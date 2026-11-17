'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const Service = require('../src/services/accessory-purchase.service')
const Controller = require('../src/controllers/accessory-purchase.controller')
const PurchaseRepository = require('../src/repositories/accessory-purchase.repository')
const InventoryRepository = require('../src/repositories/accessory-inventory.repository')
const FieldAccessService = require('../src/services/field-access.service')
const { parsePurchaseReturnSelection, allocatePurchaseReturn, planPurchaseReturnSettlement } = require('../src/utils/accessory-purchase-return')
const actor = { id: 7, store_ids: [1, 2] }
const fixture = () => {
  const calls = []
  const connection = { async execute(sql) { calls.push(['sql', sql]) }, async beginTransaction() { calls.push(['begin']) },
    async rollback() { calls.push(['rollback']) }, destroy() { calls.push(['destroy']) } }
  const purchase = { id: 8, accessory_id: 31, supplier_id: 3, store_id: 1, quantity: 50, purchase_cost: '12.50', total_amount: '625.00', name: '商品', brand_name: '当前品牌' }
  const events = []
  const repository = {
    async withConnection(fn) { calls.push(['connection']); try { return await fn(connection) } finally { calls.push(['release']) } },
    async returnPurchase(id, scope, executor) { assert.equal(executor, connection); calls.push(['purchase', scope]); return scope.allStores || scope.storeIds.includes(purchase.store_id) ? purchase : null },
    async paymentEventsAfter(id, after, pageSize, executor) { assert.equal(executor, connection); calls.push(['payments', after]); return events.filter(event => event.id > after).slice(0, pageSize) }
  }
  const inventory = {
    async purchaseOrigin(id, stockInId, executor) { assert.equal(executor, connection); assert.equal(stockInId, 8); return { event_count: 1, quantity: 50, min_cost: '12.50', max_cost: '12.50', invalid_count: 0 } },
    async batchConflict(input, executor) { assert.equal(executor, connection); calls.push(['balance', input]); return false },
    async purchaseBatchConflict(input, executor) { assert.equal(executor, connection); calls.push(['serial', input]); return false },
    async purchaseSerials(input, executor) { assert.equal(executor, connection); calls.push(['serials', input]); return {
      data: [{ id: '91', serial_number: '000ABC', store_id: '2', store_name: '二店' }],
      pagination: { page: input.serialPage, page_size: input.pageSize, total: 1 }
    } },
    async currentBatches(input, executor) { assert.equal(executor, connection); calls.push(['batches', input]); return { current_quantity: 4, data: [{ row_key: 'event:91', store_id: 2, store_name: '二店', quantity: 4,
      purchase_cost: '12.50', usage_type: 'sale', serial_tracking: 1, stock_in_id: 8, supplier_name: '不透传重复资料' }],
    pagination: { page: input.page, page_size: input.pageSize, total: 1 } } }
  }
  const service = new Service({ repository, inventory, tableExists: async (_table, executor) => { assert.equal(executor, connection); return true } })
  const pay = (id, action = 'pay', extra = {}) => ({ id, action, stock_in_id: 8, supplier_id: 3, amount: '625.00',
    reference_event_id: action === 'pay' ? null : id - 1, payment_method: 'bank_transfer', payment_time: '2026-11-13 12:13:14', ...extra })
  return { service, repository, inventory, purchase, events, calls, pay, connection }
}

test('退供核对严格验证ID、分页及当前店授权，非法请求在连接前拒绝', async () => {
  const f = fixture()
  for (const id of [true, [], null, '', '1e1', '8 OR 1=1', 0]) await assert.rejects(f.service.returnContext(actor, id), { statusCode: 400 })
  for (const query of [{ page: true }, { page_size: [1] }, { page_size: 101 }, { page: 1000001 }, { store_id: '' }, { stock_in_id: 9 }, { amount: 1 }]) {
    await assert.rejects(f.service.returnContext(actor, 8, query), { statusCode: 400 })
  }
  await assert.rejects(f.service.returnContext(actor, 8, { store_id: 3 }), { statusCode: 403 })
  await assert.rejects(f.service.returnContext(null, 8), { statusCode: 401 })
  assert.deepEqual(f.calls, [])
})

test('退供核对配置/启动/回滚失败销毁连接，不将不确定事务交回连接池', async () => {
  for (const method of ['execute', 'beginTransaction', 'rollback']) {
    const f = fixture()
    f.connection[method] = async () => { throw new Error(`${method}-failed`) }
    await assert.rejects(f.service.returnContext(actor, 8), new RegExp(`${method}-failed`))
    assert.deepEqual(f.calls.slice(-2), [['destroy'], ['release']])
  }
})

