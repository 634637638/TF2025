'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { quoteCheckoutPoints } = require('../src/utils/checkout-points')
const { quoteCustomerPoints, normalizePointsConfig } = require('../src/utils/customer-points-rules')

const config = (redemption = {}) => normalizePointsConfig({ include_accessories: true,
  redemption: { enabled: true, points_per_yuan: 100, max_percent: 100,
    sources: ['new', 'used', 'accessory'], all_accessory_categories: true, category_ids: [], ...redemption } })
const item = (values = {}) => ({ key: 'goods', source: 'accessory', amount_cents: 10000, quantity: 1,
  is_gift: false, redeem_points: 0, category_id: 2, ...values })
const quote = (items, availablePoints = 1000, rules = config(), balance = availablePoints) =>
  quoteCheckoutPoints({ items, availablePoints, balance, config: rules })
const invalid = operation => assert.throws(operation, { statusCode: 400, code: 'POINTS_RULE_INVALID' })

test('混合手机、数量商品与赠品：抵扣明细不累计，其他明细逐件取整，旧余额独立保留', () => {
  const rules = normalizePointsConfig({ ...config(), new_points_per_100: 2, accessory_points_per_100: 4 })
  const input = [item({ key: 'phone', source: 'new', amount_cents: 100000 }),
    item({ quantity: 3, redeem_points: 300 }), item({ key: 'other', amount_cents: 39900 }),
    item({ key: 'gift', quantity: 50, amount_cents: 0, is_gift: true })]
  const before = structuredClone({ input, rules })
  const result = quote(input, 500, rules, 1000)
  assert.equal(result.points_awarded, 35)
  assert.equal(result.points_used, 300)
  assert.equal(result.deduction_cents, 300)
  assert.equal(result.gross_cents, 169900)
  assert.equal(result.payable_cents, 169600)
  assert.equal(result.balance_after, 735)
  assert.equal(result.lines[1].points_awarded, 0)
  assert.equal(result.lines[3].points_awarded, 0)
  assert.deepEqual({ input, rules }, before)
  result.config_snapshot.redemption.sources.pop()
  assert.deepEqual(rules, before.rules)
})

test('相同数量合并或拆行不增加积分，每件不足1积分不能整行汇总取整', () => {
  const combined = quote([item({ quantity: 3, amount_cents: 9900 })])
  const separate = quote([0, 1, 2].map(index => item({ key: String(index), amount_cents: 9900 })))
  assert.equal(combined.points_awarded, 0)
  assert.equal(combined.points_awarded, separate.points_awarded)
  assert.equal(combined.gross_cents, separate.gross_cents)
  assert.equal(quote([item({ quantity: 3, amount_cents: 19900 })]).points_awarded, 3)
})

test('单行部分商品分到0抵扣时整条明细仍不累计，稳定分摊保留两组逐件事实', () => {
  const result = quote([item({ quantity: 3, redeem_points: 1 })])
  assert.deepEqual(result.lines[0].units, [
    { quantity: 1, points_used: 1, deduction_cents: 1, payable_cents: 9999, points_awarded: 0 },
    { quantity: 2, points_used: 0, deduction_cents: 0, payable_cents: 10000, points_awarded: 0 }
  ])
  assert.equal(result.points_awarded, 0)
  assert.equal(result.points_used, 1)
})

test('兑换按能精确到分的步长逐件分配，不吞不足1分的积分', () => {
  const rules = config({ points_per_yuan: 3, max_percent: 50 })
  const result = quote([item({ quantity: 2, amount_cents: 10000, redeem_points: 9 })], 20, rules)
  assert.deepEqual(result.lines[0].units, [
    { quantity: 1, points_used: 6, deduction_cents: 200, payable_cents: 9800, points_awarded: 0 },
    { quantity: 1, points_used: 3, deduction_cents: 100, payable_cents: 9900, points_awarded: 0 }
  ])
  invalid(() => quote([item({ quantity: 2, redeem_points: 1 })], 20, rules))
})

test('逐件上限独立核对，整行金额足够仍不能让一件商品超过上限', () => {
  const rules = config({ max_percent: 50 })
  assert.equal(quote([item({ quantity: 2, amount_cents: 3, redeem_points: 2 })], 2, rules).deduction_cents, 2)
  invalid(() => quote([item({ quantity: 2, amount_cents: 3, redeem_points: 3 })], 3, rules))
})

