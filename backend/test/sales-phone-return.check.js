'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const inventoryFixture = require('./helpers/accessory-returns')
const Repository = require('../src/repositories/sales-aftersale.repository')
const PhoneReturns = require('../src/services/sales-phone-return.service')
const GoodsReturns = require('../src/services/sales-goods-return.service')
const Controller = require('../src/controllers/sales-aftersale.controller')
const { readAftersaleSettlement } = require('../src/utils/sales-aftersale-settlement')
const { planGoodsReturn } = require('../src/utils/checkout-goods-return')

const actor = { id: 7, store_ids: [1, 2] }, time = '2026-11-13 16:00:00'
const key = id => String(id).padStart(32, '0')
const payment = (refund, collection = 0) => ({ refund_amount: refund, collection_amount: collection,
  method: refund || collection ? 'cash' : null, confirmed: true })
const line = (id, quantity = 0, charge = false, serials = []) => ({ item_id: id, quantity, serial_numbers: serials,
  charge_missing: charge, charge_confirmed: charge })
const body = (changes = {}) => ({ request_key: key(1), store_id: 2, return_reason: '客户退货', reversal_date: time,
  restock_confirmed: true, remarks: '原单办理', accessories: [line(51), line(52, 0, true)], ...changes })

/** 运行真实售后仓储、积分来源账和批次/SN返库；内存连接串行化替身不冒充MySQL多连接锁验收。 */
async function fixture({ serial = false, agreement = 5, phoneAward = 0, redemption = 0, redemptionSource = 200, denied = [] } = {}) {
  const f = inventoryFixture({ events: [{ id: 1, accessory_id: 5, store_id: 1, stock_in_id: 1, purchase_cost: 2,
    usage_type: 'sale', serial_tracking: Number(serial), event_type: 'stock_in', quantity_delta: 6, sale_id: null }],
  serials: serial ? Array.from({ length: 6 }, (_, index) => ({ id: index + 1, accessory_id: 5, store_id: 1,
    stock_in_id: 1, purchase_cost: 2, serial_number: `SN${index + 1}`, status: 'in_stock' })) : [] })
  const goods = []
  for (const gift of [false, true]) {
    const id = gift ? 52 : 51, numbers = serial ? gift ? ['SN4', 'SN5', 'SN6'] : ['SN1', 'SN2', 'SN3'] : []
    await f.sell({ quantity: 3, customer_id: 9, unit_price: gift ? 0 : 20, sale_type: gift ? 'gift' : 'sale',
      remarks: '原单', serial_numbers: numbers }, { resolveTotalCents: async () => gift ? 0 : 6000 - redemption })
    goods.push({ item_id: id, order_id: 10, item_type: 'accessory', linked_phone_sale_id: 20, accessory_id: 5,
      accessory_sale_id: gift ? 2 : 1, quantity: 3, unit_price: gift ? 0 : 20, total_amount: gift ? 0 : 60 - redemption / 100,
      points_awarded: 0, snapshot: { name: gift ? '原赠品' : '原收费商品', sale_type: gift ? 'gift' : 'sale', serial_numbers: numbers,
        ...(gift ? { gift_return_unit_price: agreement } : {}), points_used: gift ? 0 : redemption,
        deduction_cents: gift ? 0 : redemption, gross_cents: gift ? 0 : 6000, points_per_yuan: redemption && !gift ? 100 : null,
        points_units: [{ quantity: 3, points_used: gift ? 0 : redemption / 3, deduction_cents: gift ? 0 : redemption / 3,
          payable_cents: gift ? 0 : 2000 - redemption / 3, points_awarded: 0 }] } })
  }
  Object.assign(f.state, { order: { id: 10, customer_id: 9, store_id: 1, order_no: 'ORIGINAL' }, goods,
    phoneItem: { item_id: 50, item_type: 'phone', sale_id: 20, phone_id: 30, order_id: 10,
      quantity: 1, unit_price: 100, total_amount: 100, points_awarded: phoneAward },
    phoneSale: { sale_id: 20, phone_id: 30, customer_id: 9, store_id: 1, sale_type: 'retail', sale_status: 'completed',
      sale_price: 100, points_awarded: phoneAward, points_accounted_at: time, operator_id: 4, current_sale_id: 20,
      phone_status: 'sold', phone_store_id: 1 }, returnHeaders: [], returnItems: [], commits: 0, rollbacks: 0 })
  await f.transaction(async db => {
    if (phoneAward && redemptionSource === 20) await f.pointsLedger.applyDelta(db, { customerId: 9, delta: phoneAward, sourceType: 'phone_sale', sourceId: 20 })
    if (redemption) {
      if (redemptionSource !== 20) await f.pointsLedger.applyDelta(db, { customerId: 9, delta: redemption, sourceType: 'phone_sale', sourceId: redemptionSource })
      await f.pointsLedger.consume(db, { customerId: 9, points: redemption, amountCents: redemption, pointsPerYuan: 100,
        itemId: 51, snapshot: await f.pointsLedger.snapshot(db, 9) })
    }
    if (phoneAward && redemptionSource !== 20) await f.pointsLedger.applyDelta(db, { customerId: 9, delta: phoneAward, sourceType: 'phone_sale', sourceId: 20 })
  })
  let failure = '', attempts = 0
  const original = f.connection.execute.bind(f.connection), calls = []
  f.connection.execute = async (sql, params) => {
    calls.push(sql)
    const s = f.state
    if (sql.includes('FROM sales_aftersales WHERE request_key')) return [structuredClone(s.returnHeaders.filter(row => row.request_key === params[0]))]
    if (sql.includes('FROM sales_orders')) { assert.match(sql, /FOR UPDATE/); return [[s.order].filter(row => row.id === params[0])] }
    if (sql.includes('FROM sales_order_items') && sql.includes('WHERE order_id = ? AND sale_id = ?')) return [[s.phoneItem].filter(row => row.order_id === params[0] && row.sale_id === params[1])]
    if (sql.includes('FROM sales s JOIN phones')) { assert.match(sql, /FOR UPDATE/); return [[s.phoneSale].filter(row => row.sale_id === params[0])] }
    if (sql.includes('WHERE linked_phone_sale_id')) return [s.goods.filter(row => row.linked_phone_sale_id === params[0])]
    if (sql.includes('FROM sales_order_items i JOIN accessory_sales')) {
      const row = s.goods.find(item => item.order_id === params[0] && item.item_id === params[1])
      if (!row) return [[]]
      const sale = s.sales.find(item => item.id === row.accessory_sale_id)
      return [[{ ...row, sale_accessory_id: sale.accessory_id, sale_customer_id: sale.customer_id, sale_store_id: sale.store_id,
        sale_quantity: sale.quantity, sale_unit_price: sale.unit_price, sale_total_price: sale.total_price, sale_type: sale.sale_type,
        sale_operator_id: sale.operator_id }]]
    }
    if (sql.includes('FROM sales_aftersale_items i')) return [s.returnItems.filter(row => row.original_item_id === params[0])]
    if (sql.includes('SELECT id FROM stores')) return [params[0] === 2 ? [{ id: 2 }] : []]
    if (sql.startsWith('UPDATE sales s')) {
      if (failure === 'cancel') throw new Error('cancel-failed')
      const valid = s.phoneSale.sale_status !== 'cancelled' && params[0] === s.phoneSale.sale_id && params[1] === s.phoneSale.phone_id
      if (valid) s.phoneSale.sale_status = 'cancelled'
      return [{ affectedRows: Number(valid) }]
    }
    if (sql.startsWith('UPDATE phones')) {
      if (failure === 'phone') throw new Error('phone-failed')
      const valid = s.phoneSale.phone_status === 'sold' && s.phoneSale.phone_store_id === params[2]
      if (valid) Object.assign(s.phoneSale, { phone_status: 'in_stock', phone_store_id: params[0], current_sale_id: null })
      return [{ affectedRows: Number(valid) }]
    }
    if (sql.includes('INSERT INTO sales_aftersales')) {
      if (failure === 'header') throw new Error('header-failed')
      if (failure === 'deadlock' && attempts++ === 0) throw Object.assign(new Error('deadlock'), { code: 'ER_LOCK_DEADLOCK' })
      const fields = ['request_key', 'request_hash', 'order_id', 'customer_id', 'original_store_id', 'store_id', 'created_by',
        'base_refund_cents', 'recovery_cents', 'compensation_cents', 'refund_cents', 'collection_cents', 'points_delta',
        'settlement_method', 'settlement_channel', 'business_time', 'remarks', 'result_snapshot', 'created_at', 'gift_charge_cents']
      const id = s.returnHeaders.length + 1, phone = sql.includes("'phone_return'")
      s.returnHeaders.push({ id, operation_type: phone ? 'phone_return' : 'goods_return', gift_charge_cents: 0,
        ...Object.fromEntries(fields.slice(0, params.length).map((name, index) => [name, params[index]])) })
      return [{ insertId: id }]
    }
    if (sql.includes('INSERT INTO sales_aftersale_items')) {
      if (failure === 'item' && params[1] === 52) throw new Error('item-failed')
      s.returnItems.push({ id: s.returnItems.length + 1, aftersale_id: params[0], original_item_id: params[1], quantity: params[2], fact_snapshot: params[3] })
      return [{ insertId: s.returnItems.length }]
    }
    return original(sql, params)
  }
  const repo = new Repository()
  repo.withConnection = operation => f.transaction(async db => {
    let before
    db.beginTransaction = async () => { before = structuredClone(f.state) }
    db.commit = async () => { before = null; f.state.commits++ }
    db.rollback = async () => { if (before) { Object.assign(f.state, before); before = null }; f.state.rollbacks++ }
    return operation(db)
  })
  const options = { repository: repo, accessories: f.service, pointsLedger: f.pointsLedger,
    permissionCheck: async (user, action) => !['query:goods-sell', 'query:goods-gift'].includes(action) && !denied.includes(action), tableExists: async () => true, columnExists: async () => true, now: () => time }
  const service = new PhoneReturns(options), goodsReturns = new GoodsReturns(options)
  return { ...f, service, goodsReturns, calls, fail(value) { failure = value },
    quote: (changes = {}, user = actor) => service.quote(10, 20, body(changes), user),
    submit: (changes = {}, user = actor) => service.submit(10, 20, body({ settlement: payment(85), ...changes }), user),
    returnGift: (id = 2, quantity = 1, serials = []) => goodsReturns.submit(10, 52, { request_key: key(id), store_id: 2, quantity,
      serial_numbers: serials, return_reason: '客户退货', reversal_date: time, remarks: '', restock_confirmed: true,
      settlement: payment(quantity * (agreement || 0)) }, actor) }
}

