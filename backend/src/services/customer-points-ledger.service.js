'use strict'

const CustomerPointsLedgerRepository = require('../repositories/customer-points-ledger.repository')
const { hasTable } = require('./schema-inspector.service')
const { createHash } = require('node:crypto')
const { foldPointsAftersales, planAwardReturn, planRedemptionReturn } = require('../utils/customer-points-aftersale')

const MAX_POINTS = 2147483647
const integer = (value, min = 0, max = MAX_POINTS) => Number.isSafeInteger(value) && value >= min && value <= max
const reject = (message, code = 'POINTS_LEDGER_INVALID', statusCode = 409) => {
  throw Object.assign(new Error(message), { statusCode, code })
}
const validSource = source => ['phone_sale', 'checkout_item'].includes(source.sourceType) && integer(source.sourceId, 1, Number.MAX_SAFE_INTEGER)
const allocatedByCredit = state => {
  const totals = new Map()
  for (const row of state.allocations.values()) {
    const total = (totals.get(row.credit.id) || 0) + row.points
    if (!integer(total, 0, Number.MAX_SAFE_INTEGER)) reject('积分来源历史分配超出可核对范围')
    totals.set(row.credit.id, total)
  }
  return totals
}

/** 来源/去向账不持有第二份余额，不开启或提交事务，不按当前规则重造历史来源。 */
class CustomerPointsLedgerService {
  constructor({ repository = new CustomerPointsLedgerRepository(), tableExists = hasTable } = {}) {
    Object.assign(this, { repository, tableExists })
  }

  async ready(executor) {
    if (!executor || typeof executor.execute !== 'function') reject('积分记账必须使用原业务事务连接', 'POINTS_TRANSACTION_REQUIRED', 400)
    const entries = await this.tableExists('customer_points_entries', executor)
    const allocations = await this.tableExists('customer_points_allocations', executor)
    if (entries !== allocations) reject('积分来源账仅迁移了一部分，请完成结构迁移', 'POINTS_LEDGER_SCHEMA_INCOMPLETE')
    if (!entries && await this.tableExists('customer_points_aftersales', executor)) reject('积分售后账存在但原来源账缺失，请核对结构', 'POINTS_LEDGER_SCHEMA_INCOMPLETE')
    return entries && allocations
  }

  async state(executor, customerId) {
    if (!integer(customerId, 1)) reject('客户ID无效', 'POINTS_LEDGER_INVALID', 400)
    const customer = await this.repository.customer(executor, customerId)
    if (!customer || customer.points === null || !integer(Number(customer.points))) reject('客户积分余额异常')
    const credits = await this.repository.credits(executor, customerId)
    const allocations = await this.repository.allocations(executor, customerId)
    const byId = new Map()
    for (const row of credits) {
      if (!integer(Number(row.id), 1, Number.MAX_SAFE_INTEGER) || !integer(Number(row.points), 1) || byId.has(Number(row.id)) ||
        !validSource({ sourceType: row.source_type, sourceId: Number(row.source_id) })) reject('积分来源记录异常')
      byId.set(Number(row.id), { ...row, id: Number(row.id), points: Number(row.points), available: Number(row.points), spent: 0 })
    }
    const aftersales = await this.tableExists('customer_points_aftersales', executor)
      ? await this.repository.aftersales(executor, customerId) : []
    const folded = foldPointsAftersales([...byId.values()], allocations, aftersales, customerId)
    const sources = [...byId.values()].sort((a, b) => a.id - b.id)
    const tracked = sources.reduce((sum, row) => sum + row.available, 0)
    const balance = Number(customer.points)
    if (!integer(tracked) || tracked > balance) reject('客户积分与来源账不一致，请核对调整记录', 'POINTS_LEDGER_MISMATCH')
    return { balance, tracked, untracked: balance - tracked, sources, ...folded,
      returnedSources: new Set(aftersales.filter(row => row.operation_type === 'award_return').map(row => `${row.source_type}:${row.source_id}`)) }
  }

  /** 用于本单发分之前留存截止点；后续发出的积分不进入本单可消费来源。 */
  async snapshot(executor, customerId, { preserveSources = false } = {}) {
    if (!await this.ready(executor)) reject('积分来源追踪尚未迁移，不能抵扣', 'POINTS_LEDGER_NOT_READY')
    const state = await this.state(executor, customerId)
    const allocated = preserveSources ? allocatedByCredit(state) : null
    return { customer_id: customerId, available_points: state.tracked, balance: state.balance,
      credit_cutoff_id: state.sources.at(-1)?.id || 0,
      ...(allocated ? { source_limits: state.sources.map(row => ({ id: row.id, available: row.available, allocated: allocated.get(row.id) || 0 })) } : {}) }
  }

