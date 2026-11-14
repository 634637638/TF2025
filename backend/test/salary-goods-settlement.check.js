'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { planSettlement, readSnapshot, sameSettlement } = require('../src/utils/salary-goods-settlement')
const Service = require('../src/services/salary-goods-settlement.service')
const Repository = require('../src/repositories/salary-goods-settlement.repository')
const { applyGoods } = require('../src/utils/salary-goods-amounts')

const scope = { employee_id: 8, period_start: '2026-11-01', period_end: '2026-11-30', through: '2026-11-30 23:59:59' }
const sale = (patch = {}) => ({ employee_id: 8, salary_template_id: 4, order_id: 10, order_item_id: 50, accessory_sale_id: 20,
  source_key: 'goods_sale:50', kind: 'sale', original_source_key: null, aftersale_id: null, aftersale_item_id: null,
  quantity: 3, business_time: '2026-10-20 12:00:00', recorded_at: '2026-10-20 12:01:00', amount_cents: 1000,
  reason: 'earned', source_hash: 'a'.repeat(64), ...patch })
const returned = (patch = {}) => sale({ source_key: 'goods_return:100', kind: 'return', original_source_key: 'goods_sale:50',
  aftersale_id: 300, aftersale_item_id: 100, quantity: 1, business_time: '2026-11-10 10:00:00',
  recorded_at: '2026-11-10 10:00:01', amount_cents: -334, source_hash: 'b'.repeat(64), ...patch })
const facts = (entries, through = scope.through) => ({ version: 1, employee_id: 8, through, legacy_item_count: 0,
  earned_cents: entries.filter(row => row.kind === 'sale').reduce((sum, row) => sum + row.amount_cents, 0),
  reversal_cents: entries.filter(row => row.kind === 'return').reduce((sum, row) => sum - row.amount_cents, 0),
  net_cents: entries.reduce((sum, row) => sum + row.amount_cents, 0), entries })
const paid = (snapshot, id = 71) => ({ id, employee_id: 8, period_start: snapshot.period_start, period_end: snapshot.period_end,
  status: 'paid', paid_at: snapshot.through, ...applyGoods({ commission_amount: 80, net_salary: 2080 }, snapshot) })
const claimsFor = (record, firstId = 1) => readSnapshot(record.goods_commission_snapshot).entries.map((entry, offset) => ({ id: firstId + offset,
  employee_id: record.employee_id, salary_record_id: record.id, original_salary_record_id: entry.kind === 'return'
    ? entry.original_salary_record_id ?? record.id : null,
  source_key: entry.source_key, source_hash: entry.source_hash, amount_cents: entry.amount_cents,
  source_snapshot: structuredClone(entry), created_at: record.paid_at }))
const conflict = { statusCode: 409, code: 'SALARY_GOODS_SETTLEMENT_CONFLICT' }

test('同月未发成交与分次退货一起净结，零提成来源也保留且草稿不占唯一来源', () => {
  const input = facts([sale(), returned(), returned({ source_key: 'goods_return:101', aftersale_id: 301, aftersale_item_id: 101,
    quantity: 2, amount_cents: -666, source_hash: 'c'.repeat(64) })])
  const first = planSettlement(scope, input, [], [])
  assert.equal(first.earned_cents, 1000); assert.equal(first.reversal_cents, 1000); assert.equal(first.net_cents, 0)
  assert.deepEqual(first.entries.map(entry => entry.original_salary_record_id), [null, null, null])
  assert.deepEqual(planSettlement(scope, input, [], [{ ...paid(first), status: 'draft', paid_at: null }]), first)
  const zero = planSettlement(scope, facts([sale({ amount_cents: 0, reason: 'points_used' })]), [], [])
  assert.equal(zero.entries.length, 1); assert.equal(zero.entries[0].reason, 'points_used')
})

test('上月已发原提成不再领取，次月退回关联原工资，后续分次只扣未核销部分', () => {
  const october = { ...scope, period_start: '2026-10-01', period_end: '2026-10-31', through: '2026-10-31 23:59:59' }
  const original = paid(planSettlement(october, facts([sale()], october.through), [], []))
  const oldClaims = claimsFor(original), input = facts([sale(), returned()])
  const november = planSettlement(scope, input, oldClaims, [original])
  assert.equal(november.earned_cents, 0); assert.equal(november.net_cents, -334)
  assert.equal(november.entries[0].original_salary_record_id, original.id)
  const second = paid(november, 72), allClaims = [...oldClaims, ...claimsFor(second, 2)]
  assert.deepEqual(planSettlement(scope, input, allClaims, [original, second]).entries, [])
  const last = returned({ source_key: 'goods_return:101', aftersale_id: 301, aftersale_item_id: 101,
    quantity: 2, amount_cents: -666, source_hash: 'c'.repeat(64) })
  const next = planSettlement(scope, facts([sale(), returned(), last]), allClaims, [original, second])
  assert.equal(next.net_cents, -666); assert.equal(next.entries[0].original_salary_record_id, 71)
})

