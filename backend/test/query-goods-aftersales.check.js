'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const Service = require('../src/services/query-goods.service')
const Controller = require('../src/controllers/query-goods.controller')
const Repository = require('../src/repositories/query-goods.repository')
const { withReadConnection } = require('./helpers/query-goods-read')
const { buildPagination } = require('../src/utils/reference-options')
const { allocateAftersaleSettlement } = require('../src/utils/sales-aftersale-settlement')

const actor = { id: 7, store_ids: [1, 2] }
const history = () => ({ id: '31', order_id: 71, operation_type: 'goods_return', aftersale_item_id: 41, original_item_id: 61,
  settlement_items: [{ id: 41, aftersale_id: 31, original_item_id: 61, item_order_id: 71, item_type: 'accessory', quantity: '1', fact_snapshot: JSON.stringify({ serial_numbers: ['SN-ORIGINAL'],
    return_reason: '质量问题', points_awarded: 5, points_used: 0, payable_cents: 1000, restock_confirmed: true,
    inventory_event_ids: [91], point_entry_ids: [92], unit_ranges: [[0, 1]] }) }],
  base_refund_cents: '1000', recovery_cents: '30', compensation_cents: '0', refund_cents: '970', collection_cents: '0', points_delta: '-2',
  store_id: 2, store_name: '接收店', operator_id: 7, operator_name: '办理员', settlement_method: 'cash', settlement_channel: null,
  business_time: '2026-11-13 10:00:00', created_at: '2026-11-13 10:01:00', remarks: '原单售后备注',
  request_hash: 'internal-hash', result_snapshot: { internal: true } })
const fixture = (row = history()) => {
  const calls = []
  const repository = { withConnection: withReadConnection, async aftersales(scope, id, query) {
    calls.push({ scope, id, query })
    return id === 51 ? { data: [row], pagination: buildPagination(query.page, query.page_size, 125) } : null
  } }
  return { calls, service: new Service({ repository, permissionCheck: async () => true }) }
}
const response = () => ({ status(code) { this.code = code; return this }, json(body) { this.body = body; return this } })

test('只读售后查询使用销售ID、原账户门店范围和分页，金额从整数分凭据读取', async () => {
  const f = fixture(), result = await f.service.aftersales(actor, '51', { page: '7', page_size: '20' })
  assert.deepEqual(f.calls, [{ scope: { allStores: false, requestedStoreId: null, storeIds: [1, 2] }, id: 51, query: { page: 7, page_size: 20 } }])
  assert.equal(result.pagination.total, 125)
  assert.equal(result.data[0].refund_amount, 9.7)
  assert.equal(result.data[0].points_recovery_amount, 0.3)
  assert.equal(result.data[0].points_delta, -2)
  assert.equal(result.data[0].settlement_offset_amount, 0)
  assert.deepEqual(result.data[0].serial_numbers, ['SN-ORIGINAL'])
  for (const key of ['fact_snapshot', 'request_hash', 'request_key', 'result_snapshot', 'inventory_event_ids', 'point_entry_ids', 'unit_ranges', 'settlement_items', 'order_id', 'aftersale_item_id']) {
    assert.equal(JSON.stringify(result).includes(key), false)
  }
})

test('查看历史不要求退货动作权限，但双模块查看权限和登录仍不可缺少', async () => {
  const calls = [], f = fixture()
  f.service.permissionCheck = async (_actor, permission) => { calls.push(permission); return permission !== 'query:return-to-stock' }
  await f.service.aftersales(actor, 51)
  assert.deepEqual(calls, ['query:view', 'query:goods-view'])
  for (const denied of ['query:view', 'query:goods-view']) {
    const service = new Service({ repository: { aftersales() { assert.fail('不得读库') } }, permissionCheck: async (_user, permission) => permission !== denied })
    await assert.rejects(service.aftersales(actor, 51), { statusCode: 403 })
  }
  await assert.rejects(f.service.aftersales({}, 51), { statusCode: 401 })
})

