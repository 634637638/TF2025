'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const Service = require('../src/services/accessory-purchase.service')
const Repository = require('../src/repositories/accessory-purchase.repository')
const Controller = require('../src/controllers/accessory-purchase.controller')
const FieldAccess = require('../src/services/field-access.service')
const actor = { id: 7, name: '经办人', store_ids: [1, 2] }
const input = extra => ({ expected_event_id: 0, request_key: 'a'.repeat(32), payment_method: 'bank_transfer', payment_time: '2026-11-13 12:13:14', remarks: '核对采购单后登记', ...extra })
function fixture() {
  const purchase = { id: 8, store_id: 1, supplier_id: 3, quantity: 50, purchase_cost: '12.50', total_amount: '625.00' }
  const state = { events: [], stock: 20, sold: 30, purchase }
  const tx = []
  let snapshot, queue = Promise.resolve(), fail = false
  const connection = {
    async execute() { tx.push('configure') },
    async beginTransaction() { tx.push('begin'); snapshot = structuredClone(state) },
    async commit() { tx.push('commit') }, async rollback() { tx.push('rollback'); Object.assign(state, snapshot) }
  }
  const check = value => assert.equal(value, connection)
  const repository = {
    async withConnection(fn) { const previous = queue; let release; queue = new Promise(resolve => { release = resolve }); await previous; try { return await fn(connection) } finally { release() } },
    async getPurchase(id, scope, db, lock) { if (db) { check(db); assert.ok(lock === true || lock === undefined) } return id === 8 && scope.storeIds.includes(state.purchase.store_id) ? state.purchase : null },
    async byKey(key, db) { check(db); return state.events.find(row => row.request_key === key) },
    async paymentEventsAfter(id, after, size, db) { check(db); assert.equal(id, 8); return state.events.filter(row => Number(row.id) > after).slice(0, size) },
    async append(data, db) { check(db); state.events.push({ ...data, id: state.events.length + 1 }); if (fail) throw new Error('append failed'); return state.events.length },
    async list(scope, query, db) { check(db); return { scope, query, rows: [], summary: { total: 0 } } }, async history(id, page, pageSize, db) { check(db); return { id, page, pageSize, rows: state.events } }
  }
  return { service: new Service({ repository }), repository, state, tx, setFail() { fail = true } }
}

function paymentEvent(id, extra = {}) {
  return { id, stock_in_id: 8, supplier_id: 3, action: id % 2 ? 'pay' : 'cancel', amount: '625.00',
    reference_event_id: id % 2 ? null : id - 1, payment_method: 'bank_transfer', payment_time: '2026-11-13 12:13:14', ...extra }
}

test('付款登记和撤销均核对完整原账：早期错误不能被正常的最后状态掩盖', async () => {
  for (const extra of [{ amount: '624.99' }, { supplier_id: 99 }, { stock_in_id: 9 },
    { action: 'cancel', reference_event_id: 8 }, { reference_event_id: 7 }]) {
    for (const action of ['pay', 'cancel']) {
      const f = fixture(), length = action === 'pay' ? 2 : 3
      f.state.events.push(...Array.from({ length }, (_, i) => paymentEvent(i + 1)))
      Object.assign(f.state.events[0], extra)
      const before = structuredClone(f.state)
      await assert.rejects(f.service.record(actor, 8, action, input({ expected_event_id: length })), { code: 'PURCHASE_PAYMENT_CONFLICT' })
      assert.deepEqual(f.state, before)
      assert.equal(f.tx.at(-1), 'rollback')
    }
  }
  const f = fixture()
  f.state.events.push(paymentEvent(1), paymentEvent(2, { action: 'pay', reference_event_id: null }), paymentEvent(3))
  await assert.rejects(f.service.record(actor, 8, 'cancel', input({ expected_event_id: 3 })), { code: 'PURCHASE_PAYMENT_CONFLICT' })
  assert.equal(f.state.events.length, 3)
})

