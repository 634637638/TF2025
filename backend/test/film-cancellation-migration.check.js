'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { migrate, definitions, indexes, references } = require('../scripts/migrate-film-cancellations')

const table = 'customer_film_cancellations'

/** 迁移元数据和DDL替身，不连接云端；原表数据只用于摘要守恒及并发变化验证。 */
function fixture() {
  const state = { exists: false, writes: [], override: {}, failure: false,
    types: { customer_film_services: 'bigint unsigned', sales_aftersales: 'int' },
    data: { customer_film_services: [{ id: 3, order_id: 4, quantity: 2 }],
      sales_aftersales: [{ id: 8, order_id: 5, remarks: '原售后' }], [table]: [] } }
  const columns = () => Object.entries(definitions(state.types)).map(([name, type]) => ({ TABLE_NAME: table,
    COLUMN_NAME: name, COLUMN_TYPE: type, IS_NULLABLE: 'NO', COLUMN_DEFAULT: null, EXTRA: name === 'id' ? 'auto_increment' : '' }))
  const keys = () => Object.entries(indexes).flatMap(([name, fields]) => fields.map((field, index) => ({
    INDEX_NAME: name, COLUMN_NAME: field, SEQ_IN_INDEX: index + 1, NON_UNIQUE: 0, SUB_PART: null })))
  const foreign = () => Object.entries(references).map(([name, [parent, field]]) => ({ CONSTRAINT_NAME: `fk_film_cancel_${name}`,
    COLUMN_NAME: name, REFERENCED_TABLE_NAME: parent, REFERENCED_COLUMN_NAME: field, ORDINAL_POSITION: 1,
    DELETE_RULE: 'RESTRICT', UPDATE_RULE: 'RESTRICT' }))
  const db = { async query(sql) {
    if (sql.includes('information_schema.TABLES')) return [[...Object.keys(state.types), ...(state.exists ? [table] : [])]
      .filter(name => name !== state.override.missing).map(name => ({ TABLE_NAME: name,
        ENGINE: state.override.engines?.[name] || 'InnoDB' }))]
    if (sql.includes('information_schema.COLUMNS')) return [[...Object.entries(state.types).map(([name, type]) => ({
      TABLE_NAME: name, COLUMN_NAME: 'id', COLUMN_TYPE: type, IS_NULLABLE: state.override.parentNullable || 'NO' })),
    ...(state.exists ? state.override.columns || columns() : [])]]
    if (sql.includes('information_schema.STATISTICS')) return [state.override.keys || keys()]
    if (sql.includes('information_schema.KEY_COLUMN_USAGE')) return [state.override.foreign || foreign()]
    if (sql === `SELECT COUNT(*) AS count FROM ${table}`) return [[{ count: state.data[table].length }]]
    if (sql.startsWith('SELECT * FROM ')) {
      const name = sql.split(' ')[3], rows = structuredClone(state.data[name])
      assert.ok(rows, `未识别表：${name}`)
      state.afterRead?.(name)
      return [rows]
    }
    if (sql.startsWith('SHOW CREATE TABLE ')) {
      const name = sql.split(' ').at(-1)
      state.afterSchema?.(name)
      return [[{ Table: name, 'Create Table': `${sql} (...)` }]]
    }
    if (sql.startsWith(`CREATE TABLE ${table}`)) {
      if (state.failure) throw new Error('ddl-failed')
      assert.match(sql, /id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT/)
      assert.match(sql, /service_id BIGINT UNSIGNED NOT NULL/)
      assert.match(sql, /aftersale_id INT NOT NULL/)
      assert.match(sql, /actually_used TINYINT NOT NULL/)
      assert.match(sql, /reason VARCHAR\(200\) NOT NULL/)
      assert.match(sql, /UNIQUE KEY uq_film_cancel_service \(service_id\)/)
      assert.match(sql, /UNIQUE KEY uq_film_cancel_aftersale \(aftersale_id\)/)
      assert.equal((sql.match(/ON DELETE RESTRICT ON UPDATE RESTRICT/g) || []).length, 2)
      state.exists = true
    } else if (sql === `DROP TABLE ${table}`) state.exists = false
    else assert.fail(`未处理SQL：${sql}`)
    state.writes.push(sql)
    state.afterWrite?.()
    return [{}]
  } }
  return { state, db, columns, keys, foreign }
}