test('售后端点拒绝模糊ID、非法分页和额外探测条件；越权与不存在统一404', async () => {
  const f = fixture()
  for (const input of [{ page: '1x' }, { page_size: 101 }, { page: false }, { page_size: ['20'] }, { store_id: 3 }, { keyword: 'SN' }]) {
    await assert.rejects(f.service.aftersales(actor, 51, input), { statusCode: 400 })
  }
  await assert.rejects(f.service.aftersales(actor, '51 OR 1=1'), { statusCode: 400 })
  assert.equal(f.calls.length, 0)
  await assert.rejects(f.service.aftersales(actor, 52), { statusCode: 404, code: 'NOT_FOUND' })
})

test('缺表及部分字段未迁移明确返回未就绪，网络和SQL异常不伪装成空历史', async () => {
  for (const code of ['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR', 'ECONNRESET']) {
    const f = fixture()
    f.service.repository.aftersales = async () => { throw Object.assign(new Error('private database detail'), { code }) }
    if (code === 'ECONNRESET') await assert.rejects(f.service.aftersales(actor, 51), { code })
    else await assert.rejects(f.service.aftersales(actor, 51), { statusCode: 409, code: 'CHECKOUT_RETURN_NOT_READY' })
  }
})

test('损坏快照、重复SN、非整数及资金不守恒均拒绝展示为正常凭据', async () => {
  const item = changes => ({ settlement_items: [{ ...history().settlement_items[0], ...changes }] })
  const changes = [item({ fact_snapshot: '{broken' }), { refund_cents: '999' }, { collection_cents: 1 }, { points_delta: '1.5' },
    item({ quantity: 2 }), { id: '9007199254740993' }, item({ fact_snapshot: { serial_numbers: ['A', 'A'], return_reason: '退货' } }),
    { settlement_method: null }, item({ fact_snapshot: { serial_numbers: [], return_reason: '退货', payable_cents: 1 } }),
    { settlement_items: [] }, { aftersale_item_id: 42 }, { original_item_id: 62 }]
  for (const change of changes) await assert.rejects(fixture({ ...history(), ...change }).service.aftersales(actor, 51), { statusCode: 409, code: 'CHECKOUT_RETURN_CONFLICT' })
})

test('用途、数量、单价和金额任一隐藏时，售后资金/积分/支付方式渠道全部后端遮蔽', async () => {
  for (const hidden of ['basic_info.usage_type', 'stock_info.total_quantity', 'price_info.unit_price', 'price_info.total_price']) {
    const f = fixture(), res = response()
    const controller = new Controller({ service: f.service, masking: { async getUserFieldPermissions() { return { hiddenFields: [hidden] } }, filterSensitiveFields(rows) { return rows } } })
    await controller.aftersales({ user: actor, params: { id: 51 }, query: {} }, res)
    const row = res.body.data.data[0]
    for (const key of ['base_refund_amount', 'points_recovery_amount', 'points_compensation_amount', 'refund_amount', 'collection_amount', 'settlement_offset_amount',
      'gift_charge_amount', 'replacement_amount', 'exchange_credit_amount', 'points_delta', 'points_award_returned', 'points_redemption_returned', 'settlement_method', 'settlement_channel']) assert.equal(row[key], null)
    assert.equal(row.quantity, ['stock_info.total_quantity', 'basic_info.usage_type'].includes(hidden) ? null : 1)
  }
})

test('门店、办理人、SN、两个时间、原因与备注均复用原字段权限；异常脱敏', async () => {
  const f = fixture(), res = response()
  const masking = { async getUserFieldPermissions() { return { hiddenFields: ['stock_info.distribution', 'operator_info.operator_name', 'basic_info.serial_number', 'time_info.created_at', 'other_info.remarks'] } }, filterSensitiveFields(rows) { return rows } }
  await new Controller({ service: f.service, masking }).aftersales({ user: actor, params: { id: 51 }, query: {} }, res)
  for (const key of ['store_id', 'store_name', 'operator_id', 'operator_name', 'serial_numbers', 'business_time', 'created_at', 'return_reason', 'remarks']) assert.equal(res.body.data.data[0][key], null)
  f.service.repository.aftersales = async () => { throw new Error('private database detail') }
  const failure = response()
  await new Controller({ service: f.service, masking, logger: { error() {} } }).aftersales({ user: actor, params: { id: 51 }, query: {}, requestId: 'req-history' }, failure)
  assert.equal(failure.code, 500)
  assert.equal(failure.body.request_id, 'req-history')
  assert.equal(JSON.stringify(failure.body).includes('private database detail'), false)
})

