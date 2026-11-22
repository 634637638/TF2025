'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const SalesCheckoutService = require('../src/services/sales-checkout.service')
const SalesPhoneService = require('../src/services/sales-phone.service')
const AccessoryService = require('../src/services/accessory.service')
const InventoryService = require('../src/services/inventory.service')
const { normalizeQuickCheckoutPhone } = require('../src/utils/quick-checkout-phone')
const { normalizeCheckoutGoods } = require('../src/utils/checkout-goods-input')
const Controller = require('../src/controllers/sales-checkout.controller')
const QueryMutationService = require('../src/services/query-mutation.service')
const { assertStandaloneSale } = require('../src/utils/sale-input')
const CustomerPointsLedgerService = require('../src/services/customer-points-ledger.service')
const { ledgerExecutor } = require('./helpers/customer-points-ledger')
const inventoryFixture = require('./helpers/accessory-inventory')
const { normalizePointsConfig, quoteCustomerPoints } = require('../src/utils/customer-points-rules')
const { normalizeDateTimeWithCurrentTime } = require('../src/utils/time')

const actor = { id: 7, store_ids: [1, 2], name: '操作员' }
const request = () => ({ request_key: 'a'.repeat(32), store_id: 1, operator_id: 8,
  sale_time: '2026-11-13 12:00:00', customer_info: { name: '测试客户', phone: '13800138000' },
  phones: [{ phone_id: 12, sale_price: 100 }, { phone_id: 13, sale_price: 200 }],
  accessories: [{ key: 'buy', accessory_id: 5, quantity: 2, unit_price: 150, sale_type: 'sale', linked_phone_id: 12 },
    { key: 'gift', accessory_id: 5, quantity: 1, unit_price: 0, sale_type: 'gift', linked_phone_id: 13, serial_numbers: ['00aa'] }],
  payment_info: { payment_method: 'cash', payment_amount: 600 }, remarks: '整批一个备注' })

function fixture({ failAt, denied = [], granted = [], initialPoints = 10, phoneStore = 1, goodsStore = 1, deadlocks = 0, source = { validSupplier: true, inStock: false }, validReferences = true, duplicateCustomer = false, pointsConfig, trackedPoints = 0, ledgerInstalled = true, goodsCommissionRule, transactionFailure, normalizeGoodsTime = value => `${String(value).slice(0, 10)} 10:20:30` } = {}) {
  const state = { orders: [], items: [], payments: [], sales: [], accessorySales: [], stock: 4,
    points: initialPoints, entries: trackedPoints ? [{ id: 1, customer_id: 9, entry_type: 'award', source_type: 'phone_sale', source_id: 999, points: trackedPoints }] : [], allocations: [], customerUpdates: [], sold: [], staged: [], serials: [{ id: 1, serial_number: '00AA', accessory_id: 5, store_id: goodsStore,
      status: 'in_stock', stock_in_id: 30, purchase_cost: '10.25' }], serialEvents: [] }
  let snapshot, failure = failAt, tail = Promise.resolve(), remainingDeadlocks = deadlocks, active = false
  const events = [], check = db => assert.equal(db, connection)
  const connection = {
    async beginTransaction() { assert.equal(active, false); events.push('begin'); if (transactionFailure === 'begin') throw new Error('begin-failed'); active = true; snapshot = structuredClone(state) },
    async commit() { assert.equal(active, true); events.push('commit'); if (transactionFailure === 'commit') throw new Error('commit-failed'); active = false },
    async rollback() { assert.equal(active, true); events.push('rollback'); if (transactionFailure === 'rollback') throw new Error('rollback-failed'); active = false; Object.assign(state, snapshot) },
    destroy() { events.push('destroy'); active = false }
  }
  const customers = { get 9() { return state.points }, set 9(value) { state.points = value } }
  const executor = ledgerExecutor({ getState: () => ({ customers, entries: state.entries, allocations: state.allocations }),
    isActive: () => active, getFailure: () => failure, installed: ledgerInstalled })
  connection.execute = executor.execute
  const pointsLedger = new CustomerPointsLedgerService({ tableExists: async () => ledgerInstalled })
  const repository = {
    async withConnection(operation) {
      const previous = tail
      let release
      tail = new Promise(resolve => { release = resolve })
      await previous
      try { return await operation(connection) } finally { release(); events.push('release') }
    },
    async findRequest(db, key) { check(db); if (remainingDeadlocks-- > 0) throw Object.assign(new Error('deadlock'), { code: 'ER_LOCK_DEADLOCK' }); return state.orders.find(row => row.request_key === key) },
    async validStore(db, id) { check(db); return id === 1 || id === 2 },
    async seller(db, id) { check(db); return id === 8 ? { id, name: '销售员', ...(goodsCommissionRule === undefined ? {} : {
      salary_template_id: 4, goods_commission_rule: goodsCommissionRule }) } : null },
    async customerByPhone(db) { check(db); return { id: 9, points: state.points } },
    async lockCustomer(db) { check(db); return { id: 9, points: state.points } },
    async awardPoints(db, id, points) { check(db); if (failure === 'points') return false; state.points += points; return true },
    async phoneSnapshots(db, ids) { check(db); return ids.map(id => ({ id, is_new: state.staged.find(row => row.id === id)?.values[10] ?? (id === 12 ? 1 : 0), store_id: phoneStore, imei: `IMEI-${id}`, brand_name: '旧品牌' })) },
    async createOrder(db, row) { check(db); const id = state.orders.length + 1; state.orders.push({ ...row, id }); return id },
    async sales(db, ids) { check(db); return state.sales.filter(row => ids.includes(row.id)).map(row => ({ id: row.id, phone_id: row.phoneId, sale_price: row.salePrice, purchase_cost: row.purchaseCost, invoice_number: row.invoiceNumber, points_awarded: row.points })) },
    async createItem(db, row) { check(db); if (failure === 'item' && row.type === 'accessory') throw new Error('item-failed'); const id = state.items.length + 1; state.items.push(structuredClone({ ...row, id })); return id },
    async linkPayments(db, ids, orderId) { check(db); for (const row of state.payments.filter(row => ids.includes(row.id))) row.sales_order_id = orderId },
    async createPayment(db, row) { check(db); if (failure === 'payment') throw new Error('payment-failed'); const id = state.payments.length + 1; state.payments.push({ ...row, id, orderId: null, sales_order_id: row.order_id }); return id },
    async completeOrder(db, row) { check(db); if (failure === 'complete') throw new Error('complete-failed'); Object.assign(state.orders.find(order => order.id === row.id), row, { checkout_result: structuredClone(row.result) }) }
  }
  const config = normalizePointsConfig(pointsConfig || { include_accessories: true })
  const phones = new SalesPhoneService({ repository: {
    async withConnection() { assert.fail('外层事务不得重新租连接') },
    async findCustomerByPhone(db) { check(db); return { id: 9, name: '测试客户' } },
    async updateCustomer(db, row) { check(db); state.customerUpdates.push(row) },
    async findPhonesForSale(db, ids) { check(db); return ids.map(id => ({ id, store_id: phoneStore, purchase_cost: state.staged.some(row => row.id === id) ? state.staged.find(row => row.id === id).values[8] : 80, status: state.sold.includes(id) ? 'sold' : 'in_stock', is_new: state.staged.find(row => row.id === id)?.values[10] ?? (id === 12 ? 1 : 0) })) },
    async findDuplicateSales(db) { check(db); return [] },
    async createSale(db, row) { check(db); const id = state.sales.length + 21; state.sales.push({ ...row, id }); return id },
    async createPayment(db, row) { check(db); const id = state.payments.length + 1; state.payments.push({ ...row, id }); return id },
    async markPhoneSold(db, row) { check(db); state.sold.push(row.phoneId); return { affectedRows: 1 } }
  }, normalizeDate: value => value || '2026-11-13 12:00:00', prepareInvoiceTransaction: async () => assert.fail('外层事务不得初始化序列表'),
  inspectColumn: async () => true, generateInvoice: async () => `INV-${state.sales.length}`,
  reconcilePoints: async values => {
    check(values.executor)
    const points = quoteCustomerPoints({ config: values.config, available_points: state.points,
      items: [{ key: String(values.saleId), source: values.isNew ? 'new' : 'used', amount_cents: Math.round(values.salePrice * 100), is_gift: false, redeem_points: 0 }] }).points_awarded
    state.sales.find(row => row.id === values.saleId).points = points
    if (!await pointsLedger.applyDelta(values.executor, { customerId: 9, delta: points, sourceType: 'phone_sale', sourceId: values.saleId })) state.points += points
    return { points, eligibleAmount: values.salePrice }
  } })
  const product = { id: 5, name: '原商品', status: 1, category_id: 1, brand_name: '实际品牌', product_model: 'MWVW3CH' }
  const accessories = new AccessoryService({ repository: {
    async getAccessoryById(id, db) { check(db); return id === 5 ? product : null },
    async lockAccessory(id, db) { check(db); return product },
    async lockStoreStock(id, store, db) { check(db); return store === goodsStore ? { quantity: state.stock } : null },
    async countStockSerials(id, store, db) { check(db); return state.serials.filter(row => row.store_id === store && row.status === 'in_stock').length },
    async lockSerials(numbers, db) { check(db); return state.serials.filter(row => numbers.includes(row.serial_number)) },
    async createSalesRecord(row, db) { check(db); const id = state.accessorySales.length + 1; state.accessorySales.push({ ...row, id }); return id },
    async markSerialOut(id, saleId, type, time, db) { check(db); state.serials.find(row => row.id === id).status = type === 'gift' ? 'gifted' : 'sold'; return true },
    async createSerialEvent(row, db) { check(db); if (failure === 'serial') throw new Error('serial-failed'); state.serialEvents.push(row) },
    async deductStock(id, store, quantity, db) { check(db); if (store !== goodsStore || state.stock < quantity) return false; state.stock -= quantity; return true }
  }, inventoryService: inventoryFixture(state, check) })
  const inventory = new InventoryService({ repository: {
    async validateQuickSaleReferences(db) { check(db); return validReferences },
    async validateQuickCheckoutSource(db) { check(db); return source },
    async hasCustomerPhoneDuplicate(db) { check(db); return duplicateCustomer },
    async createQuickSalePhone(db, values) { check(db); const id = 900 + state.staged.length; state.staged.push({ id, values }); return id }
  } })
  const service = new SalesCheckoutService({ repository, phones, accessories, inventory, pointsLedger,
    normalizeDateWithCurrentTime: normalizeGoodsTime,
    creditPoints: async (db, id, points, { sources }) => {
      assert.deepEqual(sources, state.items.filter(row => row.type === 'accessory').map(row => ({ item_id: row.id, points: row.points_awarded })))
      assert.equal(sources.reduce((sum, row) => sum + row.points, 0), points)
      if (points && failure === 'points') throw new Error('points-failed')
      for (const source of sources) if (!await pointsLedger.applyDelta(db, { customerId: id, delta: source.points, sourceType: 'checkout_item', sourceId: source.item_id })) state.points += source.points
    },
    getPointsConfig: async db => { check(db); return config }, prepareInvoice: async db => { check(db); events.push('prepare') },
    permissionCheck: async (user, permission) => { assert.ok(user.id > 0); return granted.includes(permission) || !permission.startsWith('query:goods-') && !denied.includes(permission) }, createOrderNo: () => 'SO-TEST' })
  return { service, state, events, product, initial: structuredClone(state), retry() { failure = null } }
}

