'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const { migrate, definitions, indexes, references } = require('../scripts/migrate-film-services')

function fixture() {
  const state = { flag: false, table: false, writes: [], services: [], failure: null, override: {},
    types: { sales_orders: 'bigint unsigned', customers: 'int', sales: 'int unsigned', stores: 'int', users: 'int unsigned' },
    categories: [{ id: 1, name: '钢化膜', description: '原说明', sort_order: 0, status: 1 }] }
  const columns = () => Object.entries(definitions(state.types)).map(([name, [type, nullable, defaultValue, extra]]) => ({
    TABLE_NAME: 'customer_film_services', COLUMN_NAME: name, COLUMN_TYPE: type, IS_NULLABLE: nullable,
    COLUMN_DEFAULT: defaultValue, EXTRA: extra }))
  const keys = () => Object.entries(indexes).flatMap(([name, fields]) => fields.map((field, index) => ({
    INDEX_NAME: name, COLUMN_NAME: field, SEQ_IN_INDEX: index + 1, NON_UNIQUE: name === 'idx_film_customer' ? 1 : 0, SUB_PART: null })))
  const foreign = () => Object.entries(references).map(([name, [parent, column]]) => ({
    CONSTRAINT_NAME: `fk_film_${name}`, COLUMN_NAME: name, REFERENCED_TABLE_NAME: parent, REFERENCED_COLUMN_NAME: column,
    ORDINAL_POSITION: 1, DELETE_RULE: 'RESTRICT', UPDATE_RULE: 'RESTRICT' }))
  const db = { async query(sql) {
    if (sql.includes('information_schema.TABLES')) return [[...Object.keys(state.types), 'accessory_categories',
      ...(state.table ? ['customer_film_services'] : [])].filter(name => name !== state.override.missingParent)
      .map(name => ({ TABLE_NAME: name, ENGINE: state.override.engine || 'InnoDB' }))]
    if (sql.includes("COLUMN_NAME IN ('phone_id','model_id','phone_snapshot')")) return [state.extensions || []]
    if (sql.includes('information_schema.COLUMNS')) return [[...Object.entries(state.types).map(([name, type]) => ({
      TABLE_NAME: name, COLUMN_NAME: 'id', COLUMN_TYPE: type })), ...(state.flag ? [{ TABLE_NAME: 'accessory_categories',
      COLUMN_NAME: 'film_enabled', COLUMN_TYPE: 'tinyint(1)', IS_NULLABLE: 'NO', COLUMN_DEFAULT: '0', EXTRA: '', ...state.override.flag }] : []),
    ...(state.table ? state.override.columns || columns() : [])]]
    if (sql.includes('information_schema.STATISTICS')) return [state.override.keys || keys()]
    if (sql.includes('information_schema.KEY_COLUMN_USAGE')) return [state.override.foreign || foreign()]
    if (sql === 'SELECT * FROM accessory_categories ORDER BY id') return [state.categories.map(row => ({ ...row }))]
    if (sql === 'SELECT * FROM customer_film_services ORDER BY id') return [structuredClone(state.services)]
    if (sql.startsWith('SHOW CREATE TABLE')) return [[{ Table: sql.split(' ').at(-1), 'Create Table': `${sql} (...)` }]]
    if (state.failure && sql.startsWith(state.failure)) throw new Error('ddl-failed')
    if (sql.startsWith('ALTER TABLE accessory_categories ADD')) {
      state.flag = true; state.categories.forEach(row => { row.film_enabled = 0 })
    } else if (sql.startsWith('ALTER TABLE accessory_categories DROP')) {
      state.flag = false; state.categories.forEach(row => { delete row.film_enabled })
    } else if (sql.startsWith('CREATE TABLE customer_film_services')) {
      for (const [field, [parent]] of Object.entries(references)) assert.ok(sql.includes(`${field} ${state.types[parent].toUpperCase()}`))
      assert.match(sql, /UNIQUE KEY uq_film_order \(order_id\)/)
      assert.match(sql, /ON DELETE RESTRICT ON UPDATE RESTRICT/)
      state.table = true
    } else if (sql === 'DROP TABLE customer_film_services') state.table = false
    else assert.fail(`未处理SQL：${sql}`)
    state.writes.push(sql)
    state.afterWrite?.(sql)
    return [{}]
  } }
  return { state, db, columns, keys, foreign }
}

