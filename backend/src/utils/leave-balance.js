const { parseLocalDate, formatLocalDate } = require('./time')

function monthKey(date) {
  const parsed = parseLocalDate(date)
  return parsed ? `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}` : null
}

function monthStart(key) {
  const [year, month] = key.split('-').map(Number)
  return new Date(year, month - 1, 1)
}

function shiftMonth(key, amount) {
  const date = monthStart(key)
  date.setMonth(date.getMonth() + amount)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function listMonths(startKey, endKey) {
  const months = []
  let current = startKey
  while (current <= endKey) {
    months.push(current)
    current = shiftMonth(current, 1)
  }
  return months
}

/**
 * 按自然月计算带薪休假余额。
 * carry_in 是进入本月时仍可使用的上月额度；总额度上限为月额度的两倍。
 */
function buildMonthlyLeaveBalances({ monthlyLimit, monthlyUsage, startDate, endDate }) {
  const limit = Math.max(0, Number(monthlyLimit) || 0)
  const startKey = monthKey(startDate)
  const endKey = monthKey(endDate || startDate)
  if (!startKey || !endKey || startKey > endKey) return []

  const balances = []
  let credits = []
  const usageMonths = Object.keys(monthlyUsage || {}).filter(key => key <= endKey).sort()
  const priorMonthKey = shiftMonth(startKey, -1)
  const calculationStart = usageMonths.length > 0 && usageMonths[0] < priorMonthKey
    ? usageMonths[0]
    : priorMonthKey

  for (const key of listMonths(calculationStart, endKey)) {
    const usage = monthlyUsage?.[key] || {}
    const paidUsed = Math.max(0, Number(usage.paidUsed) || 0)
    const unpaidUsed = Math.max(0, Number(usage.unpaidUsed) || 0)
    const previousMonthUsage = monthlyUsage?.[shiftMonth(key, -1)] || {}
    if (Number(previousMonthUsage.unpaidUsed) > 0) credits = []
    const earliestValidMonth = shiftMonth(key, -1)
    credits = credits.filter(credit => credit.month >= earliestValidMonth)
    const carryIn = credits.reduce((sum, credit) => sum + credit.remaining, 0)
    credits.push({ month: key, remaining: limit })

    let usageRemaining = paidUsed
    // 先使用即将过期的上月额度，避免较新的当月额度被错误消耗。
    for (const credit of credits) {
      const used = Math.min(credit.remaining, usageRemaining)
      credit.remaining -= used
      usageRemaining -= used
      if (usageRemaining <= 0) break
    }

    const availableBeforeRequest = credits.reduce((sum, credit) => sum + credit.remaining, 0)
    const currentCredit = credits.find(credit => credit.month === key)
    const carryOut = unpaidUsed > 0 ? 0 : Math.max(0, currentCredit?.remaining || 0)
    const balance = {
      month: key,
      monthly_limit: limit,
      carry_in: carryIn,
      paid_used: paidUsed,
      unpaid_used: unpaidUsed,
      available: availableBeforeRequest,
      carry_out: carryOut,
      quota: carryIn + limit
    }

    balances.push(balance)
  }

  return balances
}

module.exports = {
  buildMonthlyLeaveBalances,
  monthKey,
  shiftMonth,
  formatLocalDate
}