const quickRequest = () => {
  const body = request()
  body.phones = []
  body.quick_phone = { brand_id: 1, model_id: 2, color_id: 3, memory_id: 4, supplier_id: 5, is_new: 1,
    imei: '123456789012345', serial_number: 'SN0001', purchase_cost: 70.25, sale_price: 100, inventory_time: '2026-11-13' }
  body.accessories.forEach(row => { row.linked_phone_id = 1 })
  body.payment_info.payment_amount = 400
  return body
}

test('快速出库混合单：新设备、销售、商品、收款同事务，原请求重试不重建设备', async () => {
  const f = fixture(), body = quickRequest()
  const result = await f.service.checkout(body, actor)
  assert.equal(result.total_amount, 400)
  assert.equal(f.state.staged.length, 1)
  assert.equal(f.state.sales.length, 1)
  assert.equal(f.state.sales[0].phoneId, 900)
  assert.equal(f.state.sales[0].purchaseCost, 70.25)
  assert.deepEqual(f.state.staged[0].values.slice(11, 15), [5, 1, 'in_stock', 'A'])
  assert.equal(f.state.staged[0].values[1], actor.id)
  const phoneItem = f.state.items.find(row => row.type === 'phone')
  assert.ok(f.state.items.filter(row => row.type === 'accessory').every(row => row.linked_phone_sale_id === phoneItem.sale_id))
  assert.equal(f.state.payments.reduce((sum, row) => sum + row.amount, 0), 400)
  assert.deepEqual(await f.service.checkout(body, actor), result)
  assert.equal(f.state.staged.length, 1)
  assert.equal(f.events.filter(event => event === 'commit').length, 2)
  const changed = quickRequest(); changed.quick_phone.purchase_cost = 71
  await assert.rejects(f.service.checkout(changed, actor), { code: 'CHECKOUT_REQUEST_CONFLICT' })
  assert.equal(f.state.staged.length, 1)
})

test('快速出库后任一商品落账失败，新设备及手机交易一并回滚，原键可安全重试', async () => {
  for (const failAt of ['item', 'serial', 'payment', 'complete']) {
    const f = fixture({ failAt })
    await assert.rejects(f.service.checkout(quickRequest(), actor))
    assert.deepEqual(f.state, f.initial)
    f.retry()
    await f.service.checkout(quickRequest(), actor)
    assert.equal(f.state.staged.length, 1)
    assert.equal(f.state.sales.length, 1)
  }
})

test('快速设备未知采购成本保持NULL，整单成本和利润不伪造为0', async () => {
  const f = fixture(), body = quickRequest()
  body.quick_phone.purchase_cost = null
  await f.service.checkout(body, actor)
  assert.equal(f.state.staged[0].values[8], null)
  assert.equal(f.state.sales[0].purchaseCost, null)
  assert.equal(f.state.items.find(row => row.type === 'phone').purchase_cost, null)
  assert.equal(f.state.orders[0].total_cost, null)
  assert.equal(f.state.orders[0].total_profit, null)
})

test('快速共同结算独立核验快速销售、查询和赠送权限，不用普通销售权限代替', async () => {
  for (const permission of ['inventory:sell', 'query:view', 'query:create', 'accessories:gift']) {
    const f = fixture({ denied: [permission] })
    await assert.rejects(f.service.checkout(quickRequest(), actor), { statusCode: 403 })
    assert.deepEqual(f.state, f.initial)
    assert.ok(!f.events.includes('begin'))
  }
})

test('快速新建拒绝停用资料、非手机供应商、在库IMEI及同客户重复设备，不留下客户资料更新', async () => {
  for (const options of [{ validReferences: false }, { source: { validSupplier: false, inStock: false } },
    { source: { validSupplier: true, inStock: true } }, { duplicateCustomer: true }]) {
    const f = fixture(options)
    await assert.rejects(f.service.checkout(quickRequest(), actor), error => [400, 409].includes(error.statusCode))
    assert.deepEqual(f.state, f.initial)
  }
})

