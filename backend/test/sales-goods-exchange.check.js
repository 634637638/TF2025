'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const inventoryFixture = require('./helpers/accessory-returns')
const Repository = require('../src/repositories/sales-goods-exchange.repository')
const ExchangeService = require('../src/services/sales-goods-exchange.service')
const ReturnService = require('../src/services/sales-goods-return.service')
const PhoneReturnService = require('../src/services/sales-phone-return.service')
const AftersaleService = require('../src/services/sales-aftersale.service')
const QueryGoodsService = require('../src/services/query-goods.service')
const { withReadConnection } = require('./helpers/query-goods-read')
const Controller = require('../src/controllers/sales-aftersale.controller')
const { readAftersaleSettlement } = require('../src/utils/sales-aftersale-settlement')
const { normalizePointsConfig } = require('../src/utils/customer-points-rules')
const { planGoodsReturn } = require('../src/utils/checkout-goods-return')
const { createGoodsCommission } = require('../src/utils/goods-commission')

const actor = { id: 7, store_ids: [1, 2] }, time = '2026-11-13 16:00:00'
const key = n => String(n).padStart(32, '0')
const body = (patch = {}) => ({ request_key: key(1), store_id: 2, quantity: 1, serial_numbers: [], return_reason: '客户退货',
  reversal_date: time, remarks: '原单换货', restock_confirmed: true, replacement: { accessory_id: 6, unit_price: 50 }, ...patch })
const cash = (refund, collection = 0) => ({ refund_amount: refund, collection_amount: collection, confirmed: true,
  method: refund || collection ? 'cash' : null })