test('未发旧提成在下一期补结，补录按真实录入截止核对，不把未来业务提前计入', () => {
  const future = sale({ order_item_id: 51, source_key: 'goods_sale:51', business_time: '2026-12-01 00:00:00' })
  const december = { ...scope, through: '2026-12-02 00:00:00' }
  const late = returned({ business_time: '2026-10-31 23:59:59', recorded_at: '2026-11-12 10:00:00' })
  const result = planSettlement(december, facts([future, late, sale()], december.through), [], [])
  assert.equal(result.net_cents, 666)
  assert.deepEqual(result.entries.map(entry => entry.source_key), ['goods_sale:50', 'goods_return:100'])
  assert.equal(result.entries[1].recorded_at, '2026-11-12 10:00:00')
})

test('原工资已发快照与核销账必须双向完整，缺行、多行、重复或来源改动明确拒绝', () => {
  const snapshot = planSettlement(scope, facts([sale(), returned()]), [], []), record = paid(snapshot), original = claimsFor(record)
  for (const claims of [original.slice(1), original.slice(0, 1), [...original, original[0]],
    original.map((row, index) => index ? row : { ...row, source_hash: 'c'.repeat(64) }),
    original.map((row, index) => index ? row : { ...row, amount_cents: 999 }),
    original.map((row, index) => index ? row : { ...row, created_at: '2026-11-30 23:59:58' }),
    original.map((row, index) => index ? row : { ...row, source_snapshot: { ...row.source_snapshot, quantity: 2 } })]) {
    assert.throws(() => planSettlement(scope, facts([sale(), returned()]), claims, [record]), conflict)
  }
  assert.throws(() => planSettlement(scope, facts([sale()]), original, [record]), conflict)
  const changed = structuredClone(record); changed.goods_commission_snapshot = readSnapshot(changed.goods_commission_snapshot)
  changed.goods_commission_snapshot.entries[0].source_hash = 'd'.repeat(64)
  assert.throws(() => planSettlement(scope, facts([sale(), returned()]), original, [changed]), conflict)
})

test('有账无已发工资、员工错配、原工资或周期损坏，不伪装成可重新领取', () => {
  const snapshot = planSettlement(scope, facts([sale(), returned()]), [], []), record = paid(snapshot), original = claimsFor(record)
  for (const patch of [{ status: 'approved' }, { paid_at: null }, { employee_id: 9 }, { period_end: '2026-11-29' },
    { goods_commission_snapshot: null }, { paid_at: '2026-12-01 00:00:00' }]) {
    assert.throws(() => planSettlement(scope, facts([sale(), returned()]), original, [{ ...record, ...patch }]), conflict)
  }
  assert.throws(() => planSettlement(scope, facts([sale(), returned()]), original, []), conflict)
  for (const patch of [{ employee_id: 9 }, { salary_record_id: 72 }, { original_salary_record_id: 72 }]) {
    const claims = original.map((row, index) => index ? { ...row, ...patch } : row)
    assert.throws(() => planSettlement(scope, facts([sale(), returned()]), claims, [record]), conflict)
  }
})

test('孤立冲回、退货时间倒置及原来源编号不一致不能扣员工工资', () => {
  for (const entries of [[returned()], [sale(), returned({ order_id: 11 })],
    [sale(), returned({ accessory_sale_id: 21 })], [sale(), returned({ business_time: '2026-10-19 00:00:00' })],
    [sale(), returned({ recorded_at: '2026-10-20 12:00:59' })]]) {
    assert.throws(() => planSettlement(scope, facts(entries), [], []), conflict)
  }
})

test('JSON键重排不触发重算，来源或原工资变化触发；核对时钟不可倒退', () => {
  const first = planSettlement(scope, facts([sale(), returned()]), [], [])
  const reordered = JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(first).reverse())))
  reordered.entries = reordered.entries.map(entry => Object.fromEntries(Object.entries(entry).reverse()))
  assert.equal(sameSettlement(first, reordered), true)
  assert.equal(sameSettlement(first, { ...reordered, through: '2026-12-01 00:00:00' }), true)
  assert.equal(sameSettlement(first, { ...reordered, through: '2026-11-30 23:59:58' }), false)
  const changed = structuredClone(first); changed.entries[1].original_salary_record_id = 72
  assert.equal(sameSettlement(first, changed), false)
})

