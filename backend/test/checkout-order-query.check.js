'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { readCheckoutOrder } = require('../src/utils/checkout-order-facts')
const Service = require('../src/services/query-goods.service')
const Repository = require('../src/repositories/query-goods.repository')
const Controller = require('../src/controllers/query-goods.controller')
const { withReadConnection } = require('./helpers/query-goods-read')

const actor = { id: 7, store_ids: [1, 2] }
const fixture = () => {
  const header = { id: 10, order_no: 'SO-ORIGINAL', customer_id: 1, operator_id: 7, store_id: 1, store_name: '一店',
    customer_name: '原客户', customer_phone: '13900000001', operator_name: '销售员', sale_time: '2026-11-14 10:00:00',
    remarks: '整批备注', total_amount: '120.00', final_amount: '115.00', paid_amount: '115.00', points_awarded: 10 }
  const common = { order_id: 10, sale_customer_id: 1, sale_operator_id: 7, sale_store_id: 1 }
  const phone = { ...common, id: 101, item_type: 'phone', phone_id: 11, sale_phone_id: 11, sale_id: 81,
    quantity: 1, unit_price: '100.00', total_amount: '100.00', phone_sale_price: '100.00', phone_sale_no: 'PHONE-A', points_awarded: 10,
    snapshot: { invoice_number: 'PHONE-A', model_name: '原手机型号', brand_name: '手机品牌', color_name: '黑', memory_name: '128G', imei: '000IMEI', serial_number: '000PHONE' } }
  const goods = { ...common, id: 201, item_type: 'accessory', accessory_id: 5, goods_accessory_id: 5, accessory_sale_id: 51,
    linked_phone_sale_id: 81, linked_phone_sale_no: 'PHONE-A', linked_phone_store_id: 1,
    quantity: 2, goods_quantity: 2, unit_price: '10.00', goods_unit_price: '10.00', total_amount: '15.00', goods_total_price: '15.00',
    goods_sale_type: 'sale', goods_sale_no: 'GOODS-A', points_awarded: 0, purchase_cost: null,
    snapshot: { name: '原充电器', brand_name: '配件品牌', product_model: 'MWVW3CH', color_name: '白', unit: '个',
      sale_no: 'GOODS-A', sale_type: 'sale', gross_cents: 2000, points_used: 500, deduction_cents: 500, points_per_yuan: 100,
      points_units: [{ quantity: 2, points_used: 250, deduction_cents: 250, payable_cents: 750, points_awarded: 0 }],
      serial_numbers: ['000SN1', '000SN2'] } }
  const gift = { ...goods, id: 202, accessory_id: 6, goods_accessory_id: 6, accessory_sale_id: 52,
    quantity: 1, goods_quantity: 1, unit_price: 0, goods_unit_price: 0, total_amount: 0, goods_total_price: 0,
    goods_sale_type: 'gift', goods_sale_no: 'GIFT-A',
    snapshot: { name: '原赠膜', sale_no: 'GIFT-A', sale_type: 'gift', serial_numbers: [] } }
  return { header, items: [phone, goods, gift] }
}
const pureGoods = () => {
  const result = fixture()
  result.items = [result.items[1]]
  Object.assign(result.items[0], { linked_phone_sale_id: null, linked_phone_sale_no: null, linked_phone_store_id: null })
  Object.assign(result.header, { total_amount: 20, final_amount: 15, paid_amount: 15, points_awarded: 0 })
  return result
}
const response = () => ({ status(code) { this.code = code; return this }, json(body) { this.body = body; return this } })
const serviceFor = (data, additions = {}) => new Service({ repository: { withConnection: withReadConnection, async originalOrder() { return structuredClone(data) } },
  permissionCheck: async () => true, ...additions })

