'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const Service = require('../src/services/query-goods.service')
const Controller = require('../src/controllers/query-goods.controller')
const Repository = require('../src/repositories/query-goods.repository')
const { withReadConnection } = require('./helpers/query-goods-read')

const actor = { id: 7, store_ids: [1, 2] }
const record = { id: 51, sale_no: 'AS-ORIGINAL', name: '原单充电器', customer_name: '测试顾客', customer_phone: '13900000001',
  quantity: 2, returned_quantity: 1, remaining_quantity: 1, unit_price: '20.50', total_price: '41.00', purchase_cost: null, profit: null, points_awarded: 0, points_used: 1, deduction_amount: '0.10',
  sale_type: 'sale', store_id: 1, store_name: '一店', has_snapshot: 1 }
const response = () => ({ status(code) { this.code = code; return this }, json(body) { this.body = body; return this } })
const fixture = (hidden = []) => {
  const calls = [], reads = []
  const repository = {
    withConnection: withReadConnection,
    async list(scope, query, fields) { reads.push({ scope, query, fields }); return { data: [structuredClone(record)], pagination: { total: 125 } } },
    async detail(scope, id) { reads.push({ scope, id }); return id === 51 ? { ...structuredClone(record), serial_numbers: ['SN1', 'SN2'],
      batches: [{ id: 1, quantity: 2, purchase_cost: 10, supplier_name: '供应商', batch_no: 'IN1' }] } : null }
  }
  const service = new Service({ repository, permissionCheck: async (_actor, permission) => { calls.push(permission); return true } })
  const masking = { async getUserFieldPermissions() { return { hiddenFields: hidden } }, filterSensitiveFields(rows) { return rows } }
  return { service, controller: new Controller({ service, masking, logger: { error() {} } }), calls, reads }
}

test('商品模式沿用严格授权门店，允许销售/赠送分页，翻页不把首屏当总数', async () => {
  const f = fixture()
  const result = await f.service.list(actor, { page: '7', page_size: '20', store_id: '2', sale_type: 'gift', keyword: ' SN1 ', start_date: '2026-11-01', end_date: '2026-11-13' }, ['serial_number'])
  assert.equal(result.pagination.total, 125)
  assert.deepEqual(f.calls, ['query:view', 'accessories:view'])
  assert.deepEqual(f.reads[0].scope, { allStores: false, requestedStoreId: 2, storeIds: [2] })
  assert.deepEqual(f.reads[0].query, { page: 7, page_size: 20, keyword: 'SN1', sale_type: 'gift', start_date: '2026-11-01', end_date: '2026-11-13' })
})

test('门店越权拒绝，无绑定账户保持空范围；不因商品模式扩大综合查询范围', async () => {
  const f = fixture()
  await assert.rejects(f.service.list(actor, { store_id: 3 }, []), { statusCode: 403 })
  assert.equal(f.reads.length, 0)
  await f.service.list({ id: 7 }, {}, [])
  assert.deepEqual(f.reads[0].scope.storeIds, [])
})

test('商品查看和综合查询查看权限均须满足，匿名或缺任何一域权限不进仓储', async () => {
  for (const denied of ['query:view', 'accessories:view']) {
    const service = new Service({ repository: { list() { assert.fail('不得读取') }, detail() { assert.fail('不得读取') } }, permissionCheck: async (_user, permission) => permission !== denied })
    await assert.rejects(service.list(actor, {}, []), { statusCode: 403, code: 'PERMISSION_DENIED' })
    await assert.rejects(service.detail(actor, 51), { statusCode: 403 })
  }
  await assert.rejects(fixture().service.list({}, {}, []), { statusCode: 401 })
})

test('拒绝非法分页、日期、额外字段和类型，不让无效筛选被静默忽略', async () => {
  for (const input of [{ page: '1x' }, { page: 0 }, { page_size: 101 }, { page_size: true }, { store_id: ['1', '3'] },
    { sale_type: 'other' }, { keyword: [] }, { keyword: 'x'.repeat(101) }, { start_date: '2026-02-30' },
    { end_date: '2026-13-01' }, { start_date: '2026-12-01', end_date: '2026-11-01' }, { supplier_id: 1 }]) {
    const f = fixture()
    await assert.rejects(f.service.list(actor, input, []), { statusCode: 400 })
    assert.equal(f.reads.length, 0)
  }
})

test('详情限定授权范围及实际商品销售ID，保留未知成本和零积分', async () => {
  const f = fixture(), result = await f.service.detail(actor, '51')
  assert.equal(result.purchase_cost, null)
  assert.equal(result.points_awarded, 0)
  assert.equal(result.has_snapshot, 1)
  assert.deepEqual(result.serial_numbers, ['SN1', 'SN2'])
  assert.equal(f.reads[0].id, 51)
  assert.deepEqual(f.reads[0].scope.storeIds, [1, 2])
  await assert.rejects(f.service.detail(actor, 52), { statusCode: 404 })
  await assert.rejects(f.service.detail(actor, '51 OR 1=1'), { statusCode: 400 })
})