test('非法真实日期、数值、损坏快照及汇总溢出拒绝，BIGINT安全整数保留', () => {
  for (const patch of [{ employee_id: true }, { period_start: '2026-02-30' }, { period_end: 'bad' },
    { through: '2026-11-31 00:00:00' }, { through: '2026-11-30 24:00:00' }, { period_start: '2026-12-01' }]) {
    assert.throws(() => planSettlement({ ...scope, ...patch }, facts([sale()]), [], []), conflict)
  }
  for (const patch of [{ quantity: 1.5 }, { amount_cents: '1000' }, { source_key: 'goods_sale:51' },
    { order_id: '9007199254740993' }, { source_hash: 'bad' }, { business_time: '2026-02-30 00:00:00' }]) {
    assert.throws(() => planSettlement(scope, facts([sale(patch)]), [], []), conflict)
  }
  for (const value of [null, [], 'null', '{}', '{bad']) assert.throws(() => readSnapshot(value), conflict)
  const large = sale({ order_item_id: 2147483648, source_key: 'goods_sale:2147483648' })
  assert.equal(planSettlement(scope, facts([large]), [], []).entries[0].order_item_id, 2147483648)
  assert.throws(() => planSettlement(scope, facts([sale({ amount_cents: Number.MAX_SAFE_INTEGER }), large]), [], []), conflict)
})

const fixture = (initial = {}) => {
  let state = { entries: [sale(), returned()], claims: [], records: [], ...initial }
  const queries = [], connection = {}, writes = []
  let insertFailure = null
  connection.execute = async (sql, params) => {
    const text = sql.replace(/\s+/g, ' ').trim(); queries.push({ sql: text, params })
    if (text.startsWith('INSERT')) {
      if (insertFailure) throw insertFailure
      const [employee_id, salary_record_id, original_salary_record_id, source_key, source_hash, amount_cents, snapshot, created_at] = params
      if (state.claims.some(row => row.source_key === source_key)) throw Object.assign(new Error('duplicate'), { code: 'ER_DUP_ENTRY' })
      const row = { id: state.claims.length + 1, employee_id, salary_record_id, original_salary_record_id,
        source_key, source_hash, amount_cents, source_snapshot: JSON.parse(snapshot), created_at }
      state.claims.push(row); writes.push({ ...row, created_at }); return [{ affectedRows: 1 }]
    }
    if (text.includes('WHERE source_key IN')) return [structuredClone(state.claims.filter(row => params.includes(row.source_key)))]
    const [employeeId, sameEmployee, afterId, size] = params
    assert.equal(sameEmployee, employeeId)
    if (text.includes('FROM salary_records sr')) return [structuredClone(state.records.filter(row => Number(row.id) > afterId &&
      (row.employee_id === employeeId && row.goods_commission_snapshot !== null || state.claims.some(claim => claim.salary_record_id === row.id && claim.employee_id === employeeId))).slice(0, size))]
    return [structuredClone(state.claims.filter(row => row.id > afterId && (row.employee_id === employeeId ||
      state.records.some(record => record.id === row.salary_record_id && record.employee_id === employeeId))).slice(0, size))]
  }
  const sourceService = { async readSources(conn, employeeId, through) {
    assert.equal(conn, connection); assert.equal(employeeId, 8)
    return facts(structuredClone(state.entries), through)
  } }
  const service = new Service({ repository: new Repository(), sources: sourceService, batchSize: 1,
    tableExists: async (_table, conn) => { assert.equal(conn, connection); return true },
    columnExists: async (_table, _column, conn) => { assert.equal(conn, connection); return true } })
  return { connection, service, queries, writes, get state() { return state }, failInsert(error) { insertFailure = error },
    async transaction(operation) {
      const before = structuredClone(state)
      try { return await operation(connection) } catch (error) { state = before; throw error }
    } }
}

