'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const inventoryFixture = require('./helpers/accessory-returns')
const Repository = require('../src/repositories/sales-aftersale.repository')
const Service = require('../src/services/sales-goods-return.service')
const Controller = require('../src/controllers/sales-aftersale.controller')
const { planGoodsReturn } = require('../src/utils/checkout-goods-return')
const { readAftersaleSettlement } = require('../src/utils/sales-aftersale-settlement')
const { createGoodsCommission } = require('../src/utils/goods-commission')

const actor = { id: 7, store_ids: [1, 2] }, time = '2026-11-13 16:00:00'
const key = value => String(value).padStart(32, '0')
const body = (overrides = {}) => ({ request_key: key(1), store_id: 2, quantity: 1, return_reason: '客户退货',
  reversal_date: time, remarks: '原单退货', restock_confirmed: true, ...overrides })
const settlement = (refund, collection = 0) => ({ refund_amount: refund, collection_amount: collection,
  method: refund || collection ? 'cash' : null, confirmed: true })

/** 实际售后/积分/批次仓储共用SQL事务替身，提交与回滚覆盖整份业务状态。 */
async function fixture({ serial = false, redemption = 0, award = 0, gift = false, fail = '', denied = [] } = {}) {
  const f = inventoryFixture({ ...(serial ? { events: [{ id: 1, accessory_id: 5, store_id: 1, stock_in_id: 1,
    purchase_cost: 10, usage_type: 'sale', serial_tracking: 1, event_type: 'stock_in', quantity_delta: 3, sale_id: null }],
  serials: [1, 2, 3].map(id => ({ id, accessory_id: 5, store_id: 1, stock_in_id: 1, purchase_cost: 10, serial_number: `SN${id}`, status: 'in_stock' })) } : {}) })
  if (serial) f.state.stocks[1] = 3
  const quantity = 3, net = gift ? 0 : 60 - redemption / 100
  await f.sell({ quantity, customer_id: 9, unit_price: gift ? 0 : 20, sale_type: gift ? 'gift' : 'sale', remarks: gift ? '原单促销赠送' : '',
    ...(serial ? { serial_numbers: ['SN1', 'SN2', 'SN3'] } : {}) }, { resolveTotalCents: async () => net * 100 })
  Object.assign(f.state, { order: { id: 10, order_no: 'ORIGINAL', store_id: 1, customer_id: 9 },
    item: { item_id: 50, order_id: 10, accessory_id: 5, accessory_sale_id: 1, quantity,
      unit_price: gift ? 0 : 20, total_amount: net, points_awarded: award,
      snapshot: { name: '原商品', sale_type: gift ? 'gift' : 'sale', serial_numbers: serial ? ['SN1', 'SN2', 'SN3'] : [],
        points_used: redemption, deduction_cents: redemption, points_per_yuan: redemption ? 100 : null, gross_cents: gift ? 0 : 6000,
        points_units: [{ quantity: 3, points_used: redemption / 3, deduction_cents: redemption / 3,
          payable_cents: gift ? 0 : 2000 - redemption / 3, points_awarded: award / 3 }] } }, returnHeaders: [], returnItems: [],
    commits: 0, rollbacks: 0 })
  await f.transaction(async db => {
    if (redemption) {
      await f.pointsLedger.applyDelta(db, { customerId: 9, delta: redemption, sourceType: 'phone_sale', sourceId: 100 })
      const snapshot = await f.pointsLedger.snapshot(db, 9)
      await f.pointsLedger.consume(db, { customerId: 9, points: redemption, amountCents: redemption, pointsPerYuan: 100, itemId: 50, snapshot })
    }
    if (award) await f.pointsLedger.applyDelta(db, { customerId: 9, delta: award, sourceType: 'checkout_item', sourceId: 50 })
  })
  const originalExecute = f.connection.execute.bind(f.connection), calls = [], perms = []
  f.connection.execute = async (sql, params) => {
    calls.push(sql)
    const s = f.state
    if (sql.includes('FROM sales_aftersales WHERE request_key')) return [structuredClone(s.returnHeaders.filter(row => row.request_key === params[0]))]
    if (sql.includes('FROM sales_orders')) { assert.match(sql, /FOR UPDATE/); return [[s.order].filter(row => row.id === params[0])] }
    if (sql.includes('FROM sales_order_items i JOIN accessory_sales')) {
      assert.match(sql, /FOR UPDATE/)
      const sale = s.sales[0]
      return [s.item.item_id === params[1] && s.item.order_id === params[0] ? [{ ...s.item,
        sale_accessory_id: sale.accessory_id, sale_customer_id: sale.customer_id, sale_store_id: sale.store_id,
        sale_quantity: sale.quantity, sale_unit_price: sale.unit_price, sale_total_price: sale.total_price, sale_type: sale.sale_type,
        sale_operator_id: sale.operator_id }] : []]
    }
    if (sql.includes('FROM sales_aftersale_items i')) { assert.match(sql, /FOR UPDATE/); return [s.returnItems.filter(row => row.original_item_id === params[0])] }
    if (sql.includes('SELECT id FROM stores')) return [[{ id: params[0] }]]
    if (sql.includes('INSERT INTO sales_aftersales')) {
      if (fail === 'header') throw new Error('header-failed')
      const fields = ['request_key', 'request_hash', 'order_id', 'customer_id', 'original_store_id', 'store_id', 'created_by', 'base_refund_cents',
        'recovery_cents', 'compensation_cents', 'refund_cents', 'collection_cents', 'points_delta', 'settlement_method', 'settlement_channel', 'business_time', 'remarks', 'result_snapshot', 'created_at']
      const id = s.returnHeaders.length + 1
      s.returnHeaders.push({ id, ...Object.fromEntries(fields.map((field, i) => [field, params[i]])) })
      return [{ insertId: id }]
    }
    if (sql.includes('INSERT INTO sales_aftersale_items')) {
      if (fail === 'item') throw new Error('item-failed')
      s.returnItems.push({ id: s.returnItems.length + 1, aftersale_id: params[0], original_item_id: params[1], quantity: params[2], fact_snapshot: params[3] })
      return [{ insertId: s.returnItems.length }]
    }
    return originalExecute(sql, params)
  }
  const repo = new Repository()
  repo.withConnection = operation => f.transaction(async db => {
    let before
    db.beginTransaction = async () => { before = structuredClone(f.state) }
    db.commit = async () => { f.state.commits++ }
    db.rollback = async () => { if (before) { Object.assign(f.state, before); before = null }; f.state.rollbacks++ }
    return operation(db)
  })
  const service = new Service({ repository: repo, accessories: f.service, pointsLedger: f.pointsLedger,
    permissionCheck: async (user, action) => { perms.push(action); return !denied.includes(action) },
    tableExists: async () => true, now: () => '2026-11-13 17:00:00' })
  return { ...f, service, calls, perms, repo,
    quote: (input = {}, user = actor) => service.quote(10, 50, body(input), user),
    submit: (input = {}, user = actor) => service.submit(10, 50, body({ settlement: settlement(20), ...input }), user) }
}

