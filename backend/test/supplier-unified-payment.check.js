'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const Service = require('../src/services/supplier-unified-payment.service')
const { migrate } = require('../scripts/migrate-supplier-payment-batches')

const actor = { id: 7, name: '经办人', store_ids: [1] }
const baseInput = (extra = {}) => ({ supplier_id: 3, phone_ids: [11], accessory_purchase_ids: [22], payment_method: 'bank_transfer', payment_time: '2026-11-18 12:00:00', actual_amount: 20000, request_key: 'a'.repeat(32), external_reference: '供应商单据20000', remarks: '', ...extra })

function fixture({ mismatch = false, failWriteAt = 0, foreignPhone = false } = {}) {
  const events = []; let writeCount = 0
  const connection = {
    async beginTransaction() { events.push('begin') },
    async commit() { events.push('commit') },
    async rollback() { events.push('rollback') },
    destroy() { events.push('destroy') },
    release() {},
    async query(sql) {
      if (/FROM supplier_payment_batches/.test(sql)) return [[]]
      if (/FROM phones/.test(sql)) return [[{ id: 11, store_id: 1, supplier_id: foreignPhone ? 4 : 3, purchase_cost: 15000 }]]
      if (/FROM accessory_stock_in/.test(sql)) return [[{ id: 22, store_id: 1, supplier_id: 3, quantity: 1, purchase_cost: mismatch ? 5000 : 5000, total_amount: mismatch ? 4000 : 5000 }]]
      if (/INSERT|UPDATE/.test(sql)) { events.push('write'); writeCount += 1; if (writeCount === failWriteAt) throw new Error('write failed'); return [{ insertId: 1, affectedRows: 1 }] }
      return [[]]
    }
  }
  const database = { async getConnection() { return connection } }
  const accessoryService = {
    paymentDetails(method, paymentTime) { return { method, paymentTime } },
    reconcilePayments: async () => ({ last: null })
  }
  return { service: new Service({ database, accessoryService }), events }
}

test('同一供应商手机和商品采购单在一个事务中合并打款', async () => {
  const f = fixture()
  const result = await f.service.create(actor, baseInput())
  assert.equal(result.expected_amount, 20000)
  assert.equal(result.phone_count, 1)
  assert.equal(result.accessory_count, 1)
  assert.deepEqual(f.events, ['begin', 'write', 'write', 'write', 'write', 'commit'])
})

test('应付金额不一致或任一写入失败会整体回滚', async () => {
  const mismatch = fixture()
  await assert.rejects(mismatch.service.create(actor, baseInput({ actual_amount: 19999 })), { code: 'PAYMENT_AMOUNT_CONFLICT' })
  assert.deepEqual(mismatch.events, ['begin', 'rollback'])
  const failed = fixture({ failWriteAt: 3 })
  await assert.rejects(failed.service.create(actor, baseInput()), /write failed/)
  assert.deepEqual(failed.events, ['begin', 'write', 'write', 'write', 'rollback'])
})

test('跨门店来源不会部分打款', async () => {
  const f = fixture()
  const connection = {
    async beginTransaction() {}, async rollback() {}, async commit() {}, destroy() {},
    release() {},
    async query(sql) {
      if (/FROM supplier_payment_batches/.test(sql)) return [[]]
      if (/FROM phones/.test(sql)) return [[{ id: 11, store_id: 2, supplier_id: 3, purchase_cost: 15000 }]]
      return [[]]
    }
  }
  f.service.database = { async getConnection() { return connection } }
  await assert.rejects(f.service.create(actor, baseInput({ accessory_purchase_ids: [] })), { code: 'STORE_SCOPE_DENIED' })
})

test('跨供应商来源拒绝登记', async () => {
  const f = fixture({ foreignPhone: true })
  await assert.rejects(f.service.create(actor, baseInput({ accessory_purchase_ids: [] })), { code: 'PAYMENT_SCOPE_CONFLICT' })
  assert.deepEqual(f.events, ['begin', 'rollback'])
})