test('持有同连接分批读完原工资和核销来源；按来源额外核查跨员工错归，不重复计账', async () => {
  const snapshot = planSettlement(scope, facts([sale(), returned()]), [], []), record = paid(snapshot)
  const f = fixture({ records: [record], claims: claimsFor(record) })
  const result = await f.service.prepare(f.connection, scope)
  assert.equal(result.net_cents, 0); assert.deepEqual(result.entries, [])
  const pages = f.queries.filter(query => query.sql.includes('FROM salary_goods_settlements l LEFT JOIN'))
  assert.deepEqual(pages.map(query => query.params[2]), [0, 1, 2])
  assert.equal(f.writes.length, 0)
  f.state.claims[0].employee_id = 9; f.state.records[0].employee_id = 9
  await assert.rejects(f.service.prepare(f.connection, scope), conflict)
})

test('两期草稿不占用来源，先发一期后另一草稿必须重算，不能静默改工资再发', async () => {
  const f = fixture(), first = await f.service.prepare(f.connection, scope)
  const nextScope = { ...scope, period_start: '2026-12-01', period_end: '2026-12-31', through: '2026-12-31 23:59:59' }
  const second = await f.service.prepare(f.connection, nextScope)
  const draft = { ...paid(second, 72), status: 'approved', paid_at: null }
  const current = { ...paid(first), status: 'approved', paid_at: null }
  const confirmed = await f.service.confirm(f.connection, current, scope.through)
  await f.transaction(async conn => {
    const record = paid(first); f.state.records.push(record)
    assert.equal(await f.service.append(conn, record, confirmed), 2)
  })
  assert.equal(f.state.claims[1].original_salary_record_id, 71)
  await assert.rejects(f.service.confirm(f.connection, draft, nextScope.through), { code: 'SALARY_GOODS_RECALCULATION_REQUIRED' })
  assert.equal(f.state.claims.length, 2)
  assert.equal((await f.service.prepare(f.connection, nextScope)).net_cents, 0)
})

test('首次发放追加唯一来源，重复追加拒绝；中途失败由原工资事务整体回滚', async () => {
  const f = fixture(), snapshot = await f.service.prepare(f.connection, scope), record = paid(snapshot)
  const confirmed = readSnapshot(record.goods_commission_snapshot)
  await f.transaction(async conn => { f.state.records.push(record); await f.service.append(conn, record, confirmed) })
  await assert.rejects(f.transaction(conn => f.service.append(conn, record, confirmed)), conflict)
  assert.equal(f.state.claims.length, 2)
  const broken = fixture(), originalAppend = broken.service.repository.append.bind(broken.service.repository)
  broken.service.repository.append = async (...args) => {
    if (broken.state.claims.length) throw new Error('second-insert-failed')
    return originalAppend(...args)
  }
  await assert.rejects(broken.transaction(async conn => {
    broken.state.records.push(record); await broken.service.append(conn, record, confirmed)
  }), /second-insert-failed/)
  assert.deepEqual(broken.state.claims, []); assert.deepEqual(broken.state.records, [])
})

test('保存后新增售后、来源哈希或归属变化拒绝发放，草稿不允许直接追加账', async () => {
  const f = fixture({ entries: [sale()] }), saved = await f.service.prepare(f.connection, scope)
  const record = { ...paid(saved), status: 'approved', paid_at: null }
  f.state.entries.push(returned())
  await assert.rejects(f.service.confirm(f.connection, record, scope.through), { code: 'SALARY_GOODS_RECALCULATION_REQUIRED' })
  await assert.rejects(f.service.append(f.connection, record, saved), conflict)
  await assert.rejects(f.service.confirm(f.connection, { ...record, employee_id: 9 }, scope.through), conflict)
  await assert.rejects(f.service.append(f.connection, { ...paid(saved), paid_at: 'bad' }, saved), conflict)
  assert.equal(f.writes.length, 0)
})

test('结构缺失明确409且不查业务、不执行DDL；分页重复和读取中变化也拒绝', async () => {
  for (const missing of ['tableExists', 'columnExists']) {
    const f = fixture(); f.service[missing] = async () => false
    await assert.rejects(f.service.prepare(f.connection, scope), { code: 'SALARY_GOODS_SETTLEMENT_NOT_READY' })
    assert.deepEqual(f.queries, [])
  }
  const f = fixture()
  f.service.repository.employeeClaims = async () => [{ id: 1 }]
  await assert.rejects(f.service.prepare(f.connection, scope), conflict)
  const snapshot = planSettlement(scope, facts([sale(), returned()]), [], []), record = paid(snapshot)
  const changed = fixture({ records: [record], claims: claimsFor(record) })
  changed.service.repository.sourceClaims = async () => [{ ...changed.state.claims[0], amount_cents: 1001 }]
  await assert.rejects(changed.service.prepare(changed.connection, scope), conflict)
})
