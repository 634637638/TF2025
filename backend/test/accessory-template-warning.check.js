'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const { migrate } = require('../scripts/migrate-accessory-template-warning')
const Service = require('../src/services/accessory.service')
const inventoryFixture = require('./helpers/accessory-inventory')
test('模板预警迁移先备份，只增加字段且可重入，保留原资料时间及金额', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tf-template-warning-'))
  t.after(() => fs.rm(dir, { recursive: true, force: true }))
  let ready = false
  const writes = []
  const original = { id: 5, name: '模板', updated_at: '2026-11-13', sale_price: '20.00' }
  const db = { async query(sql) {
    if (sql.includes('information_schema')) return [ready ? [{ COLUMN_NAME: 'min_stock', COLUMN_TYPE: 'int unsigned', IS_NULLABLE: 'NO', COLUMN_DEFAULT: '5' }] : []]
    if (sql.startsWith('SHOW')) return [[{ Table: 'accessories' }]]
    if (sql.startsWith('SELECT *')) return [[{ ...original, ...(ready ? { min_stock: 5 } : {}) }]]
    writes.push(sql); ready = true; return [{}]
  } }
  assert.equal((await migrate(db)).status, 'dry_run')
  await assert.rejects(migrate(db, { apply: true }), /backup-file/)
  await assert.rejects(migrate(db, { apply: true, backupFile: __filename }), { code: 'EEXIST' })
  assert.deepEqual(writes, [])
  const backupFile = path.join(dir, 'before.json')
  assert.equal((await migrate(db, { apply: true, backupFile })).originalDataUnchanged, true)
  assert.deepEqual(JSON.parse(await fs.readFile(backupFile, 'utf8')).rows, [original])
  assert.equal((await migrate(db, { apply: true, backupFile })).status, 'already_ready')
  assert.equal(writes.length, 1)
})
test('模板预警允许0且拒绝小数负数和超范围，入库不能覆盖模板值', async () => {
  const product = { id: 5, name: '模板', status: 1, min_stock: 3 }
  let threshold
  const connection = { async beginTransaction() {}, async commit() {}, async rollback() {} }
  const repository = {
    async withConnection(fn) { return fn(connection) },
    async getReference(id) { return { id, status: 1 } },
    async getAccessoryById() { return product }, async lockAccessory() { return product },
    async createStockInRecord() { return 1 },
    async lockStoreStock() { return null },
    async updateAccessoryStock(id, store, quantity, operation, minStock) { threshold = minStock },
    async getAccessoryStock() { return {} }
  }
  require('./helpers/accessory-stock-in')(repository, () => [])
  const service = new Service({ repository, inventoryService: inventoryFixture({}) })
  assert.equal((await service.validateProduct({ min_stock: 0 })).min_stock, 0)
  for (const value of [-1, 0.1, 10000, true, '3']) await assert.rejects(service.validateProduct({ min_stock: value }), { code: 'VALIDATION_ERROR' })
  const result = await service.stockIn({ request_key: 'a'.repeat(32), accessory_id: 5, supplier_id: 2, store_id: 1, total_quantity: 2, purchase_cost: 3, min_stock: 999 }, { id: 7, store_id: 1 })
  assert.equal(result.success, true)
  assert.equal(threshold, 3)
})