test('共用商品返库步骤返回原积分与库存事实，不自行保存售后或确认资金，外层失败完整回滚', async () => {
  const f = await fixture({ award: 6, serial: true }), before = structuredClone(f.state)
  await assert.rejects(f.transaction(async db => {
    const input = f.service.normalize(10, 50, body({ serial_numbers: ['SN2'] }), actor, true)
    const loaded = await f.service.load(db, input, actor)
    const result = await f.service.returnGoods(db, input, actor, loaded, 'exchange:original:50')
    assert.equal(result.base, 2000); assert.equal(result.delta, -2)
    assert.equal(result.recovery, 0); assert.equal(result.compensation, 0)
    assert.equal(result.pointEntries.length, 1)
    assert.equal(result.inventory.accessory_id, 5)
    assert.equal(result.inventory.remaining_quantity, 2)
    assert.equal(result.inventory.inventory_event_ids.length, 1)
    assert.equal(f.state.stocks[2], 1)
    assert.equal(f.state.customers[9], 4)
    assert.equal(f.state.serials.find(row => row.serial_number === 'SN2').status, 'in_stock')
    assert.equal(f.state.returnHeaders.length, 0); assert.equal(f.state.returnItems.length, 0)
    assert.equal(f.state.commits, 0)
    throw new Error('outer-settlement-failed')
  }), /outer-settlement-failed/)
  assert.deepEqual(f.state, before)
})