test('快速设备价格精度、身份和不支持字段不能绕过共同结算校验', async () => {
  for (const patch of [{ status: 'peer_transfer' }, { is_new: 2 }, { supplier_id: null }, { purchase_cost: -1 },
    { purchase_cost: 1.001 }, { sale_price: 0 }, { serial_number: 'a' }, { imei: 'bad' }, { inventory_time: 'bad' }]) {
    assert.throws(() => normalizeQuickCheckoutPhone({ ...quickRequest().quick_phone, ...patch }), { statusCode: 400 })
  }
  const valid = normalizeQuickCheckoutPhone({ ...quickRequest().quick_phone, purchase_cost: null, serial_number: 'noimei', imei: 'NOIMEI' })
  assert.equal(valid.purchase_cost, null)
  assert.equal(valid.serial_number, 'NOIMEI')
  const f = fixture(), body = quickRequest()
  body.phones = [{ phone_id: 12, sale_price: 100 }]
  await assert.rejects(f.service.checkout(body, actor), { statusCode: 400 })
})

test('共同结算允许按出库确认调整手机入库成本，并保存到手机销售和订单快照', async () => {
  const f = fixture(), body = request()
  body.phones[0].purchase_cost = 77.77
  body.phones[1].purchase_cost = 88.88
  await f.service.checkout(body, actor)
  assert.deepEqual(f.state.sales.map(row => row.purchaseCost), [77.77, 88.88])
  assert.deepEqual(f.state.items.filter(row => row.type === 'phone').map(row => row.purchase_cost), [77.77, 88.88])
})

test('混合批量结算复用真实手机/商品服务：独立销售、共用备注、逐条关联、SN、积分、收款均同事务', async () => {
  const f = fixture(), result = await f.service.checkout(request(), actor)
  assert.equal(result.total_amount, 600)
  assert.equal(result.points_earned, 5)
  assert.equal(f.state.points, 15)
  assert.equal(f.state.stock, 1)
  assert.deepEqual(f.state.sales.map(row => row.remarks), ['整批一个备注', '整批一个备注'])
  assert.deepEqual(f.state.accessorySales.map(row => row.remarks), ['整批一个备注', '整批一个备注'])
  assert.deepEqual(f.state.items.filter(row => row.type === 'accessory').map(row => [row.key, row.linked_phone_sale_id]), [['goods:buy', 21], ['goods:gift', 22]])
  assert.deepEqual(f.state.payments.map(row => [row.orderId, row.sales_order_id, row.amount]), [[21, 1, 100], [22, 1, 200], [null, 1, 300]])
  assert.equal(f.state.serials[0].status, 'gifted')
  assert.equal(f.state.accessorySales[0].operator_id, 8)
  assert.equal(f.state.serialEvents[0].operator_id, 7)
  assert.equal(f.state.orders[0].total_cost, null, '历史普通库存未知成本不得算成0')
  assert.deepEqual(f.events, ['prepare', 'begin', 'commit', 'release'])
  f.product.name = '后续改名'
  assert.equal(f.state.items.find(row => row.type === 'accessory').snapshot.name, '原商品')
  assert.equal('purchase_cost' in result, false)
})

test('相同请求及并发模拟只落一单，不重复扣库存/积分；同键变更内容或操作者拒绝', async () => {
  const f = fixture(), body = request()
  const [first, second] = await Promise.all([f.service.checkout(body, actor), f.service.checkout(body, actor)])
  assert.deepEqual(first, second)
  const before = structuredClone(f.state)
  assert.deepEqual(await f.service.checkout(body, actor), first)
  assert.deepEqual(f.state, before)
  await assert.rejects(f.service.checkout({ ...body, remarks: '不同内容' }, actor), { statusCode: 409 })
  await assert.rejects(f.service.checkout(body, { ...actor, id: 9 }), { statusCode: 409 })
  assert.deepEqual(f.state, before)
})

test('赠品原单约定单价独立保存快照，不增加收款、积分或商品售价，改商品现价不能覆盖', async () => {
  const f = fixture(), body = request()
  body.accessories[1].gift_return_unit_price = '20.50'
  const result = await f.service.checkout(body, actor)
  const gift = f.state.items.find(row => row.key === 'goods:gift')
  assert.equal(gift.snapshot.gift_return_unit_price, 20.5)
  assert.equal(gift.unit_price, 0)
  assert.equal(gift.points_awarded, 0)
  assert.equal(result.total_amount, 600)
  f.product.sale_price = 999
  assert.equal(gift.snapshot.gift_return_unit_price, 20.5)
  assert.deepEqual(await f.service.checkout(body, actor), result)
  await assert.rejects(f.service.checkout({ ...body, accessories: body.accessories.map(row => row.sale_type === 'gift'
    ? { ...row, gift_return_unit_price: 30 } : row) }, actor), { code: 'CHECKOUT_REQUEST_CONFLICT' })
})

test('未约定和明确约定0元分别保留，缺省新字段不改变旧结算请求摘要', async () => {
  const f = fixture(), body = request()
  assert.equal(Object.hasOwn(f.service.normalize(body, actor).accessories[1], 'gift_return_unit_price'), false)
  await f.service.checkout(body, actor)
  assert.equal(f.state.items.find(row => row.key === 'goods:gift').snapshot.gift_return_unit_price, null)
  const zero = fixture(), zeroBody = request()
  zeroBody.accessories[1].gift_return_unit_price = 0
  await zero.service.checkout(zeroBody, actor)
  assert.equal(zero.state.items.find(row => row.key === 'goods:gift').snapshot.gift_return_unit_price, 0)
})

test('赠品约定单价拒绝负数、超精度、非数值或整行越界，普通商品不接受赠品约定字段', async () => {
  for (const value of [-1, '1.001', '', true, {}, '100000000']) {
    const f = fixture(), body = request()
    body.accessories[1].gift_return_unit_price = value
    await assert.rejects(f.service.checkout(body, actor), { statusCode: 400 })
    assert.deepEqual(f.state, f.initial)
    assert.deepEqual(f.events, [])
  }
  const f = fixture(), body = request()
  body.accessories[1].quantity = 2
  body.accessories[1].gift_return_unit_price = 99999999.99
  await assert.rejects(f.service.checkout(body, actor), { statusCode: 400 })
  body.accessories[1].quantity = 1
  delete body.accessories[1].gift_return_unit_price
  body.accessories[0].gift_return_unit_price = 10
  await assert.rejects(f.service.checkout(body, actor), { statusCode: 400 })
  assert.deepEqual(f.state, f.initial)
})

for (const failAt of ['item', 'serial', 'payment', 'points', 'complete']) test(`后段${failAt}失败回滚手机、收款、客户、SN、库存及明细，原请求可重新成功提交`, async () => {
  const f = fixture({ failAt })
  await assert.rejects(f.service.checkout(request(), actor))
  assert.deepEqual(f.state, f.initial)
  assert.ok(f.events.includes('rollback'))
  f.retry()
  assert.equal((await f.service.checkout(request(), actor)).order_id, 1)
  assert.equal(f.state.orders.length, 1)
})

test('单卖商品与纯赠品不伪造手机销售或手机收款ID，已知SN成本真实保留', async () => {
  for (const gift of [true, false]) {
    const f = fixture(), body = request()
    body.phones = []
    body.accessories = [{ ...body.accessories[1], linked_phone_id: null, sale_type: gift ? 'gift' : 'sale', unit_price: gift ? 0 : 150 }]
    body.payment_info.payment_amount = gift ? 0 : 150
    const result = await f.service.checkout(body, actor)
    assert.equal(f.state.sales.length, 0)
    assert.equal(f.state.stock, 3)
    assert.equal(f.state.orders[0].total_cost, 10.25)
    assert.equal(result.points_earned, gift ? 0 : 1)
    assert.equal(f.state.payments.length, gift ? 0 : 1)
    assert.equal(f.state.payments[0]?.orderId ?? null, null)
  }
})

test('独立商品购买和赠送保留补单日期，时分秒及收款时间取提交时刻', async () => {
  for (const gift of [false, true]) {
    const f = fixture(), body = request()
    body.phones = []
    body.sale_time = '2026-11-18'
    body.accessories = [{ ...body.accessories[1], linked_phone_id: null, sale_type: gift ? 'gift' : 'sale', unit_price: gift ? 0 : 150 }]
    body.payment_info.payment_amount = gift ? 0 : 150
    await f.service.checkout(body, actor)
    assert.equal(f.state.orders[0].time, '2026-11-18 10:20:30')
    assert.equal(f.state.items[0].time, '2026-11-18 10:20:30')
    assert.equal(f.state.accessorySales[0].sale_time, '2026-11-18 10:20:30')
    if (!gift) assert.equal(f.state.payments[0].time, '2026-11-18 10:20:30')
  }
})