test('共同手机退货分别保留收费配件提成冲回与零件赠品扣款凭据，归属原配件销售员', async () => {
  const { createGoodsCommission } = require('../src/utils/goods-commission')
  const f = await fixture()
  for (const row of f.state.goods) {
    row.purchase_cost = 6
    row.snapshot.commission = createGoodsCommission({ employeeId: f.state.sales.find(sale => sale.id === row.accessory_sale_id).operator_id,
      salaryTemplateId: 4, quantity: 3, saleType: row.snapshot.sale_type, paidCents: row.total_amount * 100,
      purchaseCostCents: 600, rule: { enabled: true, type: 'fixed', fixed_amount: 2.5, percentage: 0 } })
  }
  const result = await f.submit({ accessories: [line(51, 1), line(52, 0, true)], settlement: payment(105) })
  assert.equal(result.refund_amount, 105)
  const paid = JSON.parse(f.state.returnItems.find(row => row.original_item_id === 51).fact_snapshot)
  const gift = JSON.parse(f.state.returnItems.find(row => row.original_item_id === 52).fact_snapshot)
  assert.equal(paid.commission_return.reversal_cents, 250)
  assert.equal(paid.commission_return.employee_id, f.state.sales[0].operator_id)
  assert.equal(gift.commission_return.quantity, 0)
  assert.equal(gift.commission_return.reversal_cents, 0)
  assert.equal(gift.gift_charge.amount_cents, 1500)
})

