'use strict'

const { moneyCents, validId } = require('./sale-input')

const fail = (message, code = 'GOODS_COMMISSION_CONFLICT', statusCode = 409) => {
  throw Object.assign(new Error(message), { statusCode, code })
}
const object = value => value && typeof value === 'object' && !Array.isArray(value)
const sameFields = (actual, expected) => object(actual) && Object.keys(actual).length === Object.keys(expected).length &&
  Object.keys(expected).every(key => actual[key] === expected[key])
const integer = (value, max = 9999999999) => Number.isSafeInteger(value) && value >= 0 && value <= max
const fields = ['version', 'employee_id', 'salary_template_id', 'quantity', 'sale_type', 'paid_cents',
  'purchase_cost_cents', 'points_used', 'rule', 'reason', 'earned_cents']

/** 商品规则只来自工资模板；空配置保留为未配置，不借用手机提成。 */
function normalizeGoodsCommissionRule(value) {
  if (value === null || value === undefined) return null
  let rule
  try { rule = typeof value === 'string' ? JSON.parse(value) : value } catch { /* 统一拒绝损坏规则。 */ }
  const keys = ['enabled', 'type', 'fixed_amount', 'percentage']
  if (!object(rule) || Object.keys(rule).length !== keys.length || keys.some(key => !Object.hasOwn(rule, key)) ||
    typeof rule.enabled !== 'boolean' || !['fixed', 'percentage'].includes(rule.type) ||
    moneyCents(rule.fixed_amount) === null || moneyCents(rule.percentage) === null || moneyCents(rule.percentage) > 10000) {
    fail('商品提成规则无效，请核对工资模板', 'SALARY_GOODS_RULE_INVALID', 400)
  }
  return { enabled: rule.enabled, type: rule.type, fixed_amount: moneyCents(rule.fixed_amount) / 100,
    percentage: moneyCents(rule.percentage) / 100 }
}

/** 成交净额、真实批次成本、实际销售员和规则一同冻结，后续调价/换模板不追改原单。 */
function createGoodsCommission({ employeeId, salaryTemplateId = null, quantity, saleType, paidCents, purchaseCostCents,
  pointsUsed = 0, rule: inputRule }) {
  if (!validId(employeeId) || salaryTemplateId !== null && !validId(salaryTemplateId) ||
    !integer(quantity, 999999) || !quantity || !integer(paidCents) ||
    purchaseCostCents !== null && !integer(purchaseCostCents) || !integer(pointsUsed, 2147483647) ||
    !['sale', 'gift'].includes(saleType) || saleType === 'gift' && (paidCents !== 0 || pointsUsed !== 0)) {
    fail('商品提成原始数量、金额或销售员异常')
  }
  let rule
  try { rule = normalizeGoodsCommissionRule(inputRule) }
  catch { fail('商品提成规则损坏，请核对工资模板') }
  if (rule && salaryTemplateId === null) fail('商品提成规则缺少原工资模板')
  let reason = 'eligible'
  if (!rule) reason = 'not_configured'
  else if (!rule.enabled) reason = 'disabled'
  else if (saleType === 'gift') reason = 'gift'
  else if (pointsUsed) reason = 'points_used'
  else if (purchaseCostCents === null) reason = 'unknown_cost'
  else if (paidCents < purchaseCostCents) reason = 'loss'
  else if (paidCents === purchaseCostCents) reason = 'no_profit'
  let earned = 0n
  if (reason === 'eligible') {
    earned = rule.type === 'fixed'
      ? BigInt(moneyCents(rule.fixed_amount)) * BigInt(quantity)
      : (BigInt(paidCents - purchaseCostCents) * BigInt(moneyCents(rule.percentage)) + 5000n) / 10000n
    if (!earned) reason = 'zero_rate'
  }
  if (earned > 9999999999n) fail('本行商品提成超出金额范围，请核对工资模板')
  return { version: 1, employee_id: Number(employeeId), salary_template_id: salaryTemplateId === null ? null : Number(salaryTemplateId),
    quantity, sale_type: saleType, paid_cents: paidCents, purchase_cost_cents: purchaseCostCents, points_used: pointsUsed,
    rule, reason, earned_cents: Number(earned) }
}

/** 原销售没有提成凭据时保持历史边界；已有凭据逐项重算核验，不能把损坏数据当0。 */
function readGoodsCommission(value, facts) {
  if (value === undefined) return undefined
  if (!object(value) || Object.keys(value).length !== fields.length || fields.some(key => !Object.hasOwn(value, key)) || value.version !== 1) {
    fail('原商品提成凭据异常')
  }
  const expected = createGoodsCommission({ ...facts, salaryTemplateId: value.salary_template_id, rule: value.rule })
  if (fields.some(key => key === 'rule'
    ? value.rule === null ? expected.rule !== null : !sameFields(value.rule, expected.rule)
    : value[key] !== expected[key])) fail('原商品提成与成交事实不一致')
  return expected
}

/** 复用原单0基半开区间；分币按累计占比分摊，普通件/SN分次退回总额严格守恒。 */
function goodsCommissionReturn(commission, ranges) {
  if (commission === undefined) return undefined
  if (!Array.isArray(ranges)) fail('商品提成退回区间异常')
  let previous = -1, quantity = 0, reversed = 0n
  for (const range of ranges) {
    if (!Array.isArray(range) || range.length !== 2 || !range.every(Number.isSafeInteger) ||
      range[0] < 0 || range[0] < previous || range[1] <= range[0] || range[1] > commission.quantity) fail('商品提成退回区间异常')
    quantity += range[1] - range[0]
    reversed += BigInt(commission.earned_cents) * BigInt(range[1]) / BigInt(commission.quantity) -
      BigInt(commission.earned_cents) * BigInt(range[0]) / BigInt(commission.quantity)
    previous = range[1]
  }
  return { version: 1, employee_id: commission.employee_id, salary_template_id: commission.salary_template_id,
    quantity, original_cents: commission.earned_cents, reversal_cents: Number(reversed) }
}

function readGoodsCommissionReturn(value, commission, ranges) {
  const expected = goodsCommissionReturn(commission, ranges)
  if (expected ? !sameFields(value, expected) : value !== undefined) fail('原商品提成冲回凭据不一致')
  return expected
}

module.exports = { normalizeGoodsCommissionRule, createGoodsCommission, readGoodsCommission, goodsCommissionReturn, readGoodsCommissionReturn }