test('共用返库步骤不将零退回数量的赠品扣款变成实物退回，不改变SN或批次', async () => {
  const f = await fixture({ gift: true, serial: true }), before = structuredClone(f.state)
  await f.transaction(async db => {
    const input = { order_id: 10, item_id: 50, store_id: 2, quantity: 0, serial_numbers: [], time, remarks: '' }
    const loaded = await f.service.load(db, input, actor)
    assert.deepEqual(await f.service.returnGoods(db, input, actor, loaded, 'phone:gift:50'), {
      base: 0, recovery: 0, compensation: 0, delta: 0, pointEntries: [], inventory: { inventory_event_ids: [] }
    })
  })
  assert.deepEqual(f.state, before)
})

test('实际试算回滚积分和批次，不保留售后、库存或余额变化；提交重新计算并保存原单关联', async () => {
  const f = await fixture({ award: 6 }), before = structuredClone(f.state)
  const quote = await f.quote()
  assert.equal(quote.refund_amount, 20); assert.equal(quote.points_delta, -2)
  const { rollbacks: _r1, ...afterQuote } = f.state, { rollbacks: _r2, ...original } = before
  assert.deepEqual(afterQuote, original)
  const result = await f.submit()
  assert.equal(result.aftersale_id, 1); assert.equal(result.remaining_quantity, 2)
  assert.equal(f.state.stocks[2], 1); assert.equal(f.state.customers[9], 4)
  assert.equal(f.state.returnHeaders[0].business_time, time)
  assert.equal(f.state.returnHeaders[0].created_at, '2026-11-13 17:00:00')
  assert.equal(f.state.returnItems[0].original_item_id, 50)
  const saved = f.state.returnItems[0]
  const allocation = readAftersaleSettlement({ ...f.state.returnHeaders[0], order_id: 10, operation_type: 'goods_return' },
    [{ ...saved, item_order_id: 10, item_type: 'accessory' }])
  assert.equal(allocation[0].settlement.base_refund_cents, 2000)
  assert.equal(allocation[0].settlement.refund_cents, 2000)
  assert.equal(allocation[0].settlement.points_delta, -2)
  assert.equal(allocation[0].settlement.offset_cents, 0)
  assert.deepEqual(f.state.sales, before.sales)
  assert.deepEqual(f.state.item, before.item)
})

test('同一请求幂等；重开不同请求可分次退，超量、改数量/门店/操作者不重复处理', async () => {
  const f = await fixture({ award: 6 }), first = await f.submit()
  const saved = structuredClone(f.state)
  assert.deepEqual(await f.submit(), first)
  assert.equal(f.state.returnHeaders.length, 1); assert.equal(f.state.stocks[2], 1)
  for (const input of [{ quantity: 2 }, { store_id: 1 }, { remarks: '修改内容' }]) {
    await assert.rejects(f.submit(input), { code: 'CHECKOUT_RETURN_REQUEST_CONFLICT' })
  }
  await assert.rejects(f.submit({}, { ...actor, id: 8 }), { code: 'CHECKOUT_RETURN_REQUEST_CONFLICT' })
  const next = await f.submit({ request_key: key(2), quantity: 2, settlement: settlement(40) })
  assert.equal(next.remaining_quantity, 0); assert.equal(f.state.customers[9], 0)
  assert.equal(f.state.returnItems.length, 2); assert.equal(f.state.stocks[2], 3)
  await assert.rejects(f.submit({ request_key: key(3) }), /超过原单剩余/)
  assert.equal(saved.returnHeaders.length, 1)
})

test('办理原单查询返回剩余件数与可退SN，全部退完为0；并发替身同单退货不重复返还', async () => {
  const f = await fixture({ serial: true })
  const context = () => f.service.context(10, 50, actor)
  assert.deepEqual((await context()).serial_numbers, ['SN1', 'SN2', 'SN3'])
  await f.submit({ serial_numbers: ['SN2'] })
  assert.deepEqual((await context()).serial_numbers, ['SN1', 'SN3'])
  const results = await Promise.allSettled([2, 3].map(id => f.submit({ request_key: key(id), quantity: 2,
    serial_numbers: ['SN3', 'SN1'], settlement: settlement(40) })))
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
  const final = await context()
  assert.equal(final.remaining_quantity, 0); assert.equal(final.returned_quantity, 3)
  assert.deepEqual(final.serial_numbers, [])
  assert.equal(f.state.stocks[2], 3)
})