test('仓储授权原单后按双门店范围同条件COUNT和分页，稳定排序且只执行SELECT', async () => {
  const statements = [], repository = new Repository()
  repository.withConnection = async fn => fn({ async query(sql, params) {
    statements.push({ sql, params })
    assert.match(sql, /^SELECT /)
    if (sql.includes('FROM accessory_sales')) return [[{ id: 51, item_id: 61, order_id: 71, store_id: 1 }]]
    if (sql.includes('WHERE ai.aftersale_id IN')) return [history().settlement_items]
    return [sql.startsWith('SELECT COUNT') ? [{ total: 125 }] : [history()]]
  } })
  const result = await repository.aftersales({ storeIds: [1, 2] }, 51, { page: 7, page_size: 20 })
  assert.deepEqual(statements[0].params, [51, 1, 2])
  assert.deepEqual(statements[1].params, [61, 71, 1, 71, 1, 2, 1, 2])
  assert.deepEqual(statements[2].params, [...statements[1].params, 20, 120])
  for (const sql of statements.slice(1, 3).map(item => item.sql)) {
    assert.match(sql, /a.original_store_id IN \(\?, \?\)/)
    assert.match(sql, /a.store_id IN \(\?, \?\)/)
  }
  assert.match(statements[2].sql, /ORDER BY a.id DESC, ai.id DESC LIMIT \? OFFSET \?/)
  assert.match(statements[2].sql, /SELECT a\.\*/)
  assert.match(statements[2].sql, /'goods_exchange'/)
  assert.equal(statements.length, 4)
  assert.deepEqual(statements[3].params, ['31'])
  assert.match(statements[3].sql, /LEFT JOIN sales_order_items oi ON oi.id = ai.original_item_id/)
  assert.deepEqual(result.data[0].settlement_items, history().settlement_items)
  assert.equal(result.pagination.total, 125)
})

const exchangeFixture = () => {
  const row = history(), allocation = allocateAftersaleSettlement([{ original_item_id: 61,
    base_refund_cents: 2000, recovery_cents: 0, compensation_cents: 0, gift_charge_cents: 0, replacement_cents: 5000, points_delta: 0 }], { version: 3 })
  Object.assign(row, allocation.totals, { operation_type: 'goods_exchange', original_store_id: 1, customer_id: 9 })
  row.settlement_items[0].fact_snapshot = { kind: 'return', payable_cents: 2000, serial_numbers: ['SN-ORIGINAL'],
    points_awarded: 0, points_used: 0, return_reason: '客户退货', restock_confirmed: true, settlement: allocation.items[0].settlement,
    exchange: { replacement_order_id: 72, replacement_item_id: 62, root_order_id: 71, root_item_id: 61, replacement_cents: 5000, quantity: 1 } }
  const link = { aftersale_id: 31, original_item_id: 61, order_id: 71, replacement_order_id: 72, quantity: 1, exchange_credit_cents: 2000 }
  const loaded = { order: { id: 72, order_no: 'NEW-ORDER', customer_id: 9, store_id: 2 }, row: { sale_no: 'NEW-SALE', sale_operator_name: '新销售员' },
    plan: { item: { name: '新充电器', serial_numbers: ['NEW-SN'] } }, lineage: { root_order_id: 71, root_item_id: 61 } }
  const original = { id: 71, store_id: 1, customer_id: 9 }, calls = []
  const goodsReturns = { async load(connection, input, user, options) { calls.push({ connection, input, user, options }); return loaded },
    repository: { async exchangeForItem(_connection, id, options) { assert.equal(id, 62); assert.equal(options.lock, false); return link },
      async order(_connection, id, options) { assert.equal(id, 71); assert.equal(options.lock, false); return original } } }
  const repository = { withConnection: withReadConnection, async aftersales(_scope, _id, query, verify, connection) {
    await verify(connection, [row]); return { data: [row], pagination: buildPagination(query.page, query.page_size, 1) }
  } }
  return { row, loaded, link, original, calls, goodsReturns, service: new Service({ repository, goodsReturns, permissionCheck: async () => true }) }
}

