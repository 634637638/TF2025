'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { migrate } = require('../scripts/migrate-accessory-template-colors')
const { table, definitions, indexes } = require('../src/utils/accessory-template-color-schema')

function fixture({ present = false, engine = 'InnoDB', fields = rows => rows, keys = rows => rows } = {}) {
  let exists = present, used = 0
  const writes = []
  const db = { async query(sql) {
    if (sql.includes('information_schema.TABLES')) return [[
      { TABLE_NAME: 'accessories', ENGINE: 'InnoDB' }, { TABLE_NAME: 'colors', ENGINE: 'InnoDB' },
      ...(exists ? [{ TABLE_NAME: table, ENGINE: engine }] : [])
    ]]
    if (sql.includes('information_schema.COLUMNS')) return [fields(Object.entries(definitions).map(([COLUMN_NAME, COLUMN_TYPE]) => ({ COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE: 'NO', COLUMN_DEFAULT: COLUMN_NAME === 'created_at' ? 'CURRENT_TIMESTAMP' : null })))]
    if (sql.includes('information_schema.STATISTICS')) return [keys(Object.entries(indexes).flatMap(([INDEX_NAME, columns]) => columns.map((COLUMN_NAME, i) => ({ INDEX_NAME, COLUMN_NAME,
      NON_UNIQUE: 0, SEQ_IN_INDEX: i + 1, SUB_PART: null }))))]
    if (sql.startsWith('SELECT COUNT')) return [[{ count: used }]]
    if (sql.startsWith('SHOW CREATE TABLE')) return [[{ Table: sql.split(' ').at(-1), 'Create Table': 'original schema' }]]
    if (sql.startsWith('CREATE TABLE')) exists = true
    else if (sql.startsWith('DROP TABLE')) exists = false
    else throw new Error('未声明的迁移语句')
    writes.push(sql); return [{}]
  } }
  return { db, writes, use() { used++ } }
}

test('颜色结构默认只读，显式应用要求摘要文件，创建空表并独立校验且可重复预览', async t => {
  const f = fixture(), directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tf-template-colors-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  const preview = await migrate(f.db)
  assert.equal(preview.status, 'dry_run'); assert.equal(preview.writes, false); assert.equal(f.writes.length, 0)
  await assert.rejects(migrate(f.db, { apply: true }), /backup-file/)
  const backupFile = path.join(directory, 'before.json')
  const result = await migrate(f.db, { apply: true, backupFile })
  assert.equal(result.status, 'migrated_and_verified')
  assert.equal(f.writes.length, 1); assert.match(f.writes[0], /^CREATE TABLE accessory_template_colors/)
  assert.equal((await fs.stat(backupFile)).mode & 0o777, 0o600)
  assert.deepEqual(Object.keys(JSON.parse(await fs.readFile(backupFile, 'utf8')).schema), ['accessories', 'colors'])
  assert.equal((await migrate(f.db)).status, 'already_ready')
  f.use(); await assert.rejects(migrate(f.db, { rollback: true }), /已有颜色规格/)
})

test('已有摘要拒绝覆盖，空表回退需显式应用并保存新摘要', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tf-template-colors-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  const backupFile = path.join(directory, 'before.json')
  await fs.writeFile(backupFile, 'original')
  const f = fixture()
  await assert.rejects(migrate(f.db, { apply: true, backupFile }), { code: 'EEXIST' })
  assert.deepEqual(f.writes, []); assert.equal(await fs.readFile(backupFile, 'utf8'), 'original')
  const existing = fixture({ present: true })
  assert.equal((await migrate(existing.db, { rollback: true })).writes, false)
  assert.equal(existing.writes.length, 0)
  const result = await migrate(existing.db, { rollback: true, apply: true, backupFile: path.join(directory, 'rollback.json') })
  assert.equal(result.status, 'migrated_and_verified'); assert.deepEqual(existing.writes, [`DROP TABLE ${table}`])
})

test('颜色结构引擎、字段及唯一约束冲突拒绝覆盖', async () => {
  for (const options of [{ engine: 'MyISAM' }, { fields: rows => rows.slice(1) },
    { fields: rows => rows.map(row => ({ ...row, COLUMN_DEFAULT: null })) },
    { fields: rows => rows.map(row => ({ ...row, IS_NULLABLE: 'YES' })) },
    { keys: rows => rows.map(row => ({ ...row, NON_UNIQUE: 1 })) },
    { keys: rows => rows.map(row => ({ ...row, SUB_PART: 5 })) },
    { keys: rows => [...rows, { INDEX_NAME: 'wrong_unique', COLUMN_NAME: 'template_id', NON_UNIQUE: 0, SEQ_IN_INDEX: 1, SUB_PART: null }] }]) {
    const f = fixture({ present: true, ...options })
    await assert.rejects(migrate(f.db, { apply: true }), { code: 'TEMPLATE_COLOR_SCHEMA_CONFLICT' })
    assert.deepEqual(f.writes, [])
  }
})