/** 使用真实换货/返库/出库/积分服务和仓储；SQL事务替身不冒充云端行锁验收。 */
async function fixture({ serial = false, gift = false, redemption = 0, award = 0, existing = 0, pointsRate = 1, denied = [], fail = '', deadlocks = 0 } = {}) {
  const f = inventoryFixture(serial ? { events: [{ id: 1, accessory_id: 5, store_id: 1, stock_in_id: 1, purchase_cost: 10,
    usage_type: 'sale', serial_tracking: 1, event_type: 'stock_in', quantity_delta: 2, sale_id: null }],
  serials: [1, 2].map(id => ({ id, accessory_id: 5, store_id: 1, stock_in_id: 1, purchase_cost: 10, serial_number: `OLD${id}`, status: 'in_stock' })) } : {})
  const net = gift ? 0 : 40 - redemption / 10
  await f.sell({ quantity: 2, unit_price: gift ? 0 : 20, sale_type: gift ? 'gift' : 'sale', customer_id: 9,
    remarks: '原单已确认赠送', ...(serial ? { serial_numbers: ['OLD1', 'OLD2'] } : {}) }, { resolveTotalCents: () => Math.round(net * 100) })
  f.state.products[6] = { id: 6, name: '新充电器', status: 1, template_id: 4, category_id: 1 }
  f.state.extraStocks[6] = { 1: 0, 2: 4 }
  f.state.events.push({ id: f.state.events.length + 1, accessory_id: 6, store_id: 2, stock_in_id: 20, purchase_cost: 30,
    usage_type: 'sale', serial_tracking: Number(serial), event_type: 'stock_in', quantity_delta: 4, sale_id: null })
  if (serial) for (let id = 1; id <= 4; id++) f.state.serials.push({ id: id + 2, accessory_id: 6, store_id: 2, stock_in_id: 20,
    purchase_cost: 30, serial_number: `NEW${id}`, status: 'in_stock' })
  Object.assign(f.state, { orders: [{ id: 10, order_no: 'ORIGINAL', customer_id: 9, customer_name: '测试客户', customer_phone: '13800138000', store_id: 1,
    final_amount: net, paid_amount: net, order_status: 'completed' }], items: [{ item_id: 50, order_id: 10, item_type: 'accessory', accessory_sale_id: 1,
    accessory_id: 5, linked_phone_sale_id: 21, quantity: 2, unit_price: gift ? 0 : 20, total_amount: net, points_awarded: award,
    snapshot: { name: '原充电器', sale_type: gift ? 'gift' : 'sale', gift_return_unit_price: gift ? 12 : null,
      serial_numbers: serial ? ['OLD1', 'OLD2'] : [], points_used: redemption, deduction_cents: redemption * 10,
      points_per_yuan: redemption ? 10 : null, gross_cents: gift ? 0 : 4000,
      points_units: [{ quantity: 2, payable_cents: Math.round(net * 50), points_used: redemption / 2,
        deduction_cents: redemption * 5, points_awarded: award / 2 }] } }], rootPhone: { item_id: 49, order_id: 10, item_type: 'phone', sale_id: 21, actual_sale_id: 21, phone_id: 31, sale_phone_id: 31,
    quantity: 1, unit_price: 100, total_amount: 100, points_awarded: 0, customer_id: 9, store_id: 1, sale_type: 'retail', sale_status: 'completed', sale_price: 100,
    points_accounted_at: time, operator_id: 7, current_sale_id: 21, phone_status: 'sold', phone_store_id: 1 },
  headers: [], facts: [], exchanges: [], commits: 0, rollbacks: 0 })
  await f.transaction(async db => {
    if (redemption) {
      await f.pointsLedger.applyDelta(db, { customerId: 9, sourceType: 'phone_sale', sourceId: 99, delta: redemption })
      await f.pointsLedger.consume(db, { customerId: 9, points: redemption, amountCents: redemption * 10, pointsPerYuan: 10,
        itemId: 50, snapshot: await f.pointsLedger.snapshot(db, 9) })
    }
    if (award) await f.pointsLedger.applyDelta(db, { customerId: 9, sourceType: 'checkout_item', sourceId: 50, delta: award })
    if (existing) await f.pointsLedger.applyDelta(db, { customerId: 9, sourceType: 'phone_sale', sourceId: 100, delta: existing })
  })
  let failure = fail, locks = deadlocks
  const calls = [], original = f.connection.execute.bind(f.connection)
  f.connection.execute = async (sql, params = []) => {
    calls.push(sql)
    const s = f.state
    if (sql.includes('FROM sales_aftersales WHERE request_key')) {
      if (locks-- > 0) throw Object.assign(new Error('deadlock'), { code: 'ER_LOCK_DEADLOCK' })
      return [s.headers.filter(row => row.request_key === params[0])]
    }
    if (sql.includes('FROM sales_goods_exchanges e')) {
      const e = s.exchanges.find(row => row.replacement_item_id === params[0])
      if (!e) return [[]]
      const a = s.headers.find(row => row.id === e.aftersale_id), i = s.facts.find(row => row.aftersale_id === e.aftersale_id)
      return [[{ ...e, ...a, id: e.id, aftersale_id: e.aftersale_id, aftersale_item_id: i?.id ?? null, returned_quantity: i?.quantity ?? null, fact_snapshot: i?.fact_snapshot ?? null }]]
    }
    if (sql.includes('WHERE i.sale_id = ?')) return [s.rootPhone && s.rootPhone.sale_id === params[0] ? [s.rootPhone] : []]
    if (sql.includes('WHERE order_id = ? AND sale_id = ?')) return [s.rootPhone && s.rootPhone.order_id === params[0] && s.rootPhone.sale_id === params[1] ? [s.rootPhone] : []]
    if (sql.includes('FROM sales s JOIN phones')) return [s.rootPhone && s.rootPhone.sale_id === params[0] ? [s.rootPhone] : []]
    if (sql.includes('WHERE linked_phone_sale_id')) return [s.items.filter(row => row.linked_phone_sale_id === params[0])]
    if (sql.includes('FROM sales_orders')) return [s.orders.filter(row => row.id === params[0] && row.order_status === 'completed')]
    if (sql.includes('FROM sales_order_items i JOIN accessory_sales')) {
      const row = s.items.find(item => item.order_id === params[0] && item.item_id === params[1])
      if (!row) return [[]]
      const sale = s.sales.find(item => item.id === row.accessory_sale_id)
      return [[{ ...row, sale_accessory_id: sale.accessory_id, sale_customer_id: sale.customer_id, sale_store_id: sale.store_id,
        sale_quantity: sale.quantity, sale_unit_price: sale.unit_price, sale_total_price: sale.total_price, sale_type: sale.sale_type,
        sale_no: sale.sale_no, sale_operator_name: sale.operator_name, sale_operator_id: sale.operator_id }]]
    }
    if (sql.includes('FROM sales_aftersale_items i')) return [s.facts.filter(row => row.original_item_id === params[0])]
    if (sql.includes('SELECT id FROM stores')) return [[{ id: params[0] }]]
    if (sql.includes('FROM users')) return [params[0] === 7 || params[0] === 8 ? [{ id: params[0], name: '销售员' }] : []]
    if (sql.startsWith('INSERT INTO sales_orders')) {
      const fields = ['order_no', 'request_key', 'request_hash', 'customer_id', 'customer_name', 'customer_phone', 'store_id', 'operator_id', 'created_by', 'time', 'remarks', 'config']
      const id = s.orders.at(-1).id + 1
      s.orders.push({ ...Object.fromEntries(fields.map((field, i) => [field, params[i]])), id, order_status: 'draft' })
      return [{ insertId: id }]
    }
    if (sql.startsWith('INSERT INTO sales_order_items')) {
      if (failure === 'replacement') throw new Error('replacement-failed')
      const fields = ['order_id', 'line_key', 'item_type', 'sale_id', 'accessory_sale_id', 'phone_id', 'accessory_id', 'linked_phone_sale_id',
        'quantity', 'unit_price', 'total_amount', 'purchase_cost', 'points_awarded', 'snapshot', 'created_at']
      const id = s.items.at(-1).item_id + 1
      s.items.push({ item_id: id, ...Object.fromEntries(fields.map((field, i) => [field, params[i]])) })
      return [{ insertId: id }]
    }
    if (sql.startsWith('INSERT INTO sales_aftersales')) {
      if (failure === 'header') throw new Error('header-failed')
      const fields = ['request_key', 'request_hash', 'order_id', 'customer_id', 'original_store_id', 'store_id', 'created_by',
        'base_refund_cents', 'recovery_cents', 'compensation_cents', 'refund_cents', 'collection_cents', 'points_delta', 'settlement_method',
        'settlement_channel', 'business_time', 'remarks', 'result_snapshot', 'created_at', 'gift_charge_cents', 'replacement_cents']
      const id = s.headers.length + 1, operation = sql.includes("'goods_exchange'") ? 'goods_exchange' : sql.includes("'phone_return'") ? 'phone_return' : 'goods_return'
      s.headers.push({ id, operation_type: operation, ...Object.fromEntries(fields.slice(0, params.length).map((field, i) => [field, params[i]])) })
      return [{ insertId: id }]
    }
    if (sql.startsWith('INSERT INTO sales_aftersale_items')) {
      if (failure === 'fact') throw new Error('fact-failed')
      const id = s.facts.length + 1
      s.facts.push({ id, aftersale_id: params[0], original_item_id: params[1], quantity: params[2], fact_snapshot: params[3] })
      return [{ insertId: id }]
    }
    if (sql.startsWith('INSERT INTO sales_goods_exchanges')) {
      if (failure === 'link') throw new Error('link-failed')
      const fields = ['aftersale_id', 'original_item_id', 'replacement_order_id', 'replacement_item_id', 'root_order_id', 'root_item_id', 'quantity', 'exchange_credit_cents']
      const id = s.exchanges.length + 1
      s.exchanges.push({ id, ...Object.fromEntries(fields.map((field, i) => [field, params[i]])) })
      return [{ insertId: id }]
    }
    if (sql.startsWith('UPDATE sales_orders SET')) {
      if (failure === 'complete') throw new Error('complete-failed')
      const fields = ['total_amount', 'final_amount', 'total_cost', 'total_profit', 'paid_amount', 'points_awarded', 'payment_method', 'payment_channel', 'time', 'checkout_result']
      const row = s.orders.find(item => item.id === params[10] && item.order_status === 'draft')
      if (row) Object.assign(row, Object.fromEntries(fields.map((field, i) => [field, params[i]])), { order_status: 'completed' })
      return [{ affectedRows: Number(Boolean(row)) }]
    }
    if (sql.startsWith('UPDATE sales s')) {
      const valid = s.rootPhone.sale_status === 'completed' && s.rootPhone.sale_id === params[0] && s.rootPhone.phone_id === params[1]
      if (valid) s.rootPhone.sale_status = 'cancelled'
      return [{ affectedRows: Number(valid) }]
    }
    if (sql.startsWith('UPDATE phones')) {
      const valid = s.rootPhone.phone_status === 'sold' && s.rootPhone.phone_id === params[1] && s.rootPhone.phone_store_id === params[2]
      if (valid) Object.assign(s.rootPhone, { phone_status: 'in_stock', phone_store_id: params[0], current_sale_id: null })
      return [{ affectedRows: Number(valid) }]
    }
    return original(sql, params)
  }
  const repo = new Repository()
  repo.withConnection = operation => f.transaction(async db => {
    let before
    db.beginTransaction = async () => { assert.equal(before, undefined); before = structuredClone(f.state) }
    db.commit = async () => { assert.ok(before); before = undefined; f.state.commits++ }
    db.rollback = async () => { assert.ok(before); Object.assign(f.state, before); before = undefined; f.state.rollbacks++ }
    return operation(db)
  })
  const service = new ExchangeService({ repository: repo, accessories: f.service, pointsLedger: f.pointsLedger,
    tableExists: async () => true, columnExists: async () => true, permissionCheck: async (user, permission) => !['query:goods-sell', 'query:goods-gift'].includes(permission) && !denied.includes(permission), now: () => time })
  service.checkout.getPointsConfig = async () => normalizePointsConfig({ include_accessories: true, accessory_points_per_100: pointsRate, redemption: { enabled: true,
    points_per_yuan: 10, max_percent: 100, sources: ['accessory'], all_accessory_categories: true } })
  const creditPoints = service.checkout.creditPoints
  service.checkout.creditPoints = async (db, customerId, points, options) => {
    if (failure === 'reward') throw new Error('reward-failed')
    return creditPoints(db, customerId, points, options)
  }
  return { ...f, service, repo, calls, retry() { failure = '' },
    quote: (patch = {}, user = actor) => service.quote(10, 50, body(patch), user),
    submit: (patch = {}, user = actor) => service.submit(10, 50, body({ settlement: cash(0, 30), ...patch }), user) }
}

