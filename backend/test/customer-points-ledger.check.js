'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fixture = require('./helpers/customer-points-ledger')
const CustomerPointsLedgerService = require('../src/services/customer-points-ledger.service')
const { reconcileCustomerPointsForSale, creditCheckoutPoints, DEFAULT_POINTS_CONFIG } = require('../src/services/customer-points.service')
const { clearSchemaInspectorCache } = require('../src/services/schema-inspector.service')
const CustomerManagementService = require('../src/services/customer-management.service')
const CustomerController = require('../src/controllers/customer.controller')

const award = (service, db, sourceId, delta, customerId = 9, sourceType = 'phone_sale') => service.applyDelta(db, { customerId, delta, sourceId, sourceType })
const spend = (service, db, snapshot, itemId, points, amountCents, pointsPerYuan = 3) => service.consume(db, {
  customerId: 9, snapshot, itemId, points, amountCents, pointsPerYuan
})

test('老余额原样保留且不伪造来源，新积分按真实销售入账；跨店使用同一客户账户', async () => {
  const f = fixture({ initialPoints: 20 })
  await f.transaction(async db => {
    const initial = await f.service.snapshot(db, 9)
    assert.deepEqual(initial, { customer_id: 9, available_points: 0, balance: 20, credit_cutoff_id: 0 })
    await award(f.service, db, 51, 3)
    await award(f.service, db, 52, 6, 9, 'checkout_item')
    const snapshot = await f.service.snapshot(db, 9)
    assert.equal(snapshot.available_points, 9)
    assert.equal(snapshot.balance, 29)
    await spend(f.service, db, snapshot, 71, 6, 200)
  })
  assert.equal(f.state.customers[9], 23)
  assert.equal(f.state.entries.length, 3)
  assert.deepEqual(f.state.allocations.map(row => [row.credit_entry_id, row.points, row.amount_cents]), [[1, 3, 100], [2, 3, 100]])
})

test('来源分配按先入先出，分币尾差保存到原抵扣金额，改配置不改历史事实', async () => {
  const f = fixture()
  await f.transaction(async db => {
    for (let id = 1; id <= 3; id++) await award(f.service, db, id, 1)
    const snapshot = await f.service.snapshot(db, 9)
    await spend(f.service, db, snapshot, 81, 3, 100)
    assert.deepEqual(f.state.allocations.map(row => row.amount_cents), [33, 33, 34])
    assert.equal(f.state.entries.at(-1).points_per_yuan, 3)
    assert.equal(f.state.entries.at(-1).amount_cents, 100)
    assert.equal(f.state.customers[9], 0)
    await assert.rejects(spend(f.service, db, snapshot, 81, 3, 150, 2), { code: 'POINTS_REDEMPTION_CONFLICT' })
  })
})

test('只消费结算前已有来源，本单新增积分及未知历史余额不能补足抵扣', async () => {
  const f = fixture({ initialPoints: 100 })
  await f.transaction(async db => {
    await award(f.service, db, 1, 3)
    const snapshot = await f.service.snapshot(db, 9)
    await award(f.service, db, 2, 6)
    await assert.rejects(spend(f.service, db, { ...snapshot, available_points: 100 }, 91, 6, 200), { code: 'POINTS_AVAILABLE_INSUFFICIENT' })
    await spend(f.service, db, snapshot, 91, 3, 100)
    await assert.rejects(spend(f.service, db, snapshot, 92, 3, 100), { code: 'POINTS_AVAILABLE_INSUFFICIENT' })
  })
  assert.equal(f.state.customers[9], 106)
})

test('换货来源快照逐源限额：本次返分及新发积分不能替代原额度，多行不能重复花掉同一限额', async () => {
  const f = fixture()
  await f.transaction(async db => {
    await award(f.service, db, 1, 10)
    await spend(f.service, db, await f.service.snapshot(db, 9), 51, 6, 200)
    const before = await f.service.snapshot(db, 9, { preserveSources: true })
    assert.deepEqual(before.source_limits, [{ id: 1, available: 4, allocated: 6 }])
    await f.service.returnRedemption(db, { customerId: 9, itemId: 51, points: 6, requestKey: 'exchange:original:51' })
    await award(f.service, db, 2, 5)
    await assert.rejects(spend(f.service, db, before, 52, 5, 500, 1), { code: 'POINTS_AVAILABLE_INSUFFICIENT' })
    await spend(f.service, db, before, 52, 3, 100)
    await assert.rejects(spend(f.service, db, before, 53, 2, 100, 2), { code: 'POINTS_AVAILABLE_INSUFFICIENT' })
    await spend(f.service, db, before, 53, 1, 100, 1)
    assert.equal(f.state.customers[9], 11)
    assert.deepEqual(JSON.parse(f.state.entries.at(-1).source_snapshot).source_limits, before.source_limits)
  })
})