  /** 返回false仅表示两张账表均未安装，供未启用抵扣的旧累计流程分阶段升级。 */
  async applyDelta(executor, { customerId, delta, sourceType, sourceId, details = {} }) {
    if (!integer(customerId, 1) || !Number.isSafeInteger(delta) || Math.abs(delta) > MAX_POINTS || !validSource({ sourceType, sourceId })) reject('积分来源或变动参数无效', 'POINTS_LEDGER_INVALID', 400)
    if (!await this.ready(executor)) return false
    if (!delta) return true
    const state = await this.state(executor, customerId)
    const repo = this.repository
    if (state.returnedSources.has(`${sourceType}:${sourceId}`)) reject('原销售已办理积分售后，不能再通过旧编辑或冲回路径改账', 'POINTS_AFTERSALE_SOURCE_LOCKED')
    if (delta > 0) {
      if (!integer(state.balance + delta)) reject('客户积分余额超出范围')
      await repo.setBalance(executor, customerId, state.balance, state.balance + delta)
      await repo.append(executor, { customer_id: customerId, entry_type: 'award', source_type: sourceType,
        source_id: sourceId, points: delta, balance_after: state.balance + delta, source_snapshot: details })
      return true
    }
    const own = state.sources.filter(row => row.source_type === sourceType && Number(row.source_id) === sourceId)
    const available = own.reduce((sum, row) => sum + row.available, 0)
    if (-delta > available && own.some(row => row.spent > 0)) reject('原销售奖励积分已抵扣，须通过售后核对优惠追回', 'POINTS_RECOVERY_REQUIRED')
    // 未追溯的老凭据继续按旧规则最低归零；只可动其未追溯余额，不占用其他新单的来源积分。
    const revoked = Math.min(-delta, state.balance)
    if (revoked > available + state.untracked) reject('原销售缺少可追回积分来源，请核对历史余额', 'POINTS_BASELINE_REQUIRED')
    if (!revoked) return true
    const allocated = Math.min(revoked, available)
    await repo.setBalance(executor, customerId, state.balance, state.balance - revoked)
    const entryId = await repo.append(executor, { customer_id: customerId, entry_type: 'revoke', source_type: sourceType,
      source_id: sourceId, points: -revoked, untracked_points: revoked - allocated, balance_after: state.balance - revoked,
      source_snapshot: details })
    let remaining = allocated
    for (const credit of own) {
      const points = Math.min(remaining, credit.available)
      if (points) await repo.allocate(executor, { debit_entry_id: entryId, credit_entry_id: credit.id, points })
      remaining -= points
      if (!remaining) break
    }
    return true
  }

  /** 内部结算能力：必须先试算，再传本单发分前的服务端快照；当前不提供直接HTTP扣分入口。 */
  async consume(executor, { customerId, points, amountCents, pointsPerYuan, itemId, snapshot }) {
    if (!integer(customerId, 1) || !integer(points, 1) || !integer(amountCents, 1, 9999999999) ||
      !integer(pointsPerYuan, 1, 1000000) || !integer(itemId, 1, Number.MAX_SAFE_INTEGER) ||
      !snapshot || snapshot.customer_id !== customerId || !integer(snapshot.available_points) ||
      !integer(snapshot.credit_cutoff_id, 0, Number.MAX_SAFE_INTEGER) || BigInt(points) * 100n !== BigInt(amountCents) * BigInt(pointsPerYuan)) reject('积分抵扣记账参数无效', 'POINTS_LEDGER_INVALID', 400)
    if (!await this.ready(executor)) reject('积分来源追踪尚未迁移，不能抵扣', 'POINTS_LEDGER_NOT_READY')
    const state = await this.state(executor, customerId)
    const previous = await this.repository.redemption(executor, itemId)
    if (previous) {
      if (Number(previous.customer_id) !== customerId || Number(previous.points) !== -points || Number(previous.amount_cents) !== amountCents || Number(previous.points_per_yuan) !== pointsPerYuan) reject('此商品明细已用于其他积分抵扣', 'POINTS_REDEMPTION_CONFLICT')
      return { entry_id: previous.id, points_used: points, deduction_cents: amountCents, balance_after: Number(previous.balance_after) }
    }
    let credits = state.sources.filter(row => row.id <= snapshot.credit_cutoff_id && row.available > 0)
    if (snapshot.source_limits !== undefined) {
      if (!Array.isArray(snapshot.source_limits) || snapshot.source_limits.some(row => !row ||
        !integer(row.id, 1, snapshot.credit_cutoff_id) || !integer(row.available) || !integer(row.allocated, 0, Number.MAX_SAFE_INTEGER)) ||
        new Set(snapshot.source_limits.map(row => row.id)).size !== snapshot.source_limits.length ||
        snapshot.source_limits.reduce((sum, row) => sum + row.available, 0) !== snapshot.available_points) reject('积分来源截止凭据无效')
      const limits = new Map(snapshot.source_limits.map(row => [row.id, row]))
      const allocated = allocatedByCredit(state)
      // 返还旧抵扣可能恢复截止点以前的来源；还须扣除快照之后本次已消费的份额。
      credits = credits.map(row => {
        const limit = limits.get(row.id)
        return { ...row, available: limit ? Math.min(row.available, Math.max(0, limit.available - Math.max(0, (allocated.get(row.id) || 0) - limit.allocated))) : 0 }
      }).filter(row => row.available > 0)
    }
    if (points > snapshot.available_points || points > credits.reduce((sum, row) => sum + row.available, 0)) reject('只能使用结算前已有且来源可核对的积分', 'POINTS_AVAILABLE_INSUFFICIENT', 400)
    const balanceAfter = state.balance - points
    await this.repository.setBalance(executor, customerId, state.balance, balanceAfter)
    const entryId = await this.repository.append(executor, { customer_id: customerId, entry_type: 'redeem', source_type: 'checkout_item',
      source_id: itemId, redemption_item_id: itemId, points: -points, balance_after: balanceAfter,
      amount_cents: amountCents, points_per_yuan: pointsPerYuan,
      source_snapshot: { credit_cutoff_id: snapshot.credit_cutoff_id, available_points: snapshot.available_points,
        ...(snapshot.source_limits === undefined ? {} : { source_limits: snapshot.source_limits }) } })
    let remaining = points, allocated = 0, value = 0
    for (const credit of credits) {
      const used = Math.min(remaining, credit.available)
      allocated += used
      // 累进分币分摊，跨来源拆分后仍精确等于原抵扣金额；不使用浮点乘法。
      const nextValue = Number(BigInt(amountCents) * BigInt(allocated) / BigInt(points))
      await this.repository.allocate(executor, { debit_entry_id: entryId, credit_entry_id: credit.id,
        points: used, amount_cents: nextValue - value })
      value = nextValue; remaining -= used
      if (!remaining) break
    }
    return { entry_id: entryId, points_used: points, deduction_cents: amountCents, balance_after: balanceAfter }
  }