test('付款完整链跨100条后仍可登记和撤销，撤销沿用原方式及完整北京时间', async () => {
  const f = fixture(), cursors = [], read = f.repository.paymentEventsAfter
  f.repository.paymentEventsAfter = async (...args) => { cursors.push(args[1]); return read(...args) }
  f.state.events.push(...Array.from({ length: 102 }, (_, i) => paymentEvent(i + 1)))
  await f.service.record(actor, 8, 'pay', input({ expected_event_id: 102, payment_method: 'cash', payment_time: '2026-11-13 00:01:02' }))
  assert.deepEqual(cursors, [0, 100])
  cursors.length = 0
  await f.service.record(actor, 8, 'cancel', input({ expected_event_id: 103, request_key: 'b'.repeat(32) }))
  assert.deepEqual(cursors, [0, 100])
  assert.equal(f.state.events[103].reference_event_id, 103)
  assert.equal(f.state.events[103].payment_method, 'cash')
  assert.equal(f.state.events[103].payment_time, '2026-11-13 00:01:02')
})

test('原付款方式或完整北京时间损坏时登记和撤销均拒绝，不追加或修补原账', async () => {
  for (const extra of [{ payment_method: 'unknown' }, { payment_method: null }, { payment_method: ['cash'] },
    { payment_time: null }, { payment_time: '2026-11-13' }, { payment_time: '2026-11-13 12:13' },
    { payment_time: '2026-02-30 12:13:14' }, { payment_time: '2026-11-13 24:00:00' },
    { payment_time: '2026-11-13 12:60:00' }, { payment_time: '2026-11-13 12:13:60' }]) {
    for (const action of ['pay', 'cancel']) {
      const f = fixture(), length = action === 'pay' ? 2 : 1
      f.state.events.push(...Array.from({ length }, (_, index) => paymentEvent(index + 1)))
      Object.assign(f.state.events[0], extra)
      const before = structuredClone(f.state)
      await assert.rejects(f.service.record(actor, 8, action, input({ expected_event_id: length })), { code: 'PURCHASE_PAYMENT_CONFLICT' })
      assert.deepEqual(f.state, before)
      assert.equal(f.tx.at(-1), 'rollback')
    }
  }
})

test('撤销必须保留对应原付款方式及秒级时间，早期或后续分页坏记录都拒绝', async () => {
  for (const index of [1, 101]) for (const extra of [{ payment_method: 'cash' }, { payment_time: '2026-11-13 12:13:15' }]) {
    const f = fixture()
    f.state.events.push(...Array.from({ length: 102 }, (_, index) => paymentEvent(index + 1)))
    Object.assign(f.state.events[index], extra)
    const before = structuredClone(f.state)
    await assert.rejects(f.service.record(actor, 8, 'pay', input({ expected_event_id: 102 })), { code: 'PURCHASE_PAYMENT_CONFLICT' })
    assert.deepEqual(f.state, before)
    assert.equal(f.tx.at(-1), 'rollback')
  }
})

test('不同付款轮次可改方式时间，撤销分别沿用本轮原值，合法闰日及午夜保持北京时间', async () => {
  const f = fixture()
  await f.service.record(actor, 8, 'pay', input({ payment_time: '2024-02-29 23:59:59' }))
  await f.service.record(actor, 8, 'cancel', input({ expected_event_id: 1, request_key: 'b'.repeat(32) }))
  await f.service.record(actor, 8, 'pay', input({ expected_event_id: 2, request_key: 'c'.repeat(32), payment_method: 'cash', payment_time: '2026-11-14 00:00:00' }))
  await f.service.record(actor, 8, 'cancel', input({ expected_event_id: 3, request_key: 'd'.repeat(32) }))
  assert.deepEqual(f.state.events.map(row => [row.action, row.payment_method, row.payment_time]), [
    ['pay', 'bank_transfer', '2024-02-29 23:59:59'], ['cancel', 'bank_transfer', '2024-02-29 23:59:59'],
    ['pay', 'cash', '2026-11-14 00:00:00'], ['cancel', 'cash', '2026-11-14 00:00:00']
  ])
})