test('20元换50元：原件跨店返库、新件扣库、独立原价快照与原单关联，仅记录30元补款', async () => {
  const f = await fixture(), original = structuredClone({ order: f.state.orders[0], item: f.state.items[0], sale: f.state.sales[0] })
  const before = structuredClone(f.state), quote = await f.quote()
  assert.equal(quote.collection_amount, 30); assert.equal(quote.refund_amount, 0)
  assert.deepEqual({ ...f.state, rollbacks: 0 }, before)
  const result = await f.submit({ operator_id: 8 })
  assert.equal(result.replacement_amount, 50); assert.equal(result.exchange_credit_amount, 20)
  assert.equal(f.state.stocks[2], 1); assert.equal(f.state.extraStocks[6][2], 3)
  assert.equal(f.state.sales.at(-1).operator_id, 8)
  assert.equal(f.state.items.at(-1).linked_phone_sale_id, 21)
  assert.equal(f.state.orders.at(-1).final_amount, 50); assert.equal(f.state.orders.at(-1).paid_amount, 30)
  assert.equal(f.state.orders.at(-1).total_cost, 30); assert.equal(f.state.orders.at(-1).total_profit, 20)
  assert.equal(f.state.headers[0].replacement_cents, 5000); assert.equal(f.state.headers[0].collection_cents, 3000)
  assert.equal(f.calls.some(sql => /payment_records/.test(sql)), false)
  assert.deepEqual({ order: f.state.orders[0], item: f.state.items[0], sale: f.state.sales[0] }, original)
  assert.deepEqual(await f.submit({ operator_id: 8 }), result)
  assert.equal(f.state.exchanges.length, 1); assert.equal(f.state.sales.length, 2)
  await assert.rejects(f.submit({ operator_id: 7 }), { code: 'CHECKOUT_RETURN_REQUEST_CONFLICT' })
})

test('换低价、等价或赠品原用途替换：只记录退款/零资金，赠品沿用原单约定与手机关联', async () => {
  for (const [price, refund] of [[10, 10], [20, 0]]) {
    const f = await fixture()
    const result = await f.submit({ replacement: { accessory_id: 6, unit_price: price }, settlement: cash(refund) })
    assert.equal(result.refund_amount, refund); assert.equal(result.collection_amount, 0)
    assert.equal(f.state.orders.at(-1).paid_amount, 0); assert.equal(result.exchange_credit_amount, price)
  }
  const f = await fixture({ gift: true })
  await f.submit({ replacement: { accessory_id: 6, unit_price: 0 }, settlement: cash(0) })
  const item = f.state.items.at(-1), snapshot = JSON.parse(item.snapshot)
  assert.equal(snapshot.sale_type, 'gift'); assert.equal(snapshot.gift_return_unit_price, 12)
  assert.equal(item.linked_phone_sale_id, 21); assert.equal(item.points_awarded, 0)
  assert.equal(f.state.headers[0].refund_cents, 0); assert.equal(f.state.headers[0].collection_cents, 0)
})

test('换货将旧件原提成冲回绑定原销售员，新件单独冻结新销售员规则且客户差价不混入提成', async () => {
  const f = await fixture({ serial: true }), original = f.state.items[0]
  original.purchase_cost = 20
  original.snapshot.commission = createGoodsCommission({ employeeId: f.state.sales[0].operator_id,
    salaryTemplateId: 4, quantity: 2, saleType: 'sale', paidCents: 4000, purchaseCostCents: 2000,
    rule: { enabled: true, type: 'fixed', fixed_amount: 2.5, percentage: 0 } })
  const result = await f.submit({ serial_numbers: ['OLD2'], operator_id: 8,
    replacement: { accessory_id: 6, unit_price: 50, serial_numbers: ['NEW1'] } })
  const fact = JSON.parse(f.state.facts[0].fact_snapshot), replacement = JSON.parse(f.state.items.at(-1).snapshot)
  assert.equal(result.collection_amount, 30)
  assert.equal(fact.commission_return.employee_id, f.state.sales[0].operator_id)
  assert.equal(fact.commission_return.reversal_cents, 250)
  assert.equal(replacement.commission.employee_id, 8)
  assert.equal(replacement.commission.reason, 'not_configured')
  assert.equal(original.snapshot.commission.earned_cents, 500)
})

test('替换商品可继续换货并退回，稳定追溯最初原单；各次差价与原件返库均独立留存', async () => {
  const f = await fixture(), first = await f.submit()
  const second = await f.service.submit(first.replacement_order_id, first.replacement_item_id,
    body({ request_key: key(2), replacement: { accessory_id: 6, unit_price: 35 }, settlement: cash(15) }), actor)
  assert.equal(second.root_order_id, 10); assert.equal(second.root_item_id, 50)
  assert.equal(second.refund_amount, 15)
  assert.equal(f.state.headers.length, 2); assert.equal(f.state.exchanges.length, 2)
  const returns = new ReturnService({ repository: f.repo, accessories: f.service.accessories, pointsLedger: f.pointsLedger,
    tableExists: async () => true, permissionCheck: async () => true, now: () => time })
  const request = body({ request_key: key(3), settlement: cash(35) }); delete request.replacement
  const result = await returns.submit(second.replacement_order_id, second.replacement_item_id, request, actor)
  assert.equal(result.refund_amount, 35)
  assert.equal(f.state.extraStocks[6][2], 4)
  assert.equal(f.state.headers.length, 3)
})

test('原SN返指定店、新SN按原批次扣减；未退过的原SN仍可换，重复或错误SN拒绝', async () => {
  const f = await fixture({ serial: true })
  await f.submit({ serial_numbers: ['OLD2'], replacement: { accessory_id: 6, unit_price: 50, serial_numbers: ['NEW3'] } })
  const old = f.state.serials.find(row => row.serial_number === 'OLD2'), next = f.state.serials.find(row => row.serial_number === 'NEW3')
  assert.equal(old.status, 'in_stock'); assert.equal(old.store_id, 2); assert.equal(next.status, 'sold')
  assert.equal(f.state.items.at(-1).purchase_cost, 30)
  await assert.rejects(f.submit({ request_key: key(2), serial_numbers: ['OLD2'], replacement: { accessory_id: 6, unit_price: 50, serial_numbers: ['NEW4'] } }), { statusCode: 409 })
  await f.submit({ request_key: key(2), serial_numbers: ['OLD1'], replacement: { accessory_id: 6, unit_price: 50, serial_numbers: ['NEW4'] } })
  assert.equal(f.state.exchanges.length, 2)
})

test('换货只使用结算前逐源可用积分，退旧件刚返的积分不能立即抵扣新件；抵扣行不发奖励', async () => {
  const blocked = await fixture({ redemption: 10 })
  await assert.rejects(blocked.submit({ replacement: { accessory_id: 6, unit_price: 50, redeem_points: 5 }, settlement: cash(0, 30) }), { code: 'POINTS_AVAILABLE_INSUFFICIENT' })
  assert.equal(blocked.state.customers[9], 0); assert.equal(blocked.state.orders.length, 1)
  const f = await fixture({ redemption: 10, existing: 10 })
  const result = await f.submit({ replacement: { accessory_id: 6, unit_price: 50, redeem_points: 10 }, settlement: cash(0, 29.5) })
  assert.equal(result.base_refund_amount, 19.5); assert.equal(result.points_redemption_returned, 5)
  assert.equal(result.replacement_amount, 49); assert.equal(result.points_earned, 0)
  assert.equal(f.state.customers[9], 5)
  assert.equal(f.state.allocations.at(-1).credit_entry_id, 3, '仅消费旧有独立来源，不消费本次返还来源')
})