test('不均分抵扣按原分摊顺序，SN选择对应单件；三次退货汇总与原单金额和积分守恒', () => {
  const row = { item_id: 50, quantity: 3, unit_price: 20, total_amount: 59.95, points_awarded: 0,
    snapshot: { sale_type: 'sale', serial_numbers: [], points_used: 5, deduction_cents: 5, points_per_yuan: 100, gross_cents: 6000,
      points_units: [{ quantity: 2, points_used: 2, deduction_cents: 2, payable_cents: 1998, points_awarded: 0 },
        { quantity: 1, points_used: 1, deduction_cents: 1, payable_cents: 1999, points_awarded: 0 }] } }
  const history = [], results = []
  for (let i = 0; i < 3; i++) {
    const plan = planGoodsReturn(row, history, 1, [])
    results.push(plan)
    history.push({ quantity: 1, fact_snapshot: { unit_ranges: plan.unit_ranges } })
  }
  assert.deepEqual(results.map(result => result.points_used), [2, 2, 1])
  assert.equal(results.reduce((sum, result) => sum + result.payable_cents, 0), 5995)
  const sn = structuredClone(row); sn.snapshot.serial_numbers = ['A', 'B', 'C']
  assert.equal(planGoodsReturn(sn, [], 1, ['C']).points_used, 1)
  assert.equal(planGoodsReturn(sn, [], 1, ['A']).payable_cents, 1998)
})

test('实际SN分次退货追加原提成冲回凭据，重复提交不重复冲回，损坏凭据阻止后续退回', async () => {
  const f = await fixture({ serial: true })
  const commission = createGoodsCommission({ employeeId: f.state.sales[0].operator_id, salaryTemplateId: 4, quantity: 3,
    saleType: 'sale', paidCents: 6000, purchaseCostCents: 3000, pointsUsed: 0,
    rule: { enabled: true, type: 'percentage', fixed_amount: 0, percentage: 33.33 } })
  f.state.item.purchase_cost = 30
  f.state.item.snapshot.commission = commission
  const first = { serial_numbers: ['SN3'], settlement: settlement(20) }
  await f.submit(first); await f.submit(first)
  assert.equal(f.state.returnItems.length, 1)
  assert.equal(JSON.parse(f.state.returnItems[0].fact_snapshot).commission_return.reversal_cents, 334)
  await f.submit({ request_key: key(2), quantity: 2, serial_numbers: ['SN1', 'SN2'], settlement: settlement(40) })
  assert.equal(f.state.returnItems.reduce((sum, row) => sum + JSON.parse(row.fact_snapshot).commission_return.reversal_cents, 0), 1000)
  assert.deepEqual(f.state.item.snapshot.commission, commission)
  const corrupt = await fixture({ serial: true })
  corrupt.state.item.purchase_cost = 30
  corrupt.state.item.snapshot.commission = commission
  await corrupt.submit(first)
  const changed = JSON.parse(corrupt.state.returnItems[0].fact_snapshot); changed.commission_return.reversal_cents++
  corrupt.state.returnItems[0].fact_snapshot = JSON.stringify(changed)
  const before = structuredClone(corrupt.state)
  await assert.rejects(corrupt.submit({ request_key: key(2), serial_numbers: ['SN1'], settlement: settlement(20) }), { code: 'GOODS_COMMISSION_CONFLICT' })
  assert.deepEqual(corrupt.state, before)
})

test('SN可任意顺序部分退，按原SN分摊返库，重复或错误SN拒绝且不改原销售', async () => {
  const f = await fixture({ serial: true, award: 6 })
  await f.submit({ serial_numbers: ['SN3'] })
  assert.equal(f.state.serials[2].store_id, 2); assert.equal(f.state.serials[2].status, 'in_stock')
  assert.deepEqual(JSON.parse(f.state.returnItems[0].fact_snapshot).unit_ranges, [[2, 3]])
  for (const serial_numbers of [[], ['SN3'], ['WRONG'], ['SN1', 'SN1']]) {
    await assert.rejects(f.submit({ request_key: key(2), serial_numbers }))
  }
  await f.submit({ request_key: key(2), serial_numbers: ['SN1', 'SN2'], quantity: 2, settlement: settlement(40) })
  assert.equal(f.state.stocks[2], 3)
})

