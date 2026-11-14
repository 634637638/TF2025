'use strict'

const MAX_POINTS = 2147483647
const MAX_RECOVERY_CENTS = MAX_POINTS * 100
const integer = (value, min = 0, max = MAX_POINTS) => Number.isSafeInteger(value) && value >= min && value <= max
const reject = message => { throw Object.assign(new Error(message), { statusCode: 409, code: 'POINTS_AFTERSALE_FACTS_CONFLICT' }) }
const rangePoints = range => range.end - range.start
const sumPoints = ranges => ranges.reduce((sum, range) => sum + rangePoints(range), 0)
const sourceMatches = (credit, source) => credit.source_type === source.source_type && Number(credit.source_id) === Number(source.source_id)

/** 按原抵扣的全局位置计算分币；不能按各来源当前兑换比例或局部均价重算。 */
const rangeAmount = (allocation, start, end) => {
  const value = position => BigInt(allocation.debit_amount_cents) * BigInt(allocation.offset + position) / BigInt(-allocation.debit_points)
  return Number(value(end) - value(start))
}
const recoveredAmount = (allocation, start, end) => allocation.recoveries.reduce((sum, range) => {
  const left = Math.max(start, range.start), right = Math.min(end, range.end)
  return sum + (right > left ? rangeAmount(allocation, left, right) : 0)
}, 0)
const recoveredPoints = (allocation, start, end) => allocation.recoveries.reduce((sum, range) =>
  sum + Math.max(0, Math.min(end, range.end) - Math.max(start, range.start)), 0)
const snapshot = value => {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) &&
      integer(parsed.available_points) && Array.isArray(parsed.ranges)) return parsed
  } catch { /* 售后原始凭据损坏时拒绝重造。 */ }
  reject('积分售后分配凭据异常')
}

/** 重放追加的售后事实。原奖励/消费/分配均保留，返还沿用原来源，不生成新奖励。 */
const foldPointsAftersales = (credits, rows, aftersales, customerId) => {
  const byId = new Map(credits.map(row => [row.id, row])), allocations = new Map(), redemptions = new Map()
  for (const row of rows) {
    const credit = byId.get(Number(row.credit_entry_id)), points = Number(row.points)
    if (!credit || !integer(points, 1) || !['revoke', 'redeem'].includes(row.entry_type)) reject('积分分配记录异常')
    credit.available -= points
    if (row.entry_type !== 'redeem') continue
    const allocation = { ...row, id: Number(row.id), points, debit_entry_id: Number(row.debit_entry_id),
      debit_points: Number(row.debit_points), debit_amount_cents: Number(row.debit_amount_cents),
      amount_cents: Number(row.amount_cents), points_per_yuan: Number(row.points_per_yuan),
      redemption_item_id: Number(row.redemption_item_id), credit, returned: 0, recoveries: [] }
    if (!integer(allocation.id, 1, Number.MAX_SAFE_INTEGER) || allocations.has(allocation.id) ||
      Number(row.debit_customer_id) !== customerId || !integer(allocation.debit_entry_id, 1, Number.MAX_SAFE_INTEGER) ||
      !integer(allocation.redemption_item_id, 1, Number.MAX_SAFE_INTEGER) || !integer(-allocation.debit_points, 1) ||
      row.debit_amount_cents === null || !integer(allocation.debit_amount_cents, 1, 9999999999) ||
      row.amount_cents === null || !integer(allocation.amount_cents, 0, 9999999999) ||
      !integer(allocation.points_per_yuan, 1, 1000000) ||
      BigInt(-allocation.debit_points) * 100n !== BigInt(allocation.debit_amount_cents) * BigInt(allocation.points_per_yuan)) reject('积分消费原分配凭据异常')
    const group = redemptions.get(allocation.redemption_item_id) || []
    group.push(allocation); redemptions.set(allocation.redemption_item_id, group)
    allocations.set(allocation.id, allocation)
    credit.spent += points
  }
  for (const group of redemptions.values()) {
    group.sort((a, b) => a.id - b.id)
    let offset = 0
    const first = group[0]
    for (const allocation of group) {
      allocation.offset = offset
      if (allocation.debit_entry_id !== first.debit_entry_id || allocation.debit_points !== first.debit_points ||
        allocation.debit_amount_cents !== first.debit_amount_cents || allocation.points_per_yuan !== first.points_per_yuan ||
        allocation.amount_cents !== rangeAmount(allocation, 0, allocation.points)) reject('积分消费原金额分配不守恒')
      offset += allocation.points
    }
    if (offset !== -first.debit_points) reject('积分消费原数量分配不守恒')
  }
  const keys = new Set()
  for (const row of aftersales) {
    const fact = snapshot(row.allocation_snapshot), points = Number(row.points), delta = Number(row.balance_delta), amount = Number(row.amount_cents)
    if (Number(row.customer_id) !== customerId || !integer(points, 1) || !Number.isSafeInteger(delta) || Math.abs(delta) > points ||
      !integer(amount, 0, MAX_RECOVERY_CENTS) || !integer(Number(row.balance_after)) || keys.has(row.request_key) ||
      !['phone_sale', 'checkout_item'].includes(row.source_type) || !integer(Number(row.source_id), 1, Number.MAX_SAFE_INTEGER)) reject('积分售后凭据异常')
    keys.add(row.request_key)
    let expectedAmount = 0, returnedRecovered = 0
    const seen = new Set()
    for (const range of fact.ranges) {
      const allocation = allocations.get(range?.allocation_id)
      if (!allocation || seen.has(allocation.id) || !integer(range.start) || !integer(range.end, 1) ||
        range.start >= range.end || range.end > allocation.points) reject('积分售后原分配区间异常')
      seen.add(allocation.id)
      if (row.operation_type === 'award_return') {
        const start = Math.max(allocation.returned, allocation.recoveries.at(-1)?.end || 0)
        if (!sourceMatches(allocation.credit, row) || range.start !== start) reject('积分奖励重复追回或来源不符')
        allocation.recoveries.push(range)
        allocation.credit.spent -= rangePoints(range)
        expectedAmount += rangeAmount(allocation, range.start, range.end)
      } else if (row.operation_type === 'redemption_return') {
        if (row.source_type !== 'checkout_item' || Number(row.source_id) !== allocation.redemption_item_id ||
          range.start !== allocation.returned || redemptions.get(allocation.redemption_item_id).find(part => part.returned < part.points) !== allocation) reject('商品抵扣积分重复返还或原单不符')
        const recovered = recoveredPoints(allocation, range.start, range.end)
        returnedRecovered += recovered
        expectedAmount += recoveredAmount(allocation, range.start, range.end)
        allocation.credit.available += rangePoints(range) - recovered
        allocation.credit.spent -= rangePoints(range) - recovered
        allocation.returned = range.end
      } else reject('积分售后类型异常')
    }
    if (row.operation_type === 'award_return') {
      const own = credits.filter(credit => sourceMatches(credit, row))
      // 可用来源同样FIFO分摊；后续消费可能重用已返积分，最终统一校验余额。
      if (!own.length || points !== fact.available_points + sumPoints(fact.ranges) || delta !== -fact.available_points) reject('奖励积分追回数量不守恒')
      let remaining = fact.available_points
      const revoked = fact.available_allocations
      if (!Array.isArray(revoked)) reject('奖励积分原来源冲回凭据缺失')
      const ids = new Set()
      for (const part of revoked) {
        const credit = byId.get(part?.credit_entry_id)
        if (!credit || !sourceMatches(credit, row) || ids.has(credit.id) || !integer(part.points, 1)) reject('奖励积分原来源冲回凭据异常')
        ids.add(credit.id); credit.available -= part.points; remaining -= part.points
      }
      if (remaining !== 0) reject('奖励积分原来源冲回数量不守恒')
    } else if (row.operation_type !== 'redemption_return' || fact.available_points !== 0 ||
      points !== sumPoints(fact.ranges) || delta !== points - returnedRecovered) reject('商品抵扣返还数量不守恒')
    if (amount !== expectedAmount) reject('积分售后金额与原分配不一致')
  }
  for (const credit of credits) if (!integer(credit.available) || !integer(credit.spent) || credit.available + credit.spent > credit.points) reject('积分来源余额不足，不能继续记账')
  return { redemptions, allocations }
}