test('旧奖励已消费则追回原优惠，退款不足转为补款，与新件差价一次结算', async () => {
  const f = await fixture({ award: 200 })
  await f.transaction(async db => {
    await f.pointsLedger.consume(db, { customerId: 9, itemId: 99, points: 200, amountCents: 20000, pointsPerYuan: 1,
      snapshot: await f.pointsLedger.snapshot(db, 9) })
  })
  const quote = await f.quote()
  assert.equal(quote.points_recovery_amount, 100); assert.equal(quote.collection_amount, 130)
  const result = await f.submit({ settlement: cash(0, 130) })
  assert.equal(result.exchange_credit_amount, 0)
  assert.equal(result.original_collection_amount, 80)
  assert.equal(f.state.orders.at(-1).paid_amount, 50)
  assert.equal(f.state.headers[0].recovery_cents, 10000)
})

test('正常换货撤回原奖励并按新件计分，新奖励保留真实替换明细来源，之后可原单退回', async () => {
  const f = await fixture({ award: 4 })
  const result = await f.submit({ replacement: { accessory_id: 6, unit_price: 150 }, settlement: cash(0, 130) })
  assert.equal(result.points_award_returned, 2); assert.equal(result.points_earned, 1); assert.equal(result.points_delta, -1)
  assert.equal(f.state.customers[9], 3)
  assert.equal(f.state.entries.at(-1).source_type, 'checkout_item'); assert.equal(f.state.entries.at(-1).source_id, result.replacement_item_id)
  const returns = new ReturnService({ repository: f.repo, accessories: f.service.accessories, pointsLedger: f.pointsLedger,
    tableExists: async () => true, permissionCheck: async () => true, now: () => time })
  const request = body({ request_key: key(2), settlement: cash(150) }); delete request.replacement
  const receipt = await returns.submit(result.replacement_order_id, result.replacement_item_id, request, actor)
  assert.equal(receipt.points_award_returned, 1); assert.equal(f.state.customers[9], 2)
})

test('旧抵扣来源已撤销时补退原优惠金额，不复活积分，补退与换货差价一次抵消', async () => {
  const f = await fixture({ redemption: 10 })
  await f.transaction(db => f.pointsLedger.returnAward(db, { customerId: 9, sourceType: 'phone_sale', sourceId: 99,
    points: 10, requestKey: 'original:phone:99' }))
  const result = await f.submit()
  assert.equal(result.base_refund_amount, 19.5); assert.equal(result.points_compensation_amount, 0.5)
  assert.equal(result.collection_amount, 30); assert.equal(f.state.customers[9], 0)
})

test('换货允许原数量件与新SN件互换，跟踪模式沿用各自真实库存事实', async () => {
  for (const oldSerial of [false, true]) {
    const f = await fixture({ serial: oldSerial })
    const event = f.state.events.find(row => row.accessory_id === 6)
    event.serial_tracking = Number(!oldSerial)
    f.state.serials = f.state.serials.filter(row => row.accessory_id !== 6)
    if (!oldSerial) for (let n = 1; n <= 4; n++) f.state.serials.push({ id: n + 10, accessory_id: 6, store_id: 2,
      stock_in_id: 20, purchase_cost: 30, serial_number: `NEW${n}`, status: 'in_stock' })
    const result = await f.submit({ serial_numbers: oldSerial ? ['OLD1'] : [],
      replacement: { accessory_id: 6, unit_price: 50, serial_numbers: oldSerial ? [] : ['NEW1'] } })
    assert.deepEqual(result.replacement_serial_numbers, oldSerial ? [] : ['NEW1'])
    assert.equal(f.state.stocks[2], 1); assert.equal(f.state.extraStocks[6][2], 3)
  }
})

for (const failure of ['replacement', 'reward', 'header', 'fact', 'link', 'complete', 'inventory', 'stock']) test(`换货${failure}阶段失败整笔回滚，保留原交易，原键可重试`, async () => {
  const f = await fixture({ fail: failure }), before = structuredClone(f.state)
  if (['inventory', 'stock'].includes(failure)) f.failAt(failure)
  await assert.rejects(f.submit())
  assert.deepEqual({ ...f.state, rollbacks: 0 }, before)
  f.retry(); f.failAt('')
  await f.submit()
  assert.equal(f.state.exchanges.length, 1); assert.equal(f.state.orders.length, 2)
})

test('换货完整祖先链缺关系、错根/客户/金额/手机/用途或损坏凭据均拒绝，不依赖客户端原单声明', async () => {
  for (const corrupt of [f => { f.state.exchanges = [] }, f => { f.state.exchanges[0].root_item_id = 99 },
    f => { f.state.items.at(-1).linked_phone_sale_id = 99 }, f => { f.state.orders.at(-1).customer_id = 10; f.state.customers[10] = 0 },
    f => { f.state.exchanges[0].exchange_credit_cents++ }, f => { f.state.orders.at(-1).paid_amount++ },
    f => { const fact = JSON.parse(f.state.facts[0].fact_snapshot); fact.exchange.replacement_cents++; f.state.facts[0].fact_snapshot = JSON.stringify(fact) }]) {
    const f = await fixture(), first = await f.submit(); corrupt(f)
    await assert.rejects(f.service.quote(first.replacement_order_id, first.replacement_item_id, body({ request_key: key(2) }), actor), { statusCode: 409 })
    assert.equal(f.state.orders.length, 2)
  }
})

test('普通退货和只读核对同样核验替换链；损坏关联不得绕开换货服务退款或返库', async () => {
  for (const corrupt of [f => { f.state.exchanges = [] }, f => { f.state.exchanges[0].root_order_id = 99 },
    f => { f.state.items.at(-1).linked_phone_sale_id = 99 }, f => { f.state.orders.at(-1).paid_amount++ },
    f => { f.state.rootPhone.customer_id = 10 }, f => { f.state.rootPhone.order_id = 99 },
    f => { const value = JSON.parse(f.state.items.at(-1).snapshot); delete value.exchange_source; f.state.items.at(-1).snapshot = JSON.stringify(value) }]) {
    const f = await fixture(), first = await f.submit(); corrupt(f)
    const returns = new ReturnService({ repository: f.repo, accessories: f.service.accessories, pointsLedger: f.pointsLedger,
      tableExists: async () => true, permissionCheck: async () => true, now: () => time })
    const before = structuredClone(f.state), request = body({ request_key: key(2), settlement: cash(50) }); delete request.replacement
    await assert.rejects(returns.context(first.replacement_order_id, first.replacement_item_id, actor), { statusCode: 409 })
    await assert.rejects(returns.submit(first.replacement_order_id, first.replacement_item_id, request, actor), { statusCode: 409 })
    assert.deepEqual({ ...f.state, rollbacks: before.rollbacks }, before)
  }
})

test('根关联手机必须真实属于原单和原客户；已退手机不阻止原商品后续独立退货', async () => {
  for (const corrupt of [f => { f.state.rootPhone = null }, f => { f.state.rootPhone.customer_id = 10 },
    f => { f.state.rootPhone.order_id = 11 }, f => { f.state.rootPhone.sale_phone_id = 99 },
    f => { f.state.rootPhone.item_type = 'accessory' }, f => { f.state.rootPhone.sale_status = 'pending' },
    f => { f.state.rootPhone.sale_price = 1 }]) {
    const f = await fixture(); corrupt(f)
    await assert.rejects(f.submit(), { code: 'CHECKOUT_RETURN_CONFLICT' })
    assert.equal(f.state.headers.length, 0); assert.equal(f.state.orders.length, 1)
  }
  const f = await fixture(), first = await f.submit()
  f.state.rootPhone.sale_status = 'cancelled'
  const returns = new ReturnService({ repository: f.repo, accessories: f.service.accessories, pointsLedger: f.pointsLedger,
    tableExists: async () => true, permissionCheck: async () => true, now: () => time })
  const request = body({ request_key: key(2), settlement: cash(50) }); delete request.replacement
  assert.equal((await returns.submit(first.replacement_order_id, first.replacement_item_id, request, actor)).refund_amount, 50)
})

