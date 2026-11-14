'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const AccessoryRepository = require('../src/repositories/accessory.repository')

const actor = { id: 7, name: '销售员', store_ids: [1, 2] }
const time = '2026-11-13 16:00:00'
const incoming = (id, cost, qty, tracking = 0, usage = 'sale') => ({ id, accessory_id: 5, store_id: 1,
  stock_in_id: id, purchase_cost: cost, usage_type: usage, serial_tracking: tracking,
  event_type: 'stock_in', quantity_delta: qty, sale_id: null })

const fixture = require('./helpers/accessory-returns')

test('实际出库后分次返库按原FIFO批次/成本，销售事实不删除；新店返库不增加采购记录', async () => {
  const f = fixture()
  await f.sell()
  const original = structuredClone(f.state.sales)
  const first = await f.returnStock({ quantity: 3, store_id: 2 })
  assert.equal(first.purchase_cost, 40)
  assert.equal(first.remaining_quantity, 1)
  assert.equal(f.state.stocks[2], 3)
  assert.deepEqual(f.state.events.filter(row => row.event_type === 'sale_return').map(row =>
    [row.source_event_id, row.stock_in_id, row.quantity_delta, row.purchase_cost, row.store_id]), [[3, 1, 2, 10, 2], [4, 2, 1, 20, 2]])
  await f.returnStock({ request_key: 'return:stock:2' })
  assert.deepEqual(f.state.sales, original)
  assert.deepEqual(f.state.stocks, { 1: 1, 2: 3 })
  assert.equal(f.state.events.filter(row => row.event_type === 'stock_in').length, 2)
  await assert.rejects(f.returnStock({ request_key: 'return:stock:3' }), /超过原单剩余/)
  assert.equal((await f.sell({ store_id: 2, quantity: 3 })).purchase_cost, 40)
})

test('原收费库存赠送后退回仍为收费用途，未知历史成本保持null，停用模板仍可退原单', async () => {
  const f = fixture({ events: [incoming(1, null, 2, 0, 'unclassified')] })
  await f.sell({ quantity: 2, unit_price: 0, sale_type: 'gift', remarks: '促销' })
  f.state.product.status = 0
  const returned = await f.returnStock()
  assert.equal(returned.purchase_cost, null)
  const event = f.state.events.at(-1)
  assert.equal(event.event_type, 'gift_return')
  assert.equal(event.usage_type, 'unclassified')
  assert.equal(event.purchase_cost, null)
  assert.equal(f.state.stocks[1], 1)
})

test('SN按原销售和采购逐件返库，可换授权店铺；相同实物再次出库后不可退旧销售', async () => {
  const serials = [1, 2].map(id => ({ id, accessory_id: 5, store_id: 1, stock_in_id: id,
    purchase_cost: id * 10, status: 'in_stock', serial_number: `SN${id}` }))
  const f = fixture({ events: [incoming(1, 10, 1, 1), incoming(2, 20, 1, 1)], serials })
  await f.sell({ quantity: 2, serial_numbers: ['SN1', 'SN2'] })
  await assert.rejects(f.returnStock(), /SN出库须指定/)
  const returned = await f.returnStock({ store_id: 2, serial_numbers: ['SN2'] })
  assert.equal(returned.purchase_cost, 20)
  assert.equal(f.state.serials[1].store_id, 2)
  assert.equal(f.state.serials[1].status, 'in_stock')
  assert.equal(f.state.serials[1].sale_id, null)
  assert.equal(f.state.serialEvents.at(-1).sale_id, 1)
  await assert.rejects(f.returnStock({ request_key: 'return:duplicate:sn', serial_numbers: ['SN2'] }), { code: 'SERIAL_UNAVAILABLE' })
  await f.sell({ store_id: 2, quantity: 1, serial_numbers: ['SN2'] })
  await assert.rejects(f.returnStock({ request_key: 'return:old:sale', serial_numbers: ['SN2'] }), { code: 'SERIAL_UNAVAILABLE' })
  assert.equal((await f.returnStock({ sale_id: 2, store_id: 2, request_key: 'return:new:sale', serial_numbers: ['SN2'] })).purchase_cost, 20)
})

test('返库请求相同键重试不重加库，后续退货不改变原回执；换数量/门店/实物拒绝', async () => {
  const f = fixture()
  await f.sell()
  const first = await f.returnStock()
  await f.returnStock({ request_key: 'return:stock:2' })
  const before = structuredClone(f.state)
  const replay = await f.returnStock()
  assert.deepEqual({ ...replay, replayed: false }, first)
  assert.deepEqual(f.state, before)
  for (const input of [{ quantity: 2 }, { store_id: 2 }, { serial_numbers: ['OTHER'] }]) await assert.rejects(f.returnStock(input), { code: 'ACCESSORY_RETURN_REQUEST_CONFLICT' })
})