const planAwardReturn = (state, { sourceType, sourceId, points }) => {
  const own = state.sources.filter(row => sourceMatches(row, { source_type: sourceType, source_id: sourceId }))
  if (points > own.reduce((sum, row) => sum + row.available + row.spent, 0)) reject('原销售剩余可冲回奖励不足，不动用历史余额或其他来源')
  let remaining = points
  const available = []
  for (const credit of own) {
    const take = Math.min(remaining, credit.available)
    if (take) available.push({ credit_entry_id: credit.id, points: take })
    remaining -= take
  }
  const availablePoints = points - remaining, ranges = []
  let amount = 0
  for (const allocation of state.allocations.values()) {
    if (!own.includes(allocation.credit)) continue
    const start = Math.max(allocation.returned, allocation.recoveries.at(-1)?.end || 0)
    const take = Math.min(remaining, allocation.points - start)
    if (take) {
      ranges.push({ allocation_id: allocation.id, start, end: start + take })
      amount += rangeAmount(allocation, start, start + take)
      remaining -= take
    }
  }
  if (remaining) reject('原销售消费去向不足，请核对原单')
  return { balance_delta: availablePoints ? -availablePoints : 0, amount_cents: amount,
    allocation_snapshot: { available_points: availablePoints, available_allocations: available, ranges } }
}

const planRedemptionReturn = (state, { sourceId, points }) => {
  const allocations = state.redemptions.get(sourceId)
  if (!allocations?.length) reject('未找到商品原抵扣分配，不能按现行规则返分')
  if (BigInt(points) * 100n % BigInt(allocations[0].points_per_yuan)) reject('返还积分不能精确兑换到原抵扣金额')
  let remaining = points, recovered = 0, amount = 0
  const ranges = []
  for (const allocation of allocations) {
    const start = allocation.returned, take = Math.min(remaining, allocation.points - start)
    if (take) {
      ranges.push({ allocation_id: allocation.id, start, end: start + take })
      recovered += recoveredPoints(allocation, start, start + take)
      amount += recoveredAmount(allocation, start, start + take)
      remaining -= take
    }
  }
  if (remaining) reject('商品剩余可返还抵扣积分不足')
  return { balance_delta: points - recovered, amount_cents: amount,
    allocation_snapshot: { available_points: 0, ranges } }
}

module.exports = { foldPointsAftersales, planAwardReturn, planRedemptionReturn }