test('原整单与授权当前门店分开，在同一只读RR快照核对原金额、付款及真实批次', async () => {
  const f = fixture(); f.events.push(f.pay(1))
  const result = await f.service.returnContext(actor, '8', { store_id: '2', page: '2', page_size: '10' })
  assert.equal(result.purchase.total_amount, '625.00'); assert.equal(result.purchase.paid_amount, 625)
  assert.equal(result.purchase.unpaid_amount, 0); assert.equal(result.current_quantity, 4)
  assert.equal(result.ledger_status, 'verified'); assert.equal(result.data[0].stock_in_id, undefined)
  assert.equal(result.data[0].supplier_name, undefined)
  assert.deepEqual(f.calls.find(call => call[0] === 'purchase')[1].storeIds, [1, 2])
  assert.deepEqual(f.calls.find(call => call[0] === 'batches')[1], { accessoryId: 31, stockInId: 8, purchaseCost: '12.50',
    scope: { allStores: false, requestedStoreId: 2, storeIds: [2] }, exact: true, page: 2, pageSize: 10 })
  assert.match(f.calls[1][1], /REPEATABLE READ, READ ONLY/)
  assert.deepEqual(f.calls.slice(-2), [['rollback'], ['release']])
  await assert.rejects(f.service.returnContext({ id: 7, store_ids: [2] }, 8), { statusCode: 404 })
})

test('退供核对优先原采购资料快照，损坏时拒绝试算且不补当前名称', async () => {
  const f = fixture()
  f.purchase.product_snapshot = { version: 1, accessory_id: 31, supplier_id: 3, store_id: 1, name: '入库时商品',
    category: '原类型', brand_name: null, product_model: '原型号', color_name: null, unit: '个', supplier_name: '入库时供应商', store_name: '入库时一店' }
  const result = await f.service.returnContext(actor, 8)
  assert.equal(result.purchase.name, '入库时商品')
  assert.equal(result.purchase.brand_name, null)
  assert.equal(result.purchase.has_snapshot, true)
  assert.equal('product_snapshot' in result.purchase, false)
  f.purchase.product_snapshot.supplier_id = 99
  await assert.rejects(f.service.returnContext(actor, 8), { code: 'PURCHASE_SNAPSHOT_CONFLICT' })
  assert.deepEqual(f.calls.slice(-2), [['rollback'], ['release']])
})

test('完整付款链跨页核对，撤销后保留原金额并恢复原应付，零采购允许只读核对', async () => {
  const f = fixture()
  for (let id = 1; id <= 102; id++) f.events.push(f.pay(id, id % 2 ? 'pay' : 'cancel'))
  const result = await f.service.returnContext(actor, 8)
  assert.equal(result.purchase.latest_event_id, 102); assert.equal(result.purchase.paid_amount, 0)
  assert.equal(result.purchase.unpaid_amount, 625); assert.equal(result.purchase.payment_status, 'unpaid')
  assert.deepEqual(f.calls.filter(call => call[0] === 'payments').map(call => call[1]), [0, 100])
  f.events.length = 0; f.purchase.purchase_cost = '0.00'; f.purchase.total_amount = '0.00'
  f.inventory.purchaseOrigin = async () => ({ event_count: 0 })
  const zero = await f.service.returnContext(actor, 8)
  assert.equal(zero.purchase.unpaid_amount, 0)
})

test('付款链重复打款、孤立撤销、错误原引用、供应商或金额不符均拒绝，不能仅信最新状态', async () => {
  for (const events of [f => [f.pay(1), f.pay(2)], f => [f.pay(1, 'cancel')],
    f => [f.pay(1), f.pay(2, 'cancel', { reference_event_id: 9 })], f => [f.pay(1, 'pay', { supplier_id: 9 })],
    f => [f.pay(1, 'pay', { amount: '1.00' })], f => [f.pay(1, 'pay', { reference_event_id: 9 })]]) {
    const f = fixture(); f.events.push(...events(f))
    await assert.rejects(f.service.returnContext(actor, 8), { code: 'PURCHASE_PAYMENT_CONFLICT' })
    assert.equal(f.calls.some(call => call[0] === 'batches'), false)
    assert.deepEqual(f.calls.slice(-2), [['rollback'], ['release']])
  }
})

test('旧单没有原入库流水标明未知可退量，绝不按当前商品档案接续或猜批次', async () => {
  const f = fixture(); f.inventory.purchaseOrigin = async () => ({ event_count: 0 })
  const result = await f.service.returnContext(actor, 8)
  assert.equal(result.ledger_status, 'untracked'); assert.equal(result.current_quantity, null)
  assert.deepEqual(result.data, []); assert.equal(result.serials, null)
  assert.equal(f.calls.some(call => ['batches', 'serials'].includes(call[0])), false)
})

test('缺结构、原采购金额差、原入库缺件/成本差、SN来源差及数据库错误均失败关闭并释放连接', async () => {
  for (const reason of ['schema', 'amount', 'origin', 'cost', 'balance', 'sn', 'overflow', 'database']) {
    const f = fixture()
    if (reason === 'schema') f.service.tableExists = async () => false
    if (reason === 'amount') f.purchase.total_amount = '624.99'
    if (reason === 'origin') f.inventory.purchaseOrigin = async () => ({ event_count: 1, quantity: 49, min_cost: '12.50', max_cost: '12.50', invalid_count: 0 })
    if (reason === 'cost') f.inventory.purchaseOrigin = async () => ({ event_count: 1, quantity: 50, min_cost: '12.00', max_cost: '12.50', invalid_count: 0 })
    if (reason === 'balance') f.inventory.batchConflict = async () => true
    if (reason === 'sn') f.inventory.purchaseBatchConflict = async () => true
    if (reason === 'overflow') f.inventory.currentBatches = async () => ({ current_quantity: 51, data: [] })
    if (reason === 'database') f.repository.paymentEventsAfter = async () => { throw new Error('读取失败') }
    await assert.rejects(f.service.returnContext(actor, 8), reason === 'database' ? /读取失败/ : { statusCode: 409 })
    assert.deepEqual(f.calls.slice(-2), [['rollback'], ['release']])
  }
})