test('补单时间工具校验北京时间日期并保留重试幂等身份', async () => {
  assert.equal(normalizeDateTimeWithCurrentTime('2026-11-18', () => '2026-11-20 09:08:07'), '2026-11-18 09:08:07')
  assert.equal(normalizeDateTimeWithCurrentTime('2026-02-30', () => '2026-11-20 09:08:07'), null)
  assert.equal(normalizeDateTimeWithCurrentTime('2026-11-18', () => 'not-a-time'), null)

  let currentTime = '2026-11-20 09:08:07'
  const f = fixture({ normalizeGoodsTime: date => `${String(date).slice(0, 10)} ${currentTime.slice(11)}` })
  const body = request()
  body.request_key = 'b'.repeat(32)
  body.phones = []
  body.sale_time = '2026-11-18'
  body.accessories = [{ ...body.accessories[0], linked_phone_id: null, quantity: 1 }]
  body.payment_info.payment_amount = 150
  const first = await f.service.checkout(body, actor)
  currentTime = '2026-11-20 09:09:10'
  const retry = await f.service.checkout(body, actor)
  assert.deepEqual(retry, first)
  assert.equal(f.state.orders.length, 1)
  assert.equal(f.state.orders[0].time, '2026-11-18 09:08:07')
})

test('商品数量行逐件积分和实付分组保存原单，改当前商品不改历史，重试不重建分组', async () => {
  for (const price of [99, 150]) {
    const f = fixture(), body = request()
    body.phones = []
    body.accessories = [{ ...body.accessories[0], unit_price: price, linked_phone_id: null }]
    body.payment_info.payment_amount = price * 2
    const result = await f.service.checkout(body, actor)
    const saved = structuredClone(f.state.items[0])
    const pointsPerUnit = price === 99 ? 0 : 1
    assert.equal(result.points_earned, pointsPerUnit * 2)
    assert.equal(saved.points_awarded, pointsPerUnit * 2)
    assert.deepEqual(saved.snapshot.points_units, [{ quantity: 2, points_used: 0, deduction_cents: 0,
      payable_cents: price * 100, points_awarded: pointsPerUnit }])
    f.product.sale_price = 999
    await f.service.checkout(body, actor)
    assert.equal(f.state.items.length, 1)
    assert.deepEqual(f.state.items[0], saved)
  }
})

test('手机/商品/赠送权限分别核验，任一不足均在事务前拒绝', async () => {
  for (const denied of [['accessories:sell'], ['accessories:gift'], ['sales:sell', 'inventory:sell']]) {
    const f = fixture({ denied })
    await assert.rejects(f.service.checkout(request(), actor), { statusCode: 403 })
    assert.deepEqual(f.state, f.initial)
    assert.deepEqual(f.events, [])
  }
})

test('错误关联、未选实际商品、积分抵扣、金额不符、未授权来源手机和库存不足均不留下任何部分事实', async () => {
  const edits = [
    body => { body.accessories[0].linked_phone_id = 99 }, body => { delete body.accessories[0].accessory_id },
    body => { body.accessories[0].redeem_points = 1 }, body => { body.redeem_points = -1 },
    body => { body.payment_info.payment_amount = 599 }, body => { body.accessories[0].quantity = 4 },
    body => { body.accessories[1].serial_numbers = ['WRONG'] }, body => { body.operator_id = 99 },
    body => { body.store_id = 3 }, body => { body.accessories[0].key = body.accessories[1].key },
    body => { body.accessories[0].unit_price = '1.001' }
  ]
  for (const edit of edits) {
    const f = fixture(), body = request(); edit(body)
    await assert.rejects(f.service.checkout(body, actor))
    assert.deepEqual(f.state, f.initial)
  }
  const f = fixture({ phoneStore: 3 })
  await assert.rejects(f.service.checkout(request(), actor), { statusCode: 403, code: 'STORE_SCOPE_DENIED' })
  assert.deepEqual(f.state, f.initial)
})

test('授权跨店共同结算：一店手机由二店销售，普通及SN商品只扣二店，来源及成本快照保留', async () => {
  const f = fixture({ phoneStore: 1, goodsStore: 2 }), body = request()
  body.store_id = 2
  const quoted = await f.service.quote(body, actor)
  assert.equal(quoted.payable_cents, 60000)
  assert.deepEqual(f.state, f.initial, '试算不能写销售或库存')
  const result = await f.service.checkout(body, actor)
  assert.equal(f.state.orders[0].store_id, 2)
  assert.deepEqual(f.state.sales.map(row => row.storeId), [2, 2])
  assert.deepEqual(f.state.accessorySales.map(row => row.store_id), [2, 2])
  assert.equal(f.state.stock, 1)
  assert.equal(f.state.serials[0].store_id, 2)
  assert.equal(f.state.serials[0].status, 'gifted')
  assert.ok(f.state.inventoryEvents.length > 0)
  assert.ok(f.state.inventoryEvents.every(row => row.store_id === 2))
  assert.deepEqual(f.state.items.filter(row => row.type === 'phone').map(row => [row.snapshot.store_id, row.purchase_cost]), [[1, 80], [1, 80]])
  const saved = structuredClone(f.state)
  assert.deepEqual(await f.service.checkout(body, actor), result)
  assert.deepEqual(f.state, saved, '跨店原请求重试不得重复扣库或计分')
})

test('跨店共同结算试算及提交均要求销售店和每台手机来源店权限', async () => {
  for (const storeIds of [[1], [2]]) {
    for (const operation of ['quote', 'checkout']) {
      const f = fixture({ phoneStore: 1, goodsStore: 2 }), body = request()
      body.store_id = 2
      await assert.rejects(f.service[operation](body, { ...actor, store_ids: storeIds }), { statusCode: 403, code: 'STORE_SCOPE_DENIED' })
      assert.deepEqual(f.state, f.initial)
      if (storeIds[0] === 1) assert.deepEqual(f.events, [], '无销售门店权限须在事务前拒绝')
      else assert.ok(f.events.includes('rollback'), '无来源门店权限须整单回滚')
    }
  }
})

test('跨店销售不会借用手机来源店的商品库存或SN，失败不留半单', async () => {
  for (const wrongSerialStore of [false, true]) {
    const f = fixture({ phoneStore: 1, goodsStore: wrongSerialStore ? 2 : 1 }), body = request()
    body.store_id = 2
    if (wrongSerialStore) f.state.serials[0].store_id = 1
    const before = structuredClone(f.state)
    await assert.rejects(f.service.checkout(body, actor), { statusCode: 400, code: wrongSerialStore ? 'SERIAL_UNAVAILABLE' : 'INSUFFICIENT_STOCK' })
    assert.deepEqual(f.state, before)
    assert.ok(f.events.includes('rollback'))
  }
})

test('只重试受控锁冲突，达到次数后返回错误而不写半单', async () => {
  const f = fixture({ deadlocks: 2 })
  assert.equal((await f.service.checkout(request(), actor)).order_id, 1)
  assert.equal(f.events.filter(value => value === 'rollback').length, 2)
  const exhausted = fixture({ deadlocks: 3 })
  await assert.rejects(exhausted.service.checkout(request(), actor), { code: 'ER_LOCK_DEADLOCK' })
  assert.deepEqual(exhausted.state, exhausted.initial)
})