test('原混合单完整展示购买/赠品、SN及抵扣净额；原快照白名单不外泄采购或内部凭据', () => {
  const data = fixture(), output = readCheckoutOrder(data.header, data.items)
  assert.equal(output.final_amount, 115)
  assert.equal(output.points_used, 500)
  assert.equal(output.points_awarded, 10)
  assert.equal(output.items.length, 3)
  assert.deepEqual(output.items[1].serial_numbers, ['000SN1', '000SN2'])
  assert.equal(output.items[2].sale_type, 'gift')
  assert.equal(output.items[2].total_amount, 0)
  assert.equal(output.items[1].linked_phone_sale_no, 'PHONE-A')
  for (const row of output.items) {
    for (const key of ['snapshot', 'purchase_cost', 'sale_operator_id', 'accessory_id', 'customer_id']) assert.equal(key in row, false)
  }
})

test('多台手机及各自赠品保留真实归属，退货后仍展示原单而非当前库存', async () => {
  const data = fixture(), second = structuredClone(data.items[0])
  Object.assign(second, { id: 102, sale_id: 82, phone_id: 12, sale_phone_id: 12, phone_sale_no: 'PHONE-B' })
  second.snapshot.invoice_number = 'PHONE-B'
  data.items.push(second)
  Object.assign(data.items[2], { linked_phone_sale_id: 82, linked_phone_sale_no: 'PHONE-B', returned_quantity: 1, remaining_quantity: 0 })
  Object.assign(data.header, { total_amount: 220, final_amount: 215, paid_amount: 215, points_awarded: 20 })
  const output = await serviceFor(data).originalOrder(actor, 51, 'goods')
  assert.equal(output.items[1].linked_phone_sale_no, 'PHONE-A')
  assert.equal(output.items[2].linked_phone_sale_no, 'PHONE-B')
  assert.equal(output.items[2].quantity, 1)
  assert.equal(output.items.length, 4)
})

test('独立商品单可查看，原资料未知保持null，不读取当前主档补历史', async () => {
  const data = pureGoods(), output = await serviceFor(data).originalOrder(actor, 51, 'goods')
  assert.equal(output.items[0].memory, null)
  assert.equal(output.items[0].linked_phone_sale_no, null)
  assert.equal(output.final_amount, 15)
})

for (const [label, alter] of [
  ['头金额', d => { d.header.final_amount = 114 }],
  ['重复行', d => { d.items.push(d.items[0]) }],
  ['客户', d => { d.items[0].sale_customer_id = 99 }],
  ['门店', d => { d.items[0].sale_store_id = 2 }],
  ['员工', d => { d.items[0].sale_operator_id = 8 }],
  ['手机归属', d => { d.items[0].sale_phone_id = 99 }],
  ['手机SN类型', d => { d.items[0].snapshot.serial_number = {} }],
  ['原手机单号', d => { d.items[0].snapshot.invoice_number = 'OTHER' }],
  ['商品归属', d => { d.items[1].goods_accessory_id = 99 }],
  ['原成交价', d => { d.items[1].goods_total_price = 16 }],
  ['原用途', d => { d.items[1].goods_sale_type = 'gift' }],
  ['积分抵扣', d => { d.items[1].snapshot.deduction_cents = 400 }],
  ['SN数量', d => { d.items[1].snapshot.serial_numbers = ['SN'] }],
  ['坏JSON', d => { d.items[1].snapshot = '{' }],
  ['关联手机', d => { d.items[1].linked_phone_sale_id = 999 }]
]) test(`损坏的${label}拒绝生成完整原单`, () => {
  const data = fixture(); alter(data)
  assert.throws(() => readCheckoutOrder(data.header, data.items), { statusCode: 409 })
})