test('手机和赠品核对试算回滚全部变化；正式提交保留原销售、明细、原积分及采购事实', async () => {
  const f = await fixture({ phoneAward: 10 }), before = structuredClone(f.state)
  const result = await f.quote()
  assert.equal(result.refund_amount, 85); assert.equal(result.gift_charge_amount, 15); assert.equal(result.points_delta, -10)
  assert.deepEqual({ ...f.state, rollbacks: 0 }, before)
  const receipt = await f.submit()
  assert.equal(receipt.aftersale_id, 1); assert.equal(f.state.phoneSale.sale_status, 'cancelled')
  assert.equal(f.state.phoneSale.phone_status, 'in_stock'); assert.equal(f.state.phoneSale.phone_store_id, 2)
  assert.equal(f.state.stocks[2], 0); assert.equal(f.state.customers[9], 0)
  assert.deepEqual(f.state.sales, before.sales); assert.deepEqual(f.state.goods, before.goods)
  assert.equal(f.state.phoneSale.points_awarded, 10); assert.equal(f.state.phoneSale.operator_id, 4)
  const rows = f.state.returnItems.map(row => ({ ...row, item_order_id: 10, item_type: row.original_item_id === 50 ? 'phone' : 'accessory' }))
  const entries = readAftersaleSettlement(f.state.returnHeaders[0], rows)
  assert.equal(entries.length, 2); assert.equal(entries[1].row.quantity, 0)
  assert.equal(entries[1].settlement.gift_charge_cents, 1500)
  assert.equal(f.calls.some(sql => /DELETE|UPDATE payment_records|INSERT INTO payment_records/.test(sql)), false)
})