test('字段权限逐域覆盖嵌套价格/客户/店铺/SN；拒绝时不进入结算且内部错误不泄漏', async () => {
  for (const field of ['sale_price', 'purchase_cost', 'phone', 'store_id', 'unit_price', 'serial_numbers', 'gift_return_unit_price', 'redeem_points', 'operator_id', 'sale_time', 'sale_type']) {
    const access = { async getDeniedWrite(id, body, map) { assert.equal(id, 7); return body?.[field] !== undefined && map[field] ? map[field] : null } }
    const controller = new Controller({ permissionCheck: async () => true, service: { async checkout() { assert.fail('隐藏字段不应进入结算') } }, phoneAccess: access, goodsAccess: access })
    const res = { status(code) { this.code = code; return this }, json(value) { this.body = value; return this } }
    const body = request()
    if (field === 'purchase_cost') body.phones[0].purchase_cost = 80
    body.accessories[1].gift_return_unit_price = 20
    body.accessories[0].redeem_points = 1
    await controller.checkout({ body, user: actor }, res)
    assert.equal(res.code, 403)
  }
})

test('商品结算允许可见只读字段作为新交易资料提交，隐藏字段仍返回字段标识并拒绝', async () => {
  const checkedOptions = []
  const access = { async getDeniedWrite(_id, _body, map, options) {
    checkedOptions.push(options)
    return Object.values(map).includes('price_info.profit') ? 'price_info.profit' : undefined
  } }
  const controller = new Controller({ permissionCheck: async () => true, phoneAccess: access, goodsAccess: access,
    service: { async checkout() { return { order_no: 'TEST-ORDER' } } } })
  const response = () => ({ status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } })
  const allowed = response()
  await controller.checkout({ body: request(), user: actor }, allowed)
  assert.equal(allowed.body.success, true)
  assert.ok(checkedOptions.length > 0 && checkedOptions.every(options => options.visibleOnly === true))

  access.getDeniedWrite = async (_id, body, map) => body?.sale_time !== undefined ? map.sale_time : undefined
  const denied = response()
  await controller.checkout({ body: request(), user: actor }, denied)
  assert.equal(denied.statusCode, 403)
  assert.equal(denied.body.code, 'FIELD_PERMISSION_DENIED')
  assert.equal(denied.body.field, 'sale.sale_time')
})

test('仅售商品时销售员、日期和出库方式字段隐藏同样拒绝，不依赖手机字段校验', async () => {
  for (const [field, expected] of [['operator_id', 'operator_info.operator_name'], ['sale_time', 'time_info.created_at'], ['sale_type', 'basic_info.usage_type']]) {
    const checked = []
    const access = { async getDeniedWrite(id, body, map) {
      assert.equal(id, 7)
      if (body?.[field] !== undefined && map[field]) { checked.push(map[field]); return map[field] }
      return null
    } }
    const controller = new Controller({ permissionCheck: async () => true, service: { async checkout() { assert.fail('隐藏字段不可写入') } },
      phoneAccess: { async getDeniedWrite() { assert.fail('无手机明细不可依赖手机字段鉴权') } }, goodsAccess: access })
    const body = { ...request(), phones: [] }
    const res = { status(code) { this.code = code; return this }, json(value) { this.body = value; return this } }
    await controller.checkout({ body, user: actor }, res)
    assert.equal(res.code, 403)
    assert.equal(res.body.code, 'FIELD_PERMISSION_DENIED')
    assert.deepEqual(checked, [expected])
  }
})

test('快速共同结算的采购设备及客户字段均由后端拒绝隐藏字段写入', async () => {
  for (const field of ['brand_id', 'model_id', 'color_id', 'memory_id', 'supplier_id', 'imei', 'serial_number',
    'is_new', 'purchase_cost', 'inventory_time', 'sale_price', 'name', 'phone']) {
    const access = { async getDeniedWrite(id, body, map) { return body?.[field] !== undefined && map[field] ? map[field] : null } }
    const controller = new Controller({ permissionCheck: async () => true, service: { async checkout() { assert.fail('隐藏字段不应落账') } }, phoneAccess: access, goodsAccess: access })
    const res = { status(code) { this.code = code; return this }, json(value) { this.body = value; return this } }
    await controller.checkout({ body: quickRequest(), user: actor }, res)
    assert.equal(res.code, 403, field)
    assert.equal(res.body.code, 'FIELD_PERMISSION_DENIED')
  }
})

test('共同结算手机不能经旧退库或删除入口拆单，拒绝时不冲积分、不删记录并回滚', async () => {
  for (const action of ['returnToStock', 'deletePhoneRecord']) {
    const events = [], connection = { async beginTransaction() { events.push('begin') }, async rollback() { events.push('rollback') } }
    const repository = {
      withConnection: operation => operation(connection),
      async lockPhoneForReturn() { return [[{ status: 'sold', store_id: 1, checkout_order_id: 10 }]] },
      async lockPhoneForDelete() { return [[{ store_id: 1, checkout_order_id: 10 }]] }
    }
    const service = new QueryMutationService({ access: { async authorize() {} }, repository, reversePoints: () => assert.fail('不可先冲回积分') })
    const promise = action === 'returnToStock'
      ? service.returnToStock(12, 7, { return_reason: '客户退货', return_type: '退货处理', handle_method: '返厂维修', refund_amount: 100,
        refund_method: 'cash', reversal_date: '2026-11-13 12:00:00' }, { allStores: true })
      : service.deletePhoneRecord(12, { allStores: true })
    await assert.rejects(promise, { statusCode: 400, code: 'CHECKOUT_AFTERSALE_NOT_READY' })
    assert.deepEqual(events, ['begin', 'rollback'])
  }
  assert.doesNotThrow(() => assertStandaloneSale(null))
  assert.throws(() => assertStandaloneSale(10), { status: 400, code: 'CHECKOUT_AFTERSALE_NOT_READY' })
})

const redemptionConfig = { include_accessories: true, redemption: { enabled: true, points_per_yuan: 10,
  max_percent: 100, sources: ['accessory'], all_accessory_categories: true, category_ids: [] } }
const redeemRequest = () => {
  const body = request()
  body.accessories[0].redeem_points = 10
  body.payment_info.payment_amount = 599
  return body
}

test('共用商品输入保留稳定排序、原SN和旧幂等载荷，不把零积分或未约定金额补入摘要', () => {
  const f = fixture(), rows = request().accessories.reverse()
  rows[1].redeem_points = '0'
  const result = normalizeCheckoutGoods(rows, { phoneIds: new Set([12, 13]),
    normalizeSerials: value => f.service.accessories.normalizeSerials(value) })
  assert.deepEqual(result, { total_cents: 30000, items: [
    { key: 'buy', accessory_id: 5, quantity: 2, unit_price: 150, sale_type: 'sale', linked_phone_id: 12, serial_numbers: [] },
    { key: 'gift', accessory_id: 5, quantity: 1, unit_price: 0, sale_type: 'gift', linked_phone_id: 13, serial_numbers: ['00AA'] }
  ] })
  rows[0].gift_return_unit_price = '0'
  assert.equal(normalizeCheckoutGoods(rows, { phoneIds: new Set([12, 13]),
    normalizeSerials: value => f.service.accessories.normalizeSerials(value) }).items[1].gift_return_unit_price, 0)
  assert.equal(rows[0].serial_numbers[0], '00aa', '输入草稿不被规范化步骤修改')
})

test('共用商品输入拒绝损坏列表、重复行、跨手机关联和金额溢出', () => {
  const f = fixture(), options = { phoneIds: new Set([12, 13]),
    normalizeSerials: value => f.service.accessories.normalizeSerials(value) }
  for (const rows of [null, {}, Array(1001).fill(request().accessories[0]),
    [request().accessories[0], request().accessories[0]],
    [{ ...request().accessories[0], linked_phone_id: 99 }],
    [{ ...request().accessories[0], quantity: 999999, unit_price: 99999999.99 }]]) {
    assert.throws(() => normalizeCheckoutGoods(rows, options), { code: 'CHECKOUT_INVALID', statusCode: 400 })
  }
})