test('20元换50元历史由真实关联核验新单，展示20抵付与30补款且无全额现金收款', async () => {
  const f = exchangeFixture(), result = (await f.service.aftersales(actor, 51)).data[0]
  assert.equal(result.operation_type, 'goods_exchange')
  assert.equal(result.base_refund_amount, 20); assert.equal(result.replacement_amount, 50)
  assert.equal(result.exchange_credit_amount, 20); assert.equal(result.collection_amount, 30)
  assert.equal(result.refund_amount, 0)
  assert.deepEqual(result.replacement, { name: '新充电器', sale_no: 'NEW-SALE', order_no: 'NEW-ORDER', operator_name: '新销售员', serial_numbers: ['NEW-SN'] })
  assert.deepEqual(f.calls[0].input, { order_id: 72, item_id: 62, quantity: 0, serial_numbers: [] })
  assert.deepEqual(f.calls[0].options, { lock: false })
  for (const key of ['request_hash', 'settlement_items', 'fact_snapshot', 'replacement_item_id', 'exchange_credit_cents']) assert.equal(JSON.stringify(result).includes(key), false)
})

test('换货头、真实替换关系、客户门店及根原单不一致拒绝，缺新件不当作无历史', async () => {
  for (const mutate of [f => { f.link.aftersale_id++ }, f => { f.link.exchange_credit_cents++ }, f => { f.link.original_item_id++ },
    f => { f.original.customer_id++ }, f => { f.original.store_id++ }, f => { f.loaded.order.store_id = 1 },
    f => { f.loaded.lineage.root_item_id++ }, f => { f.loaded.row.sale_no = '' },
    f => { f.goodsReturns.load = async () => { throw Object.assign(new Error('missing'), { statusCode: 404 }) } }]) {
    const f = exchangeFixture(); mutate(f)
    await assert.rejects(f.service.aftersales(actor, 51), { statusCode: 409, code: 'CHECKOUT_RETURN_CONFLICT' })
  }
  const f = exchangeFixture(); f.goodsReturns.load = async () => { throw Object.assign(new Error('offline'), { code: 'ECONNRESET' }) }
  await assert.rejects(f.service.aftersales(actor, 51), { code: 'ECONNRESET' })
})

test('换货嵌套单号、商品、SN和销售员沿用字段遮蔽，资金整体隐藏不反推抵付', async () => {
  for (const [field, keys] of [['basic_info.sequence', ['order_no', 'sale_no']], ['basic_info.name', ['name']],
    ['basic_info.serial_number', ['serial_numbers']], ['operator_info.operator_name', ['operator_name']]]) {
    const f = exchangeFixture(), res = response()
    await new Controller({ service: f.service, masking: { async getUserFieldPermissions() { return { hiddenFields: [field] } },
      filterSensitiveFields(rows) { return rows } } }).aftersales({ user: actor, params: { id: 51 }, query: {} }, res)
    for (const key of keys) assert.equal(res.body.data.data[0].replacement[key], null)
  }
  for (const field of ['basic_info.usage_type', 'stock_info.total_quantity', 'price_info.unit_price', 'price_info.total_price']) {
    const f = exchangeFixture(), res = response()
    await new Controller({ service: f.service, masking: { async getUserFieldPermissions() { return { hiddenFields: [field] } },
      filterSensitiveFields(rows) { return rows } } }).aftersales({ user: actor, params: { id: 51 }, query: {} }, res)
    for (const key of ['replacement_amount', 'exchange_credit_amount', 'refund_amount', 'collection_amount']) assert.equal(res.body.data.data[0][key], null)
  }
})

