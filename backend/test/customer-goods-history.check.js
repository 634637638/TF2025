'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const Service = require('../src/services/query-goods.service')
const Controller = require('../src/controllers/query-goods.controller')
const Repository = require('../src/repositories/query-goods.repository')
const { withReadConnection } = require('./helpers/query-goods-read')

const actor = { id: 7, store_ids: [1, 2] }
const record = { id: 51, customer_id: 8, customer_name: '不应输出', customer_phone: '13900000001',
  sale_no: 'AS1', order_id: 10, order_item_id: 20, order_no: 'SO1', linked_phone_invoice: 'PHONE1', linked_phone_store_id: 1,
  name: '原单商品', category: '充电头', brand_name: '原品牌', product_model: 'MWVW3CH', color_name: '白', unit: '个',
  sale_type: 'gift', store_name: '一店', quantity: 2, returned_quantity: 2, remaining_quantity: 0,
  unit_price: '0.00', total_price: '0.00', points_used: 0, deduction_amount: '0.00', points_awarded: 0,
  operator_name: '原销售员', sale_time: '2026-11-14 10:00:00', remarks: '原备注', has_snapshot: 1,
  purchase_cost: '10.00', profit: '-20.00' }
const response = () => ({ status(code) { this.code = code; return this }, json(body) { this.body = body; return this } })
const fixture = (hiddenFields = []) => {
  const reads = [], permissions = []
  const repository = { withConnection: withReadConnection, async list(scope, query, fields, connection) {
    reads.push({ scope, query, fields, connection })
    return { data: [structuredClone(record), { ...record, id: 52, order_id: null, order_no: null, has_snapshot: 0, linked_phone_store_id: 3 }], pagination: { total: 125 } }
  } }
  const service = new Service({ repository, permissionCheck: async (_actor, permission) => { permissions.push(permission); return true } })
  const masking = { async getUserFieldPermissions() { return { hiddenFields } }, filterSensitiveFields(rows) { return rows } }
  return { service, reads, permissions, controller: new Controller({ service, masking, logger: { error() {} } }) }
}

test('客户商品历史沿用三模块授权及门店范围，真实客户ID和分页在同一快照传入仓储', async () => {
  const f = fixture(), result = await f.service.customerHistory(actor, '8', { page: '7', page_size: '20' })
  assert.deepEqual(f.permissions, ['query:view', 'accessories:view', 'customers:view'])
  assert.deepEqual(f.reads[0].scope.storeIds, [1, 2])
  assert.deepEqual(f.reads[0].query, { page: 7, page_size: 20, customer_id: 8 })
  assert.deepEqual(f.reads[0].fields, [])
  assert.ok(f.reads[0].connection)
  assert.equal(result.pagination.total, 125)
  assert.equal(result.data[0].remaining_quantity, 0)
  assert.equal(result.data[0].has_order, true)
  assert.equal(result.data[1].has_order, false)
  assert.equal(result.data[0].linked_phone_invoice, 'PHONE1')
  assert.equal(result.data[1].linked_phone_invoice, null, '不公开越店原手机的单号')
  for (const row of result.data) for (const key of ['customer_id', 'customer_name', 'customer_phone', 'purchase_cost', 'profit', 'order_id', 'order_item_id', 'linked_phone_store_id']) {
    assert.equal(Object.hasOwn(row, key), false, key)
  }
})

test('任一查看权限缺失和匿名均在租借连接前拒绝', async () => {
  for (const denied of ['customers:view', 'query:view', 'accessories:view']) {
    const service = new Service({ repository: { withConnection() { assert.fail('不得读取') } }, permissionCheck: async (_actor, permission) => permission !== denied })
    await assert.rejects(service.customerHistory(actor, 8), { statusCode: 403, code: 'PERMISSION_DENIED' })
  }
  await assert.rejects(fixture().service.customerHistory({}, 8), { statusCode: 401 })
})