test('原单仓储复用整单授权约束，付款游标稳定递增且不读取幂等凭据', async () => {
  const calls = [], repository = new PurchaseRepository()
  const executor = { async query(sql, params) { calls.push({ sql, params }); return [[]] } }
  await repository.returnPurchase(8, { allStores: false, storeIds: [1, 2] }, executor)
  await repository.paymentEventsAfter(8, 100, 100, executor)
  assert.match(calls[0].sql, /JSON_LENGTH\(si.distribution\)/)
  assert.deepEqual(calls[0].params, [1, 2, 1, 2, 8])
  assert.match(calls[1].sql, /id > \? ORDER BY id LIMIT \?/)
  assert.deepEqual(calls[1].params, [8, 100, 100])
  for (const call of calls) assert.doesNotMatch(call.sql, /FOR UPDATE|request_key|request_hash|INSERT|UPDATE |DELETE/)
})

test('原批次分页仅查指定实际商品及采购ID；SN按原采购/当前店/成本核对双向缺失', async () => {
  const calls = [], inventory = new InventoryRepository()
  const input = { accessoryId: 31, stockInId: 8, purchaseCost: '12.50', scope: { allStores: false, storeIds: [2] }, exact: true, page: 2, pageSize: 10 }
  const executor = { async query(sql, params) { calls.push({ sql, params }); return /COUNT\(\*\) AS total/.test(sql) ? [[{ total: 4, total_quantity: 9 }]] : [[]] } }
  const result = await inventory.currentBatches(input, executor)
  assert.equal(result.current_quantity, 9); assert.equal(result.pagination.total, 4)
  assert.deepEqual(calls[0].params, [31, 2, 8]); assert.deepEqual(calls[1].params, [31, 2, 8, 10, 10])
  assert.doesNotMatch(calls[0].sql, /UNION ALL|template_id/)
  await inventory.purchaseBatchConflict(input, executor)
  assert.match(calls[2].sql, /sn.stock_in_id = \?/)
  assert.match(calls[2].sql, /l.quantity <> COALESCE\(sn.quantity, 0\)/)
  assert.match(calls[2].sql, /l.store_id IS NULL/)
  assert.equal((calls[2].sql.match(/\?/g) || []).length, calls[2].params.length)
  for (const call of calls) assert.doesNotMatch(call.sql, /FOR UPDATE|INSERT|UPDATE |DELETE/)
})

const response = () => ({ status(code) { this.code = code; return this }, json(body) { this.body = body; return this } })
test('退供核对使用两个模块严格字段读取，分别遮蔽原资料与库存用途/SN/成本', async () => {
  const f = fixture(), modules = []
  const masking = { async getUserFieldPermissions(_user, module, options) { modules.push([module, options]); return { hiddenFields: module === 'payments_supplierphonepaymentsview'
    ? ['payment.brand_name'] : ['basic_info.usage_type', 'basic_info.serial_tracking', 'price_info.purchase_cost'] } }, filterSensitiveFields: rows => rows }
  const controller = new Controller({ service: f.service,
    returnFieldAccess: new FieldAccessService({ moduleKey: 'payments_supplierphonepaymentsview', strict: true, masking, responseKeys: { 'payment.brand_name': ['brand_name'] } }),
    inventoryFieldAccess: new FieldAccessService({ moduleKey: 'accessories_accessoriesview', strict: true, masking, responseKeys: {
      'basic_info.usage_type': ['usage_type'], 'basic_info.serial_tracking': ['serial_tracking'], 'price_info.purchase_cost': ['purchase_cost'] } }) })
  const res = response(); await controller.returnContext({ user: actor, params: { id: '8' }, query: {} }, res)
  assert.equal(res.body.success, true); assert.equal(res.body.data.purchase.brand_name, null)
  for (const key of ['usage_type', 'serial_tracking', 'purchase_cost']) assert.equal(res.body.data.data[0][key], null)
  assert.equal(res.body.data.purchase.purchase_cost, '12.50')
  assert.deepEqual(modules.map(([, options]) => options), [{ strict: true }, { strict: true }])
})

test('任一模块必要字段隐藏或权限故障在业务读取前拒绝', async () => {
  for (const field of ['purchase.quantity', 'payment.supplier_name', 'payment.store_name', 'payment.purchase_cost', 'payment.payment_status', 'stock_info.distribution', 'stock_info.total_quantity', 'failure']) {
    const access = { async getPermissions() { if (field === 'failure') throw Object.assign(new Error('权限故障'), { statusCode: 503 }); return { hiddenFields: [field] } } }
    const controller = new Controller({ service: { async returnContext() { assert.fail('不应读取业务数据') } }, returnFieldAccess: access, inventoryFieldAccess: access })
    const res = response(); await controller.returnContext({ user: actor, params: { id: '8' }, query: {} }, res)
    assert.equal(res.code, field === 'failure' ? 500 : 403)
  }
})