test('收费搭售可保留或一同部分退；赠品可部分返库并对剩余原约定扣款，后续只退原实际扣款', async () => {
  const f = await fixture()
  await f.submit({ accessories: [line(51, 2), line(52, 1, true)], settlement: payment(130) })
  assert.equal(f.state.stocks[2], 3)
  const gift = f.state.returnItems.find(row => row.original_item_id === 52), fact = JSON.parse(gift.fact_snapshot)
  assert.equal(gift.quantity, 1); assert.equal(fact.gift_charge.quantity, 2); assert.equal(fact.gift_charge.amount_cents, 1000)
  await f.returnGift(2)
  await f.returnGift(3)
  assert.equal(f.state.stocks[2], 5)
  assert.equal(f.state.returnHeaders.reduce((sum, row) => sum + row.refund_cents, 0), 14000)
  const last = JSON.parse(f.state.returnItems.at(-1).fact_snapshot)
  assert.equal(last.gift_refund_cents, 500); assert.equal(last.gift_charge_aftersale_id, 1)
  await assert.rejects(f.returnGift(4), /超过原单剩余/)
})

test('SN赠品按原件选择返库，未退SN保持赠送状态及原门店，后续按实际扣款逐件退款', async () => {
  const f = await fixture({ serial: true })
  await f.submit({ accessories: [line(51), line(52, 1, true, ['SN5'])], settlement: payment(90) })
  assert.equal(f.state.serials[4].status, 'in_stock'); assert.equal(f.state.serials[4].store_id, 2)
  assert.equal(f.state.serials[3].status, 'gifted'); assert.equal(f.state.serials[3].store_id, 1)
  await f.returnGift(2, 1, ['SN6'])
  assert.equal(f.state.serials[5].store_id, 2); assert.equal(f.state.returnHeaders[1].refund_cents, 500)
  await assert.rejects(f.returnGift(3, 1, ['SN5']), /已经退回/)
  await f.returnGift(3, 1, ['SN4'])
  assert.equal(f.state.stocks[2], 3)
})

test('没有约定禁止扣款，明确0元约定可确认；赠品全退不要求扣款权限', async () => {
  const missing = await fixture({ agreement: null })
  await assert.rejects(missing.submit(), /缺少原单约定/)
  const zero = await fixture({ agreement: 0 })
  await zero.submit({ settlement: payment(100) }); await zero.returnGift()
  assert.equal(zero.state.returnHeaders[1].refund_cents, 0)
  const full = await fixture({ denied: ['accessories:gift'] })
  await full.submit({ accessories: [line(51), line(52, 3)], settlement: payment(100) })
  assert.equal(full.state.stocks[2], 3)
})