test('跨页付款账读取故障回滚，不追加付款或改变库存', async () => {
  const f = fixture(), read = f.repository.paymentEventsAfter
  f.state.events.push(...Array.from({ length: 102 }, (_, i) => paymentEvent(i + 1)))
  const before = structuredClone(f.state)
  f.repository.paymentEventsAfter = async (...args) => { if (args[1]) throw new Error('history read failed'); return read(...args) }
  await assert.rejects(f.service.record(actor, 8, 'pay', input({ expected_event_id: 102 })), /history read failed/)
  assert.deepEqual(f.state, before)
  assert.equal(f.tx.at(-1), 'rollback')
})
test('采购按真实批次整额登记，忽略客户端金额身份，不随销量/余量/划拨改变', async () => {
  const f = fixture()
  const result = await f.service.record(actor, 8, 'pay', input({ amount: 1, operator_id: 99 }))
  assert.equal(result.amount, 625)
  assert.equal(f.state.events[0].operator_id, actor.id)
  assert.equal(f.state.events[0].supplier_id, 3)
  assert.equal(f.state.events[0].stock_in_id, 8)
  assert.deepEqual([f.state.stock, f.state.sold, f.state.purchase.quantity], [20, 30, 50])
  assert.equal(f.tx.at(-1), 'commit')
})
test('撤销追加审计并关联原打款，重新登记保留全部历史，旧请求重试不恢复已撤销状态', async () => {
  const f = fixture()
  await f.service.record(actor, 8, 'pay', input())
  await f.service.record(actor, 8, 'cancel', input({ expected_event_id: 1, request_key: 'b'.repeat(32), remarks: '登记错误' }))
  assert.equal(f.state.events[1].reference_event_id, 1)
  assert.equal(f.state.events[1].payment_time, '2026-11-13 12:13:14')
  assert.equal(f.state.events[1].amount, 625)
  assert.equal((await f.service.record(actor, 8, 'pay', input())).replayed, true)
  assert.equal(f.state.events.length, 2)
  await f.service.record(actor, 8, 'pay', input({ expected_event_id: 2, request_key: 'c'.repeat(32) }))
  await assert.rejects(f.service.record(actor, 8, 'cancel', input({ expected_event_id: 1, request_key: 'd'.repeat(32) })), { code: 'PAYMENT_VERSION_CONFLICT' })
  assert.deepEqual(f.state.events.map(event => event.action), ['pay', 'cancel', 'pay'])
})
test('并发重复同标识只登记一次，不同标识过期版本拒绝', async () => {
  const f = fixture()
  const results = await Promise.all([f.service.record(actor, 8, 'pay', input()), f.service.record(actor, 8, 'pay', input())])
  assert.equal(results.filter(result => result.replayed).length, 1)
  assert.equal(f.state.events.length, 1)
  await assert.rejects(f.service.record(actor, 8, 'pay', input({ request_key: 'b'.repeat(32) })), { code: 'PAYMENT_VERSION_CONFLICT' })
  await assert.rejects(f.service.record(actor, 8, 'pay', input({ remarks: '改变内容' })), { code: 'PAYMENT_REQUEST_CONFLICT' })
})
test('没有打款不能撤销；已打款不能再次登记；审计写入失败整体回滚', async () => {
  const f = fixture()
  await assert.rejects(f.service.record(actor, 8, 'cancel', input()), { code: 'PAYMENT_STATE_CONFLICT' })
  f.setFail()
  await assert.rejects(f.service.record(actor, 8, 'pay', input()), /append failed/)
  assert.deepEqual(f.state.events, [])
  assert.equal(f.tx.at(-1), 'rollback')
  const g = fixture()
  await g.service.record(actor, 8, 'pay', input())
  await assert.rejects(g.service.record(actor, 8, 'pay', input({ expected_event_id: 1, request_key: 'b'.repeat(32) })), { code: 'PAYMENT_STATE_CONFLICT' })
})
test('采购数量/单价/总额不符和零金额拒绝登记，不能用错误总额覆盖', async () => {
  for (const extra of [{ total_amount: '0.00' }, { total_amount: '1.00' }, { quantity: 0 }, { purchase_cost: '12.501' }]) {
    const f = fixture(); Object.assign(f.state.purchase, extra)
    await assert.rejects(f.service.record(actor, 8, 'pay', input()), { code: 'PURCHASE_AMOUNT_CONFLICT' })
    assert.equal(f.state.events.length, 0)
  }
})
test('认证和门店范围覆盖列表、登记和历史，列表日期及分页严格校验', async () => {
  const f = fixture()
  await assert.rejects(f.service.list({}, {}), { statusCode: 401 })
  await assert.rejects(f.service.list(actor, { store_id: 99 }), { statusCode: 403 })
  for (const fn of [() => f.service.history({ id: 8, store_id: 99 }, 8), () => f.service.record({ id: 8, store_id: 99 }, 8, 'pay', input())]) await assert.rejects(fn(), { statusCode: 404 })
  for (const query of [{ page_size: '101' }, { page: true }, { start_date: '2026-02-30' }, { start_date: '2026-11-14', end_date: '2026-11-13' }, { payment_status: 'x' }, { keyword: [] }]) await assert.rejects(f.service.list(actor, query), { statusCode: 400 })
  const result = await f.service.list(actor, { page: '2', page_size: '10', store_id: 1 })
  assert.deepEqual(result.scope.storeIds, [1, 2])
  assert.equal(result.query.page, 2)
})
for (const [label, extra] of [
  ['版本缺失', { expected_event_id: undefined }], ['版本布尔', { expected_event_id: false }],
  ['标识非法', { request_key: 'bad' }], ['时间越界', { payment_time: '2026-11-13 24:00:00' }],
  ['日期非法', { payment_time: '2026-02-30 00:00:00' }], ['方式非法', { payment_method: 'wrong' }], ['备注非法', { remarks: 7 }]
]) test(`登记拒绝${label}且不写入`, async () => {
  const f = fixture(); await assert.rejects(f.service.record(actor, 8, 'pay', input(extra)), { statusCode: 400 }); assert.equal(f.state.events.length, 0)
})
test('撤销原因必填；历史正常分页且仅显示原采购范围', async () => {
  const f = fixture()
  await assert.rejects(f.service.record(actor, 8, 'cancel', input({ remarks: ' ' })), { statusCode: 400 })
  assert.deepEqual(await f.service.history(actor, '8', { page: '2', page_size: '5' }), { id: 8, page: 2, pageSize: 5, rows: [] })
})
test('云端 BIGINT 字符串统一为数字ID，重试与历史保持同一响应契约', async () => {
  const f = fixture()
  await f.service.record(actor, 8, 'pay', input())
  f.state.events[0].id = '1'
  f.state.events[0].stock_in_id = '8'
  f.state.events[0].operator_id = '7'
  assert.equal((await f.service.record(actor, 8, 'pay', input())).id, 1)
  const history = await f.service.history(actor, 8)
  assert.equal(history.rows[0].id, 1)
  assert.equal(history.rows[0].stock_in_id, 8)
  assert.equal(history.rows[0].operator_id, 7)
})
test('仓储范围排除跨店历史分配；列表/汇总按采购原额，绑定关键词和结束日期', () => {
  const repository = new Repository()
  const restricted = repository.conditions({ allStores: false, storeIds: [1, 2] }, { keyword: "%' OR 1=1", end_date: '2026-11-13', payment_status: 'unpaid' })
  assert.match(restricted.where, /JSON_LENGTH/)
  assert.match(restricted.where, /JSON_CONTAINS/)
  assert.ok(!restricted.where.includes("%' OR 1=1"))
  assert.ok(restricted.params.includes("%%' OR 1=1%"))
  assert.match(restricted.where, /DATE_ADD/)
  assert.match(repository.conditions({ allStores: false, storeIds: [] }).where, /1 = 0/)
})
test('采购控制器复用字段脱敏：隐藏成本同时隐藏汇总及历史金额，隐藏状态不泄漏已付分组', async () => {
  const hidden = ['payment.purchase_cost', 'payment.payment_status', 'payment.supplier_name']
  const fieldAccess = new FieldAccess({ moduleKey: 'payments_supplierphonepaymentsview', masking: {
    async getUserFieldPermissions() { return { hiddenFields: hidden } }, filterSensitiveFields(data) { return data }
  } })
  // 从真实控制器配置取得响应映射，测试实际脱敏路径。
  const controller = new Controller({ service: { async list() { return { rows: [{ id: 8, total_amount: 625, payment_status: 'paid', latest_event_id: 1, supplier_id: 3 }], summary: { total: 1, total_amount: 625, paid_amount: 625, unpaid_amount: 0 }, pagination: { total: 1 } } } } })
  fieldAccess.responseKeys = controller.fields.responseKeys
  controller.fields = fieldAccess
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } }
  await controller.list({ user: actor, query: {} }, res)
  assert.equal(res.body.data[0].id, 8)
  for (const key of ['total_amount', 'latest_event_id', 'supplier_id']) assert.equal(res.body.data[0][key], null)
  for (const key of ['total_amount', 'paid_amount', 'unpaid_amount']) assert.equal(res.body.summary[key], null)
  await controller.list({ user: actor, query: { supplier_id: 3 } }, res)
  assert.equal(res.statusCode, 403)
  await controller.pay({ user: actor, params: { id: 8 }, body: input() }, res)
  assert.equal(res.statusCode, 403)
})