async function temporary(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tf-film-cancellation-'))
  t.after(() => fs.rm(dir, { recursive: true, force: true }))
  return name => path.join(dir, name)
}

test('贴膜撤销默认只读预览，执行要求独占0600备份，父表原记录守恒且可幂等重入', async t => {
  const backup = await temporary(t), f = fixture(), before = structuredClone(f.state.data)
  const preview = await migrate(f.db)
  assert.equal(preview.status, 'dry_run'); assert.equal(preview.writes, false)
  assert.equal(preview.sql.length, 1); assert.deepEqual(f.state.writes, [])
  await assert.rejects(migrate(f.db, { apply: true }), /backup-file/)
  const filename = backup('create.json')
  await fs.writeFile(filename, 'existing')
  await assert.rejects(migrate(f.db, { apply: true, backupFile: filename }), { code: 'EEXIST' })
  assert.deepEqual(f.state.writes, [])
  await fs.unlink(filename)
  assert.equal((await migrate(f.db, { apply: true, backupFile: filename })).originalDataUnchanged, true)
  assert.equal((await fs.stat(filename)).mode & 0o777, 0o600)
  const saved = JSON.parse(await fs.readFile(filename, 'utf8'))
  assert.equal(saved.tables.customer_film_services.count, 1)
  assert.equal(saved.tables.sales_aftersales.count, 1)
  assert.deepEqual(Object.keys(saved.schemas), ['customer_film_services', 'sales_aftersales'])
  assert.deepEqual(f.state.data, before)
  assert.deepEqual(await migrate(f.db, { apply: true, backupFile: filename }), { status: 'already_ready', writes: false })
  assert.equal(f.state.writes.length, 1)
})

test('父键沿用真实signed/unsigned整数类型，不兼容类型、可空键及缺表均零写入拒绝', async () => {
  for (const type of ['int(11)', 'bigint(20) unsigned', 'smallint unsigned']) {
    const f = fixture(); f.state.types.sales_aftersales = type
    const result = await migrate(f.db)
    assert.ok(result.sql[0].includes(`aftersale_id ${type.replace(/\(\d+\)/, '').toUpperCase()} NOT NULL`))
  }
  for (const change of [f => { f.state.types.sales_aftersales = 'varchar(10)' },
    f => { f.state.types.customer_film_services = 'int; DROP TABLE sales' },
    f => { f.state.override.parentNullable = 'YES' }, f => { f.state.override.missing = 'sales_aftersales' },
    f => { f.state.override.engines = { customer_film_services: 'MyISAM' } }]) {
    const f = fixture(); change(f)
    await assert.rejects(migrate(f.db, { apply: true }), /前置表|父键类型/)
    assert.deepEqual(f.state.writes, [])
  }
})

test('已有撤销表的引擎、字段、唯一索引及RESTRICT外键冲突不覆盖', async () => {
  const changes = [f => { f.state.override.engines = { [table]: 'MyISAM' } },
    f => { f.state.override.columns = f.columns().slice(1) },
    f => { f.state.override.columns = f.columns().map(row => ({ ...row, IS_NULLABLE: 'YES' })) },
    f => { f.state.override.columns = f.columns().map(row => ({ ...row, COLUMN_DEFAULT: '0' })) },
    f => { f.state.override.columns = f.columns().map(row => ({ ...row, EXTRA: '' })) },
    f => { f.state.override.columns = f.columns().map(row => row.COLUMN_NAME === 'service_id' ? { ...row, COLUMN_TYPE: 'int' } : row) },
    f => { f.state.override.keys = f.keys().slice(1) },
    f => { f.state.override.keys = f.keys().map(row => ({ ...row, NON_UNIQUE: 1 })) },
    f => { f.state.override.keys = f.keys().map(row => ({ ...row, SUB_PART: 1 })) },
    f => { f.state.override.keys = f.keys().map(row => ({ ...row, SEQ_IN_INDEX: 2 })) },
    f => { f.state.override.keys = [...f.keys(), { INDEX_NAME: 'unexpected' }] },
    f => { f.state.override.foreign = f.foreign().slice(1) },
    ...['DELETE_RULE', 'UPDATE_RULE', 'REFERENCED_TABLE_NAME', 'REFERENCED_COLUMN_NAME', 'ORDINAL_POSITION'].map(field =>
      f => { f.state.override.foreign = f.foreign().map(row => ({ ...row, [field]: 'invalid' })) })]
  for (const change of changes) {
    const f = fixture(); f.state.exists = true; change(f)
    await assert.rejects(migrate(f.db, { apply: true }), /冲突/)
    assert.deepEqual(f.state.writes, [])
  }
})