test('SN核对与原采购同一快照，保留前导零并独立分页，检索不改变整批余额', async () => {
  const f = fixture()
  const result = await f.service.returnContext(actor, 8, { store_id: '2', serial_page: '2', page_size: '10', serial_search: ' 000A ' })
  assert.equal(result.current_quantity, 4)
  assert.deepEqual(result.serials.data, [{ id: 91, serial_number: '000ABC', store_id: 2, store_name: '二店' }])
  const input = f.calls.find(call => call[0] === 'serials')[1]
  assert.deepEqual(input.scope.storeIds, [2]); assert.equal(input.accessoryId, 31); assert.equal(input.stockInId, 8)
  assert.equal(input.serialPage, 2); assert.equal(input.page, 1); assert.equal(input.serialSearch, '000A')
  assert.deepEqual(f.calls.slice(-2), [['rollback'], ['release']])
})

test('SN非法分页、数组/对象/超长/控制字符检索在连接前拒绝', async () => {
  const f = fixture()
  for (const query of [null, [], { serial_page: true }, { serial_page: '1e2' }, { serial_page: 1000001 },
    { serial_search: [] }, { serial_search: {} }, { serial_search: 123 }, { serial_search: 'x'.repeat(101) }, { serial_search: 'A\nB' }]) {
    await assert.rejects(f.service.returnContext(actor, 8, query), { statusCode: 400 })
  }
  assert.deepEqual(f.calls, [])
})

test('原采购SN查询精确限定实际商品/采购/在库/当前店，数量与明细相同条件，检索按字面绑定', async () => {
  const calls = [], inventory = new InventoryRepository()
  const executor = { async query(sql, params) {
    calls.push({ sql, params })
    return /COUNT\(\*\) AS total/.test(sql) ? [[{ total: 21 }]] : [[{ id: 91, serial_number: '00%_A', store_id: 2, store_name: '二店' }]]
  } }
  const input = { accessoryId: 31, stockInId: 8, scope: { allStores: false, storeIds: [2] }, serialPage: 2, pageSize: 20, serialSearch: '%_' }
  const result = await inventory.purchaseSerials(input, executor)
  assert.equal(result.pagination.total, 21); assert.equal(result.pagination.page, 2); assert.equal(result.pagination.has_next, false)
  assert.deepEqual(calls[0].params, [31, 8, 2, '%_'])
  assert.deepEqual(calls[1].params, [31, 8, 2, '%_', 20, 20])
  for (const call of calls) {
    assert.match(call.sql, /sn.accessory_id = \? AND sn.stock_in_id = \? AND sn.status = 'in_stock'/)
    assert.match(call.sql, /sn.store_id IN \(\?\)/); assert.match(call.sql, /LOCATE\(\?, sn.serial_number\) > 0/)
    assert.doesNotMatch(call.sql, /template_id|LIKE|FOR UPDATE|INSERT|UPDATE |DELETE|purchase_cost|sale_id/)
    assert.equal((call.sql.match(/\?/g) || []).length, call.params.length)
  }
  calls.length = 0
  await inventory.purchaseSerials({ ...input, scope: { allStores: false, storeIds: [] }, serialSearch: '' }, executor)
  assert.match(calls[0].sql, /1 = 0/)
})

test('隐藏SN仍可核对普通批次，但不读取逐件资料且禁止利用检索及页码推断SN', async () => {
  const f = fixture(), fields = { async getPermissions() { return { hiddenFields: [] } }, maskPayload: value => value }
  const inventoryFields = { ...fields, async getPermissions() { return { hiddenFields: ['basic_info.serial_number'] } } }
  const controller = new Controller({ service: f.service, returnFieldAccess: fields, inventoryFieldAccess: inventoryFields })
  const req = { user: actor, params: { id: '8' }, query: {} }, res = response()
  await controller.returnContext(req, res)
  assert.equal(res.body.data.serials, null); assert.equal(res.body.data.current_quantity, 4)
  assert.equal(f.calls.some(call => call[0] === 'serials'), false)
  f.calls.length = 0
  for (const query of [{ serial_search: '' }, { serial_search: '000A' }, { serial_page: '1' }]) {
    const denied = response(); await controller.returnContext({ ...req, query }, denied)
    assert.equal(denied.code, 403)
  }
  assert.deepEqual(f.calls, [])
})

test('SN读取失败或数量超过原批次余额时关闭核对并回滚，不返回猜测的明细', async () => {
  for (const reason of ['query', 'quantity']) {
    const f = fixture()
    f.inventory.purchaseSerials = async () => {
      if (reason === 'query') throw new Error('SN查询失败')
      return { data: [], pagination: { total: 5 } }
    }
    await assert.rejects(f.service.returnContext(actor, 8), reason === 'query' ? /SN查询失败/ : { code: 'INVENTORY_LEDGER_CONFLICT' })
    assert.deepEqual(f.calls.slice(-2), [['rollback'], ['release']])
  }
})

