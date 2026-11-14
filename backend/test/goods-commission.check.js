'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { normalizeGoodsCommissionRule, createGoodsCommission, readGoodsCommission,
  goodsCommissionReturn, readGoodsCommissionReturn } = require('../src/utils/goods-commission')
const { planGoodsReturn } = require('../src/utils/checkout-goods-return')
const Repository = require('../src/repositories/sales-checkout.repository')

const rule = (patch = {}) => ({ enabled: true, type: 'fixed', fixed_amount: 2.5, percentage: 33.33, ...patch })
const facts = (patch = {}) => ({ employeeId: 8, salaryTemplateId: 4, quantity: 3, saleType: 'sale', paidCents: 6000,
  purchaseCostCents: 3000, pointsUsed: 0, rule: rule(), ...patch })
const reordered = value => Object.fromEntries(Object.entries(value).reverse())

test('商品提成规则独立校验按件/利润配置，保留0和两位精度，拒绝隐式强转及未知字段', () => {
  assert.equal(normalizeGoodsCommissionRule(undefined), null)
  assert.equal(normalizeGoodsCommissionRule(null), null)
  assert.deepEqual(normalizeGoodsCommissionRule(JSON.stringify(rule({ fixed_amount: '0', percentage: '12.34' }))),
    rule({ fixed_amount: 0, percentage: 12.34 }))
  for (const value of [false, 'bad', {}, [], rule({ enabled: 1 }), rule({ type: 'sales' }), rule({ percentage: 100.01 }),
    rule({ percentage: 1.001 }), rule({ fixed_amount: '1e2' }), rule({ fixed_amount: true }), rule({ fixed_amount: -1 }),
    rule({ fixed_amount: NaN }), rule({ extra: 1 })]) assert.throws(() => normalizeGoodsCommissionRule(value), { statusCode: 400 })
})

test('按件只乘实际件数，按利润对实际净额减真实采购成本计提并按分四舍五入', () => {
  assert.equal(createGoodsCommission(facts()).earned_cents, 750)
  const value = createGoodsCommission(facts({ rule: rule({ type: 'percentage' }) }))
  assert.equal(value.earned_cents, 1000)
  assert.equal(value.employee_id, 8)
  assert.equal(value.salary_template_id, 4)
  assert.equal(createGoodsCommission(facts({ quantity: 1, paidCents: 101, purchaseCostCents: 100,
    rule: rule({ type: 'percentage', percentage: 50 }) })).earned_cents, 1)
})

test('赠品、任意积分抵扣、未知成本、亏损、零毛利、关闭及零提成不发提成', () => {
  for (const [patch, reason] of [
    [{ saleType: 'gift', paidCents: 0 }, 'gift'], [{ pointsUsed: 1 }, 'points_used'],
    [{ purchaseCostCents: null }, 'unknown_cost'], [{ purchaseCostCents: 6001 }, 'loss'],
    [{ purchaseCostCents: 6000 }, 'no_profit'], [{ rule: rule({ enabled: false }) }, 'disabled'],
    [{ rule: null }, 'not_configured'], [{ rule: rule({ fixed_amount: 0 }) }, 'zero_rate']
  ]) {
    const value = createGoodsCommission(facts(patch))
    assert.equal(value.reason, reason); assert.equal(value.earned_cents, 0)
  }
})

test('非法成交事实或超限提成拒绝，不靠0成本、当前手机规则或丢弃小数继续结算', () => {
  for (const patch of [{ employeeId: 0 }, { employeeId: true }, { salaryTemplateId: null }, { salaryTemplateId: 0 },
    { quantity: 0 }, { quantity: 1.2 }, { paidCents: null }, { purchaseCostCents: undefined }, { purchaseCostCents: -1 },
    { pointsUsed: -1 }, { pointsUsed: '1' }, { saleType: 'gift' }, { rule: rule({ percentage: 101 }) },
    { rule: rule({ fixed_amount: 99999999.99 }) }]) assert.throws(() => createGoodsCommission(facts(patch)), { statusCode: 409 })
})

test('快照从原单核验，兼容MySQL JSON键重排；规则、成交额、成本、销售员等篡改均拒绝', () => {
  const input = facts(), original = createGoodsCommission(input)
  const value = reordered({ ...original, rule: reordered(original.rule) })
  assert.deepEqual(readGoodsCommission(value, input), original)
  for (const key of ['employee_id', 'quantity', 'paid_cents', 'purchase_cost_cents', 'points_used', 'earned_cents']) {
    const changed = { ...original, [key]: original[key] + 1 }
    assert.throws(() => readGoodsCommission(changed, input), { statusCode: 409 })
  }
  assert.equal(readGoodsCommission(original, { ...input, salaryTemplateId: 99 }).salary_template_id, 4)
  for (const changed of [null, {}, { ...original, version: 2 }, { ...original, reason: 'disabled' },
    { ...original, extra: 1 }, { ...original, rule: { ...original.rule, fixed_amount: 10 } }]) {
    assert.throws(() => readGoodsCommission(changed, input), { statusCode: 409 })
  }
  assert.equal(readGoodsCommission(undefined, {}), undefined)
})