test('隐藏客户、商品、SN不参与关键词匹配；隐藏字段在列表和嵌套批次中由后端遮蔽', async () => {
  const f = fixture(['customer_info.customer_phone', 'basic_info.name', 'basic_info.serial_number', 'price_info.purchase_cost', 'basic_info.supplier_name'])
  const list = response()
  await f.controller.list({ user: actor, query: { keyword: '13900000001' } }, list)
  for (const field of ['customer_phone', 'name', 'serial_number']) assert.equal(f.reads[0].fields.includes(field), false)
  assert.equal(list.body.data.data[0].customer_phone, null)
  assert.equal(list.body.data.data[0].name, null)
  const detail = response()
  await f.controller.detail({ user: actor, params: { id: 51 } }, detail)
  assert.equal(detail.body.data.serial_numbers, null)
  assert.equal(detail.body.data.batches[0].purchase_cost, null)
  assert.equal(detail.body.data.batches[0].supplier_name, null)
  assert.equal(detail.body.data.profit, null)
})

test('隐藏数量或成交金额时同时遮蔽相关成本/利润/积分，不能从派生字段反推', async () => {
  for (const field of ['stock_info.total_quantity', 'price_info.unit_price', 'price_info.total_price']) {
    const f = fixture([field]), res = response()
    await f.controller.list({ user: actor, query: {} }, res)
    const row = res.body.data.data[0]
    assert.equal(row.total_price, null)
    assert.equal(row.profit, null)
    assert.equal(row.points_awarded, null)
    assert.equal(row.points_used, null)
    assert.equal(row.deduction_amount, null)
    if (field === 'stock_info.total_quantity') {
      assert.equal(row.quantity, null)
      assert.equal(row.returned_quantity, null)
      assert.equal(row.remaining_quantity, null)
    } else {
      assert.equal(row.returned_quantity, 1)
      assert.equal(row.remaining_quantity, 1)
    }
  }
})

test('隐藏门店、销售时间或出库类型时不允许用这些筛选字段探测数据', async () => {
  for (const [field, query] of [['stock_info.distribution', { store_id: 1 }], ['time_info.created_at', { start_date: '2026-11-01' }], ['basic_info.usage_type', { sale_type: 'gift' }]]) {
    const f = fixture([field]), res = response()
    await f.controller.list({ user: actor, query }, res)
    assert.equal(res.code, 403)
    assert.equal(res.body.code, 'FIELD_PERMISSION_DENIED')
    assert.equal(f.reads.length, 0)
  }
})

test('异常读取返回统一错误和请求ID，不暴露数据库异常；业务404保持原错误码', async () => {
  const controller = new Controller({ access: { async getPermissions() { throw new Error('secret sql') } }, logger: { error() {} } }), res = response()
  await controller.list({ user: actor, query: {}, requestId: 'req-test' }, res)
  assert.equal(res.code, 500)
  assert.equal(res.body.request_id, 'req-test')
  assert.equal(JSON.stringify(res.body).includes('secret sql'), false)
  const missing = response()
  await fixture().controller.detail({ user: actor, params: { id: 52 } }, missing)
  assert.equal(missing.code, 404)
})