const quoteFixture = () => {
  const f = fixture()
  f.selection = {
    batches: [
      { row_key: 'event:11', accessory_id: 31, stock_in_id: 8, store_id: 1, store_name: '一店', quantity: 2, purchase_cost: '12.50', usage_type: 'sale', serial_tracking: 0 },
      { row_key: 'event:12', accessory_id: 31, stock_in_id: 8, store_id: 2, store_name: '二店', quantity: 2, purchase_cost: '12.50', usage_type: 'gift', serial_tracking: 1 }
    ],
    serials: [{ id: 91, serial_number: '000ABC', accessory_id: 31, stock_in_id: 8, status: 'in_stock', store_id: 2, purchase_cost: '12.50' }]
  }
  f.inventory.purchaseReturnSelection = async (input, executor) => {
    assert.equal(executor, f.connection); f.calls.push(['selection', input]); return f.selection
  }
  f.input = { batches: [{ row_key: 'event:11', quantity: 2 }], serial_ids: [91] }
  return f
}

test('退供试算拒绝未知字段、无效数量、重复或超量候选，非法输入不取得连接', async () => {
  const f = quoteFixture()
  for (const body of [null, [], {}, { ...f.input, purchase_cost: 0 }, { ...f.input, supplier_id: 3 },
    { batches: [], serial_ids: [] }, { batches: [], serial_ids: [91, '91'] },
    { batches: [], serial_ids: [true] }, { batches: [], serial_ids: ['1e2'] }, { batches: [], serial_ids: [91, 91] },
    { batches: [], serial_ids: Array.from({ length: 1001 }, (_, i) => i + 1) },
    { batches: Array.from({ length: 101 }, (_, i) => ({ row_key: `event:${i + 1}`, quantity: 1 })), serial_ids: [] },
    { batches: [f.input.batches[0], f.input.batches[0]], serial_ids: [] },
    ...[0, -1, 0.5, true, [], '1e2', '2元', '2\n'].map(quantity => ({ batches: [{ row_key: 'event:11', quantity }], serial_ids: [] })),
    ...['stock:31:2', 'event:0', 'event:01', 'event:1 OR 1=1', 'event:2147483648'].map(row_key => ({ batches: [{ row_key, quantity: 1 }], serial_ids: [] })),
    { batches: [{ row_key: 'event:11', quantity: 1, store_id: 1 }], serial_ids: [] }]) {
    await assert.rejects(f.service.quoteReturn(actor, 8, body), { statusCode: 400 })
  }
  assert.deepEqual(f.calls, [])
})

test('普通数量与SN混合试算按原采购单价以分计算，完整付款链和重查候选共用只读连接', async () => {
  const f = quoteFixture(); f.events.push(f.pay(1))
  const result = await f.service.quoteReturn(actor, 8, f.input)
  assert.deepEqual(result, { purchase_id: 8, quantity: 3, purchase_cost: 12.5, total_amount: 37.5,
    payment_status: 'paid', latest_event_id: 1, preview_only: true, data: [
      { row_key: 'event:11', store_id: 1, store_name: '一店', quantity: 2, usage_type: 'sale', serial_tracking: 0, serial_numbers: [] },
      { row_key: 'event:12', store_id: 2, store_name: '二店', quantity: 1, usage_type: 'gift', serial_tracking: 1, serial_numbers: ['000ABC'] }
    ] })
  const selection = f.calls.find(call => call[0] === 'selection')[1]
  assert.deepEqual(selection.serialIds, [91]); assert.deepEqual(selection.batchEventIds, [11])
  assert.deepEqual(selection.scope.storeIds, [1, 2]); assert.equal(selection.accessoryId, 31); assert.equal(selection.stockInId, 8)
  assert.match(f.calls[1][1], /READ ONLY/); assert.deepEqual(f.calls.slice(-2), [['rollback'], ['release']])
  assert.equal(f.calls.some(call => call[0] === 'serials'), false)
})

test('已付采购每次可选退款或留抵，未付只冲应付，资金试算按原数量原价且无业务写入', async () => {
  for (const [paid, mode, amounts] of [
    [true, 'supplier_refund', { payable_reduction: 0, refund_amount: 37.5, credit_amount: 0 }],
    [true, 'supplier_credit', { payable_reduction: 0, refund_amount: 0, credit_amount: 37.5 }],
    [false, 'reduce_payable', { payable_reduction: 37.5, refund_amount: 0, credit_amount: 0 }]
  ]) {
    const f = quoteFixture(); if (paid) f.events.push(f.pay(1))
    const before = structuredClone({ purchase: f.purchase, events: f.events, selection: f.selection })
    const result = await f.service.quoteReturn(actor, 8, { ...f.input, settlement_mode: mode })
    assert.deepEqual(result.settlement, { mode, ...amounts })
    assert.equal(result.preview_only, true); assert.equal(result.quantity, 3); assert.equal(result.total_amount, 37.5)
    assert.deepEqual({ purchase: f.purchase, events: f.events, selection: f.selection }, before)
    assert.deepEqual(f.calls.slice(-2), [['rollback'], ['release']])
    assert.equal(f.calls.some(call => call[0] === 'commit'), false)
  }
})

