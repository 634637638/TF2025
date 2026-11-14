'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { validId, moneyCents } = require('../src/utils/sale-input')
const { normalizeCheckoutGoods } = require('../src/utils/checkout-goods-input')
const SalesGoodsReturnService = require('../src/services/sales-goods-return.service')

const invalidNumbers = ['1\n', '1e0', '0x1', '1元', ' ', '-0', -1, '-1', true, false, {}, [], NaN, Infinity]

test('销售公共金额与ID拒绝尾随换行及混输，保留已有金额范围和分币浮点容差', () => {
  for (const value of invalidNumbers) {
    assert.equal(validId(value), false)
    assert.equal(moneyCents(value), null)
  }
  for (const value of ['0', 0, '00']) assert.equal(moneyCents(value), 0)
  assert.equal(moneyCents('0.01'), 1)
  assert.equal(moneyCents(0.1 + 0.2), 30)
  assert.equal(moneyCents('1.001'), null)
  assert.equal(moneyCents('99999999.99'), 9999999999)
  assert.equal(moneyCents('100000000'), null)
  assert.equal(validId('01'), true)
  assert.equal(validId(2147483648), false)
})

test('共同结算数量及积分复用公共完整整数，合法载荷与旧省略语义保持', () => {
  const base = { key: 'item', accessory_id: 1, quantity: 1, unit_price: 0.01, sale_type: 'sale' }
  const options = { normalizeSerials: () => [] }
  for (const value of invalidNumbers) {
    for (const field of ['accessory_id', 'quantity', 'redeem_points', 'unit_price']) {
      assert.throws(() => normalizeCheckoutGoods([{ ...base, [field]: value }], options), { statusCode: 400 })
    }
  }
  const normalized = normalizeCheckoutGoods([{ ...base, quantity: '01', redeem_points: '0' }], options)
  assert.equal(normalized.total_cents, 1)
  assert.equal(normalized.items[0].quantity, 1)
  assert.equal(Object.hasOwn(normalized.items[0], 'redeem_points'), false)
})

test('商品售后数量、明细ID及资金原文尾随换行在事务或权限查询之前拒绝', async () => {
  const service = new SalesGoodsReturnService({ repository: { withConnection() { assert.fail('非法输入不得租借事务') } },
    accessories: { normalizeSerials: () => [] }, permissionCheck() { assert.fail('非法输入不进入权限或业务查询') } })
  const actor = { id: 1, store_ids: [2] }
  const base = { request_key: 'a'.repeat(32), store_id: 2, quantity: 1, return_reason: '客户退货',
    reversal_date: '2026-11-13 12:00:00', restock_confirmed: true }
  await assert.rejects(service.quote('1\n', 2, base, actor), { statusCode: 400 })
  await assert.rejects(service.quote(1, '2\n', base, actor), { statusCode: 400 })
  await assert.rejects(service.quote(1, 2, { ...base, quantity: '1\n' }, actor), { statusCode: 400 })
  await assert.rejects(service.quote(1, 2, { ...base, settlement: { refund_amount: '1\n', collection_amount: 0, confirmed: true, method: 'cash' } }, actor), { statusCode: 400 })
})
