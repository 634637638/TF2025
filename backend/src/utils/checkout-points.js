'use strict'

const { quoteCustomerPoints, normalizePointsConfig } = require('./customer-points-rules')

const invalid = message => { throw Object.assign(new Error(message), { statusCode: 400, code: 'POINTS_RULE_INVALID' }) }
const gcd = (a, b) => b ? gcd(b, a % b) : a

/** 数量明细最多保存两组逐件分摊，不按几十万件展开数组。金额始终使用整数分。 */
const quoteCheckoutPoints = ({ items, availablePoints, balance = availablePoints, config }) => {
  if (!Array.isArray(items) || !items.length || items.length > 1000 || !Number.isSafeInteger(availablePoints) ||
    availablePoints < 0 || availablePoints > 2147483647 || !Number.isSafeInteger(balance) || balance < availablePoints || balance > 2147483647) invalid('可用积分或明细无效')
  const normalized = normalizePointsConfig(config), keys = new Set()
  let used = 0, earned = 0, deduction = 0, gross = 0
  const lines = items.map(row => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) invalid('积分商品明细无效')
    const points = row.redeem_points === undefined ? 0 : row.redeem_points
    const quantity = row.quantity === undefined ? 1 : row.quantity
    if (typeof row.key !== 'string' || !row.key.trim() || row.key.length > 100 || keys.has(row.key) ||
      !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 999999 ||
      !Number.isSafeInteger(points) || points < 0 || points > 2147483647) invalid('积分明细、数量或使用积分无效')
    keys.add(row.key)
    if (!Number.isSafeInteger(row.amount_cents) || row.amount_cents < 0 || row.amount_cents * quantity >= 10000000000) invalid('商品金额无效或超出范围')
    // 每件抵扣须为可兑换到分的整数步长；将步长份数均分，多出的份数按稳定顺序放前面。
    const step = normalized.redemption.points_per_yuan ? normalized.redemption.points_per_yuan / gcd(normalized.redemption.points_per_yuan, 100) : 1
    if (points % step !== 0) invalid('抵扣积分不能精确兑换到分，请调整积分数量')
    const shares = points / step, base = Math.floor(shares / quantity) * step, extra = shares % quantity
    const groups = []
    if (extra) groups.push({ quantity: extra, points: base + step })
    if (quantity > extra) groups.push({ quantity: quantity - extra, points: base })
    let lineEarned = 0, lineDeduction = 0
    const units = groups.map(group => {
      // 单件只核验自己的抵扣量；整单余额在汇总扣分/发分后检查，不能把同一余额重复加到各组。
      const quote = quoteCustomerPoints({ config: normalized, available_points: group.points, items: [{
        key: row.key, source: row.source, amount_cents: row.amount_cents, category_id: row.category_id,
        is_gift: row.is_gift, redeem_points: group.points
      }] }).lines[0]
      lineEarned += points ? 0 : quote.points_awarded * group.quantity
      lineDeduction += quote.deduction_cents * group.quantity
      return { quantity: group.quantity, points_used: group.points, deduction_cents: quote.deduction_cents,
        payable_cents: quote.payable_cents, points_awarded: points ? 0 : quote.points_awarded }
    })
    used += points; earned += lineEarned; deduction += lineDeduction; gross += row.amount_cents * quantity
    if (!Number.isSafeInteger(gross) || gross >= 10000000000 || earned > 2147483647 || used > availablePoints) invalid('只能使用结算前已有积分，可用积分不足或本单金额超出范围')
    return { key: row.key, source: row.source, quantity, gross_cents: row.amount_cents * quantity,
      points_used: points, deduction_cents: lineDeduction, payable_cents: row.amount_cents * quantity - lineDeduction,
      points_awarded: lineEarned, units }
  })
  if (balance - used + earned > 2147483647) invalid('结算后积分余额超出范围')
  return { lines, gross_cents: gross, points_used: used, points_awarded: earned, deduction_cents: deduction,
    payable_cents: gross - deduction, balance_after: balance - used + earned, config_snapshot: normalized }
}

module.exports = { quoteCheckoutPoints }