test('仓储列表和COUNT共享过滤，使用原单资料、参数绑定及稳定分页，无SN联表乘大数量', async () => {
  const statements = [], repo = new Repository()
  repo.withConnection = async fn => fn({ async query(sql, params) {
    statements.push({ sql, params }); return [sql.startsWith('SELECT COUNT') ? [{ total: 125 }] : [record]]
  } })
  const result = await repo.list({ storeIds: [1, 2] }, { page: 7, page_size: 20, keyword: 'MW-VW3', sale_type: 'sale' }, ['product_model', 'serial_number'])
  assert.deepEqual(statements[0].params, [1, 2, 'sale', '%MW-VW3%', '%MW-VW3%'])
  assert.deepEqual(statements[1].params, [...statements[0].params, 20, 120])
  assert.match(statements[1].sql, /CASE WHEN i.id IS NOT NULL THEN/)
  assert.match(statements[0].sql, /EXISTS \(SELECT 1 FROM accessory_serial_events/)
  assert.match(statements[1].sql, /ORDER BY s.sale_time DESC, s.id DESC LIMIT \? OFFSET \?/)
  assert.equal(result.pagination.has_next, false)
  assert.equal(result.pagination.total_pages, 7)
})

test('仓储先校验销售门店再读SN/批次，来源按原出库流水而不是当前主档供应商', async () => {
  const statements = [], repo = new Repository()
  repo.withConnection = async fn => fn({ async query(sql, params) {
    statements.push({ sql, params })
    if (sql.includes('FROM accessory_sales')) return [[record]]
    if (sql.includes('FROM accessory_serial_events')) return [[{ serial_number: 'SN1' }]]
    return [[{ stock_in_id: 81, supplier_name: '原采购供应商' }]]
  } })
  const result = await repo.detail({ storeIds: [2] }, 51)
  assert.deepEqual(statements[0].params, [51, 2])
  assert.match(statements[0].sql, /s.store_id IN \(\?\)/)
  assert.match(statements[2].sql, /si.supplier_id/)
  assert.match(statements[2].sql, /e.quantity_delta < 0/)
  assert.deepEqual(result.serial_numbers, ['SN1'])
  assert.equal(result.batches[0].supplier_name, '原采购供应商')
  statements.length = 0
  repo.withConnection = async fn => fn({ async query(sql) { statements.push(sql); return [[]] } })
  assert.equal(await repo.detail({ storeIds: [] }, 51), null)
  assert.equal(statements.length, 1)
})

test('手机原凭证只读关联配件，沿用双模块权限和门店范围，不返回采购成本', async () => {
  const reads = [], repository = { withConnection: withReadConnection, async phoneReceipt(scope, id) { reads.push({ scope, id }); return [{ ...record, serial_numbers: ['000SN'] }] } }
  const service = new Service({ repository, permissionCheck: async () => true })
  const rows = await service.phoneReceipt(actor, '81')
  assert.deepEqual(reads, [{ scope: { allStores: false, requestedStoreId: null, storeIds: [1, 2] }, id: 81 }])
  assert.equal(rows[0].name, '原单充电器'); assert.deepEqual(rows[0].serial_numbers, ['000SN'])
  for (const field of ['purchase_cost', 'profit', 'customer_phone', 'batches']) assert.equal(Object.hasOwn(rows[0], field), false)
  await assert.rejects(service.phoneReceipt(actor, '81 OR 1'), { statusCode: 400 })
  for (const denied of ['query:view', 'accessories:view']) {
    const restricted = new Service({ repository, permissionCheck: async (_user, permission) => permission !== denied })
    await assert.rejects(restricted.phoneReceipt(actor, 81), { statusCode: 403 })
  }
  assert.equal(reads.length, 1)
})

test('手机凭证后端同样遮蔽隐藏SN、价格、数量和用途，不因打印补回敏感信息', async () => {
  const masking = { async getUserFieldPermissions() { return { hiddenFields: ['basic_info.serial_number', 'price_info.total_price', 'basic_info.usage_type'] } }, filterSensitiveFields(rows) { return rows } }
  const service = new Service({ repository: { withConnection: withReadConnection, async phoneReceipt() { return [{ ...record, serial_numbers: ['000SN'] }] } }, permissionCheck: async () => true })
  const controller = new Controller({ service, masking }), res = response()
  await controller.phoneReceipt({ user: actor, params: { saleId: '81' } }, res)
  const row = res.body.data[0]
  assert.equal(row.serial_numbers, null); assert.equal(row.total_price, null); assert.equal(row.deduction_amount, null)
  assert.equal(row.sale_type, null); assert.equal(row.quantity, null)
})

test('手机原凭证仓储按真实销售ID和同订单关联，排除其它手机与之后换货，SN不重复计金额', async () => {
  const statements = [], repo = new Repository()
  let released = false
  repo.database = () => ({ async getConnection() { return {
    async query(sql, params) {
      statements.push({ sql, params })
      return [statements.length === 1 ? [record, { ...record, id: 52, sale_type: 'gift', total_price: 0 }]
        : [{ sale_id: 51, serial_number: 'A01' }, { sale_id: 51, serial_number: 'A02' }, { sale_id: 52, serial_number: 'G01' }]]
    }, release() { released = true }
  } } })
  const rows = await repo.phoneReceipt({ storeIds: [2] }, 81)
  assert.deepEqual(statements[0].params, [81, 2, 2])
  assert.match(statements[0].sql, /ps\.id = \?/)
  assert.match(statements[0].sql, /ps\.store_id IN \(\?\)/)
  assert.match(statements[0].sql, /s\.store_id IN \(\?\)/)
  assert.match(statements[0].sql, /pi\.sale_id = ps\.id AND pi\.item_type = 'phone' AND pi\.order_id = i\.order_id/)
  assert.deepEqual(statements[1].params, [51, 52])
  assert.match(statements[1].sql, /se\.event_type IN \('sale', 'gift'\)/)
  assert.equal(rows.length, 2)
  assert.deepEqual(rows.map(row => row.serial_numbers), [['A01', 'A02'], ['G01']])
  assert.equal(released, true)
})