test('奖励已消费按原优惠追回；退款不足显示客户补款，未确认、旧试算金额均回滚', async () => {
  const f = await fixture({ phoneAward: 300 })
  await f.transaction(async db => f.pointsLedger.consume(db, { customerId: 9, points: 300, amountCents: 30000,
    pointsPerYuan: 1, itemId: 99, snapshot: await f.pointsLedger.snapshot(db, 9) }))
  const quote = await f.quote()
  assert.equal(quote.refund_amount, 0); assert.equal(quote.collection_amount, 215)
  await assert.rejects(f.submit(), { code: 'CHECKOUT_RETURN_QUOTE_CHANGED' })
  await assert.rejects(f.submit({ settlement: { ...payment(0, 215), confirmed: false } }), { code: 'CHECKOUT_RETURN_PAYMENT_REQUIRED' })
  assert.equal(f.state.phoneSale.sale_status, 'completed'); assert.equal(f.state.returnHeaders.length, 0)
  await f.submit({ settlement: payment(0, 215) })
  assert.equal(f.state.returnHeaders[0].collection_cents, 21500)
})

test('手机和抵扣商品一起退，在同一客户锁中返原来源积分；返库与原分摊守恒', async () => {
  const f = await fixture({ phoneAward: 100, redemption: 300 })
  await f.submit({ accessories: [line(51, 3), line(52, 3)], settlement: payment(157) })
  assert.equal(f.state.customers[9], 300); assert.equal(f.state.stocks[2], 6)
  assert.equal(f.state.returnHeaders[0].points_delta, 200)
  assert.equal(f.state.returnItems.length, 3)
})

test('原手机来源已被待退商品消费时，先追回再补退抵扣金额，不复活已撤销奖励', async () => {
  // 售后重放已有来源关系，不改变销售端只能使用结算前积分的规则。
  const f = await fixture({ phoneAward: 300, redemption: 300, redemptionSource: 20 })
  const quote = await f.quote({ accessories: [line(51, 3), line(52, 3)] })
  assert.equal(quote.points_recovery_amount, 3)
  assert.equal(quote.points_compensation_amount, 3)
  assert.equal(quote.refund_amount, 157)
  await f.submit({ accessories: [line(51, 3), line(52, 3)], settlement: payment(157) })
  assert.equal(f.state.customers[9], 0)
  assert.equal(f.state.returnHeaders[0].points_delta, 0)
  assert.equal(f.state.stocks[2], 6)
})

test('同请求重试幂等；改变明细、门店、操作者均拒绝，换请求不能重复撤销；模拟竞争只成功一次', async () => {
  const f = await fixture(), receipt = await f.submit()
  assert.deepEqual(await f.submit(), receipt)
  for (const changes of [{ remarks: '变更' }, { accessories: [line(51, 1), line(52, 0, true)] }]) {
    await assert.rejects(f.submit(changes), { code: 'CHECKOUT_RETURN_REQUEST_CONFLICT' })
  }
  await assert.rejects(f.submit({}, { ...actor, id: 8 }), { code: 'CHECKOUT_RETURN_REQUEST_CONFLICT' })
  await assert.rejects(f.submit({ request_key: key(2) }), { statusCode: 409 })
  assert.equal(f.state.returnHeaders.length, 1)
  const next = await fixture()
  const results = await Promise.allSettled([1, 2].map(id => next.submit({ request_key: key(id) })))
  assert.equal(results.filter(row => row.status === 'fulfilled').length, 1)
})