test('商品事务步骤仅出库、保存原快照和消费已有积分，由外层发奖、收款及提交', async () => {
  const f = fixture({ trackedPoints: 10, pointsConfig: redemptionConfig }), body = redeemRequest()
  body.accessories[0].quantity = 1
  body.accessories.push({ ...body.accessories[0], key: 'earned', redeem_points: 0 })
  const input = f.service.normalize(body, actor)
  await f.service.repository.withConnection(async db => {
    await db.beginTransaction()
    try {
      const result = await f.service.issueGoods(db, input, actor, { orderId: 42, customerId: 9,
        seller: { id: 8, name: '销售员' }, config: normalizePointsConfig(redemptionConfig),
        pointsSnapshot: await f.service.pointsLedger.snapshot(db, 9), phoneSales: new Map([[12, 21], [13, 22]]), initialCost: null })
      assert.equal(result.used, 10); assert.equal(result.deduction, 100); assert.equal(result.goodsPoints, 1)
      assert.equal(result.totalCost, null)
      assert.equal(result.items.length, 3)
      assert.deepEqual(result.goodsPointSources.map(row => row.points), [0, 1, 0])
      assert.equal(f.state.stock, 1); assert.equal(f.state.serials[0].status, 'gifted')
      assert.equal(f.state.points, 0, '本步骤不提前发放本次待得奖励')
      assert.deepEqual(f.state.entries.map(row => row.entry_type), ['award', 'redeem'])
      assert.equal(f.state.orders.length, 0); assert.equal(f.state.payments.length, 0); assert.equal(f.state.sales.length, 0)
      assert.equal(f.state.items[0].snapshot.points_used, 10)
      assert.equal(f.state.items[0].snapshot.deduction_cents, 100)
      assert.equal(f.state.items[0].linked_phone_sale_id, 21)
      assert.equal(f.state.items.at(-1).linked_phone_sale_id, 22)
      assert.equal(f.events.includes('commit'), false)
    } finally { await db.rollback() }
  })
  assert.deepEqual(f.state, f.initial)
})

test('外层后续失败可回滚商品事务步骤，不遗留出库、SN、积分消费或共同明细', async () => {
  const f = fixture({ trackedPoints: 10, pointsConfig: redemptionConfig })
  await assert.rejects(f.service.repository.withConnection(async db => {
    await db.beginTransaction()
    try {
      await f.service.issueGoods(db, f.service.normalize(redeemRequest(), actor), actor, { orderId: 42, customerId: 9,
        seller: { id: 8, name: '销售员' }, config: normalizePointsConfig(redemptionConfig),
        pointsSnapshot: await f.service.pointsLedger.snapshot(db, 9), phoneSales: new Map([[12, 21], [13, 22]]) })
      throw new Error('outer-settlement-failed')
    } finally { await db.rollback() }
  }), /outer-settlement-failed/)
  assert.deepEqual(f.state, f.initial)
  assert.deepEqual(f.events, ['begin', 'rollback', 'release'])
})

test('商品明细实际抵扣只用原来源：扣后发手机积分，抵扣行不累计，净实收及未知成本守恒', async () => {
  const f = fixture({ pointsConfig: redemptionConfig, trackedPoints: 10 })
  const result = await f.service.checkout(redeemRequest(), actor)
  assert.equal(result.total_amount, 600)
  assert.equal(result.paid_amount, 599)
  assert.equal(result.deduction_amount, 1)
  assert.equal(result.points_used, 10)
  assert.equal(result.points_earned, 3)
  assert.equal(f.state.points, 3)
  assert.deepEqual(f.state.entries.map(row => row.entry_type), ['award', 'redeem', 'award', 'award'])
  assert.deepEqual(f.state.allocations.map(row => [row.credit_entry_id, row.points, row.amount_cents]), [[1, 10, 100]])
  assert.equal(f.state.accessorySales[0].unit_price, 150)
  assert.equal(f.state.accessorySales[0].total_price, 299)
  assert.equal(f.state.accessorySales[0].profit, null)
  assert.equal(f.state.payments.reduce((sum, row) => sum + row.amount, 0), 599)
  assert.equal(f.state.orders[0].total_amount, 600)
  assert.equal(f.state.orders[0].final_amount, 599)
  assert.equal(f.state.orders[0].total_profit, null)
  const saved = structuredClone(f.state)
  assert.deepEqual(await f.service.checkout(redeemRequest(), actor), result)
  assert.deepEqual(f.state, saved)
  const changed = redeemRequest(); changed.accessories[0].redeem_points = 9; changed.payment_info.payment_amount = 599.1
  await assert.rejects(f.service.checkout(changed, actor), { code: 'CHECKOUT_REQUEST_CONFLICT' })
  assert.deepEqual(f.state, saved)
})

test('全额抵扣SN商品仍是收费交易，0现金不造收款，实收利润按净额减真实成本', async () => {
  const f = fixture({ initialPoints: 1500, trackedPoints: 1500, pointsConfig: redemptionConfig }), body = request()
  body.phones = []
  body.accessories = [{ ...body.accessories[1], sale_type: 'sale', unit_price: 150, linked_phone_id: null, redeem_points: 1500 }]
  body.payment_info.payment_amount = 0
  const result = await f.service.checkout(body, actor)
  assert.equal(result.paid_amount, 0)
  assert.equal(result.points_used, 1500)
  assert.equal(result.points_earned, 0)
  assert.equal(f.state.points, 0)
  assert.equal(f.state.payments.length, 0)
  assert.equal(f.state.serials[0].status, 'sold')
  assert.equal(f.state.stock, 3)
  assert.equal(f.state.accessorySales[0].sale_type, 'sale')
  assert.equal(f.state.accessorySales[0].total_price, 0)
  assert.equal(f.state.accessorySales[0].profit, -10.25)
  assert.equal(f.state.orders[0].total_profit, -10.25)
})

test('三件商品共抵扣1分钱，原单保留单价与两组分摊，净收款不丢分币', async () => {
  const f = fixture({ trackedPoints: 1, pointsConfig: { ...redemptionConfig,
      redemption: { ...redemptionConfig.redemption, points_per_yuan: 100 } } }), body = request()
  body.phones = []
  body.accessories = [{ ...body.accessories[0], quantity: 3, linked_phone_id: null, redeem_points: 1 }]
  body.payment_info.payment_amount = 449.99
  const result = await f.service.checkout(body, actor)
  assert.equal(result.paid_amount, 449.99)
  assert.equal(result.points_earned, 0)
  assert.equal(f.state.items[0].unit_price, 150)
  assert.equal(f.state.items[0].total_amount, 449.99)
  assert.deepEqual(f.state.items[0].snapshot.points_units, [
    { quantity: 1, points_used: 1, deduction_cents: 1, payable_cents: 14999, points_awarded: 0 },
    { quantity: 2, points_used: 0, deduction_cents: 0, payable_cents: 15000, points_awarded: 0 }
  ])
})

test('高余额混合单先扣再发，最终合法时不因发分顺序误拒绝', async () => {
  const f = fixture({ initialPoints: 2147483647, trackedPoints: 10, pointsConfig: redemptionConfig })
  const result = await f.service.checkout(redeemRequest(), actor)
  assert.equal(result.points_earned, 3)
  assert.equal(f.state.points, 2147483640)
})

test('历史余额、本单手机新积分、跨行重复占用及结构未就绪均不能补足抵扣，整单回滚', async () => {
  for (const options of [{ trackedPoints: 0 }, { trackedPoints: 9 }, { trackedPoints: 10, ledgerInstalled: false }]) {
    const f = fixture({ ...options, pointsConfig: redemptionConfig })
    await assert.rejects(f.service.checkout(redeemRequest(), actor), error => ['POINTS_AVAILABLE_INSUFFICIENT', 'POINTS_LEDGER_NOT_READY'].includes(error.code))
    assert.deepEqual(f.state, f.initial)
  }
  const f = fixture({ trackedPoints: 10, pointsConfig: redemptionConfig }), body = redeemRequest()
  body.accessories = [body.accessories[0], { ...body.accessories[0], key: 'second', quantity: 1 }]
  body.payment_info.payment_amount = 748
  await assert.rejects(f.service.checkout(body, actor), { code: 'POINTS_AVAILABLE_INSUFFICIENT' })
  assert.deepEqual(f.state, f.initial)
})

