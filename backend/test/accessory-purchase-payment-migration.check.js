'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const { migrate, definitions } = require('../scripts/migrate-accessory-purchase-payments')
function fixture() {
  let ready = false, count = 0, conflict = false
  const writes = []
  const db = { async query(sql) {
    if (sql.includes('information_schema.TABLES')) return [ready ? [{ ENGINE: 'InnoDB' }] : []]
    if (sql.includes('information_schema.COLUMNS')) return [Object.entries(definitions).map(([name, type]) => ({ COLUMN_NAME: name, COLUMN_TYPE: conflict && name === 'amount' ? 'float' : type, IS_NULLABLE: name === 'reference_event_id' ? 'YES' : 'NO' }))]
    if (sql.includes('information_schema.STATISTICS')) return [[
      { INDEX_NAME: 'PRIMARY', COLUMN_NAME: 'id', NON_UNIQUE: 0 },
      { INDEX_NAME: 'uq_accessory_purchase_payment_request', COLUMN_NAME: 'request_key', NON_UNIQUE: 0 },
      ...['stock_in_id', 'id'].map(name => ({ INDEX_NAME: 'idx_accessory_purchase_payment_order', COLUMN_NAME: name, NON_UNIQUE: 1 })),
      ...['supplier_id', 'id'].map(name => ({ INDEX_NAME: 'idx_accessory_purchase_payment_supplier', COLUMN_NAME: name, NON_UNIQUE: 1 }))
    ]]
    if (sql.startsWith('SHOW CREATE')) return [[{ Table: 'original' }]]
    if (sql.startsWith('SELECT *')) return [[{ id: 1, original: 'unchanged' }]]
    if (sql.startsWith('SELECT COUNT')) return [[{ count }]]
    writes.push(sql); ready = sql.startsWith('CREATE TABLE'); return [{}]
  } }
  return { db, writes, occupied() { count = 1 }, conflict() { conflict = true } }
}
test('采购打款迁移预览零写入，先备份再创建，原表摘要不变，重复执行不重建', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tf-purchase-migration-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  const f = fixture()
  assert.equal((await migrate(f.db)).writes, false)
  assert.equal(f.writes.length, 0)
  await assert.rejects(migrate(f.db, { apply: true }), /backup-file/)
  await assert.rejects(migrate(f.db, { apply: true, backupFile: __filename }), { code: 'EEXIST' })
  assert.equal(f.writes.length, 0)
  const backupFile = path.join(directory, 'before.json')
  assert.equal((await migrate(f.db, { apply: true, backupFile })).originalDataUnchanged, true)
  assert.equal(Object.keys(JSON.parse(await fs.readFile(backupFile, 'utf8'))).length, 7)
  assert.equal((await fs.stat(backupFile)).mode & 0o777, 0o600)
  assert.equal((await migrate(f.db, { apply: true, backupFile })).status, 'already_ready')
  assert.equal(f.writes.length, 1)
  f.occupied()
  await assert.rejects(migrate(f.db, { rollback: true, apply: true, backupFile: path.join(directory, 'rollback.json') }), /已有采购打款历史/)
  f.conflict()
  await assert.rejects(migrate(f.db), /字段结构冲突/)
})
test('空采购打款表回退仍先备份，禁止破坏既有采购及库存', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tf-purchase-rollback-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  const f = fixture()
  await migrate(f.db, { apply: true, backupFile: path.join(directory, 'before.json') })
  assert.equal((await migrate(f.db, { rollback: true })).writes, false)
  assert.equal((await migrate(f.db, { rollback: true, apply: true, backupFile: path.join(directory, 'rollback.json') })).originalDataUnchanged, true)
  assert.deepEqual(f.writes.map(sql => sql.split(' ').slice(0, 3).join(' ')), ['CREATE TABLE accessory_purchase_payments', 'DROP TABLE accessory_purchase_payments'])
})