  /** 供已鉴权的售后事务调用；外层必须同事务保存退款/补款及原销售冲回凭据。 */
  returnAward(executor, input) { return this.recordAftersale(executor, 'award_return', input) }

  /** 返还抵扣商品：有效来源恢复积分，已追回的优惠转为应补退金额，不再次发积分。 */
  returnRedemption(executor, input = {}) {
    return this.recordAftersale(executor, 'redemption_return', { ...input, sourceType: 'checkout_item', sourceId: input.itemId })
  }

  async recordAftersale(executor, operation, { customerId, points, sourceType, sourceId, requestKey } = {}) {
    if (!integer(customerId, 1) || !integer(points, 1) || !validSource({ sourceType, sourceId }) ||
      typeof requestKey !== 'string' || !/^[A-Za-z0-9:_-]{8,100}$/.test(requestKey)) reject('积分售后参数无效', 'POINTS_LEDGER_INVALID', 400)
    if (!await this.ready(executor) || !await this.tableExists('customer_points_aftersales', executor)) reject('积分售后账尚未迁移，不能办理', 'POINTS_AFTERSALE_NOT_READY')
    // 先锁同一客户，再读取来源及售后事实，沿用消费顺序，避免同账户返分和扣分并发覆盖。
    const state = await this.state(executor, customerId)
    const hash = createHash('sha256').update(JSON.stringify([customerId, operation, sourceType, sourceId, points])).digest('hex')
    const previous = await this.repository.aftersaleRequest(executor, requestKey)
    const result = row => ({ entry_id: Number(row.id), operation_type: row.operation_type,
      points: Number(row.points), points_delta: Number(row.balance_delta),
      recovery_cents: row.operation_type === 'award_return' ? Number(row.amount_cents) : 0,
      compensation_cents: row.operation_type === 'redemption_return' ? Number(row.amount_cents) : 0,
      balance_after: Number(row.balance_after) })
    if (previous) {
      if (previous.request_hash !== hash) reject('该售后请求已按其他内容处理', 'POINTS_AFTERSALE_REQUEST_CONFLICT')
      return result(previous)
    }
    const plan = operation === 'award_return' ? planAwardReturn(state, { sourceType, sourceId, points })
      : planRedemptionReturn(state, { sourceId, points })
    const balanceAfter = state.balance + plan.balance_delta
    if (!integer(balanceAfter)) reject('售后积分余额超出范围')
    if (plan.balance_delta) await this.repository.setBalance(executor, customerId, state.balance, balanceAfter)
    const row = { ...plan, request_key: requestKey, request_hash: hash, customer_id: customerId, operation_type: operation,
      source_type: sourceType, source_id: sourceId, points, balance_after: balanceAfter }
    row.id = await this.repository.appendAftersale(executor, row)
    return result(row)
  }
}

module.exports = CustomerPointsLedgerService