for (const stage of ['stock', 'inventory', 'outer', 'serial', 'serial_event']) test(`${stage}失败返库、SN、事件与外层退款同时回滚，原键可重试`, async () => {
  const f = fixture({ events: [incoming(1, 10, 1, 1)], serials: [{ id: 1, accessory_id: 5, store_id: 1, stock_in_id: 1,
    purchase_cost: 10, status: 'in_stock', serial_number: 'SN1' }] })
  await f.sell({ quantity: 1, serial_numbers: ['SN1'] })
  const before = structuredClone(f.state)
  f.failAt(stage)
  await assert.rejects(f.returnStock({ serial_numbers: ['SN1'] }))
  assert.deepEqual(f.state, before)
  f.failAt('')
  await f.returnStock({ serial_numbers: ['SN1'] })
  assert.equal(f.state.stocks[1], 1)
  assert.equal(f.state.events.filter(row => row.event_type === 'sale_return').length, 1)
})

test('原流水缺失/超额/成本损坏/汇总漂移拒绝，不能按当前进价重造批次', async () => {
  for (const damage of [
    f => { f.state.events = f.state.events.filter(row => row.event_type !== 'sale') },
    f => { f.state.events.find(row => row.event_type === 'sale').quantity_delta = -10 },
    f => { f.state.events.find(row => row.event_type === 'sale').purchase_cost = 'invalid' },
    f => { f.state.stocks[1] = 1 }
  ]) {
    const f = fixture()
    await f.sell()
    damage(f)
    const before = structuredClone(f.state)
    await assert.rejects(f.returnStock(), { statusCode: 409 })
    assert.deepEqual(f.state, before)
  }
})

test('未迁移、未授权店铺、停用接收店与非法数量均拒绝；并发模拟不能超额返库', async () => {
  const absent = fixture({ installed: false })
  await absent.sell()
  await assert.rejects(absent.returnStock(), { code: 'ACCESSORY_RETURN_NOT_READY' })
  const f = fixture()
  await f.sell()
  await assert.rejects(f.returnStock({ store_id: 2 }, { id: 8, store_ids: [1] }), { statusCode: 403 })
  f.state.storeActive = 0
  await assert.rejects(f.returnStock(), { code: 'INVALID_REFERENCE' })
  f.state.storeActive = 1
  for (const quantity of [0, -1, 1.2, true, 1000000]) await assert.rejects(f.returnStock({ quantity }), { statusCode: 400 })
  const results = await Promise.allSettled(['return:parallel:1', 'return:parallel:2'].map(request_key => f.returnStock({ quantity: 4, request_key })))
  assert.equal(results.filter(row => row.status === 'fulfilled').length, 1)
  assert.equal(f.state.stocks[1], 4)
})

test('实际仓储返库使用参数及CAS，不伪造采购总入库，不删除销售与历史SN事件', async () => {
  const repo = new AccessoryRepository(), calls = []
  const db = { async query(sql, params) { calls.push({ sql, params }); return [{ affectedRows: 1 }] },
    async execute(sql, params) { calls.push({ sql, params }); return [[]] } }
  await repo.returnSerial(2, 11, 3, time, db)
  await repo.restoreSaleStock(5, 3, 2, 5, db)
  await repo.saleForReturn(11, db, true)
  assert.match(calls[0].sql, /sale_id = \? AND status IN/)
  assert.deepEqual(calls[0].params, [3, time, 2, 11])
  assert.match(calls[1].sql, /VALUES \(\?, \?, \?, 0, 0, \?\)/)
  assert.doesNotMatch(calls[1].sql, /total_in =|total_out =/)
  assert.match(calls[2].sql, /FOR UPDATE/)
})

test('积分优惠追回/返分与真实批次返库共用同一连接，外层退款失败时一起回滚', async () => {
  const f = fixture()
  await f.sell()
  await f.transaction(async db => {
    await f.pointsLedger.applyDelta(db, { customerId: 9, delta: 3, sourceType: 'phone_sale', sourceId: 10 })
    await f.pointsLedger.consume(db, { customerId: 9, points: 3, amountCents: 100, pointsPerYuan: 3, itemId: 51,
      snapshot: await f.pointsLedger.snapshot(db, 9) })
  })
  const before = structuredClone(f.state)
  const process = async (db, fail) => {
    const recovered = await f.pointsLedger.returnAward(db, { customerId: 9, sourceType: 'phone_sale', sourceId: 10, points: 3, requestKey: 'phone:return:10' })
    const returned = await f.pointsLedger.returnRedemption(db, { customerId: 9, itemId: 51, points: 3, requestKey: 'item:return:51' })
    const stock = await f.service.returnSaleStock({ sale_id: 1, store_id: 1, quantity: 4, request_key: 'stock:return:51' }, actor, db, { time })
    if (fail) throw new Error('refund-document-failed')
    return { recovered, returned, stock }
  }
  await assert.rejects(f.transaction(db => process(db, true)), /refund-document-failed/)
  assert.deepEqual(f.state, before)
  const result = await f.transaction(db => process(db, false))
  assert.equal(result.recovered.recovery_cents, 100)
  assert.equal(result.returned.compensation_cents, 100)
  assert.equal(result.returned.points_delta, 0)
  assert.equal(result.stock.purchase_cost, 60)
  assert.equal(f.state.customers[9], 0)
  assert.equal(f.state.stocks[1], 4)
  assert.equal(f.state.aftersales.length, 2)
})