/** 使用真实仓储公共租借入口，故障阶段不以假释放掩盖未结束事务。 */
function paymentConnectionFixture(action, failAt) {
  const events = [], records = action === 'cancel' ? [paymentEvent(1)] : []
  const purchase = { id: 8, supplier_id: 3, store_id: 1, quantity: 50, purchase_cost: '12.50', total_amount: '625.00' }
  let active = false, before, failure = failAt
  const step = stage => { events.push(stage); if (failure === stage) throw new Error(`${stage}-failed`) }
  const connection = {
    async beginTransaction() { step('begin'); before = structuredClone(records); active = true },
    async commit() { step('commit'); active = false },
    async rollback() { step('rollback'); records.splice(0, records.length, ...before); active = false },
    destroy() { events.push('destroy'); active = false },
    release() { events.push('release'); assert.equal(active, false, '未结束的事务不能回到连接池') }
  }
  const repository = new Repository()
  repository.getConnection = () => ({ async getConnection() { events.push('acquire'); return connection } })
  repository.getPurchase = async (_id, _scope, db, lock) => { assert.equal(db, connection); assert.equal(lock, true); step('lock'); return purchase }
  repository.byKey = async (key, db) => { assert.equal(db, connection); step('replay'); return records.find(row => row.request_key === key) }
  repository.paymentEventsAfter = async (_id, after, _size, db) => { assert.equal(db, connection); step('history'); return records.filter(row => row.id > after) }
  repository.append = async (row, db) => { assert.equal(db, connection); step('append'); records.push({ ...row, id: records.length + 1 }); return records.length }
  return { service: new Service({ repository }), events, records, input: input({ expected_event_id: action === 'cancel' ? 1 : 0 }),
    fail(stage) { failure = stage } }
}