async function temporary(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tf-film-migration-'))
  t.after(() => fs.rm(dir, { recursive: true, force: true }))
  return name => path.join(dir, name)
}

test('默认预览不写库；apply先创建0600独占备份，不覆盖已有文件，原类型不变且可幂等重入', async t => {
  const backup = await temporary(t), f = fixture()
  const preview = await migrate(f.db)
  assert.equal(preview.status, 'dry_run'); assert.equal(preview.sql.length, 2); assert.deepEqual(f.state.writes, [])
  await assert.rejects(migrate(f.db, { apply: true }), /backup-file/)
  const filename = backup('original.json')
  await fs.writeFile(filename, 'existing')
  await assert.rejects(migrate(f.db, { apply: true, backupFile: filename }), { code: 'EEXIST' })
  assert.deepEqual(f.state.writes, [])
  await fs.unlink(filename)
  assert.equal((await migrate(f.db, { apply: true, backupFile: filename })).originalDataUnchanged, true)
  const saved = JSON.parse(await fs.readFile(filename, 'utf8'))
  assert.deepEqual(saved.categories, [{ id: 1, name: '钢化膜', description: '原说明', sort_order: 0, status: 1 }])
  assert.equal((await fs.stat(filename)).mode & 0o777, 0o600)
  assert.equal(f.state.categories[0].film_enabled, 0)
  assert.deepEqual(await migrate(f.db, { apply: true, backupFile: filename }), { status: 'already_ready', writes: false })
  assert.equal(f.state.writes.length, 2)
})

test('所有外键沿用真实父键signed/unsigned类型；不兼容类型或前置表缺失时零写入拒绝', async () => {
  const f = fixture(), result = await migrate(f.db)
  assert.match(result.sql[1], /customer_id INT NOT NULL/)
  assert.match(result.sql[1], /qualification_sale_id INT UNSIGNED NULL/)
  for (const type of ['varchar(20)', undefined, 'int; DROP TABLE customers']) {
    const broken = fixture(); broken.state.types.customers = type
    await assert.rejects(migrate(broken.db, { apply: true }), /父键类型不兼容/)
    assert.deepEqual(broken.state.writes, [])
  }
  const missing = fixture(); missing.state.override.missingParent = 'sales'
  await assert.rejects(migrate(missing.db), /前置表缺失/)
  assert.deepEqual(missing.state.writes, [])
})

test('引擎、布尔列、类型/空值、唯一及前缀索引、外键删除/更新规则冲突均拒绝覆盖', async () => {
  const variants = [f => { f.state.override.engine = 'MyISAM' },
    f => { f.state.override.flag = { COLUMN_TYPE: 'int' } }, f => { f.state.override.flag = { COLUMN_DEFAULT: '1' } },
    f => { f.state.override.flag = { IS_NULLABLE: 'YES' } },
    f => { f.state.override.columns = f.columns().slice(1) },
    f => { f.state.override.columns = f.columns().map(row => row.COLUMN_NAME === 'quantity' ? { ...row, COLUMN_TYPE: 'int' } : row) },
    f => { f.state.override.columns = f.columns().map(row => row.COLUMN_NAME === 'order_id' ? { ...row, IS_NULLABLE: 'YES' } : row) },
    f => { f.state.override.keys = f.keys().map(row => row.INDEX_NAME === 'uq_film_order' ? { ...row, NON_UNIQUE: 1 } : row) },
    f => { f.state.override.keys = f.keys().map(row => row.INDEX_NAME === 'uq_film_order' ? { ...row, SUB_PART: 5 } : row) },
    f => { f.state.override.keys = f.keys().map(row => row.INDEX_NAME === 'idx_film_customer' ? { ...row, SEQ_IN_INDEX: 3 } : row) },
    f => { f.state.override.foreign = f.foreign().slice(1) },
    f => { f.state.override.foreign = f.foreign().map(row => ({ ...row, DELETE_RULE: 'CASCADE' })) },
    f => { f.state.override.foreign = f.foreign().map(row => ({ ...row, UPDATE_RULE: 'CASCADE' })) },
    f => { f.state.override.foreign = f.foreign().map(row => ({ ...row, REFERENCED_TABLE_NAME: 'phones' })) }]
  for (const change of variants) {
    const f = fixture(); f.state.flag = f.state.table = true; change(f)
    await assert.rejects(migrate(f.db, { apply: true }), /贴膜|film_enabled/)
    assert.deepEqual(f.state.writes, [])
  }
})