test('无原销售授权或旧单无共同明细时不查询售后表，不暴露升级状态', async () => {
  for (const original of [[], [{ id: 51, item_id: null }]]) {
    let count = 0
    const repository = new Repository()
    repository.withConnection = async fn => fn({ async query() { count++; return [original] } })
    const result = await repository.aftersales({ storeIds: [] }, 51, { page: 1, page_size: 20 })
    assert.equal(count, 1)
    assert.deepEqual(result, original.length ? { data: [], pagination: buildPagination(1, 20, 0) } : null)
  }
})

test('同一售后多商品只公开所查商品的资金归属和积分，不透传同笔其他明细', async () => {
  const row = history(), allocation = allocateAftersaleSettlement([
    { original_item_id: 61, base_refund_cents: 1000, recovery_cents: 3000, compensation_cents: 0, points_delta: -5 },
    { original_item_id: 62, base_refund_cents: 10000, recovery_cents: 0, compensation_cents: 0, points_delta: 100 }
  ])
  Object.assign(row, allocation.totals)
  const original = JSON.parse(row.settlement_items[0].fact_snapshot)
  row.settlement_items = allocation.items.map((item, index) => ({ id: 41 + index, aftersale_id: 31,
    original_item_id: item.original_item_id, item_order_id: 71, item_type: 'accessory', quantity: 1,
    fact_snapshot: { ...original, payable_cents: item.settlement.base_refund_cents, settlement: item.settlement,
      serial_numbers: index ? ['OTHER-PRIVATE-SN'] : original.serial_numbers } }))
  const result = (await fixture(row).service.aftersales(actor, 51)).data[0]
  assert.equal(result.base_refund_amount, 10)
  assert.equal(result.points_recovery_amount, 30)
  assert.equal(result.refund_amount, 0)
  assert.equal(result.collection_amount, 0)
  assert.equal(result.settlement_offset_amount, -20)
  assert.equal(result.points_delta, -5)
  assert.equal(JSON.stringify(result).includes('OTHER-PRIVATE-SN'), false)
  assert.equal(result.settlement_method, 'cash')
  assert.equal(row.refund_cents, 8000)
  row.original_item_id = 62; row.aftersale_item_id = 42
  const other = (await fixture(row).service.aftersales(actor, 51)).data[0]
  assert.equal(other.refund_amount, 80); assert.equal(other.settlement_offset_amount, 20)
})

test('有新逐行凭据但同笔明细缺失、跨原单或合计漂移时返回冲突，不以头金额补齐', async () => {
  for (const corrupt of [row => { row.settlement_items.pop() }, row => { row.settlement_items[1].item_order_id = 72 },
    row => { row.points_delta = 9 }, row => { row.settlement_items[1].fact_snapshot.settlement.refund_cents++ }]) {
    const row = history(), allocation = allocateAftersaleSettlement([61, 62].map(id => ({ original_item_id: id,
      base_refund_cents: 1000, recovery_cents: 30, compensation_cents: 0, points_delta: -2 })))
    Object.assign(row, allocation.totals)
    row.settlement_items = allocation.items.map((item, index) => ({ ...history().settlement_items[0], id: 41 + index,
      original_item_id: item.original_item_id,
      fact_snapshot: { ...JSON.parse(history().settlement_items[0].fact_snapshot), settlement: item.settlement } }))
    corrupt(row)
    await assert.rejects(fixture(row).service.aftersales(actor, 51), { statusCode: 409, code: 'CHECKOUT_RETURN_CONFLICT' })
  }
})

test('分页无行时不查明细；有行时整页头ID去重后一次读齐，不逐条追加查询', async () => {
  for (const selected of [[], [history(), { ...history(), aftersale_item_id: 42, original_item_id: 62 }]]) {
    const calls = [], repository = new Repository()
    repository.withConnection = async fn => fn({ async query(sql, params) {
      calls.push({ sql, params })
      if (sql.includes('FROM accessory_sales')) return [[{ id: 51, item_id: 61, order_id: 71, store_id: 1 }]]
      if (sql.startsWith('SELECT COUNT')) return [[{ total: selected.length }]]
      if (sql.includes('WHERE ai.aftersale_id IN')) return [history().settlement_items]
      return [selected]
    } })
    const result = await repository.aftersales({ storeIds: [1, 2] }, 51, { page: 1, page_size: 20 })
    assert.equal(calls.length, selected.length ? 4 : 3)
    if (selected.length) {
      assert.deepEqual(calls[3].params, ['31'])
      assert.equal(result.data[0].settlement_items, result.data[1].settlement_items)
    }
  }
})