test('换货新单净额含旧件抵付，现金入账可小于净额，但必须核验真实换货链', async () => {
  const data = pureGoods(), calls = []
  data.header.paid_amount = 5
  data.items[0].snapshot.exchange_source = { original_order_id: 9 }
  const service = serviceFor(data, { goodsReturns: { async load(connection, input, user, options) {
    calls.push({ connection, input, user, options })
    return { order: data.header, row: { item_id: 201, linked_phone_sale_id: null }, lineage: { root_order_id: 9 } }
  } } })
  const output = await service.originalOrder(actor, 51, 'goods')
  assert.equal(output.paid_amount, 5); assert.equal(output.final_amount, 15)
  assert.equal(calls.length, 1); assert.equal(calls[0].options.lock, false)
  delete data.items[0].snapshot.exchange_source
  await assert.rejects(serviceFor(data).originalOrder(actor, 51, 'goods'), { statusCode: 409 })
})

test('跨单手机关联必须是已核验的换货后继，伪造相同根原单不通过', async () => {
  const data = pureGoods()
  Object.assign(data.items[0], { linked_phone_sale_id: 81, linked_phone_sale_no: 'PHONE-A', linked_phone_store_id: 1 })
  const service = serviceFor(data, { goodsReturns: { async load() { return { order: data.header,
    row: { item_id: 201, linked_phone_sale_id: 81 }, lineage: { root_order_id: 10 } } } } })
  await assert.rejects(service.originalOrder(actor, 51, 'goods'), { statusCode: 409 })
})

test('整单任一销售或关联手机越店时整体拒绝，不能返回部分数据', async () => {
  for (const key of ['sale_store_id', 'linked_phone_store_id']) {
    const data = fixture(); data.items[1][key] = 99
    await assert.rejects(serviceFor(data).originalOrder(actor, 51, 'goods'), { statusCode: 404 })
  }
  await assert.rejects(serviceFor(null).originalOrder(actor, 51, 'goods'), { statusCode: 404 })
})

test('来源必须是真实销售ID，双模块权限在仓储之前校验', async () => {
  const repository = { originalOrder() { assert.fail('不应读取') } }
  const denied = new Service({ repository, permissionCheck: async () => false })
  await assert.rejects(denied.originalOrder(actor, 51, 'goods'), { statusCode: 403 })
  await assert.rejects(serviceFor(null).originalOrder(actor, '51 OR 1=1', 'goods'), { statusCode: 400 })
  await assert.rejects(serviceFor(null).originalOrder(actor, 51, 'other'), { statusCode: 400 })
})

const controllerFor = (hidden = {}) => new Controller({ service: serviceFor(fixture()), masking: {
  async getUserFieldPermissions(_id, module, options) { assert.equal(options.strict, true); return { hiddenFields: hidden[module] || [] } },
  filterSensitiveFields(rows) { return rows }
}, logger: { error() {} } })
const read = async controller => {
  const res = response()
  await controller.goodsOrder({ user: actor, params: { id: 51 } }, res)
  return res
}
test('手机与商品分别按本模块脱敏，共享头使用两模块交集，隐藏原价不允许从合计相减推算', async () => {
  const res = await read(controllerFor({ query_queryview: ['basic_info.sale_price', 'basic_info.model', 'customer_info.customer_phone'] }))
  assert.equal(res.body.success, true)
  assert.equal(res.body.data.items[0].name, null)
  assert.equal(res.body.data.items[0].total_amount, null)
  assert.equal(res.body.data.items[1].name, '原充电器')
  assert.equal(res.body.data.items[1].total_amount, 15)
  assert.equal(res.body.data.final_amount, null)
  assert.equal(res.body.data.paid_amount, null)
  assert.equal(res.body.data.customer_phone, null)
})

for (const field of ['basic_info.usage_type', 'stock_info.total_quantity', 'price_info.unit_price', 'price_info.total_price']) {
  test(`隐藏商品${field}同步隐藏整组资金与整单合计`, async () => {
    const res = await read(controllerFor({ accessories_accessoriesview: [field] }))
    assert.equal(res.body.data.items[1].total_amount, null)
    assert.equal(res.body.data.items[1].points_used, null)
    assert.equal(res.body.data.final_amount, null)
    assert.equal(res.body.data.items[0].total_amount, 100)
  })
}