test('DDL中断保留完整备份；新备份重入仅补缺失结构，原数据保持且不猜历史服务', async t => {
  const backup = await temporary(t), f = fixture()
  f.state.failure = 'CREATE TABLE'
  await assert.rejects(migrate(f.db, { apply: true, backupFile: backup('failed.json') }), /ddl-failed/)
  assert.equal(f.state.flag, true); assert.equal(f.state.table, false)
  assert.equal(JSON.parse(await fs.readFile(backup('failed.json'), 'utf8')).categories[0].name, '钢化膜')
  f.state.failure = null
  await migrate(f.db, { apply: true, backupFile: backup('resume.json') })
  assert.equal(f.state.writes.length, 2)
  assert.deepEqual(f.state.services, [])
})

test('启用标记或已有服务事实时禁止回退及缺失结构重建；空结构回退同样要求备份且可重入', async t => {
  const backup = await temporary(t)
  for (const history of [false, true]) {
    const f = fixture(); f.state.flag = f.state.table = true; f.state.categories[0].film_enabled = history ? 0 : 1
    if (history) f.state.services.push({ id: 1, order_id: 9 })
    await assert.rejects(migrate(f.db, { rollback: true, apply: true, backupFile: backup(`denied-${history}.json`) }), /已有贴膜/)
    assert.deepEqual(f.state.writes, [])
    if (!history) { f.state.table = false; await assert.rejects(migrate(f.db), /已有贴膜/) }
  }
  const f = fixture()
  await migrate(f.db, { apply: true, backupFile: backup('create.json') })
  const preview = await migrate(f.db, { rollback: true })
  assert.equal(preview.sql.length, 2); assert.equal(f.state.writes.length, 2)
  await assert.rejects(migrate(f.db, { rollback: true, apply: true }), /backup-file/)
  await migrate(f.db, { rollback: true, apply: true, backupFile: backup('rollback.json') })
  assert.equal(f.state.flag, false); assert.equal(f.state.table, false)
  assert.equal('film_enabled' in f.state.categories[0], false)
  assert.deepEqual(await migrate(f.db, { rollback: true }), { status: 'already_ready', writes: false })
})

test('迁移期间原类型变化或服务写入必须报核验失败并保留备份，不自动回删新事实', async t => {
  const backup = await temporary(t)
  for (const field of ['name', 'film_enabled', 'services']) {
    const f = fixture()
    f.state.afterWrite = sql => {
      if (!sql.startsWith('CREATE TABLE')) return
      if (field === 'services') f.state.services.push({ id: 1, order_id: 9 })
      else f.state.categories[0][field] = field === 'name' ? '并发修改' : 1
    }
    await assert.rejects(migrate(f.db, { apply: true, backupFile: backup(`${field}.json`) }), /变化|出现贴膜服务/)
    assert.equal(f.state.table, true); assert.equal(f.state.flag, true)
    assert.equal(JSON.parse(await fs.readFile(backup(`${field}.json`), 'utf8')).categories[0].name, '钢化膜')
  }
})


test('旧贴膜迁移兼容已登记设备关联扩展，但不能先于扩展回退或忽略未知字段', async () => {
  const f = fixture(); f.state.flag = f.state.table = true
  f.state.extensions = ['phone_id', 'model_id', 'phone_snapshot'].map(COLUMN_NAME => ({ COLUMN_NAME }))
  f.state.override.columns = [...f.columns(), ...f.state.extensions.map(row => ({ ...row, TABLE_NAME: 'customer_film_services' }))]
  assert.equal((await migrate(f.db)).status, 'already_ready')
  await assert.rejects(migrate(f.db, { rollback: true }), /先按受控流程回退贴膜模板匹配扩展/)
  f.state.override.columns.push({ TABLE_NAME: 'customer_film_services', COLUMN_NAME: 'unknown' })
  await assert.rejects(migrate(f.db), /字段数量不一致/)
  assert.deepEqual(f.state.writes, [])
})