test('真实锁定类型决定抵扣资格，比例上限与兑换步长服务端核验，失败无部分销售', async () => {
  const configs = [
    { ...redemptionConfig, redemption: { ...redemptionConfig.redemption, max_percent: 1 } },
    { ...redemptionConfig, redemption: { ...redemptionConfig.redemption, points_per_yuan: 300 } },
    { ...redemptionConfig, redemption: { ...redemptionConfig.redemption, all_accessory_categories: false, category_ids: [2] } }
  ]
  for (const config of configs) {
    const f = fixture({ initialPoints: 100, trackedPoints: 100, pointsConfig: config }), body = redeemRequest()
    body.accessories[0].redeem_points = 100
    body.payment_info.payment_amount = 590
    await assert.rejects(f.service.checkout(body, actor), { code: 'POINTS_RULE_INVALID' })
    assert.deepEqual(f.state, f.initial)
  }
})

for (const failAt of ['item', 'serial', 'payment', 'complete', 'balance', 'entry', 'allocation']) test(`实际抵扣${failAt}失败整单回滚，余额/来源/分配/SN/手机/收款均还原，原键可重试`, async () => {
  const f = fixture({ failAt, trackedPoints: 10, pointsConfig: redemptionConfig })
  await assert.rejects(f.service.checkout(redeemRequest(), actor))
  assert.deepEqual(f.state, f.initial)
  f.retry()
  const result = await f.service.checkout(redeemRequest(), actor)
  assert.equal(result.points_used, 10)
  assert.equal(f.state.allocations.length, 1)
  assert.equal(f.state.orders.length, 1)
})

test('不同请求并发模拟不能重复消费同一来源，只有一单提交', async () => {
  const f = fixture({ trackedPoints: 10, pointsConfig: redemptionConfig }), second = redeemRequest()
  second.request_key = 'b'.repeat(32)
  const results = await Promise.allSettled([f.service.checkout(redeemRequest(), actor), f.service.checkout(second, actor)])
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
  assert.equal(f.state.orders.length, 1)
  assert.equal(f.state.stock, 1)
  assert.equal(f.state.points, 3)
  assert.equal(f.state.allocations.length, 1)
})

test('抵扣字段严格校验，非零须填写净实收，赠品/手机/整单不接受抵扣；零值保持旧请求摘要', async () => {
  const f = fixture({ trackedPoints: 10, pointsConfig: redemptionConfig })
  const baseline = f.service.normalize(request(), actor)
  const zero = request(); zero.accessories[0].redeem_points = '0'
  assert.deepEqual(f.service.normalize(zero, actor), baseline)
  for (const value of [null, true, -1, '1.1', '', {}, 2147483648]) {
    const body = request(); body.accessories[0].redeem_points = value
    await assert.rejects(f.service.checkout(body, actor), { statusCode: 400 })
  }
  for (const change of [body => { body.accessories[1].redeem_points = 1 }, body => { body.phones[0].redeem_points = 1 },
    body => { body.redeem_points = 1 }, body => { delete body.payment_info.payment_amount }, body => { body.payment_info.payment_amount = 600 }]) {
    const body = redeemRequest(); change(body)
    await assert.rejects(f.service.checkout(body, actor), { statusCode: 400 })
    assert.deepEqual(f.state, f.initial)
  }
})


test('实际结算前的服务端试算只读并释放锁，与原单积分/抵扣/实收一致，不更新客户或创建单据', async () => {
  const f = fixture({ trackedPoints: 10, pointsConfig: redemptionConfig })
  const quote = await f.service.quote(redeemRequest(), actor)
  assert.equal(quote.available_points, 10)
  assert.equal(quote.balance, 10)
  assert.equal(quote.points_used, 10)
  assert.equal(quote.points_awarded, 3)
  assert.equal(quote.payable_cents, 59900)
  assert.equal(quote.redemption_ready, true)
  assert.equal(quote.lines.find(row => row.key === 'goods:buy').points_awarded, 0)
  assert.equal(quote.config_snapshot, undefined)
  assert.deepEqual(f.state, f.initial)
  assert.deepEqual(f.events, ['begin', 'rollback', 'release'])
  const result = await f.service.checkout(redeemRequest(), actor)
  assert.equal(result.points_used, quote.points_used)
  assert.equal(result.points_earned, quote.points_awarded)
  assert.equal(result.paid_amount, quote.payable_cents / 100)
})

test('自动积分仅用于只读试算，实际提交逐行分配并重新核验，非法自动参数不进入事务', async () => {
  const f = fixture({ trackedPoints: 10, pointsConfig: redemptionConfig })
  const body = { ...request(), auto_redeem: true }, before = structuredClone(body)
  const quote = await f.service.quote(body, actor)
  assert.equal(quote.points_used, 10)
  assert.equal(quote.lines.find(row => row.key === 'goods:buy').points_used, 10)
  assert.equal(quote.lines.find(row => row.key === 'goods:gift').points_used, 0)
  assert.ok(quote.lines.filter(row => row.source !== 'accessory').every(row => row.points_used === 0))
  assert.deepEqual(f.state, f.initial)
  assert.deepEqual(body, before)
  await assert.rejects(f.service.checkout(body, actor), { statusCode: 400 })
  const input = request()
  input.accessories[0].redeem_points = 10
  input.payment_info.payment_amount = quote.payable_cents / 100
  const result = await f.service.checkout(input, actor)
  assert.equal(result.points_used, 10)
  assert.equal(result.paid_amount, quote.payable_cents / 100)
  const invalid = fixture()
  for (const auto_redeem of [null, 1, 'true', [], {}]) await assert.rejects(invalid.service.quote({ ...request(), auto_redeem }, actor), { statusCode: 400 })
  for (const body of [null, [], false]) await assert.rejects(invalid.service.quote(body, actor), { statusCode: 400 })
  assert.deepEqual(invalid.events, [])
})

test('积分试算失败只读回滚，未迁移来源账不开放抵扣；试算不能保证之后余额未改变', async () => {
  const absent = fixture({ ledgerInstalled: false, pointsConfig: redemptionConfig })
  const quote = await absent.service.quote(request(), actor)
  assert.equal(quote.available_points, 0)
  assert.equal(quote.balance, 10)
  assert.equal(quote.redemption_ready, false)
  assert.deepEqual(absent.state, absent.initial)
  const f = fixture({ trackedPoints: 10, pointsConfig: redemptionConfig })
  await f.service.quote(redeemRequest(), actor)
  f.product.status = 0
  await assert.rejects(f.service.checkout(redeemRequest(), actor))
  assert.deepEqual(f.state, f.initial)
})

test('试算权限与隐藏金额在服务前拒绝，不新增私有扣分权限，沿用实际销售动作', async () => {
  const access = { async getDeniedWrite(id, body, map) { return body?.total_amount !== undefined && map.total_amount ? map.total_amount : null } }
  const controller = new Controller({ permissionCheck: async () => true, service: { quote() { assert.fail('隐藏金额不能进入试算') } }, phoneAccess: access, goodsAccess: access })
  const res = { status(code) { this.code = code; return this }, json(value) { this.body = value; return this } }
  await controller.quote({ user: actor, body: request() }, res)
  assert.equal(res.code, 403)
  const f = fixture({ denied: ['accessories:sell'] })
  await assert.rejects(f.service.quote(request(), actor), { statusCode: 403 })
  assert.deepEqual(f.events, [])
})