test('旧版手机批量打款详情兼容读取并标记为可批量取消', async () => {
  const connection = {
    release() {},
    async query(sql) {
      if (/FROM supplier_payment_batches/.test(sql)) return [[]]
      if (/FROM phones/.test(sql)) return [[{
        id: 11, phone_store_id: 1, phone_supplier_id: 3, phone_store_name: '一店', supplier_name: '供应商甲',
        phone_purchase_cost: 15000, phone_payment_time: '2026-11-18 12:00:00', phone_payment_method: 'bank_transfer',
        phone_payment_remarks: '已核对', phone_payment_operator_name: '经办人'
      }]]
      throw new Error(`unexpected query: ${sql}`)
    }
  }
  const service = new Service({
    database: { async getConnection() { return connection } },
    accessoryService: { repository: { async getPurchase() { return null } } }
  })
  const result = await service.details(actor, '11111111-1111-4111-8111-111111111111')
  assert.equal(result.legacy_phone_batch, true)
  assert.equal(result.supplier_id, 3)
  assert.equal(result.expected_amount, 15000)
  assert.equal(result.lines.length, 1)
  assert.equal(result.lines[0].source_type, 'phone')
})

test('合并批次整批撤销同时处理手机与商品，任何失败均回滚', async () => {
  const run = async failAccessoryCancel => {
    const events = [], appended = []
    const connection = {
      async beginTransaction() { events.push('begin') },
      async commit() { events.push('commit') },
      async rollback() { events.push('rollback') },
      destroy() {}, release() {},
      async query(sql) {
        if (/FROM supplier_payment_batches WHERE id=\? FOR UPDATE/.test(sql)) return [[{ id: '11111111-1111-4111-8111-111111111111', supplier_id: 3, status: 'paid' }]]
        if (/FROM supplier_payment_batch_lines/.test(sql)) return [[
          { source_type: 'phone', source_id: 11, amount: 100 },
          { source_type: 'accessory', source_id: 22, amount: 100 }
        ]]
        if (/FROM phones/.test(sql)) return [[{ id: 11, store_id: 1, supplier_id: 3, purchase_cost: 100, payment_status: 'paid', payment_batch_id: '11111111-1111-4111-8111-111111111111' }]]
        if (/UPDATE phones/.test(sql)) { events.push('clear-phones'); return [{ affectedRows: 1 }] }
        if (/UPDATE supplier_payment_batches/.test(sql)) { events.push('cancel-batch'); return [{ affectedRows: 1 }] }
        throw new Error(`unexpected query: ${sql}`)
      }
    }
    const service = new Service({
      database: { async getConnection() { return connection } },
      accessoryService: {
        repository: {
          async getPurchase() { return { id: 22, supplier_id: 3, quantity: 1, purchase_cost: 100, total_amount: 100 } },
          async append(event) { if (failAccessoryCancel) throw new Error('append failed'); appended.push(event); return 9 }
        },
        async reconcilePayments() { return { last: { id: 8, action: 'pay', payment_batch_id: '11111111-1111-4111-8111-111111111111', payment_method: 'bank_transfer', payment_time: '2026-11-18 12:00:00' }, summary: { payment_status: 'paid' } } }
      }
    })
    return { service, events, appended }
  }
  const successCase = await run(false)
  const result = await successCase.service.cancel(actor, '11111111-1111-4111-8111-111111111111', { request_key: 'b'.repeat(32), remarks: '整批取消打款' })
  assert.deepEqual(result, { id: '11111111-1111-4111-8111-111111111111', replayed: false, phone_count: 1, accessory_count: 1 })
  assert.equal(successCase.appended[0].action, 'cancel')
  assert.deepEqual(successCase.events, ['begin', 'clear-phones', 'cancel-batch', 'commit'])

  const failedCase = await run(true)
  await assert.rejects(failedCase.service.cancel(actor, '11111111-1111-4111-8111-111111111111', { request_key: 'c'.repeat(32), remarks: '整批取消打款' }), /append failed/)
  assert.deepEqual(failedCase.events, ['begin', 'rollback'])
})

test('迁移 dry-run 只读取结构并保留明确的两类来源关联', async () => {
  const statements = []
  const db = { async query(sql) { statements.push(sql); return [[]] } }
  const result = await migrate(db)
  assert.equal(result.status, 'dry_run')
  assert.equal(result.writes, false)
  assert.ok(result.sql.some(sql => /CREATE TABLE supplier_payment_batches/.test(sql)))
  assert.ok(result.sql.some(sql => /CREATE TABLE supplier_payment_batch_lines/.test(sql)))
  assert.ok(result.sql.some(sql => /FOREIGN KEY \(payment_batch_id\)/.test(sql)))
  assert.ok(statements.every(sql => /information_schema/.test(sql)))
})