test('退抵扣商品只退净额并返原来源积分；原奖励已追回时转为补退款，不重新发积分', async () => {
  for (const recovered of [false, true]) {
    const f = await fixture({ redemption: 300 })
    if (recovered) await f.transaction(db => f.pointsLedger.returnAward(db, { customerId: 9, sourceType: 'phone_sale', sourceId: 100,
      points: 300, requestKey: 'origin:phone:return' }))
    const quote = await f.quote()
    assert.equal(quote.base_refund_amount, 19)
    assert.equal(quote.refund_amount, recovered ? 20 : 19)
    assert.equal(quote.points_delta, recovered ? 0 : 100)
    const result = await f.submit({ settlement: settlement(recovered ? 20 : 19) })
    assert.equal(result.points_compensation_amount, recovered ? 1 : 0)
    assert.equal(f.state.customers[9], recovered ? 0 : 100)
  }
})

test('原商品奖励已消费：原抵扣价值扣退款；超出退款必须补款确认，不造负退款', async () => {
  const f = await fixture({ award: 6000 })
  await f.transaction(async db => {
    const snapshot = await f.pointsLedger.snapshot(db, 9)
    await f.pointsLedger.consume(db, { customerId: 9, points: 6000, amountCents: 600000, pointsPerYuan: 1, itemId: 70, snapshot })
  })
  const quote = await f.quote()
  assert.equal(quote.points_recovery_amount, 2000)
  assert.equal(quote.refund_amount, 0); assert.equal(quote.collection_amount, 1980)
  await assert.rejects(f.submit(), { code: 'CHECKOUT_RETURN_QUOTE_CHANGED' })
  await assert.rejects(f.submit({ settlement: { ...settlement(0, 1980), confirmed: false } }), { code: 'CHECKOUT_RETURN_PAYMENT_REQUIRED' })
  assert.equal(f.state.stocks[2], 0); assert.equal(f.state.aftersales.length, 0)
  await f.submit({ settlement: settlement(0, 1980) })
  assert.equal(f.state.returnHeaders[0].collection_cents, 198000)
  assert.equal(f.state.returnHeaders[0].refund_cents, 0)
})

test('退款未确认、过期金额、头/明细/库存/积分失败全部回滚，不保留资金凭据', async () => {
  for (const failure of ['header', 'item', 'inventory', 'stock', 'aftersale']) {
    const f = await fixture({ award: 6, fail: failure })
    if (failure === 'inventory' || failure === 'stock') f.failAt(failure)
    // 积分错误直接模拟外部组件失败，仍要求外层统一回滚。
    if (failure === 'aftersale') f.service.pointsLedger = { returnAward: async () => { throw new Error('points-failed') } }
    const before = structuredClone(f.state)
    await assert.rejects(f.submit())
    assert.equal(f.state.returnHeaders.length, 0); assert.equal(f.state.returnItems.length, 0)
    assert.deepEqual(f.state.events, before.events); assert.deepEqual(f.state.aftersales, before.aftersales)
    assert.deepEqual(f.state.customers, before.customers); assert.deepEqual(f.state.stocks, before.stocks)
  }
  const f = await fixture()
  await assert.rejects(f.submit({ settlement: { ...settlement(20), confirmed: false } }), { code: 'CHECKOUT_RETURN_PAYMENT_REQUIRED' })
  assert.equal(f.state.stocks[2], 0)
})

test('赠品实物退回零金额，停用模板仍可退原件；不调用第三方退款或删除原交易', async () => {
  const f = await fixture({ gift: true })
  f.state.product.status = 0
  const receipt = await f.submit({ settlement: settlement(0) })
  assert.equal(receipt.refund_amount, 0); assert.equal(receipt.points_delta, 0)
  assert.equal(f.state.stocks[2], 1); assert.equal(f.state.sales.length, 1)
  assert.equal(f.calls.some(sql => /DELETE|UPDATE payment_records|INSERT INTO payment_records/.test(sql)), false)
})

