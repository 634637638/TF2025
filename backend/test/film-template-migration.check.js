'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const { migrate, parseArgs } = require('../scripts/migrate-film-template-matching')
const { additions } = require('../src/utils/film-template-schema')

function fixture() {
  const fields = [], writes = [], rows = { accessories: [{ id: 1, name: '原膜', updated_at: '原时间' }], customer_film_services: [{ id: 2, quantity: 3 }] }
  const state = { fields, writes, rows, mutateFields: value => value, missing: null }
  const db = { async query(sql) {
    if (sql.includes('information_schema.TABLES')) return [[...['accessories', 'customer_film_services', 'accessory_categories', 'accessory_compatible_models', 'accessory_template_colors']]
      .filter(name => name !== state.missing).map(TABLE_NAME => ({ TABLE_NAME, ENGINE: 'InnoDB' }))]
    if (sql.includes('information_schema.COLUMNS')) return [state.mutateFields(structuredClone(fields))]
    if (sql.startsWith('SHOW CREATE TABLE')) return [[{ 'Create Table': sql }]]
    const select = sql.match(/^SELECT \* FROM (\w+) ORDER BY id$/)
    if (select) { state.onRead?.(); return [structuredClone(rows[select[1]])] }
    const used = sql.match(/^SELECT COUNT\(\*\) AS count FROM (\w+) WHERE (\w+) (<> 0|IS NOT NULL)$/)
    if (used) return [[{ count: rows[used[1]].filter(row => used[3] === '<> 0' ? row[used[2]] !== 0 : row[used[2]] !== null).length }]]
    if (state.fail && sql.includes(state.fail)) throw new Error('ddl-failed')
    const add = sql.match(/^ALTER TABLE (\w+) ADD COLUMN (\w+) (.+)$/)
    const drop = sql.match(/^ALTER TABLE (\w+) DROP COLUMN (\w+)$/)
    if (add) {
      const [, table, name] = add, flag = table === 'accessories'
      fields.push({ TABLE_NAME: table, COLUMN_NAME: name, COLUMN_TYPE: flag ? 'tinyint(1)' : name === 'phone_snapshot' ? 'json' : 'bigint',
        IS_NULLABLE: flag ? 'NO' : 'YES', COLUMN_DEFAULT: flag ? '0' : null, EXTRA: '' })
      rows[table].forEach(row => { row[name] = flag ? 0 : null })
    } else if (drop) {
      const [, table, name] = drop
      fields.splice(fields.findIndex(row => row.TABLE_NAME === table && row.COLUMN_NAME === name), 1)
      rows[table].forEach(row => { delete row[name] })
    } else assert.fail(`未声明的SQL: ${sql}`)
    writes.push(sql); return [{}]
  } }
  return { state, db }
}
async function temporary(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tf-film-template-'))
  t.after(() => fs.rm(dir, { recursive: true, force: true }))
  return name => path.join(dir, name)
}

test('贴膜匹配默认仅预览5列，不新建业务表、不回填旧类型；apply必须独占0600摘要并核对原数据', async t => {
  const backup = await temporary(t), f = fixture(), before = structuredClone(f.state.rows)
  const preview = await migrate(f.db)
  assert.equal(preview.status, 'dry_run'); assert.equal(preview.writes, false); assert.equal(preview.sql.length, 5)
  assert.ok(preview.sql.every(sql => sql.startsWith('ALTER TABLE '))); assert.deepEqual(f.state.writes, [])
  await assert.rejects(migrate(f.db, { apply: true }), /backup-file/)
  const backupFile = backup('before.json')
  const result = await migrate(f.db, { apply: true, backupFile })
  assert.equal(result.originalDataUnchanged, true); assert.equal(f.state.writes.length, 5)
  assert.equal((await fs.stat(backupFile)).mode & 0o777, 0o600)
  for (const table of Object.keys(before)) for (const row of f.state.rows[table]) {
    for (const [field, value] of Object.entries(before[table][0])) assert.deepEqual(row[field], value)
    for (const field of Object.keys(additions[table])) assert.equal(row[field], table === 'accessories' ? 0 : null)
  }
  assert.deepEqual(await migrate(f.db), { status: 'already_ready', writes: false })
})

test('已有摘要不覆盖、结构冲突或颜色前置缺失拒绝写入；未知参数在读取环境前拒绝', async t => {
  const backup = await temporary(t), backupFile = backup('existing.json')
  await fs.writeFile(backupFile, 'existing')
  const f = fixture()
  await assert.rejects(migrate(f.db, { apply: true, backupFile }), { code: 'EEXIST' })
  assert.deepEqual(f.state.writes, [])
  f.state.missing = 'accessory_template_colors'
  await assert.rejects(migrate(f.db), /前置表缺失/)
  assert.deepEqual(f.state.writes, [])
  for (const args of [['--apply=true'], ['--apply', '--apply'], ['--backup-file='], ['--backup-file=a', '--backup-file=b'], ['--bad']]) assert.throws(() => parseArgs(args), /参数无效/)
  assert.deepEqual(parseArgs(['--apply', '--backup-file=record.json']), { apply: true, rollback: false, backupFile: 'record.json' })
})

test('部分DDL失败后仅补缺列，类型/空值/默认值/生成属性冲突不被忽略', async t => {
  const backup = await temporary(t), f = fixture()
  f.state.fail = 'ADD COLUMN model_id'
  await assert.rejects(migrate(f.db, { apply: true, backupFile: backup('partial.json') }), /ddl-failed/)
  assert.equal(f.state.fields.length, 3)
  f.state.fail = null
  assert.equal((await migrate(f.db)).sql.length, 2)
  await migrate(f.db, { apply: true, backupFile: backup('resume.json') })
  for (const conflict of [{ COLUMN_TYPE: 'int' }, { IS_NULLABLE: 'YES' }, { COLUMN_DEFAULT: '1' }, { EXTRA: 'VIRTUAL GENERATED' }]) {
    f.state.mutateFields = rows => rows.map((row, index) => index ? row : { ...row, ...conflict })
    await assert.rejects(migrate(f.db, { apply: true }), /结构冲突/)
    assert.equal(f.state.writes.length, 5)
  }
})

test('模板已配置或新服务关联存在即阻止回退；全为默认值才允许备份后回退，旧业务数据保留', async t => {
  const backup = await temporary(t), f = fixture()
  await migrate(f.db, { apply: true, backupFile: backup('create.json') })
  for (const [table, definitions] of Object.entries(additions)) for (const field of Object.keys(definitions)) {
    const original = f.state.rows[table][0][field]
    f.state.rows[table][0][field] = table === 'accessories' ? 1 : field === 'phone_snapshot' ? '{}' : 11
    await assert.rejects(migrate(f.db, { rollback: true }), /禁止删除扩展结构/)
    assert.equal(f.state.writes.length, 5)
    f.state.rows[table][0][field] = original
  }
  assert.equal((await migrate(f.db, { rollback: true })).writes, false)
  await assert.rejects(migrate(f.db, { rollback: true, apply: true }), /backup-file/)
  await migrate(f.db, { rollback: true, apply: true, backupFile: backup('rollback.json') })
  assert.equal(f.state.fields.length, 0); assert.equal(f.state.rows.accessories[0].name, '原膜')
})