test('隐藏商品单号不能从手机行或关联手机单号绕回', async () => {
  const res = await read(controllerFor({ accessories_accessoriesview: ['basic_info.sequence'] }))
  assert.equal(res.body.data.order_no, null)
  assert.ok(res.body.data.items.every(row => row.sale_no === null && row.linked_phone_sale_no === null))
})

test('任何模块字段权限读取故障均关闭整单响应，不能返回部分未脱敏事实', async () => {
  for (const module of ['accessories_accessoriesview', 'query_queryview']) {
    const controller = new Controller({ service: serviceFor(fixture()), masking: {
      async getUserFieldPermissions(_id, key) { if (key === module) throw new Error('isolated failure'); return { hiddenFields: [] } },
      filterSensitiveFields(rows) { return rows }
    }, logger: { error() {} } })
    const res = await read(controller)
    assert.equal(res.code, 500)
    assert.equal(res.body.data, undefined)
  }
})

test('仓储两种来源均限制真实销售及订单门店，同连接完整读取原明细，无当前库存状态过滤', async () => {
  for (const source of ['goods', 'phone']) {
    const calls = [], data = fixture()
    const connection = { async query(sql, params) { calls.push({ sql, params }); return [calls.length === 1 ? [data.header] : data.items] } }
    const repo = new Repository({ database() { assert.fail('不得打开另一连接') } })
    await repo.originalOrder({ allStores: false, storeIds: [1, 2] }, 51, source, connection)
    assert.equal(calls.length, 2)
    assert.deepEqual(calls[0].params, [51, 1, 2, 1, 2])
    assert.match(calls[0].sql, /sale\.store_id IN/)
    assert.match(calls[0].sql, /o\.store_id IN/)
    assert.ok(calls[0].sql.includes(source === 'phone' ? 'JOIN sales sale' : 'JOIN accessory_sales sale'))
    assert.doesNotMatch(calls[1].sql, /FROM phones|JOIN phones|JOIN accessories|LIMIT |sale_status/)
    assert.deepEqual(calls[1].params, [10])
  }
})

test('整单头与行处于同一只读快照，发生并发变更仍在下一次请求可见', async () => {
  const data = pureGoods(), events = []
  let snapshot
  const connection = {
    async execute(sql) { assert.equal(sql, 'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY'); events.push('configure') },
    async beginTransaction() { events.push('begin') },
    async query(sql) {
      events.push('read'); snapshot ??= structuredClone(data)
      if (sql.includes('FROM sales_orders o')) { data.items[0].snapshot.name = '并发新版本'; return [[snapshot.header]] }
      return [snapshot.items]
    },
    async rollback() { events.push('rollback'); snapshot = undefined },
    release() { events.push('release') }, destroy() { assert.fail('不应销毁正常连接') }
  }
  const repository = new Repository({ database: () => ({ async getConnection() { events.push('acquire'); return connection } }) })
  const service = new Service({ repository, permissionCheck: async () => true })
  assert.equal((await service.originalOrder(actor, 51, 'goods')).items[0].name, '原充电器')
  assert.equal((await service.originalOrder(actor, 51, 'goods')).items[0].name, '并发新版本')
  assert.deepEqual(events, Array(2).fill(['acquire', 'configure', 'begin', 'read', 'read', 'rollback', 'release']).flat())
})

test('商品销售与订单明细BIGINT按安全整数读取，不被手机INT标识上限误拒绝', async () => {
  const data = pureGoods()
  Object.assign(data.items[0], { id: 3000000001, accessory_id: 3000000002, goods_accessory_id: 3000000002, accessory_sale_id: 3000000003 })
  const output = await serviceFor(data).originalOrder(actor, '3000000003', 'goods')
  assert.equal(output.items[0].id, 3000000001)
  await assert.rejects(serviceFor(data).originalOrder(actor, '9007199254740992', 'goods'), { statusCode: 400 })
  await assert.rejects(serviceFor(data).originalOrder(actor, '3000000003', 'phone'), { statusCode: 400 })
})