test('替换关联结构缺失拒绝原单核对，普通旧商品仍可在原售后结构办理，不自动补造关系', async () => {
  const f = await fixture(), first = await f.submit()
  const returns = new ReturnService({ repository: f.repo, accessories: f.service.accessories, pointsLedger: f.pointsLedger,
    tableExists: async table => table !== 'sales_goods_exchanges', permissionCheck: async () => true, now: () => time })
  await assert.rejects(returns.context(first.replacement_order_id, first.replacement_item_id, actor), { code: 'CHECKOUT_RETURN_CONFLICT' })
  assert.equal((await returns.context(10, 50, actor)).remaining_quantity, 1)
  const independent = await fixture(); independent.state.items[0].linked_phone_sale_id = null; independent.state.rootPhone = null
  assert.equal((await independent.submit()).root_order_id, 10)
})

test('部分售后结构缺失明确返回未就绪，连接故障保持原错误，不伪装成无换货或正常退款', async () => {
  for (const code of ['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR', 'ECONNRESET']) {
    const f = await fixture(), first = await f.submit()
    f.repo.exchangeForItem = async () => { throw Object.assign(new Error('internal connection detail'), { code }) }
    const returns = new ReturnService({ repository: f.repo, accessories: f.service.accessories, pointsLedger: f.pointsLedger,
      tableExists: async () => true, permissionCheck: async () => true, now: () => time })
    await assert.rejects(returns.context(first.replacement_order_id, first.replacement_item_id, actor),
      code === 'ECONNRESET' ? { code } : { statusCode: 409, code: 'CHECKOUT_RETURN_NOT_READY' })
    assert.equal(f.state.headers.length, 1); assert.equal(f.state.extraStocks[6][2], 3)
  }
})

const phoneReturns = f => new PhoneReturnService({ repository: f.repo, accessories: f.service.accessories, pointsLedger: f.pointsLedger,
  tableExists: async () => true, columnExists: async () => true, permissionCheck: async () => true, now: () => time })
const phoneRequest = (accessories, refund) => ({ request_key: key(8), store_id: 2, return_reason: '客户退货', reversal_date: time,
  restock_confirmed: true, remarks: '手机与替换件退货', accessories, settlement: cash(refund) })
const phoneLine = (id, quantity = 0, charge = false, serials = []) => ({ item_id: id, quantity, serial_numbers: serials,
  charge_missing: charge, charge_confirmed: charge })
const chargedGift = async options => {
  const f = await fixture({ gift: true, ...options })
  await phoneReturns(f).submit(10, 21, phoneRequest([phoneLine(50, 0, true)], 76), actor)
  return f
}
const phoneHistory = (f, itemId) => {
  const header = f.state.headers.find(row => row.operation_type === 'phone_return')
  const items = f.state.facts.filter(row => row.aftersale_id === header.id).map(row => {
    const source = f.state.items.find(item => item.item_id === row.original_item_id) || f.state.rootPhone
    return { ...row, item_order_id: source.order_id, item_type: source.item_type, sale_id: source.sale_id, phone_id: source.phone_id,
      linked_phone_sale_id: source.linked_phone_sale_id }
  })
  return { ...header, aftersale_item_id: items.find(row => row.original_item_id === itemId).id,
    original_item_id: itemId, settlement_items: items, settlement_channel: header.settlement_channel ?? null }
}

test('手机退货包含全部原件与替换件，按各自真实原单返库；跨单资金凭据没有实证核验不得读取', async () => {
  const f = await fixture({ serial: true }), first = await f.submit({ serial_numbers: ['OLD1'],
    replacement: { accessory_id: 6, unit_price: 50, serial_numbers: ['NEW1'] } })
  const service = phoneReturns(f), request = phoneRequest([phoneLine(50), phoneLine(first.replacement_item_id, 1, false, ['NEW1'])], 150)
  const before = structuredClone(f.state), quote = await service.quote(10, 21, request, actor)
  assert.equal(quote.refund_amount, 150)
  assert.deepEqual({ ...f.state, rollbacks: before.rollbacks }, before)
  const result = await service.submit(10, 21, request, actor)
  assert.equal(result.refund_amount, 150); assert.equal(f.state.rootPhone.sale_status, 'cancelled')
  assert.equal(f.state.extraStocks[6][2], 4); assert.equal(f.state.stocks[2], 1)
  const header = phoneHistory(f, first.replacement_item_id)
  assert.throws(() => readAftersaleSettlement(header, header.settlement_items), { code: 'CHECKOUT_RETURN_CONFLICT' })
  const query = new QueryGoodsService({ goodsReturns: service, permissionCheck: async () => true,
    repository: { withConnection: operation => f.transaction(db => withReadConnection(operation, db)), async aftersales(scope, id, page, verify, connection) {
      await verify(connection, [header])
      return { data: [header], pagination: { page: 1, page_size: 20, total: 1, total_pages: 1, has_next: false, has_prev: false } }
    } } })
  const history = await query.aftersales(actor, f.state.sales.at(-1).id)
  assert.equal(history.data[0].base_refund_amount, 50); assert.equal(history.data[0].refund_amount, 50)
  assert.deepEqual(history.data[0].serial_numbers, ['NEW1'])
  f.state.exchanges[0].root_order_id = 99
  await assert.rejects(query.aftersales(actor, f.state.sales.at(-1).id), { code: 'CHECKOUT_RETURN_CONFLICT' })
})

test('替换赠品同样要求退回或按最初约定扣款；随后退还只退实际扣款，保留原手机关联', async () => {
  const f = await fixture({ gift: true }), first = await f.submit({ replacement: { accessory_id: 6, unit_price: 0 }, settlement: cash(0) })
  const service = phoneReturns(f), request = phoneRequest([phoneLine(50, 0, true), phoneLine(first.replacement_item_id, 0, true)], 76)
  const result = await service.submit(10, 21, request, actor)
  assert.equal(result.gift_charge_amount, 24); assert.equal(result.refund_amount, 76)
  assert.equal(f.state.extraStocks[6][2], 3)
  const returns = new ReturnService({ repository: f.repo, accessories: f.service.accessories, pointsLedger: f.pointsLedger,
    tableExists: async () => true, permissionCheck: async () => true, now: () => time })
  const refund = body({ request_key: key(9), settlement: cash(12) }); delete refund.replacement
  const restored = await returns.submit(first.replacement_order_id, first.replacement_item_id, refund, actor)
  assert.equal(restored.refund_amount, 12); assert.equal(f.state.extraStocks[6][2], 4)
  assert.equal(f.state.items.at(-1).linked_phone_sale_id, 21)
})