test('最多999999件仍只输出两组，积分、金额与数量精确守恒', () => {
  const result = quote([item({ quantity: 999999, amount_cents: 1, redeem_points: 300 })], 300)
  assert.equal(result.lines[0].units.length, 2)
  assert.equal(result.lines[0].units.reduce((sum, unit) => sum + unit.quantity, 0), 999999)
  assert.equal(result.payable_cents, 999699)
  assert.equal(result.points_awarded, 0)
  assert.equal(result.balance_after, 0)
})

test('单件公共规则与数量分摊一致，所有组合保持分值和金额守恒', () => {
  for (const rate of [3, 40, 100, 250]) for (const quantity of [1, 2, 7, 31]) {
    const rules = config({ points_per_yuan: rate })
    const points = rate * 2
    const result = quote([item({ quantity, redeem_points: points })], points, rules)
    const units = result.lines[0].units
    const checks = units.map((unit, index) => ({ unit, calculated: quoteCustomerPoints({ config: rules,
      available_points: unit.points_used, items: [{ ...item(), key: String(index), redeem_points: unit.points_used }] }).lines[0] }))
    for (const { unit, calculated } of checks) {
      assert.equal(unit.deduction_cents, calculated.deduction_cents)
      assert.equal(unit.payable_cents, calculated.payable_cents)
    }
    assert.equal(units.reduce((sum, unit) => sum + unit.quantity * unit.points_used, 0), points)
    assert.equal(units.reduce((sum, unit) => sum + unit.quantity * unit.deduction_cents, 0), 200)
    assert.equal(result.payable_cents + result.deduction_cents, quantity * 10000)
    assert.equal(result.points_awarded, 0)
  }
})

test('临近余额上限时先按整单抵扣再判断最终余额，不逐件重复叠加原余额', () => {
  const max = 2147483647
  const result = quote([item({ key: 'earn' }), item({ key: 'spend', amount_cents: 100, redeem_points: 100 })], max)
  assert.equal(result.balance_after, max - 99)
  invalid(() => quote([item()], 0, config(), max))
  assert.equal(quote([item({ amount_cents: 0, is_gift: true })], 0, config(), max).balance_after, max)
})

test('本单新积分和未追溯余额不能用于本单抵扣，多行合计不可复用同一可用余额', () => {
  invalid(() => quote([item({ key: 'earn', amount_cents: 100000 }), item({ redeem_points: 1 })], 0))
  invalid(() => quote([item({ redeem_points: 1 })], 0, config(), 1000))
  invalid(() => quote([item({ key: 'one', redeem_points: 6 }), item({ key: 'two', redeem_points: 6 })], 10))
})

test('抵扣仍受来源、商品类型、启停和赠品约束，不能以数量绕开公共规则', () => {
  for (const rules of [config({ enabled: false }), config({ sources: ['new'] }),
    config({ all_accessory_categories: false, category_ids: [3] })]) {
    invalid(() => quote([item({ quantity: 5, redeem_points: 1 })], 10, rules))
  }
  invalid(() => quote([item({ amount_cents: 0, is_gift: true, redeem_points: 1 })]))
  invalid(() => quote([item({ is_gift: true })]))
  invalid(() => quote([item({ source: 'repair' })]))
})

test('严格拒绝非法明细、数量、积分和金额，不将空值或部分字符串解析成有效数据', () => {
  for (const row of [null, true, [], 'goods', item({ key: ' ' }), item({ key: 'x'.repeat(101) })]) invalid(() => quote([row]))
  for (const value of [null, '', true, '2', 0, -1, 1.5, 1000000, NaN, Infinity]) invalid(() => quote([item({ quantity: value })]))
  for (const value of [null, '', false, '1', -1, 0.1, 2147483648, NaN, Infinity]) invalid(() => quote([item({ redeem_points: value })]))
  for (const value of [null, '', false, '100', -1, 0.5, 10000000000, NaN, Infinity]) invalid(() => quote([item({ amount_cents: value })]))
  invalid(() => quote([item(), item()]))
  invalid(() => quote([]))
  invalid(() => quote(Array.from({ length: 1001 }, (_, index) => item({ key: String(index) }))))
  assert.equal(quote([{ key: 'default', source: 'accessory', amount_cents: 10000, is_gift: false }]).points_awarded, 1)
})

test('金额、累计积分及账户余额在单件和整单均不越界', () => {
  invalid(() => quote([item({ amount_cents: 5000000000, quantity: 2 })]))
  invalid(() => quote([item({ key: 'a', amount_cents: 5000000000 }), item({ key: 'b', amount_cents: 5000000000 })]))
  for (const value of [-1, 0.5, '1', null, 2147483648, NaN]) invalid(() => quote([item()], value))
  invalid(() => quote([item()], 10, config(), 9))
  invalid(() => quote([item()], 0, config(), 2147483648))
})
