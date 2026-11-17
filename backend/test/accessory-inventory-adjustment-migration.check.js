'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { migrate, definitions, indexes } = require('../scripts/migrate-accessory-inventory-adjustments')

function fixture({ present = false, engine = 'InnoDB', changeField = fields => fields, changeIndexes = keys => keys } = {}) {
  let exists = present, used = 0
  const writes = []
  const db = { async query(sql) {
    if (sql.includes('information_schema.TABLES')) {
      if (sql.includes("TABLE_NAME = 'accessory_inventory_adjustments'")) return [exists ? [{ ENGINE: engine }] : []]
      return [Array.from({ length: 3 }, () => ({ ENGINE: 'InnoDB' }))]
    }
    if (sql.includes('COLUMN_NAME = \'event_type\'')) return [[{ COLUMN_TYPE: "enum('stock_in','sale','stock_correct')" }]]
    if (sql.includes('information_schema.COLUMNS')) return [changeField(Object.entries(definitions).map(([COLUMN_NAME, COLUMN_TYPE]) => ({
      COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE: COLUMN_NAME === 'operator_name' ? 'YES' : 'NO',
      COLLATION_NAME: ['request_key', 'request_hash'].includes(COLUMN_NAME) ? 'ascii_bin' : null
    })))]
    if (sql.includes('information_schema.STATISTICS')) return [changeIndexes(Object.entries(indexes).flatMap(([INDEX_NAME, columns]) => columns.map((COLUMN_NAME, index) => ({
      INDEX_NAME, COLUMN_NAME, NON_UNIQUE: INDEX_NAME.startsWith('idx_') ? 1 : 0, SEQ_IN_INDEX: index + 1, SUB_PART: null
    }))))]
    if (sql.startsWith('SELECT * FROM')) return [[{ id: 1, quantity: 4 }]]
    if (sql.startsWith('SELECT COUNT')) return [[{ count: used }]]
    if (sql.startsWith('SHOW CREATE TABLE')) return [[{ Table: 'original', 'Create Table': 'original schema' }]]
    writes.push(sql)
    if (sql.startsWith('CREATE TABLE accessory_inventory_adjustments')) exists = true
    else if (sql.startsWith('DROP TABLE accessory_inventory_adjustments')) exists = false
    else throw new Error(`unexpected SQL ${sql}`)
    return [{}]
  } }
  return { db, writes, used() { used = 1 } }
}

test('盘点迁移默认零写入预览，显式执行先保存独占0600备份并保持原库存不变', async t => {
  const f = fixture(), directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tf-inventory-adjustment-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  const preview = await migrate(f.db)
  assert.equal(preview.status, 'dry_run')
  assert.equal(preview.writes, false)
  assert.equal(f.writes.length, 0)
  await assert.rejects(migrate(f.db, { apply: true }), /backup-file/)
  const backupFile = path.join(directory, 'before.json')
  const result = await migrate(f.db, { apply: true, backupFile })
  assert.equal(result.originalDataUnchanged, true)
  assert.equal(f.writes.length, 1)
  assert.equal((await fs.stat(backupFile)).mode & 0o777, 0o600)
  assert.equal((await migrate(f.db)).status, 'already_ready')
})

test('存在盘点审计记录时拒绝回滚', async t => {
  const f = fixture()
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tf-inventory-adjustment-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  await migrate(f.db, { apply: true, backupFile: path.join(directory, 'before.json') })
  f.used()
  await assert.rejects(migrate(f.db, { rollback: true }), /已有盘点审计记录/)
})

test('已有盘点表的引擎、字段或索引冲突时拒绝覆盖，普通批次索引保持非唯一', async t => {
  const cases = [
    { engine: 'MyISAM' },
    { changeField: fields => fields.filter(field => field.COLUMN_NAME !== 'remarks') },
    { changeField: fields => fields.map(field => field.COLUMN_NAME === 'request_key' ? { ...field, COLLATION_NAME: 'ascii_general_ci' } : field) },
    { changeIndexes: keys => keys.map(key => key.INDEX_NAME === 'uq_accessory_inventory_adjustment_request' ? { ...key, NON_UNIQUE: 1 } : key) },
    { changeIndexes: keys => keys.map(key => key.INDEX_NAME === 'idx_accessory_inventory_adjustment_batch' ? { ...key, NON_UNIQUE: 0 } : key) }
  ]
  for (const [index, options] of cases.entries()) await t.test(`冲突${index + 1}`, async () => {
    const f = fixture({ present: true, ...options })
    await assert.rejects(migrate(f.db, { apply: true }), { code: 'INVENTORY_ADJUSTMENT_SCHEMA_CONFLICT' })
    assert.deepEqual(f.writes, [])
  })
  assert.equal((await migrate(fixture({ present: true }).db)).status, 'already_ready')
})