test('DDL失败保留备份；恢复只建缺表，不补造服务或改写原售后', async t => {
  const backup = await temporary(t), f = fixture()
  f.state.failure = true
  await assert.rejects(migrate(f.db, { apply: true, backupFile: backup('failed.json') }), /ddl-failed/)
  assert.equal(f.state.exists, false); assert.deepEqual(f.state.writes, [])
  assert.equal(JSON.parse(await fs.readFile(backup('failed.json'), 'utf8')).tables.customer_film_services.count, 1)
  f.state.failure = false
  await migrate(f.db, { apply: true, backupFile: backup('retry.json') })
  assert.deepEqual(f.state.data[table], [])
  assert.equal(f.state.data.sales_aftersales[0].remarks, '原售后')
})

test('已有撤销事实禁止回退；空表回退仍先备份，可重复预览且不删除原服务或售后', async t => {
  const backup = await temporary(t), f = fixture(); f.state.exists = true
  f.state.data[table].push({ id: 1, service_id: 3, aftersale_id: 8, actually_used: 1, reason: '误录' })
  for (const apply of [false, true]) await assert.rejects(migrate(f.db, { rollback: true, apply }), /已有贴膜撤销/)
  assert.deepEqual(f.state.writes, [])
  f.state.data[table] = []
  assert.deepEqual((await migrate(f.db, { rollback: true })).sql, [`DROP TABLE ${table}`])
  await assert.rejects(migrate(f.db, { rollback: true, apply: true }), /backup-file/)
  await migrate(f.db, { rollback: true, apply: true, backupFile: backup('rollback.json') })
  assert.equal(f.state.exists, false)
  const saved = JSON.parse(await fs.readFile(backup('rollback.json'), 'utf8'))
  assert.equal(saved.tables[table].count, 0); assert.ok(saved.schemas[table])
  assert.equal(f.state.data.customer_film_services.length, 1); assert.equal(f.state.data.sales_aftersales.length, 1)
  assert.deepEqual(await migrate(f.db, { rollback: true }), { status: 'already_ready', writes: false })
})

test('备份期间原表或撤销事实变化须在DDL前停止，回退不能删除新撤销记录', async t => {
  const backup = await temporary(t)
  for (const rollback of [false, true]) {
    const f = fixture(); f.state.exists = rollback
    f.state.afterSchema = name => {
      if (name === 'sales_aftersales') {
        if (rollback) f.state.data[table].push({ id: 1, service_id: 3, aftersale_id: 8 })
        else f.state.data.customer_film_services[0].quantity++
      }
    }
    await assert.rejects(migrate(f.db, { apply: true, rollback, backupFile: backup(`${rollback}.json`) }), /备份期间/)
    assert.deepEqual(f.state.writes, []); assert.equal(f.state.exists, rollback)
    assert.ok(JSON.parse(await fs.readFile(backup(`${rollback}.json`), 'utf8')).tables)
  }
})

test('DDL后原服务或售后变化及新增撤销事实均报失败，不自动回删已发生事实', async t => {
  const backup = await temporary(t)
  for (const name of ['customer_film_services', 'sales_aftersales', table]) {
    const f = fixture()
    f.state.afterWrite = () => f.state.data[name].push({ id: 99 })
    await assert.rejects(migrate(f.db, { apply: true, backupFile: backup(`${name}.json`) }), /变化|出现撤销记录/)
    assert.equal(f.state.exists, true); assert.equal(f.state.writes.length, 1)
    assert.ok(f.state.data[name].some(row => row.id === 99))
  }
})

test('未知或重复CLI参数在读取真实配置及连接数据库前拒绝', () => {
  for (const args of [['--unknown'], ['--apply', '--apply'], ['--backup-file='], ['--backup-file=a', '--backup-file=b']]) {
    const result = spawnSync(process.execPath, [path.resolve(__dirname, '../scripts/migrate-film-cancellations.js'), ...args],
      { encoding: 'utf8', env: { ...process.env, ENV_FILE: 'test/missing-unit-env' } })
    assert.equal(result.status, 1); assert.equal(result.stdout, '')
    assert.match(result.stderr, /仅支持/)
  }
})