test('客户ID、分页严格校验，不能注入客户/门店/关键词扩大或探测历史', async () => {
  for (const id of ['8 OR 1=1', 0, true, ['8'], null, 2147483648]) {
    const f = fixture(); await assert.rejects(f.service.customerHistory(actor, id), { statusCode: 400 }); assert.equal(f.reads.length, 0)
  }
  for (const query of [{ customer_id: 9 }, { store_id: 3 }, { keyword: '139' }, { sale_type: 'gift' }, { page: -1 }, { page_size: 101 }, { page: true }]) {
    const f = fixture(); await assert.rejects(f.service.customerHistory(actor, 8, query), { statusCode: 400 }); assert.equal(f.reads.length, 0)
  }
  await assert.rejects(fixture().service.list(actor, { customer_id: 8 }, []), { statusCode: 400 })
})

test('没有绑定门店时保持空范围，不借客户历史跨店读取', async () => {
  const f = fixture(); await f.service.customerHistory({ id: 7 }, 8)
  assert.deepEqual(f.reads[0].scope, { allStores: false, requestedStoreId: null, storeIds: [] })
})

test('客户列表使用商品来源字段脱敏，隐藏数量/用途遮蔽完整派生金额和积分', async () => {
  for (const hidden of ['stock_info.total_quantity', 'basic_info.usage_type', 'price_info.unit_price', 'price_info.total_price']) {
    const f = fixture([hidden]), res = response()
    await f.controller.customerHistory({ user: actor, params: { customerId: '8' }, query: {} }, res)
    assert.equal(res.body.success, true)
    const row = res.body.data.data[0]
    for (const key of ['total_price', 'points_awarded', 'points_used', 'deduction_amount']) assert.equal(row[key], null, key)
    if (hidden === 'stock_info.total_quantity' || hidden === 'basic_info.usage_type') {
      for (const key of ['quantity', 'returned_quantity', 'remaining_quantity']) assert.equal(row[key], null, key)
    }
  }
})

test('商品名称、门店、销售员和备注隐藏后不从客户主档补回', async () => {
  const f = fixture(['basic_info.name', 'stock_info.distribution', 'operator_info.operator_name', 'other_info.remarks']), res = response()
  await f.controller.customerHistory({ user: actor, params: { customerId: '8' }, query: {} }, res)
  for (const key of ['name', 'store_name', 'operator_name', 'remarks']) assert.equal(res.body.data.data[0][key], null)
})

test('字段权限读取故障在业务读取前拒绝，错误不暴露客户或SQL', async () => {
  const f = fixture(), res = response()
  const controller = new Controller({ service: f.service, access: { async getPermissions() { throw new Error('private sql') } }, logger: { error() {} } })
  await controller.customerHistory({ user: actor, params: { customerId: '8' }, query: {}, requestId: 'isolated-read' }, res)
  assert.equal(res.code, 500); assert.equal(res.body.code, 'INTERNAL_ERROR'); assert.equal(f.reads.length, 0)
  assert.equal(JSON.stringify(res.body).includes('private sql'), false)
})

test('客户姓名或电话隐藏时拒绝客户定向筛选，不能通过ID反查隐藏关联', async () => {
  for (const field of ['customer_info.customer_name', 'customer_info.customer_phone']) {
    const f = fixture([field]), res = response()
    await f.controller.customerHistory({ user: actor, params: { customerId: '8' }, query: {} }, res)
    assert.equal(res.code, 403); assert.equal(res.body.code, 'FIELD_PERMISSION_DENIED'); assert.equal(f.reads.length, 0)
  }
})

test('仓储COUNT及列表同时绑定客户ID/门店，不按手机号推断且不排除已退原记录', async () => {
  const queries = [], connection = { async query(sql, params) {
    queries.push({ sql, params }); return /COUNT\(\*\)/.test(sql) ? [[{ total: 0 }]] : [[]]
  } }
  const repo = new Repository(), result = await repo.list({ allStores: false, storeIds: [2] }, { customer_id: 8, page: 2, page_size: 10 }, [], connection)
  assert.equal(result.pagination.total, 0)
  for (const { sql, params } of queries) {
    assert.match(sql, /s\.customer_id = \?/)
    assert.match(sql, /s\.store_id IN \(\?\)/)
    assert.deepEqual(params.slice(0, 2), [2, 8])
    assert.doesNotMatch(sql.split('WHERE').at(-1), /customer_phone\s*=|remaining_quantity\s*>|order_status\s*=/)
  }
  assert.deepEqual(queries[1].params.slice(-2), [10, 10])
})