test('手机撤销、返库、SN、积分、头和任一明细失败均回滚，死锁只整体重试', async () => {
  for (const failure of ['cancel', 'phone', 'header', 'item', 'inventory', 'stock', 'serial', 'serial_event']) {
    const f = await fixture({ phoneAward: 10, serial: true }), before = structuredClone(f.state)
    if (['inventory', 'stock', 'serial', 'serial_event'].includes(failure)) f.failAt(failure)
    else f.fail(failure)
    await assert.rejects(f.submit({ accessories: [line(51), line(52, 3, false, ['SN4', 'SN5', 'SN6'])], settlement: payment(100) }))
    assert.deepEqual({ ...f.state, rollbacks: 0 }, before)
  }
  const f = await fixture({ phoneAward: 10 }); f.fail('deadlock')
  await f.submit()
  assert.equal(f.state.returnHeaders.length, 1); assert.equal(f.state.customers[9], 0)
})

test('原销售错位、过期、未完成、金额/积分异常、漏核对商品、损坏历史、越权或缺迁移不放行', async () => {
  for (const change of [{ current_sale_id: 19 }, { sale_status: 'pending' }, { phone_status: 'in_stock' },
    { customer_id: 8 }, { sale_price: 99 }, { points_awarded: 1 }, { points_accounted_at: null }]) {
    const f = await fixture(); Object.assign(f.state.phoneSale, change)
    await assert.rejects(f.submit(), { statusCode: 409 })
    assert.equal(f.state.returnHeaders.length, 0)
  }
  for (const permission of ['query:view', 'query:return-to-stock', 'query:goods-view', 'accessories:gift']) {
    const f = await fixture({ denied: [permission] }); await assert.rejects(f.submit(), { statusCode: 403 })
  }
  const f = await fixture()
  await assert.rejects(f.submit({ accessories: [line(52, 0, true)] }), /未逐条核对/)
  await assert.rejects(f.submit({}, { id: 7, store_ids: [2] }), { statusCode: 403 })
  await assert.rejects(f.submit({}, { id: 7, store_ids: [1] }), { statusCode: 403 })
  f.service.columnExists = async () => false
  await assert.rejects(f.submit(), { code: 'CHECKOUT_RETURN_NOT_READY' })
})

test('客户端不得指定退款基数、原价、积分或伪造动作；数值/重复明细/赠品未确认一律拒绝', async () => {
  const f = await fixture()
  for (const changes of [{ quantity: 1 }, { serial_numbers: [] }, { gift_charge_amount: 0 },
    { accessories: [line(51), line(52), line(52)] }, { accessories: [line(51), { ...line(52, 0, true), charge_confirmed: false }] },
    { accessories: [line(51, true), line(52, 0, true)] }, { accessories: [line(51), { ...line(52, 0, true), unit_price: 0 }] }]) {
    await assert.rejects(f.submit(changes))
    assert.equal(f.state.returnHeaders.length, 0); assert.equal(f.state.phoneSale.sale_status, 'completed')
  }
})

test('赠品扣款凭据篡改、重复扣款或后续退款未关联原实际扣款拒绝，不当作已退实物', async () => {
  const f = await fixture(); await f.submit()
  const history = f.state.returnItems.filter(row => row.original_item_id === 52)
  assert.equal(planGoodsReturn(f.state.goods[1], history, 0, []).remaining_quantity, 3)
  for (const change of [fact => { fact.gift_charge.amount_cents++ }, fact => { fact.gift_charge.quantity-- },
    fact => { fact.gift_charge.unit_cents = 0 }, fact => { fact.kind = 'return' }]) {
    const damaged = structuredClone(history), fact = JSON.parse(damaged[0].fact_snapshot)
    change(fact); damaged[0].fact_snapshot = fact
    assert.throws(() => planGoodsReturn(f.state.goods[1], damaged, 1, []), { statusCode: 409 })
  }
  assert.throws(() => planGoodsReturn(f.state.goods[1], [...history, ...history], 1, []), { statusCode: 409 })
  await f.returnGift()
  const last = f.state.returnItems.at(-1), fact = JSON.parse(last.fact_snapshot)
  delete fact.gift_charge_aftersale_id; last.fact_snapshot = JSON.stringify(fact)
  await assert.rejects(f.returnGift(3), { statusCode: 409 })
})

