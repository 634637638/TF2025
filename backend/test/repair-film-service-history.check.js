'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { createPlan } = require('../scripts/repair-film-service-history')

const row = (extra = {}) => ({
  order_id: 99, customer_id: 10, sale_customer_id: 10, store_id: 2, sale_store_id: 2, accessory_store_id: 2,
  operator_id: 3, sale_operator_id: 3, accessory_operator_id: 3, phone_id: 100, model_id: 20, model_name: '手机',
  snapshot_model_name: '手机', quantity: 1, accessory_quantity: 1, unit_price: 0, total_price: 0,
  accessory_sale_type: 'gift', ...extra
})

test('历史赠膜回填只接受共同订单、手机、客户、门店和商品均唯一一致的记录', () => {
  assert.equal(createPlan([row()]).length, 1)
  assert.throws(() => createPlan([row({ sale_store_id: 1 })]), /关联不一致/)
  assert.throws(() => createPlan([row({ quantity: 2, accessory_quantity: 1 })]), /关联不一致/)
})

test('同一订单同一手机存在多条膜明细时停止回填，不猜测服务次数', () => {
  assert.throws(() => createPlan([row(), row({ item_id: 2 })]), /存在多条赠膜明细/)
})

test('历史回填拒绝收费、非零金额或无型号的商品行', () => {
  assert.throws(() => createPlan([row({ accessory_sale_type: 'sale' })]), /关联不一致/)
  assert.throws(() => createPlan([row({ unit_price: 10 })]), /关联不一致/)
  assert.throws(() => createPlan([row({ model_id: null })]), /关联不一致/)
})