test('手机核对不能漏掉替换件或接受伪造跨单关系，后段失败整体保留原销售及库存', async () => {
  for (const kind of ['missing', 'unrelated', 'corrupt', 'header']) {
    const f = await fixture({ fail: kind === 'header' ? 'header' : '' })
    if (kind === 'header') f.retry()
    const first = await f.submit(), service = phoneReturns(f)
    const rows = [phoneLine(50), phoneLine(first.replacement_item_id, 1)]
    if (kind === 'missing') rows.pop()
    if (kind === 'unrelated') { f.state.exchanges = []; const value = JSON.parse(f.state.items.at(-1).snapshot); delete value.exchange_source; f.state.items.at(-1).snapshot = JSON.stringify(value) }
    if (kind === 'corrupt') f.state.exchanges[0].root_item_id = 99
    if (kind === 'header') service.repository.create = async () => { throw new Error('phone-header-failed') }
    const before = structuredClone(f.state)
    await assert.rejects(service.submit(10, 21, phoneRequest(rows, 150), actor))
    assert.deepEqual({ ...f.state, rollbacks: before.rollbacks }, before)
  }
})

test('只读手机清单展示替换件及原件已退数量；按真实关系校验门店，不暴露原始换货快照', async () => {
  const f = await fixture(), first = await f.submit(), goodsReturns = phoneReturns(f)
  const repository = { async returnChecklist() {
    return f.state.items.map(item => ({ ...item, goods_order_id: item.order_id, order_id: 10, order_no: 'ORIGINAL', store_id: 1,
      phone_item_id: 49, sale_id: 21, phone_id: 31, phone_quantity: 1, phone_amount: 100, phone_points: 0,
      return_history: f.state.facts.filter(row => row.original_item_id === item.item_id) }))
  } }
  const checklist = new AftersaleService({ repository, goodsReturns, permissionCheck: async () => true })
  const start = f.calls.length, result = await checklist.returnChecklist(10, 21, actor)
  assert.equal(result.accessories.length, 2); assert.equal(result.accessories[0].returned_quantity, 1)
  assert.equal(result.accessories[1].item_id, first.replacement_item_id); assert.equal(result.accessories[1].remaining_quantity, 1)
  assert.equal(JSON.stringify(result).includes('exchange_source'), false)
  assert.equal(f.calls.slice(start).some(sql => /FOR UPDATE|INSERT|UPDATE|DELETE/.test(sql)), false)
  await assert.rejects(checklist.returnChecklist(10, 21, { ...actor, store_ids: [1] }), { statusCode: 403 })
  f.state.exchanges = []
  await assert.rejects(checklist.returnChecklist(10, 21, actor), { statusCode: 409 })
})

test('换货实际权限、双门店范围、实物确认、同键内容、差价确认和就绪结构不能绕过', async () => {
  for (const permission of ['query:view', 'query:exchange', 'query:goods-view', 'accessories:sell']) {
    const f = await fixture({ denied: [permission] })
    await assert.rejects(f.submit(), { statusCode: 403 }); assert.equal(f.state.exchanges.length, 0)
  }
  const gift = await fixture({ gift: true, denied: ['accessories:gift'] })
  await assert.rejects(gift.submit({ replacement: { accessory_id: 6, unit_price: 0 }, settlement: cash(0) }), { statusCode: 403 })
  const f = await fixture({ deadlocks: 1 })
  await assert.rejects(f.submit({}, { id: 7, store_ids: [2] }), { statusCode: 403 })
  await assert.rejects(f.submit({ settlement: cash(0, 29) }), { code: 'CHECKOUT_RETURN_QUOTE_CHANGED' })
  await assert.rejects(f.submit({ settlement: { ...cash(0, 30), confirmed: false } }), { code: 'CHECKOUT_RETURN_PAYMENT_REQUIRED' })
  await assert.rejects(f.submit({ restock_confirmed: false }), { statusCode: 400 })
  await assert.rejects(f.submit({ replacement: { accessory_id: 6, unit_price: 0 } }), { statusCode: 409 })
  f.service.columnExists = async () => false
  await assert.rejects(f.submit(), { code: 'CHECKOUT_RETURN_NOT_READY' })
  assert.equal(f.state.orders.length, 1)
})

test('换货动作独立授权，只有退库权限不允许换货；换货权限不额外要求普通退库动作', async () => {
  const f = await fixture({ denied: ['query:return-to-stock'] })
  const result = await f.submit()
  assert.equal(result.collection_amount, 30)
  assert.equal(f.state.exchanges.length, 1)
  const denied = await fixture({ denied: ['query:exchange'] })
  await assert.rejects(denied.service.context(10, 50, actor), { statusCode: 403 })
  await assert.rejects(denied.quote(), { statusCode: 403 })
  assert.equal(denied.state.orders.length, 1)
})

test('换货HTTP核对/试算/提交复用真实事务，隐藏销售员或新件SN时在写入前拒绝', async () => {
  const response = () => ({ status(code) { this.code = code; return this }, json(value) { this.body = value; return this } })
  const f = await fixture(), hiddenFields = [], controller = new Controller({ goodsExchanges: f.service,
    goodsAccess: { getPermissions: async () => ({ hiddenFields }) }, logger: { error() {} } })
  const req = { user: actor, params: { orderId: 10, itemId: 50 }, body: body() }
  const context = response(); await controller.goodsExchangeContext(req, context)
  assert.equal(context.body.data.remaining_quantity, 2)
  const quoted = response(); await controller.quoteGoodsExchange(req, quoted)
  assert.equal(quoted.body.data.collection_amount, 30); assert.equal(f.state.exchanges.length, 0)
  for (const field of ['operator_info.operator_name', 'price_info.unit_price', 'stock_info.total_quantity', 'basic_info.serial_number']) {
    hiddenFields.push(field)
    const denied = response()
    await controller.submitGoodsExchange({ ...req, body: body({ replacement: { accessory_id: 6, unit_price: 50, serial_numbers: ['NEW01'] }, settlement: cash(0, 30) }) }, denied)
    assert.equal(denied.code, 403); assert.equal(denied.body.code, 'FIELD_PERMISSION_DENIED')
    assert.equal(f.state.exchanges.length, 0); hiddenFields.pop()
  }
  const submitted = response(); await controller.submitGoodsExchange({ ...req, body: body({ settlement: cash(0, 30) }) }, submitted)
  assert.equal(submitted.body.success, true); assert.equal(submitted.body.data.operator_id, 7)
  assert.equal(f.state.exchanges.length, 1)
  f.service.context = async () => { throw new Error('private SQL') }
  const error = response(); await controller.goodsExchangeContext(req, error)
  assert.equal(error.code, 500); assert.equal(JSON.stringify(error.body).includes('private'), false)
  const route = require('node:fs').readFileSync(require('node:path').join(__dirname, '../src/routes/sales.js'), 'utf8')
  for (const suffix of ['', '/quote']) {
    const declarations = route.split('\n').filter(line => line.includes(`'/checkout/:orderId/items/:itemId/exchange${suffix}'`))
    assert.equal(declarations.length, suffix ? 1 : 2)
    for (const declaration of declarations) assert.match(declaration, /unifiedAuth, requirePermission\('query:view'\), requirePermission\('query:exchange'\), requirePermission\('query:goods-view'\)/)
  }
})