test('同单仅抵扣行不累计，其余商品与手机正常发分，原来源消费后才追加新来源', async () => {
  const f = fixture({ trackedPoints: 10, pointsConfig: redemptionConfig }), body = request()
  body.accessories = [{ ...body.accessories[0], quantity: 1, redeem_points: 10 }, { ...body.accessories[0], key: 'other' }]
  body.payment_info.payment_amount = 749
  const quote = await f.service.quote(body, actor)
  const result = await f.service.checkout(body, actor)
  assert.equal(result.points_earned, 5)
  assert.equal(result.points_used, 10)
  assert.equal(result.paid_amount, 749)
  assert.equal(f.state.points, 5)
  assert.equal(quote.points_awarded, result.points_earned)
  assert.deepEqual(f.state.items.filter(row => row.type === 'accessory').map(row => row.points_awarded), [0, 2])
  assert.equal(f.state.entries.at(-1).source_type, 'checkout_item')
  assert.equal(f.state.entries.at(-1).points, 2)
  assert.deepEqual(f.state.allocations.map(row => row.credit_entry_id), [1])
})

test('共同结算冻结实际销售员商品提成：收费SN按件、赠品不计，重试和后续改规则不追改', async () => {
  const rule = { enabled: true, type: 'fixed', fixed_amount: 2.5, percentage: 10 }
  const f = fixture({ goodsCommissionRule: rule }), body = request()
  Object.assign(body.accessories[0], { quantity: 1, serial_numbers: ['00aa'] })
  body.accessories[1].serial_numbers = []
  body.payment_info.payment_amount = 450
  await f.service.checkout(body, actor)
  const rows = f.state.items.filter(row => row.type === 'accessory')
  assert.equal(rows[0].snapshot.commission.earned_cents, 250)
  assert.equal(rows[0].snapshot.commission.purchase_cost_cents, 1025)
  assert.equal(rows[0].snapshot.commission.employee_id, 8)
  assert.equal(rows[0].snapshot.commission.salary_template_id, 4)
  assert.equal(rows[1].snapshot.commission.reason, 'gift')
  const saved = structuredClone(rows)
  rule.fixed_amount = 99
  await f.service.checkout(body, actor)
  assert.deepEqual(f.state.items.filter(row => row.type === 'accessory'), saved)
})

for (const method of ['quote', 'checkout']) {
  test(`共同结算${method}事务启动失败销毁连接，不进入业务或自动重试`, async () => {
    const f = fixture({ transactionFailure: 'begin' })
    await assert.rejects(f.service[method](request(), actor), /begin-failed/)
    assert.deepEqual(f.events.slice(-3), ['begin', 'destroy', 'release'])
    assert.equal(f.events.filter(event => event === 'begin').length, 1)
    assert.deepEqual(f.state, f.initial)
  })

  test(`共同结算${method}回滚失败只尝试一次并销毁连接`, async () => {
    const f = fixture({ transactionFailure: 'rollback', ...(method === 'checkout' ? { failAt: 'item' } : {}) })
    await assert.rejects(f.service[method](request(), actor), /rollback-failed/)
    assert.deepEqual(f.events.slice(-3), ['rollback', 'destroy', 'release'])
    assert.equal(f.events.filter(event => event === 'begin').length, 1)
    assert.equal(f.events.filter(event => event === 'rollback').length, 1)
    assert.equal(f.events.includes('commit'), false)
  })
}

test('共同结算死锁的回滚失败不能在该连接重试', async () => {
  const f = fixture({ deadlocks: 1, transactionFailure: 'rollback' })
  await assert.rejects(f.service.checkout(request(), actor), /rollback-failed/)
  assert.deepEqual(f.events, ['prepare', 'begin', 'rollback', 'destroy', 'release'])
  assert.deepEqual(f.state, f.initial)
})

test('共同结算提交失败但回滚成功仍释放可复用连接，全部交易事实还原', async () => {
  const f = fixture({ transactionFailure: 'commit' })
  await assert.rejects(f.service.checkout(request(), actor), /commit-failed/)
  assert.deepEqual(f.events.slice(-3), ['commit', 'rollback', 'release'])
  assert.equal(f.events.includes('destroy'), false)
  assert.deepEqual(f.state, f.initial)
})

test('共同结算试算业务拒绝后正常回滚，不销毁可复用连接', async () => {
  const f = fixture({ phoneStore: 3 })
  await assert.rejects(f.service.quote(request(), actor), { statusCode: 403, code: 'STORE_SCOPE_DENIED' })
  assert.deepEqual(f.events, ['begin', 'rollback', 'release'])
  assert.deepEqual(f.state, f.initial)
})

test('同单积分抵扣行与未知历史成本不产生商品提成，损坏工资规则使整单回滚', async () => {
  const enabled = { enabled: true, type: 'fixed', fixed_amount: 2.5, percentage: 10 }
  const f = fixture({ goodsCommissionRule: enabled })
  await f.service.checkout(request(), actor)
  assert.equal(f.state.items.find(row => row.key === 'goods:buy').snapshot.commission.reason, 'unknown_cost')
  const redeemed = fixture({ goodsCommissionRule: enabled, trackedPoints: 10, pointsConfig: redemptionConfig }), body = redeemRequest()
  Object.assign(body.accessories[0], { quantity: 1, serial_numbers: ['00aa'] })
  body.accessories[1].serial_numbers = []
  body.payment_info.payment_amount = 449
  await redeemed.service.checkout(body, actor)
  const commission = redeemed.state.items.find(row => row.key === 'goods:buy').snapshot.commission
  assert.equal(commission.purchase_cost_cents, 1025)
  assert.equal(commission.paid_cents, 14900)
  assert.equal(commission.points_used, 10)
  assert.equal(commission.reason, 'points_used')
  assert.equal(commission.earned_cents, 0)
  assert.equal(redeemed.state.items.find(row => row.key === 'goods:buy').points_awarded, 0)
  assert.equal(redeemed.state.points, 3, '仅手机正常累计，本行抵扣后的正毛利也不计提成或积分')
  const invalid = fixture({ goodsCommissionRule: { ...enabled, fixed_amount: -1 } })
  await assert.rejects(invalid.service.checkout(request(), actor), { code: 'GOODS_COMMISSION_CONFLICT' })
  assert.deepEqual(invalid.state, invalid.initial)
})

test('延迟手机发分只允许调用方持有事务，不能成为独立销售的禁发积分入口', async () => {
  await assert.rejects(new SalesPhoneService().sell({ deferPoints: true }), /共同结算事务/)
})

test('具体商品范围贯穿合单自动试算和正式事务，移除该商品即拒绝抵扣并回滚', async () => {
  const rules = ids => ({ ...redemptionConfig, redemption: { ...redemptionConfig.redemption,
    all_accessory_categories: false, category_ids: [1], accessory_ids: ids } })
  const allowed = fixture({ trackedPoints: 10, pointsConfig: rules([5]) })
  const preview = await allowed.service.quote({ ...redeemRequest(), auto_redeem: true }, actor)
  assert.equal(preview.points_used, 10)
  await allowed.service.checkout(redeemRequest(), actor)
  assert.equal(allowed.state.orders.length, 1)
  const denied = fixture({ trackedPoints: 10, pointsConfig: rules([6]) })
  const noPoints = await denied.service.quote({ ...redeemRequest(), auto_redeem: true }, actor)
  assert.equal(noPoints.points_used, 0)
  const before = structuredClone(denied.state)
  await assert.rejects(denied.service.checkout(redeemRequest(), actor), /不符合积分抵扣范围/)
  assert.deepEqual(denied.state, before)
})


test('综合查询独立商品动作可完成真实结算，缺销售或赠送动作在事务前拒绝', async () => {
  const denied = ['accessories:view', 'accessories:sell', 'accessories:gift']
  const granted = ['query:view', 'query:goods-view', 'query:goods-sell', 'query:goods-gift']
  const f = fixture({ denied, granted })
  await f.service.checkout(request(), actor)
  assert.equal(f.state.orders.length, 1)
  assert.equal(f.state.sales.length, 2)
  for (const missing of ['query:goods-sell', 'query:goods-gift', 'query:goods-view']) {
    const rejected = fixture({ denied, granted: granted.filter(permission => permission !== missing) })
    await assert.rejects(rejected.service.checkout(request(), actor), { statusCode: 403 })
    assert.deepEqual(rejected.state, rejected.initial)
    assert.deepEqual(rejected.events, [])
  }
})