for (const stage of ['begin', 'lock', 'replay', 'history', 'append', 'commit']) {
  test(`采购付款/撤销${stage}故障只清理一次，未完成写入不能成功返回`, async () => {
    for (const action of ['pay', 'cancel']) {
      const f = paymentConnectionFixture(action, stage)
      await assert.rejects(f.service.record(actor, 8, action, f.input), new RegExp(`${stage}-failed`))
      assert.equal(f.events.at(-1), 'release')
      assert.equal(f.events.filter(event => event === 'acquire').length, 1)
      assert.equal(f.events.filter(event => event === 'rollback').length, stage === 'begin' ? 0 : 1)
      assert.equal(f.events.filter(event => event === 'destroy').length, stage === 'begin' ? 1 : 0)
      assert.equal(f.records.length, action === 'cancel' ? 1 : 0)
    }
  })
}

test('采购付款及撤销回滚故障销毁连接，不二次回滚或自动重放', async () => {
  for (const action of ['pay', 'cancel']) {
    const f = paymentConnectionFixture(action, 'rollback')
    f.service.reconcilePayments = async () => { throw new Error('history-failed') }
    await assert.rejects(f.service.record(actor, 8, action, f.input), /rollback-failed/)
    assert.deepEqual(f.events, ['acquire', 'begin', 'lock', 'replay', 'rollback', 'destroy', 'release'])
  }
})

test('采购付款/撤销正常提交及同键重放复用连接，重放提交失败仍回滚清理', async () => {
  for (const action of ['pay', 'cancel']) {
    const f = paymentConnectionFixture(action)
    const first = await f.service.record(actor, 8, action, f.input)
    assert.equal(first.replayed, false)
    assert.deepEqual(f.events.slice(-2), ['commit', 'release'])
    f.events.length = 0
    const replay = await f.service.record(actor, 8, action, f.input)
    assert.equal(replay.id, first.id); assert.equal(replay.replayed, true)
    assert.deepEqual(f.events, ['acquire', 'begin', 'lock', 'replay', 'commit', 'release'])
    const before = structuredClone(f.records)
    for (const stage of ['commit', 'rollback']) {
      f.events.length = 0
      f.fail(stage)
      if (stage === 'rollback') f.service.repository.byKey = async () => { throw new Error('replay-failed') }
      await assert.rejects(f.service.record(actor, 8, action, f.input), new RegExp(`${stage}-failed`))
      assert.deepEqual(f.events.slice(-2), stage === 'commit' ? ['rollback', 'release'] : ['destroy', 'release'])
      assert.equal(f.events.filter(event => event === 'rollback').length, 1)
      assert.deepEqual(f.records, before)
    }
  }
})