test('退供资金方式非法在租借前拒绝，付款状态变化须重新核对，不把退款与冲应付混用', async () => {
  for (const settlement_mode of [null, undefined, '', 'refund', [], {}, true, 'supplier_credit\n']) {
    const f = quoteFixture()
    await assert.rejects(f.service.quoteReturn(actor, 8, { ...f.input, settlement_mode }), { statusCode: 400 })
    assert.deepEqual(f.calls, [])
  }
  for (const [paid, mode] of [[false, 'supplier_refund'], [false, 'supplier_credit'], [true, 'reduce_payable']]) {
    const f = quoteFixture(); if (paid) f.events.push(f.pay(1))
    await assert.rejects(f.service.quoteReturn(actor, 8, { ...f.input, settlement_mode: mode }), { code: 'PURCHASE_RETURN_SETTLEMENT_CONFLICT' })
    assert.deepEqual(f.calls.slice(-2), [['rollback'], ['release']])
  }
})

test('退供资金规划只分配一个金额归属，零元和分币守恒，超限或坏状态不产生计划', () => {
  for (const [status, mode, key] of [['unpaid', 'reduce_payable', 'payable_reduction'],
    ['paid', 'supplier_refund', 'refund_amount'], ['paid', 'supplier_credit', 'credit_amount']]) {
    for (const cents of [0, 29, 145, 9999999999]) {
      const plan = planPurchaseReturnSettlement(status, mode, cents)
      assert.equal(Math.round(plan[key] * 100), cents)
      assert.equal(['payable_reduction', 'refund_amount', 'credit_amount'].reduce((sum, field) => sum + Math.round(plan[field] * 100), 0), cents)
    }
  }
  for (const amount of [-1, 1.5, NaN, Infinity, '29', 10000000000]) {
    assert.throws(() => planPurchaseReturnSettlement('paid', 'supplier_refund', amount), { code: 'PURCHASE_RETURN_SETTLEMENT_CONFLICT' })
  }
  assert.throws(() => planPurchaseReturnSettlement('unknown', 'supplier_refund', 29), { statusCode: 409 })
})

test('退供核对及试算共用完整付款方式时间核验，坏原登记或撤销不进入库存分配', async () => {
  for (const extra of [{ payment_method: 'unknown' }, { payment_time: '2026-02-30 12:13:14' },
    { payment_method: 'cash' }, { payment_time: '2026-11-13 12:13:15' }]) {
    for (const operation of ['context', 'quote']) {
      const f = quoteFixture()
      f.events.push(f.pay(1), f.pay(2, 'cancel', extra))
      const before = structuredClone(f.events)
      await assert.rejects(operation === 'context' ? f.service.returnContext(actor, 8) : f.service.quoteReturn(actor, 8, f.input), { code: 'PURCHASE_PAYMENT_CONFLICT' })
      assert.equal(f.calls.some(call => ['batches', 'selection'].includes(call[0])), false)
      assert.deepEqual(f.events, before)
      assert.deepEqual(f.calls.slice(-2), [['rollback'], ['release']])
    }
  }
})

test('候选已移走、跨采购或越权缺失、普通和SN数量不足、成本变动及用途歧义均拒绝试算', async () => {
  for (const reason of ['missingBatch', 'missingSerial', 'wrongSerial', 'quantity', 'snQuantity', 'cost', 'snCost', 'tracking', 'ambiguous', 'blank', 'duplicateSN', 'invalidQuantity']) {
    const f = quoteFixture()
    if (reason === 'missingBatch') f.selection.batches.shift()
    if (reason === 'missingSerial') f.selection.serials = []
    if (reason === 'wrongSerial') f.selection.serials[0].id = 92
    if (reason === 'quantity') f.selection.batches[0].quantity = 1
    if (reason === 'snQuantity') f.selection.batches[1].quantity = 0
    if (reason === 'cost') f.selection.batches[0].purchase_cost = '12.51'
    if (reason === 'snCost') f.selection.serials[0].purchase_cost = '12.49'
    if (reason === 'tracking') f.selection.batches[0].serial_tracking = 1
    if (reason === 'ambiguous') f.selection.batches.push({ ...f.selection.batches[1], row_key: 'event:13', usage_type: 'sale' })
    if (reason === 'blank') f.selection.serials[0].serial_number = ' '
    if (reason === 'duplicateSN') { f.input.serial_ids.push(92); f.selection.serials.push({ ...f.selection.serials[0], id: 92 }) }
    if (reason === 'invalidQuantity') f.selection.batches[0].quantity = '2x'
    await assert.rejects(f.service.quoteReturn(actor, 8, f.input), { code: 'PURCHASE_RETURN_SELECTION_CONFLICT' })
    assert.deepEqual(f.calls.slice(-2), [['rollback'], ['release']])
  }
})