test('真实换货后历史按实际新订单/销售快照及完整链读取，连续换货仍能追溯第一笔', async () => {
  const f = await fixture({ serial: true }), first = await f.submit({ serial_numbers: ['OLD1'], replacement: { accessory_id: 6, unit_price: 50, serial_numbers: ['NEW1'] } })
  const headers = () => f.state.headers.filter(row => row.operation_type === 'goods_exchange').map(row => {
    const fact = f.state.facts.find(item => item.aftersale_id === row.id), original = f.state.items.find(item => item.item_id === fact.original_item_id)
    return { ...row, aftersale_item_id: fact.id, original_item_id: fact.original_item_id,
      settlement_items: [{ ...fact, item_order_id: original.order_id, item_type: 'accessory' }] }
  })
  const history = new QueryGoodsService({ permissionCheck: async () => true, goodsReturns: f.service, repository: {
    withConnection: operation => f.transaction(db => withReadConnection(operation, db)),
    async aftersales(_scope, _id, _query, verify, connection) {
      const rows = headers()
      await verify(connection, rows)
      return { data: rows, pagination: { total: rows.length } }
    }
  } })
  let result = await history.aftersales(actor, 1)
  assert.equal(result.data[0].collection_amount, 30); assert.equal(result.data[0].exchange_credit_amount, 20)
  assert.deepEqual(result.data[0].replacement.serial_numbers, ['NEW1'])
  const previous = f.calls.length
  await f.service.submit(first.replacement_order_id, first.replacement_item_id, body({ request_key: key(2), serial_numbers: ['NEW1'],
    replacement: { accessory_id: 6, unit_price: 60, serial_numbers: ['NEW2'] }, settlement: cash(0, 10) }), actor)
  result = await history.aftersales(actor, 1)
  assert.equal(result.data.length, 2)
  assert.deepEqual(result.data[0].replacement.serial_numbers, ['NEW1'])
  assert.deepEqual(result.data[1].replacement.serial_numbers, ['NEW2'])
  const beforeRead = f.calls.length
  await history.aftersales(actor, 1)
  assert.equal(f.calls.slice(beforeRead).some(sql => /FOR UPDATE|INSERT|UPDATE|DELETE/.test(sql)), false)
  assert.ok(f.calls.length > previous)
  f.state.exchanges[0].aftersale_id = 999
  await assert.rejects(history.aftersales(actor, 1), { statusCode: 409 })
})

test('新件不足、未启用、未知库存或销售员及客户端改用途/数量/关联均拒绝，不留下先退后卖半笔业务', async () => {
  for (const patch of [{ operator_id: 99 }, { replacement: { accessory_id: 99, unit_price: 50 } },
    { replacement: { accessory_id: 6, unit_price: 50, quantity: 10 } },
    { replacement: { accessory_id: 6, unit_price: 50, linked_phone_sale_id: 99 } },
    { replacement: { accessory_id: 6, unit_price: 50, sale_type: 'gift' } }]) {
    const f = await fixture()
    await assert.rejects(f.submit(patch))
    assert.equal(f.state.orders.length, 1); assert.equal(f.state.stocks[2], 0)
  }
  for (const kind of ['stock', 'disabled', 'customer', 'ledger']) {
    const f = await fixture({ award: 4 })
    if (kind === 'stock') { f.state.extraStocks[6][2] = 0; f.state.events.find(row => row.accessory_id === 6).quantity_delta = 0 }
    if (kind === 'disabled') f.state.products[6].status = 0
    if (kind === 'customer') f.state.orders[0].customer_phone = null
    if (kind === 'ledger') f.service.pointsLedger.ready = async () => false
    await assert.rejects(f.submit())
    assert.equal(f.state.orders.length, 1); assert.equal(f.state.stocks[2], 0); assert.equal(f.state.customers[9], 4)
    assert.equal(f.state.headers.length, 0)
  }
})

test('已扣款赠品按原实际12元抵付50元新件，仅补38元，原赠品及扣款不被改写', async () => {
  const f = await chargedGift({ denied: ['accessories:gift'], pointsRate: 100 })
  const before = structuredClone(f.state)
  const context = await f.service.context(10, 50, actor)
  assert.equal(context.sale_type, 'gift'); assert.equal(context.replacement_sale_type, 'sale'); assert.equal(context.gift_charge_settled, true)
  const quote = await f.quote()
  assert.equal(quote.base_refund_amount, 12); assert.equal(quote.collection_amount, 38)
  assert.deepEqual({ ...f.state, rollbacks: before.rollbacks }, before)
  const result = await f.submit({ settlement: cash(0, 38), operator_id: 8 })
  assert.equal(result.exchange_credit_amount, 12); assert.equal(result.replacement_paid_amount, 38)
  assert.equal(result.points_earned, 50)
  assert.equal(f.state.items.at(-1).linked_phone_sale_id, 21)
  const snapshot = JSON.parse(f.state.items.at(-1).snapshot)
  assert.equal(snapshot.sale_type, 'sale'); assert.equal(snapshot.gift_return_unit_price, null)
  assert.equal(f.state.sales.at(-1).sale_type, 'sale'); assert.equal(f.state.sales.at(-1).operator_id, 8)
  assert.equal(f.state.stocks[2], 1); assert.equal(f.state.extraStocks[6][2], 3)
  const fact = JSON.parse(f.state.facts.at(-1).fact_snapshot)
  assert.equal(fact.gift_refund_cents, 1200); assert.equal(fact.gift_charge_aftersale_id, before.headers[0].id)
  assert.deepEqual(f.state.headers[0], before.headers[0]); assert.deepEqual(f.state.items[0], before.items[0])
  assert.equal(f.state.rootPhone.sale_status, 'cancelled')
  assert.deepEqual(await f.submit({ settlement: cash(0, 38), operator_id: 8 }), result)
  assert.equal(f.state.exchanges.length, 1)
  const next = await f.service.context(result.replacement_order_id, result.replacement_item_id, actor)
  assert.equal(next.sale_type, 'sale'); assert.equal(next.gift_charge_settled, false)
  assert.equal(next.replacement_sale_type, 'sale')
})

test('已扣款赠品分次换低价、等价及SN新件按实际扣款分摊，不重复返还剩余赠品扣款', async () => {
  const f = await chargedGift({ serial: true })
  const first = await f.submit({ serial_numbers: ['OLD2'], replacement: { accessory_id: 6, unit_price: 8, serial_numbers: ['NEW3'] }, settlement: cash(4) })
  assert.equal(first.refund_amount, 4); assert.equal(first.exchange_credit_amount, 8)
  assert.equal(f.state.serials.find(row => row.serial_number === 'OLD2').status, 'in_stock')
  assert.equal(f.state.serials.find(row => row.serial_number === 'NEW3').status, 'sold')
  const second = await f.submit({ request_key: key(2), serial_numbers: ['OLD1'], replacement: { accessory_id: 6, unit_price: 12, serial_numbers: ['NEW4'] }, settlement: cash(0) })
  assert.equal(second.base_refund_amount, 12); assert.equal(second.collection_amount, 0); assert.equal(second.refund_amount, 0)
  assert.equal(second.remaining_quantity, 0)
  const receipts = f.state.facts.filter(row => row.original_item_id === 50).map(row => JSON.parse(row.fact_snapshot))
  assert.equal(receipts.reduce((sum, fact) => sum + (fact.gift_refund_cents || 0), 0), 2400)
  await assert.rejects(f.submit({ request_key: key(3), serial_numbers: ['OLD2'], settlement: cash(0, 38) }), { statusCode: 409 })
  assert.equal((await f.service.context(first.replacement_order_id, first.replacement_item_id, actor)).remaining_quantity, 1)
})