test('手机售后赠品零件返库与扣款分列；后续赠品按原实际扣款退款，用途隐藏后整体脱敏', async () => {
  const row = history(), allocation = allocateAftersaleSettlement([
    { original_item_id: 50, base_refund_cents: 10000, recovery_cents: 0, compensation_cents: 0, gift_charge_cents: 0, points_delta: 0 },
    { original_item_id: 61, base_refund_cents: 0, recovery_cents: 0, compensation_cents: 0, gift_charge_cents: 1500, points_delta: 0 }
  ], { version: 2 })
  Object.assign(row, allocation.totals, { operation_type: 'phone_return', aftersale_item_id: 42 })
  row.settlement_items = allocation.items.map((item, index) => ({ id: 41 + index, aftersale_id: 31,
    original_item_id: item.original_item_id, item_order_id: 71, item_type: index ? 'accessory' : 'phone', quantity: index ? 0 : 1,
    fact_snapshot: { kind: index ? 'gift_charge' : 'phone_return', payable_cents: item.settlement.base_refund_cents,
      serial_numbers: [], points_awarded: 0, points_used: 0, return_reason: '客户退货', restock_confirmed: !index,
      settlement: item.settlement, ...(index ? { gift_charge: { quantity: 3, unit_cents: 500, amount_cents: 1500, serial_numbers: ['G1', 'G2', 'G3'] } } : {}) } }))
  const result = (await fixture(row).service.aftersales(actor, 51)).data[0]
  assert.equal(result.quantity, 0); assert.equal(result.gift_charge_quantity, 3); assert.equal(result.gift_charge_amount, 15)
  assert.equal(result.refund_amount, 0); assert.equal(result.settlement_offset_amount, -15)
  const res = response()
  await new Controller({ service: fixture(row).service, masking: { async getUserFieldPermissions() {
    return { hiddenFields: ['basic_info.usage_type'] }
  }, filterSensitiveFields(rows) { return rows } } }).aftersales({ user: actor, params: { id: 51 }, query: {} }, res)
  for (const key of ['quantity', 'gift_charge_quantity', 'gift_charge_amount', 'refund_amount', 'settlement_offset_amount', 'points_delta']) {
    assert.equal(res.body.data.data[0][key], null)
  }
  const returned = history(), refund = allocateAftersaleSettlement([
    { original_item_id: 61, base_refund_cents: 500, recovery_cents: 0, compensation_cents: 0, gift_charge_cents: 0, points_delta: 0 }
  ], { version: 2 })
  Object.assign(returned, refund.totals)
  returned.settlement_items[0].fact_snapshot = { kind: 'return', payable_cents: 500, gift_refund_cents: 500,
    gift_charge_aftersale_id: 30, serial_numbers: ['G2'], points_awarded: 0, points_used: 0, return_reason: '赠品退回',
    restock_confirmed: true, settlement: refund.items[0].settlement }
  const later = (await fixture(returned).service.aftersales(actor, 51)).data[0]
  assert.equal(later.quantity, 1); assert.equal(later.refund_amount, 5); assert.equal(later.gift_charge_amount, 0)
  for (const mutate of [fact => { fact.gift_charge.quantity = 2 }, fact => { fact.gift_charge.serial_numbers = ['G1', 'G1', 'G3'] }]) {
    const corrupt = structuredClone(row); mutate(corrupt.settlement_items[1].fact_snapshot)
    await assert.rejects(fixture(corrupt).service.aftersales(actor, 51), { code: 'CHECKOUT_RETURN_CONFLICT' })
  }
})