test('分配时逐行重核原实际商品、采购、当前店及在库状态，不能仅依赖候选SQL过滤', async () => {
  const cases = [
    f => { f.selection.batches[0].accessory_id = 32 },
    f => { f.selection.batches[0].stock_in_id = 9 },
    f => { f.selection.batches[0].store_id = 3 },
    f => { f.selection.serials[0].accessory_id = 32 },
    f => { f.selection.serials[0].stock_in_id = 9 },
    f => { f.selection.serials[0].store_id = 3; f.selection.batches[1].store_id = 3 },
    f => { f.selection.serials[0].status = 'sold' },
    f => { delete f.selection.serials[0].stock_in_id },
    f => { delete f.selection.batches[0].accessory_id },
    f => { f.selection.serials[0].serial_number = '000ABC\n' },
    f => { f.selection.batches[0].usage_type = 'unknown' },
    f => { f.selection.batches[1].quantity = 50 },
    f => { f.selection.batches.push({ ...f.selection.batches[0] }) },
    f => { f.selection.batches.push({ ...f.selection.batches[0], row_key: 'event:99', quantity: 1 }) }
  ]
  for (const mutate of cases) {
    const f = quoteFixture(); mutate(f)
    await assert.rejects(f.service.quoteReturn(actor, 8, f.input), { code: 'PURCHASE_RETURN_SELECTION_CONFLICT' })
    assert.deepEqual(f.calls.slice(-2), [['rollback'], ['release']])
  }
})

test('原批次分配保存逐件ID及原来源、稳定排序且不修改快照，不按付款状态改变采购退回原值', async () => {
  const f = quoteFixture(), scope = { allStores: false, storeIds: [1, 2] }
  const before = structuredClone(f.selection)
  const selection = parsePurchaseReturnSelection(f.input)
  const plan = allocatePurchaseReturn({ purchase: f.purchase, scope, currentQuantity: 4, ...selection, selected: f.selection })
  assert.equal(plan.quantity, 3); assert.equal(plan.costCents, 3750)
  assert.deepEqual(plan.allocations.map(row => ({ accessory: row.accessory_id, purchase: row.stock_in_id,
    source: row.source_event_id, store: row.store_id, serials: row.serial_ids })), [
    { accessory: 31, purchase: 8, source: 11, store: 1, serials: [] },
    { accessory: 31, purchase: 8, source: 12, store: 2, serials: [91] }
  ])
  assert.deepEqual(f.selection, before)
  const unpaid = await f.service.quoteReturn(actor, 8, f.input)
  f.events.push(f.pay(1))
  const paid = await f.service.quoteReturn(actor, 8, f.input)
  assert.deepEqual(paid.data, unpaid.data)
  assert.equal(paid.total_amount, unpaid.total_amount)
  assert.equal(paid.payment_status, 'paid'); assert.equal(unpaid.payment_status, 'unpaid')
  for (const result of [paid, unpaid]) {
    assert.equal(result.payable_reduction, undefined); assert.equal(result.refund_amount, undefined)
    for (const row of result.data) {
      assert.equal(row.serial_ids, undefined); assert.equal(row.accessory_id, undefined)
      assert.equal(row.stock_in_id, undefined); assert.equal(row.source_event_id, undefined)
    }
  }
})

test('多店混合SN分配保留每件实物及用途，输入顺序不同结果一致，金额按分守恒', () => {
  const f = quoteFixture(), scope = { allStores: false, storeIds: [1, 2] }
  const purchase = { ...f.purchase, purchase_cost: '0.29', total_amount: '14.50' }
  const selected = { batches: [
    { ...f.selection.batches[0], purchase_cost: '0.29', quantity: 3 },
    { ...f.selection.batches[1], purchase_cost: '0.29', quantity: 2 },
    { ...f.selection.batches[1], row_key: 'event:13', store_id: 1, store_name: '一店', purchase_cost: '0.29', quantity: 1, usage_type: 'sale' }
  ], serials: [
    { ...f.selection.serials[0], id: 93, serial_number: '000C', purchase_cost: '0.29' },
    { ...f.selection.serials[0], id: 92, serial_number: '000B', purchase_cost: '0.29' },
    { ...f.selection.serials[0], id: 94, serial_number: '000D', purchase_cost: '0.29', store_id: 1 }
  ] }
  const input = { purchase, scope, currentQuantity: 6, batches: [{ row_key: 'event:11', quantity: 2 }], serialIds: [94, 93, 92], selected }
  const plan = allocatePurchaseReturn(input)
  assert.equal(plan.quantity, 5); assert.equal(plan.costCents, 145)
  assert.deepEqual(plan.allocations.map(row => [row.row_key, row.store_id, row.usage_type, row.serial_numbers]), [
    ['event:11', 1, 'sale', []], ['event:13', 1, 'sale', ['000D']], ['event:12', 2, 'gift', ['000B', '000C']]
  ])
  const reordered = allocatePurchaseReturn({ ...input, serialIds: [...input.serialIds].reverse(),
    selected: { batches: [...selected.batches].reverse(), serials: [...selected.serials].reverse() } })
  assert.deepEqual(reordered, plan)
  assert.equal(plan.allocations.reduce((sum, row) => sum + Math.round(row.purchase_cost * 100) * row.quantity, 0), plan.costCents)
})