test('换货撤回可用奖励后，不能用本次刚返还的另一旧来源顶替，即使总余额和截止ID足够', async () => {
  const f = fixture()
  await f.transaction(async db => {
    await award(f.service, db, 1, 6)
    await spend(f.service, db, await f.service.snapshot(db, 9), 51, 6, 200)
    await award(f.service, db, 2, 3)
    const snapshot = await f.service.snapshot(db, 9, { preserveSources: true })
    await f.service.returnAward(db, { customerId: 9, sourceType: 'phone_sale', sourceId: 2, points: 3, requestKey: 'exchange:award:2' })
    await f.service.returnRedemption(db, { customerId: 9, itemId: 51, points: 6, requestKey: 'exchange:redeem:51' })
    await assert.rejects(spend(f.service, db, snapshot, 52, 3, 100), { code: 'POINTS_AVAILABLE_INSUFFICIENT' })
    assert.equal(f.state.customers[9], 6)
  })
})

test('相同商品抵扣幂等，改客户、积分或兑换值冲突；并发不能花同一来源两次', async () => {
  const f = fixture()
  let snapshot
  await f.transaction(async db => { await award(f.service, db, 1, 3); snapshot = await f.service.snapshot(db, 9) })
  const results = await Promise.allSettled([101, 102].map(itemId => f.transaction(db => spend(f.service, db, snapshot, itemId, 3, 100))))
  assert.equal(results.filter(row => row.status === 'fulfilled').length, 1)
  assert.equal(results.filter(row => row.status === 'rejected')[0].reason.code, 'POINTS_AVAILABLE_INSUFFICIENT')
  const itemId = f.state.entries.at(-1).redemption_item_id, before = structuredClone(f.state)
  await f.transaction(async db => {
    const original = await spend(f.service, db, snapshot, itemId, 3, 100)
    assert.equal(original.points_used, 3)
    await assert.rejects(f.service.consume(db, { customerId: 10, points: 3, amountCents: 100, pointsPerYuan: 3, itemId,
      snapshot: { ...snapshot, customer_id: 10 } }), { code: 'POINTS_REDEMPTION_CONFLICT' })
  })
  assert.deepEqual(f.state, before)
})

test('退货或改价只冲原来源；已使用奖励须先核对追回，不归零放行或挪用其他奖励', async () => {
  const f = fixture()
  await f.transaction(async db => {
    await award(f.service, db, 11, 6)
    await award(f.service, db, 12, 3)
    await award(f.service, db, 11, -2)
    const snapshot = await f.service.snapshot(db, 9)
    await spend(f.service, db, snapshot, 111, 3, 100)
    await award(f.service, db, 11, -1)
    const before = structuredClone(f.state)
    await assert.rejects(award(f.service, db, 11, -3), { code: 'POINTS_RECOVERY_REQUIRED' })
    await assert.rejects(award(f.service, db, 99, -3), { code: 'POINTS_BASELINE_REQUIRED' })
    assert.deepEqual(f.state, before)
  })
  assert.equal(f.state.customers[9], 3)
})

test('未迁移历史凭据只冲未知余额，新来源不被历史退货占用，不补造期初', async () => {
  const f = fixture({ initialPoints: 2 })
  await f.transaction(async db => {
    await award(f.service, db, 1, 3)
    await award(f.service, db, 90, -2)
    assert.equal(f.state.entries.at(-1).untracked_points, 2)
    await assert.rejects(award(f.service, db, 90, -1), { code: 'POINTS_BASELINE_REQUIRED' })
    assert.equal((await f.service.state(db, 9)).tracked, 3)
  })
  const old = fixture({ initialPoints: 2 })
  await old.transaction(db => award(old.service, db, 90, -10))
  assert.equal(old.state.customers[9], 0)
  assert.equal(old.state.entries[0].points, -2)
})

for (const stage of ['balance', 'entry', 'allocation']) test(`${stage}失败时余额、来源和分配随外层事务整体回滚，原请求可重试`, async () => {
  const f = fixture()
  let snapshot
  await f.transaction(async db => { await award(f.service, db, 1, 3); snapshot = await f.service.snapshot(db, 9) })
  const before = structuredClone(f.state)
  f.failAt(stage)
  await assert.rejects(f.transaction(db => spend(f.service, db, snapshot, 121, 3, 100)))
  assert.deepEqual(f.state, before)
  f.failAt('')
  await f.transaction(db => spend(f.service, db, snapshot, 121, 3, 100))
  assert.equal(f.state.customers[9], 0)
})

test('余额与账不符、来源超分配、非法兑换或余额溢出均拒绝，无静默修补', async () => {
  const f = fixture()
  await f.transaction(async db => {
    await award(f.service, db, 1, 3)
    const snapshot = await f.service.snapshot(db, 9)
    for (const values of [[1, 100, 3], [3, -1, 3], [1.5, 50, 3]]) await assert.rejects(
      spend(f.service, db, snapshot, 131, ...values), { statusCode: 400 })
    f.state.customers[9] = 2
    await assert.rejects(f.service.snapshot(db, 9), { code: 'POINTS_LEDGER_MISMATCH' })
    f.state.customers[9] = 2147483647
    await assert.rejects(award(f.service, db, 2, 1), /超出范围/)
    f.state.allocations.push({ credit_entry_id: 1, debit_entry_id: 9, points: 4 })
    f.state.entries.push({ id: 9, entry_type: 'revoke', customer_id: 9, points: -4 })
    await assert.rejects(f.service.snapshot(db, 9), /来源余额不足/)
  })
})

