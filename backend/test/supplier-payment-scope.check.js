'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const sharedService = require('../src/services/supplier-payment.service')

const fixture = (phones) => {
  const events = [], reads = []
  const connection = {
    async beginTransaction() { events.push('begin') },
    async execute(sql, params) {
      if (/SELECT/.test(sql)) { reads.push({ sql, params }); return [phones] }
      events.push('write')
      return [{ affectedRows: 1 }]
    },
    async commit() { events.push('commit') },
    async rollback() { events.push('rollback') },
    release() { events.push('release') }
  }
  const service = Object.create(sharedService)
  service.database = () => ({ getConnection: async () => connection,
    async execute(sql, params) { reads.push({ sql, params }); return [[]] } })
  service.ensureSchema = async () => {}
  return { service, events, reads }
}

test('手机供应商付款、取消与编辑逐台检查来源门店，混入越界手机整单回滚', async () => {
  const phone = { id: 1, store_id: 2, supplier_id: 3, status: 'in_stock', purchase_cost: 80 }
  const actor = { id: 7, store_ids: [1] }
  for (const method of ['batchPayment', 'batchCancelPayment', 'singlePayment', 'updatePayment']) {
    const f = fixture([phone])
    await assert.rejects(f.service[method]({ actor, phone_ids: [1], phone_id: 1,
      payment_method: 'cash', payment_time: '2026-11-17 12:00:00', operator_id: 7 }), { statusCode: 403 })
    assert.deepEqual(f.events, ['begin', 'rollback', 'release'])
  }
  const f = fixture([{ ...phone, store_id: 1 }, { ...phone, id: 2 }])
  await assert.rejects(f.service.batchPayment({ actor, phone_ids: [1, 2], payment_method: 'cash',
    payment_time: '2026-11-17 12:00:00', operator_id: 7 }), { statusCode: 403 })
  assert.deepEqual(f.events, ['begin', 'rollback', 'release'])
})

test('付款统计、列表与批次明细均按采购门店范围读取，空绑定生成空范围', async () => {
  const actor = { id: 7, store_ids: [1, 3] }
  const f = fixture([])
  await f.service.getStatistics({}, actor)
  await f.service.getSummaryStatistics({}, actor)
  await f.service.getPhones({}, actor)
  await f.service.getPaymentBatchDetails(8, '2026-11-17 12:00:00', null, actor)
  assert.ok(f.reads.length >= 4)
  for (const call of f.reads) {
    assert.match(call.sql, /p\.store_id IN \(\?, \?\)/)
    assert.equal((call.sql.match(/\?/g) || []).length, call.params.length)
  }
  f.reads.length = 0
  await f.service.getStatistics({}, { id: 7, store_ids: [] })
  assert.match(f.reads[0].sql, /1 = 0/)
  await assert.rejects(f.service.getPhones({ store_id: 2 }, actor), { statusCode: 403 })
})