test('用途转换后连续换货和退货仍核对最初赠品原单，后续只按新件净价办理', async () => {
  const f = await chargedGift()
  const first = await f.submit({ settlement: cash(0, 38) })
  const next = await f.service.submit(first.replacement_order_id, first.replacement_item_id,
    body({ request_key: key(2), replacement: { accessory_id: 6, unit_price: 60 }, settlement: cash(0, 10) }), actor)
  assert.equal(next.root_order_id, 10); assert.equal(next.root_item_id, 50); assert.equal(next.base_refund_amount, 50)
  const service = new ReturnService({ repository: f.repo, accessories: f.service.accessories, pointsLedger: f.pointsLedger,
    tableExists: async () => true, permissionCheck: async () => true, now: () => time })
  const request = body({ request_key: key(3), settlement: cash(60) }); delete request.replacement
  const result = await service.submit(next.replacement_order_id, next.replacement_item_id, request, actor)
  assert.equal(result.refund_amount, 60)
  assert.equal(f.state.extraStocks[6][2], 4)
  assert.equal(f.state.facts.filter(row => JSON.parse(row.fact_snapshot).gift_refund_cents === 1200).length, 1)
  assert.equal((await service.context(10, 50, actor)).remaining_quantity, 1)
})

test('赠品先换货、手机扣款后再转为收费新件，历史核验完整祖先链及原实际抵付', async () => {
  const f = await fixture({ gift: true })
  const gift = await f.submit({ replacement: { accessory_id: 6, unit_price: 0 }, settlement: cash(0) })
  await phoneReturns(f).submit(10, 21, phoneRequest([phoneLine(50, 0, true), phoneLine(gift.replacement_item_id, 0, true)], 76), actor)
  const result = await f.service.submit(gift.replacement_order_id, gift.replacement_item_id,
    body({ request_key: key(2), replacement: { accessory_id: 6, unit_price: 50 }, settlement: cash(0, 38) }), actor)
  assert.equal(result.root_item_id, 50); assert.equal(result.base_refund_amount, 12)
  const history = new QueryGoodsService({ permissionCheck: async () => true, goodsReturns: f.service, repository: {
    withConnection: operation => f.transaction(db => withReadConnection(operation, db)),
    async aftersales(_scope, _id, _query, verify, connection) {
      const row = f.state.headers.at(-1), fact = f.state.facts.at(-1)
      const header = { ...row, aftersale_item_id: fact.id, original_item_id: fact.original_item_id,
        settlement_items: [{ ...fact, item_order_id: gift.replacement_order_id, item_type: 'accessory' }] }
      await verify(connection, [header])
      return { data: [header], pagination: { total: 1 } }
    }
  } })
  const before = f.calls.length, rows = await history.aftersales(actor, gift.replacement_item_id)
  assert.equal(rows.data[0].exchange_credit_amount, 12); assert.equal(rows.data[0].collection_amount, 38)
  assert.equal(rows.data[0].replacement.order_no, f.state.orders.at(-1).order_no)
  assert.equal(f.calls.slice(before).some(sql => /FOR UPDATE|INSERT|UPDATE|DELETE/.test(sql)), false)
})

test('已扣款赠品换货须商品销售权限，不能改回赠送、重复用原扣款或留下失败半笔', async () => {
  const denied = await chargedGift({ denied: ['accessories:sell'] })
  await assert.rejects(denied.submit({ settlement: cash(0, 38) }), { statusCode: 403 })
  const f = await chargedGift()
  await assert.rejects(f.submit({ replacement: { accessory_id: 6, unit_price: 0 }, settlement: cash(12) }), { statusCode: 409 })
  const before = structuredClone(f.state), create = f.repo.createExchange.bind(f.repo)
  f.repo.createExchange = async () => { throw new Error('link-failed') }
  await assert.rejects(f.submit({ settlement: cash(0, 38) }), /link-failed/)
  assert.deepEqual({ ...f.state, rollbacks: before.rollbacks }, before)
  f.repo.createExchange = create
  await f.submit({ settlement: cash(0, 38) })
  assert.equal(f.state.exchanges.length, 1)
})

test('已扣款赠品换入新件可消费结算前已有积分，抵扣新件不发奖，0元原约定也保留已扣款事实', async () => {
  const f = await chargedGift({ existing: 10, pointsRate: 100 })
  const result = await f.submit({ replacement: { accessory_id: 6, unit_price: 50, redeem_points: 10 }, settlement: cash(0, 37) })
  assert.equal(result.base_refund_amount, 12); assert.equal(result.replacement_amount, 49)
  assert.equal(result.points_used, 10); assert.equal(result.points_earned, 0); assert.equal(f.state.customers[9], 0)
  const zero = await fixture({ gift: true })
  zero.state.items[0].snapshot.gift_return_unit_price = 0
  await phoneReturns(zero).submit(10, 21, phoneRequest([phoneLine(50, 0, true)], 100), actor)
  assert.equal((await zero.service.context(10, 50, actor)).gift_charge_settled, true)
  const changed = await zero.submit({ settlement: cash(0, 50) })
  assert.equal(changed.base_refund_amount, 0); assert.equal(changed.collection_amount, 50)
  const receipt = JSON.parse(zero.state.facts.at(-1).fact_snapshot)
  assert.equal(receipt.gift_refund_cents, 0); assert.equal(receipt.gift_charge_aftersale_id, 1)
  assert.equal((await zero.service.context(changed.replacement_order_id, changed.replacement_item_id, actor)).sale_type, 'sale')
})

test('赠品用途转换缺少原扣款、错扣款ID或金额、伪造新件用途均拒绝核对及继续退换', async () => {
  for (const corrupt of [fact => { delete fact.gift_refund_cents }, fact => { delete fact.gift_charge_aftersale_id },
    fact => { fact.gift_charge_aftersale_id = 99 }, fact => { fact.gift_refund_cents++ }]) {
    const f = await chargedGift(), result = await f.submit({ settlement: cash(0, 38) })
    const row = f.state.facts.at(-1), fact = JSON.parse(row.fact_snapshot); corrupt(fact); row.fact_snapshot = JSON.stringify(fact)
    await assert.rejects(f.service.context(result.replacement_order_id, result.replacement_item_id, actor), { statusCode: 409 })
  }
  const f = await chargedGift(), result = await f.submit({ settlement: cash(0, 38) })
  const item = f.state.items.at(-1), snapshot = JSON.parse(item.snapshot)
  snapshot.sale_type = 'gift'; item.snapshot = JSON.stringify(snapshot)
  await assert.rejects(f.service.context(result.replacement_order_id, result.replacement_item_id, actor), { statusCode: 409 })
  snapshot.sale_type = 'sale'; item.snapshot = JSON.stringify(snapshot)
  f.state.facts.splice(0, 2)
  await assert.rejects(f.service.context(result.replacement_order_id, result.replacement_item_id, actor), { statusCode: 409 })
})

test('0元赠品退款也必须晚于真实扣款，不能引用以后才出现的扣款伪造用途转换', async () => {
  const f = await fixture({ gift: true })
  f.state.items[0].snapshot.gift_return_unit_price = 0
  const history = [
    { aftersale_id: 2, quantity: 1, fact_snapshot: { kind: 'return', unit_ranges: [[0, 1]], serial_numbers: [],
      gift_refund_cents: 0, gift_charge_aftersale_id: 3 } },
    { aftersale_id: 3, quantity: 0, fact_snapshot: { kind: 'gift_charge', unit_ranges: [], serial_numbers: [],
      gift_charge: { quantity: 1, unit_cents: 0, amount_cents: 0, serial_numbers: [] } } }
  ]
  assert.throws(() => planGoodsReturn(f.state.items[0], history, 0, []), { statusCode: 409, code: 'CHECKOUT_RETURN_CONFLICT' })
})