test('共同手机售后控制器先核验手机及商品必要字段权限，内部错误不回显SQL；路由独立要求退货动作', async () => {
  const response = () => ({ status(code) { this.code = code; return this }, json(value) { this.body = value; return this } })
  for (const [domain, fields] of [['phone', ['basic_info.sale_price', 'store_info.store_name', 'time_info.sale_time', 'other_info.remarks']],
    ['goods', ['basic_info.name', 'basic_info.usage_type', 'basic_info.serial_number', 'stock_info.distribution',
      'stock_info.total_quantity', 'price_info.unit_price', 'price_info.total_price', 'time_info.created_at', 'other_info.remarks']]]) {
    for (const field of fields) {
      let calls = 0
      const controller = new Controller({ phoneReturns: { quote: async () => { calls++ }, submit: async () => { calls++ } },
        phoneAccess: { getPermissions: async () => ({ hiddenFields: domain === 'phone' ? [field] : [] }) },
        goodsAccess: { getPermissions: async () => ({ hiddenFields: domain === 'goods' ? [field] : [] }) } })
      for (const method of ['quotePhoneReturn', 'submitPhoneReturn']) {
        const res = response()
        await controller[method]({ user: actor, params: { orderId: 10, saleId: 20 }, body: body() }, res)
        assert.equal(res.code, 403); assert.equal(calls, 0)
      }
    }
  }
  const controller = new Controller({ phoneReturns: { submit: async () => { throw new Error('private SQL') } },
    phoneAccess: { getPermissions: async () => ({ hiddenFields: [] }) }, goodsAccess: { getPermissions: async () => ({ hiddenFields: [] }) }, logger: { error() {} } })
  const res = response()
  await controller.submitPhoneReturn({ user: actor, params: { orderId: 10, saleId: 20 }, body: body() }, res)
  assert.equal(res.code, 500); assert.equal(JSON.stringify(res.body).includes('SQL'), false)
  const fs = require('node:fs'), path = require('node:path'), route = fs.readFileSync(path.join(__dirname, '../src/routes/sales.js'), 'utf8')
  for (const suffix of ['/quote', '']) {
    const declaration = route.split('\n').find(row => row.includes(`'/checkout/:orderId/phones/:saleId/return${suffix}'`))
    assert.match(declaration, /unifiedAuth, requirePermission\('query:view'\), requirePermission\('query:return-to-stock'\)/)
  }
})


test('联合手机退货共用旧退库处理意向选项，保存事实并按退库返还库存；变更意向不能复用已成交请求', async () => {
  const options = require('../src/config/return-stock-options.json')
  for (const return_type of options.return_type) for (const handle_method of options.handle_method) {
    const f = await fixture()
    const result = await f.submit({ return_type, handle_method })
    const fact = JSON.parse(f.state.returnItems.find(row => row.original_item_id === 50).fact_snapshot)
    assert.equal(fact.return_type, return_type)
    assert.equal(fact.handle_method, handle_method)
    assert.equal(f.state.phoneSale.phone_status, 'in_stock')
    assert.equal(f.state.phoneSale.phone_store_id, 2)
    assert.equal(f.state.phoneSale.sale_status, 'cancelled')
    assert.deepEqual(await f.submit({ return_type, handle_method }), result)
    await assert.rejects(f.submit({ return_type: return_type === '退货处理' ? '申请换货' : '退货处理', handle_method }), { code: 'CHECKOUT_RETURN_REQUEST_CONFLICT' })
    assert.equal(f.state.returnHeaders.length, 1)
  }
})

test('未知、空值及对象形式的处理意向在售后事务之前拒绝；旧请求不新增字段影响幂等摘要', async () => {
  const f = await fixture()
  for (const field of ['return_type', 'handle_method']) for (const value of ['', null, {}, '无效选项']) {
    await assert.rejects(f.quote({ [field]: value }), { code: 'CHECKOUT_RETURN_INVALID', statusCode: 400 })
  }
  assert.equal(f.state.returnHeaders.length, 0)
  assert.equal(f.state.commits, 0)
  const input = f.service.normalize(10, 20, body(), actor, true)
  assert.equal(Object.hasOwn(input, 'return_type'), false)
  assert.equal(Object.hasOwn(input, 'handle_method'), false)
})