test('部分退回按原单位置分配分币，SN任意顺序最终严格冲回原提成，不读取新模板', () => {
  const original = createGoodsCommission(facts({ rule: rule({ type: 'percentage' }) }))
  const reverse = ranges => goodsCommissionReturn(original, ranges)
  assert.equal(reverse([[2, 3]]).reversal_cents, 334)
  assert.equal(reverse([[0, 1]]).reversal_cents, 333)
  assert.equal(reverse([[1, 2]]).reversal_cents, 333)
  assert.equal(reverse([[0, 1], [2, 3]]).reversal_cents, 667)
  assert.equal(reverse([[0, 3]]).reversal_cents, original.earned_cents)
  assert.equal(reverse([]).reversal_cents, 0)
  assert.deepEqual(readGoodsCommissionReturn(reordered(reverse([[0, 1]])), original, [[0, 1]]), reverse([[0, 1]]))
  for (const ranges of [[[0, 2], [1, 3]], [[2, 3], [0, 1]], [[0, 4]], [[0, 0]], [[-1, 1]], [[0, 1.5]], null]) {
    assert.throws(() => reverse(ranges), { statusCode: 409 })
  }
  assert.throws(() => readGoodsCommissionReturn({ ...reverse([[0, 1]]), reversal_cents: 334 }, original, [[0, 1]]), { statusCode: 409 })
  assert.equal(goodsCommissionReturn(undefined, [[0, 1]]), undefined)
  assert.throws(() => readGoodsCommissionReturn(reverse([[0, 1]]), undefined, [[0, 1]]), { statusCode: 409 })
})

test('售后规划复用原SN区间，核验已冲回数量/金额，不对旧单补造商品提成', () => {
  const commission = createGoodsCommission(facts({ rule: rule({ type: 'percentage' }) }))
  const row = { item_id: 50, quantity: 3, unit_price: 20, total_amount: 60, purchase_cost: 30, sale_operator_id: 8, points_awarded: 0,
    snapshot: { sale_type: 'sale', points_used: 0, serial_numbers: ['SN1', 'SN2', 'SN3'], commission } }
  const first = planGoodsReturn(row, [], 1, ['SN3'])
  assert.equal(first.commission_return.reversal_cents, 334)
  const history = [{ quantity: 1, fact_snapshot: { unit_ranges: first.unit_ranges, serial_numbers: ['SN3'], commission_return: first.commission_return } }]
  const second = planGoodsReturn(row, history, 2, ['SN1', 'SN2'])
  assert.equal(second.commission_return.reversal_cents, 666)
  assert.throws(() => planGoodsReturn(row, [{ ...history[0], fact_snapshot: { ...history[0].fact_snapshot, commission_return: undefined } }], 1, ['SN1']), { statusCode: 409 })
  const legacy = structuredClone(row); delete legacy.snapshot.commission
  assert.equal(planGoodsReturn(legacy, [], 1, ['SN1']).commission_return, undefined)
  const unknown = structuredClone(row)
  unknown.purchase_cost = null
  unknown.snapshot.commission = createGoodsCommission(facts({ purchaseCostCents: null }))
  assert.equal(planGoodsReturn(unknown, [], 1, ['SN1']).commission_return.reversal_cents, 0)
  for (const cost of [undefined, 'bad', -1, '1.001', true]) {
    assert.throws(() => planGoodsReturn({ ...unknown, purchase_cost: cost }, [], 1, ['SN1']), { code: 'GOODS_COMMISSION_CONFLICT' })
  }
})

test('商品规则从实际销售员工资模板同连接读取，未配模板或未升级字段保持未配置，缺模板拒绝', async () => {
  const queries = [], repo = new Repository()
  let user = { id: 8, name: '原销售员', salary_template_id: 4 }, templates = [{ id: 4, goods_commission_rule: rule(), base_salary: 9999 }]
  const connection = { async execute(sql, params) { queries.push({ sql, params }); return [sql.includes('FROM users') ? user ? [user] : [] : templates] } }
  const seller = await repo.seller(connection, 8)
  assert.deepEqual(seller.goods_commission_rule, rule()); assert.equal(seller.base_salary, undefined)
  assert.equal(queries.length, 2); assert.deepEqual(queries.map(row => row.params), [[8], [4]])
  templates = [{ id: 4 }]
  assert.equal((await repo.seller(connection, 8)).goods_commission_rule, null)
  templates = []; await assert.rejects(repo.seller(connection, 8), { statusCode: 409 })
  user = { ...user, salary_template_id: null }; queries.length = 0
  assert.equal((await repo.seller(connection, 8)).goods_commission_rule, null); assert.equal(queries.length, 1)
  user = null; assert.equal(await repo.seller(connection, 8), null)
})