test('未安装两张表保留旧累计，消费明确拒绝；只安装一张拒绝，不能降级绕过', async () => {
  const db = { execute() { assert.fail('不应读取业务表') } }
  const missing = new CustomerPointsLedgerService({ tableExists: async () => false })
  assert.equal(await award(missing, db, 1, 3), false)
  await assert.rejects(missing.snapshot(db, 9), { code: 'POINTS_LEDGER_NOT_READY' })
  const partial = new CustomerPointsLedgerService({ tableExists: async name => name === 'customer_points_entries' })
  await assert.rejects(award(partial, db, 1, 3), { code: 'POINTS_LEDGER_SCHEMA_INCOMPLETE' })
  await assert.rejects(partial.ready(null), { code: 'POINTS_TRANSACTION_REQUIRED' })
})

test('公共手机积分入口保存来源、重复同步不追发、客户转移及旧入口已消费保护同事务', async () => {
  clearSchemaInspectorCache()
  const f = fixture()
  f.state.sales[21] = { id: 21, customer_id: 9, points_awarded: 0, points_accounted_at: null }
  const sync = (db, customerId, price) => reconcileCustomerPointsForSale({ executor: db, saleId: 21, customerId,
    saleType: 'retail', salePrice: price, isNew: 1, config: DEFAULT_POINTS_CONFIG, initialize: true })
  await f.transaction(async db => {
    await sync(db, 9, 300)
    await sync(db, 9, 300)
    assert.equal(f.state.entries.length, 1)
    const original = JSON.parse(f.state.entries[0].source_snapshot)
    assert.equal(original.sale_price, 300)
    assert.equal(original.config.new_points_per_100, 1)
    await sync(db, 10, 300)
    f.state.sales[21].customer_id = 10
    assert.equal(f.state.customers[9], 0)
    assert.equal(f.state.customers[10], 3)
    assert.equal(f.state.entries.at(-1).source_id, 21)
    const snapshot = await f.service.snapshot(db, 10)
    await f.service.consume(db, { customerId: 10, snapshot, points: 3, amountCents: 100, pointsPerYuan: 3, itemId: 151 })
  })
  const before = structuredClone(f.state)
  await assert.rejects(f.transaction(db => sync(db, 10, 0)), { code: 'POINTS_RECOVERY_REQUIRED' })
  assert.deepEqual(f.state, before)
  clearSchemaInspectorCache()
})

test('商品积分公共入账必须逐个关联订单明细，合计不符或缺来源拒绝，失败不留下部分来源', async () => {
  clearSchemaInspectorCache()
  const f = fixture()
  await f.transaction(async db => {
    await assert.rejects(creditCheckoutPoints(db, 9, 3), /真实订单明细/)
    await assert.rejects(creditCheckoutPoints(db, 9, 3, { sources: [{ item_id: 1, points: 2 }] }), /真实订单明细/)
    await creditCheckoutPoints(db, 9, 3, { sources: [{ item_id: 1, points: 1 }, { item_id: 2, points: 2 }] })
  })
  assert.deepEqual(f.state.entries.map(row => [row.source_type, row.source_id, row.points]), [['checkout_item', 1, 1], ['checkout_item', 2, 2]])
  clearSchemaInspectorCache()
})

test('普通客户资料保存不写回旧积分；已启用来源账拒绝手工覆盖，历史调整不混为来源', async () => {
  const writes = [], executor = { execute() {} }
  const service = new CustomerManagementService({
    repository: {
      async findCustomerById() { return { id: 9, points: 3 } },
      async getCustomerColumns() { return new Set(['name', 'points', 'updated_at']) },
      async update(id, data) { writes.push({ id, data }); return { affectedRows: 1 } },
      async withConnection(operation) { return operation(executor) }
    },
    pointsLedger: { async ready(db) { assert.equal(db, executor); return true } }
  })
  await service.update({ id: '9' }, { name: '客户资料', points: '3' })
  assert.equal(Object.hasOwn(writes[0].data, 'points'), false)
  await assert.rejects(service.update({ id: '9' }, { points: '5' }), { statusCode: 409, code: 'POINTS_ADJUSTMENT_REQUIRED' })
  const controller = new CustomerController({ service, logger: { error() { assert.fail('业务409不应当作内部异常') } } })
  const res = { status(value) { this.statusCode = value; return this }, json(value) { this.body = value; return this } }
  await controller.update({ params: { id: '9' }, body: { points: '5' } }, res)
  assert.equal(res.statusCode, 409)
  assert.match(res.body.message, /积分核对调整/)
  for (const points of [-1, '2.2', '2abc', true, '', '2147483648']) await assert.rejects(service.update({ id: '9' }, { points }), { statusCode: 400 })
  assert.equal(writes.length, 1)
})