test('未核对历史来源、超原批次当前量、付款链错误及候选查询失败不返回试算，清理只读事务', async () => {
  for (const reason of ['untracked', 'total', 'payment', 'query', 'originalScope']) {
    const f = quoteFixture()
    if (reason === 'untracked') f.inventory.purchaseOrigin = async () => ({ event_count: 0 })
    if (reason === 'total') f.input.batches[0].quantity = 4
    if (reason === 'payment') f.events.push(f.pay(1), f.pay(2))
    if (reason === 'query') f.inventory.purchaseReturnSelection = async () => { throw new Error('选择查询失败') }
    await assert.rejects(f.service.quoteReturn(reason === 'originalScope' ? { id: 7, store_ids: [2] } : actor, 8, f.input),
      reason === 'query' ? /选择查询失败/ : { statusCode: reason === 'originalScope' ? 404 : 409 })
    assert.deepEqual(f.calls.slice(-2), [['rollback'], ['release']])
  }
})

test('原采购零成本允许零额试算，未付款仅展示原价格而不生成冲应付或退款', async () => {
  const f = quoteFixture(); f.purchase.purchase_cost = '0.00'; f.purchase.total_amount = '0.00'
  f.inventory.purchaseOrigin = async () => ({ event_count: 1, quantity: 50, min_cost: '0.00', max_cost: '0.00', invalid_count: 0 })
  f.selection.batches.forEach(row => { row.purchase_cost = '0.00' }); f.selection.serials.forEach(row => { row.purchase_cost = '0.00' })
  const result = await f.service.quoteReturn(actor, 8, f.input)
  assert.equal(result.total_amount, 0); assert.equal(result.payment_status, 'unpaid')
  assert.equal(result.refund_amount, undefined); assert.equal(result.payable_reduction, undefined)
})

test('试算SN与批次候选SQL精确限定原实际商品/采购/在库及授权当前店，候选全绑定不分页或写库', async () => {
  const calls = [], inventory = new InventoryRepository()
  const executor = { async query(sql, params) { calls.push({ sql, params }); return /FROM accessory_serials/.test(sql)
    ? [[{ id: 91, serial_number: '000ABC', store_id: 2, purchase_cost: '12.50' }]] : [[]] } }
  const input = { accessoryId: 31, stockInId: 8, scope: { allStores: false, storeIds: [2] }, serialIds: [91], batchEventIds: [11] }
  await inventory.purchaseReturnSelection(input, executor)
  assert.match(calls[0].sql, /sn.accessory_id = \? AND sn.stock_in_id = \? AND sn.status = 'in_stock'/)
  assert.deepEqual(calls[0].params, [31, 8, 91, 2])
  assert.match(calls[1].sql, /g.stock_in_id = \? AND g.quantity > 0/)
  assert.match(calls[1].sql, /g.serial_tracking = 0 AND g.event_id IN/)
  assert.match(calls[1].sql, /g.serial_tracking = 1 AND g.store_id IN/)
  assert.deepEqual(calls[1].params, [31, 2, 8, 11, 2])
  for (const call of calls) {
    assert.equal((call.sql.match(/\?/g) || []).length, call.params.length)
    assert.doesNotMatch(call.sql, /template_id|LIMIT|FOR UPDATE|INSERT|UPDATE |DELETE/)
  }
  calls.length = 0
  await inventory.purchaseReturnSelection({ ...input, serialIds: [], batchEventIds: [] }, executor)
  assert.deepEqual(calls, [])
})

test('试算两个模块必要字段缺失在读取前拒绝，SN隐藏仅允许普通试算；拒绝查询参数', async () => {
  for (const field of ['purchase.quantity', 'payment.purchase_cost', 'payment.payment_status', 'stock_info.distribution',
    'stock_info.total_quantity', 'price_info.purchase_cost', 'basic_info.usage_type', 'basic_info.serial_tracking', 'basic_info.serial_number']) {
    const fields = { async getPermissions() { return { hiddenFields: [field] } } }
    const controller = new Controller({ service: { quoteReturn() { assert.fail('不应调用业务') } }, returnFieldAccess: fields, inventoryFieldAccess: fields })
    const res = response(); await controller.quoteReturn({ user: actor, params: { id: '8' }, query: {}, body: { batches: [], serial_ids: [91] } }, res)
    assert.equal(res.code, 403)
  }
  const f = quoteFixture(); f.selection.serials = []; f.selection.batches = f.selection.batches.filter(row => row.serial_tracking === 0)
  const access = { async getPermissions() { return { hiddenFields: ['basic_info.serial_number'] } } }
  const controller = new Controller({ service: f.service, returnFieldAccess: access, inventoryFieldAccess: access })
  const req = { user: actor, params: { id: '8' }, query: {}, body: { batches: f.input.batches, serial_ids: [] } }
  const res = response(); await controller.quoteReturn(req, res)
  assert.equal(res.body.success, true); assert.equal(res.body.data.total_amount, 25)
  const invalid = response(); await controller.quoteReturn({ ...req, query: { store_id: 1 } }, invalid)
  assert.equal(invalid.code, 400)
})