test('逐域权限、原单门店与接收门店范围不能绕过；缺迁移拒绝进入退货事务', async () => {
  for (const permission of ['query:view', 'query:return-to-stock', 'accessories:view']) {
    const f = await fixture({ denied: [permission] })
    await assert.rejects(f.submit(), { statusCode: 403 }); assert.equal(f.calls.length, 0)
  }
  const f = await fixture()
  await assert.rejects(f.submit({}, { id: 7, store_ids: [2] }), { statusCode: 403 })
  await assert.rejects(f.submit({}, { id: 7, store_ids: [1] }), { statusCode: 403 })
  f.service.tableExists = async table => table === 'sales_aftersales'
  await assert.rejects(f.submit(), { code: 'CHECKOUT_RETURN_NOT_READY' })
})

test('非法字段、数量、时间、资金方式和非列表SN拒绝；无法用客户端金额重算售后', async () => {
  const f = await fixture()
  for (const input of [{ quantity: true }, { quantity: 0 }, { quantity: '1.5' }, { reversal_date: '2026-02-30' },
    { serial_numbers: 'SN1' }, { total_amount: 10 }, { refund_amount: 20 }, { return_reason: '随便' }, { restock_confirmed: false },
    { settlement: settlement(-1) }, { settlement: { ...settlement(20), method: 'mobile' } },
    { settlement: { ...settlement(20), collection_amount: 1 } }, { settlement: { ...settlement(20), confirmed: 'true' } }]) {
    await assert.rejects(f.submit(input), { statusCode: 400 })
  }
  assert.equal(f.calls.length, 0)
})

test('原单销售不守恒、损坏分摊、历史分摊异常与库存剩余漂移均拒绝，保留所有原事实', async () => {
  for (const corrupt of ['sale', 'snapshot', 'history', 'remaining']) {
    const f = await fixture({ award: 6 })
    if (corrupt === 'sale') f.state.sales[0].total_price = 1
    if (corrupt === 'snapshot') f.state.item.snapshot.points_units[0].points_awarded = 1
    if (corrupt === 'history') f.state.returnItems.push({ original_item_id: 50, quantity: 1, fact_snapshot: '{bad' })
    if (corrupt === 'remaining') {
      const original = f.service.accessories.returnSaleStock.bind(f.service.accessories)
      f.service.accessories.returnSaleStock = async (...args) => ({ ...await original(...args), remaining_quantity: 0 })
    }
    await assert.rejects(f.submit(), { statusCode: 409 })
    assert.equal(f.state.stocks[2], 0)
  }
})

test('控制器在任何试算/提交前拒绝隐藏金额、数量、门店和SN，内部异常不暴露数据库信息', async () => {
  const res = () => ({ status(code) { this.code = code; return this }, json(data) { this.body = data; return this } })
  for (const field of ['basic_info.name', 'stock_info.distribution', 'stock_info.total_quantity', 'price_info.unit_price',
    'price_info.total_price', 'basic_info.serial_number', 'time_info.created_at']) {
    let calls = 0
    const controller = new Controller({ goodsReturns: { quote: async () => { calls++ }, submit: async () => { calls++ } },
      goodsAccess: { getPermissions: async () => ({ hiddenFields: [field] }) } })
    for (const method of ['quoteGoodsReturn', 'submitGoodsReturn']) {
      const response = res()
      await controller[method]({ user: actor, params: { orderId: 10, itemId: 50 }, body: body({ serial_numbers: ['SN1'] }) }, response)
      assert.equal(response.code, 403); assert.equal(calls, 0)
    }
  }
  const controller = new Controller({ goodsReturns: { submit: async () => { throw new Error('private database details') } },
    goodsAccess: { getPermissions: async () => ({ hiddenFields: [] }) }, logger: { error() {} } })
  const response = res()
  await controller.submitGoodsReturn({ user: actor, params: { orderId: 10, itemId: 50 }, body: body() }, response)
  assert.equal(response.code, 500); assert.equal(JSON.stringify(response.body).includes('private'), false)
})
