'use strict'

const { isDeepStrictEqual } = require('node:util')
const { isIntegerInput } = require('./input-values')
const { formatLocalDate, parseLocalDate, normalizeDateTime } = require('./time')

const conflict = message => { throw Object.assign(new Error(message), { statusCode: 409, code: 'SALARY_GOODS_SETTLEMENT_CONFLICT' }) }
const integer = value => {
  if (!isIntegerInput(value)) conflict('商品工资核销整数无效')
  return Number(value)
}
const id = value => {
  const result = integer(value)
  if (result <= 0) conflict('商品工资核销关联编号无效')
  return result
}
const sum = values => {
  const result = values.reduce((total, value) => total + BigInt(integer(value)), 0n)
  if (result < BigInt(Number.MIN_SAFE_INTEGER) || result > BigInt(Number.MAX_SAFE_INTEGER)) conflict('商品工资核销汇总超出安全整数范围')
  return Number(result)
}
const object = value => {
  try {
    const result = typeof value === 'string' ? JSON.parse(value) : value
    if (result && typeof result === 'object' && !Array.isArray(result)) return result
  } catch { /* 损坏凭据不能视为未配置或零。 */ }
  conflict('商品工资核销快照损坏')
}
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && formatLocalDate(parseLocalDate(value)) === value
const time = value => {
  let result
  try { result = normalizeDateTime(value, false) } catch { /* 统一为业务冲突。 */ }
  if (!result || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(result) ||
    normalizeDateTime(new Date(result.replace(' ', 'T') + '+08:00'), false) !== result) conflict('商品工资核销时间无效')
  return result
}

function context(input) {
  if (!input || !date(input.period_start) || !date(input.period_end) || input.period_start > input.period_end ||
    typeof input.through !== 'string' || time(input.through) !== input.through) conflict('商品工资核销周期或截止时间无效')
  return { employee_id: id(input.employee_id), period_start: input.period_start, period_end: input.period_end, through: input.through }
}

function source(value, employeeId, through) {
  const row = object(value)
  if (row.employee_id !== employeeId || !['sale', 'return'].includes(row.kind) ||
    !Number.isSafeInteger(row.amount_cents) || !Number.isSafeInteger(row.quantity) || row.quantity < 0 ||
    typeof row.reason !== 'string' || !row.reason || typeof row.source_hash !== 'string' || !/^[a-f0-9]{64}$/.test(row.source_hash) ||
    time(row.business_time) !== row.business_time || time(row.recorded_at) !== row.recorded_at ||
    row.business_time > through || row.recorded_at > through) conflict('商品工资原始来源无效')
  for (const key of ['order_id', 'order_item_id', 'accessory_sale_id']) if (id(row[key]) !== row[key]) conflict('商品工资来源编号无效')
  if (row.salary_template_id !== null && id(row.salary_template_id) !== row.salary_template_id) conflict('商品工资模板编号无效')
  if (row.kind === 'sale') {
    if (row.source_key !== `goods_sale:${row.order_item_id}` || row.original_source_key !== null ||
      row.aftersale_id !== null || row.aftersale_item_id !== null || row.amount_cents < 0 || row.quantity === 0) conflict('商品成交提成来源无效')
  } else if (id(row.aftersale_id) !== row.aftersale_id || id(row.aftersale_item_id) !== row.aftersale_item_id ||
    row.source_key !== `goods_return:${row.aftersale_item_id}` || row.original_source_key !== `goods_sale:${row.order_item_id}` || row.amount_cents > 0) {
    conflict('商品退货提成来源无效')
  }
  return row
}

function totals(entries) {
  return { earned_cents: sum(entries.filter(row => row.kind === 'sale').map(row => row.amount_cents)),
    reversal_cents: sum(entries.filter(row => row.kind === 'return').map(row => -row.amount_cents)),
    net_cents: sum(entries.map(row => row.amount_cents)) }
}

function readSnapshot(value) {
  const snapshot = object(value), input = context(snapshot)
  if (snapshot.version !== 1 || !Array.isArray(snapshot.entries) || !Number.isSafeInteger(snapshot.legacy_item_count) || snapshot.legacy_item_count < 0) conflict('商品工资核销快照版本或汇总无效')
  const seen = new Set()
  for (const entry of snapshot.entries) {
    const { original_salary_record_id: originalId, ...entrySource } = object(entry)
    source(entrySource, input.employee_id, input.through)
    if (originalId !== null && id(originalId) !== originalId || entry.kind === 'sale' && originalId !== null ||
      entry.business_time.slice(0, 10) > input.period_end || seen.has(entry.source_key)) conflict('商品工资核销快照来源重复或周期无效')
    seen.add(entry.source_key)
  }
  const amount = totals(snapshot.entries)
  for (const field of Object.keys(amount)) if (snapshot[field] !== amount[field]) conflict('商品工资核销快照金额不守恒')
  return snapshot
}

/** 比较已确认草稿时允许核对时间前进，但来源、原工资归属及零提成事实不可变化。 */
function sameSettlement(left, right) {
  const { through: leftTime, ...first } = readSnapshot(left)
  const { through: rightTime, ...second } = readSnapshot(right)
  return leftTime <= rightTime && isDeepStrictEqual(first, second)
}

/** sources 必须来自 SalaryGoodsService 的一致性核验；不能接收客户端来源集合。 */
function planSettlement(input, sources, claims, records) {
  const scope = context(input), employeeId = scope.employee_id
  if (sources.version !== 1 || sources.employee_id !== employeeId || sources.through !== scope.through ||
    !Array.isArray(sources.entries) || !Array.isArray(claims) || !Array.isArray(records) ||
    !Number.isSafeInteger(sources.legacy_item_count) || sources.legacy_item_count < 0) conflict('商品工资核销来源集合无效')
  const bySource = new Map(), byRecord = new Map(), byClaim = new Map(), claimsByRecord = new Map()
  for (const entry of sources.entries) {
    source(entry, employeeId, scope.through)
    if (bySource.has(entry.source_key)) conflict('商品工资原始来源重复')
    bySource.set(entry.source_key, entry)
  }
  for (const [key, value] of Object.entries(totals(sources.entries))) if (sources[key] !== value) conflict('商品工资来源汇总不守恒')
  for (const record of records) {
    const recordId = id(record.id)
    if (byRecord.has(recordId)) conflict('商品工资原记录重复')
    byRecord.set(recordId, record)
  }
  for (const claim of claims) {
    const entry = bySource.get(claim.source_key), recordId = id(claim.salary_record_id), record = byRecord.get(recordId)
    if (!entry || id(claim.employee_id) !== employeeId || byClaim.has(claim.source_key) ||
      !record || id(record.employee_id) !== employeeId || record.status !== 'paid' || !record.paid_at || time(record.paid_at) > scope.through ||
      time(claim.created_at) !== time(record.paid_at) || claim.source_hash !== entry.source_hash ||
      integer(claim.amount_cents) !== entry.amount_cents) conflict('已核销商品提成与原销售或已发工资不一致')
    const saved = object(claim.source_snapshot)
    const { original_salary_record_id: _original, ...savedSource } = saved
    if (!isDeepStrictEqual(savedSource, entry)) conflict('商品提成核销原始快照不一致')
    byClaim.set(claim.source_key, claim)
    if (!claimsByRecord.has(recordId)) claimsByRecord.set(recordId, [])
    claimsByRecord.get(recordId).push(claim)
  }
  for (const record of records) {
    const recordId = id(record.id), paid = record.status === 'paid' || Boolean(record.paid_at)
    // 草稿可重算/删除，不占来源；有账无快照、已发空快照均不能被静默忽略。
    if (!paid) continue
    if (record.goods_commission_snapshot === null || record.goods_commission_snapshot === undefined) {
      if (claimsByRecord.has(recordId)) conflict('商品核销缺少已发工资快照')
      continue
    }
    const snapshot = readSnapshot(record.goods_commission_snapshot)
    if (record.status !== 'paid' || !record.paid_at || time(record.paid_at) > scope.through ||
      snapshot.employee_id !== employeeId || id(record.employee_id) !== employeeId ||
      snapshot.period_start !== formatLocalDate(record.period_start) || snapshot.period_end !== formatLocalDate(record.period_end) ||
      snapshot.through > time(record.paid_at)) conflict('商品提成已发工资周期或时间不一致')
    for (const entry of snapshot.entries) {
      const claim = byClaim.get(entry.source_key)
      if (!claim || id(claim.salary_record_id) !== recordId || !isDeepStrictEqual(object(claim.source_snapshot), entry)) conflict('已发工资商品来源未完整核销')
    }
    if ((claimsByRecord.get(recordId)?.length || 0) !== snapshot.entries.length) conflict('已发工资核销来源数量不一致')
  }
  for (const entry of bySource.values()) {
    if (entry.kind !== 'return') continue
    const original = bySource.get(entry.original_source_key)
    if (!original || original.kind !== 'sale' || original.order_id !== entry.order_id || original.accessory_sale_id !== entry.accessory_sale_id ||
      entry.recorded_at < original.recorded_at || entry.business_time < original.business_time) conflict('退货核销缺少有效原成交来源')
    const claim = byClaim.get(entry.source_key)
    if (claim) {
      const saleClaim = byClaim.get(entry.original_source_key)
      if (!saleClaim || id(claim.original_salary_record_id) !== id(saleClaim.salary_record_id)) conflict('退货提成扣回未关联原已发工资')
      const saved = object(claim.source_snapshot)
      const expectedOriginal = id(saleClaim.salary_record_id) === id(claim.salary_record_id) ? null : id(saleClaim.salary_record_id)
      if (saved.original_salary_record_id !== expectedOriginal) conflict('退货核销原工资归属不一致')
    }
  }
  for (const claim of claims) if (bySource.get(claim.source_key).kind === 'sale' && claim.original_salary_record_id !== null) conflict('原成交核销不能关联其他工资')
  const entries = [...bySource.values()].filter(entry => !byClaim.has(entry.source_key) && entry.business_time.slice(0, 10) <= scope.period_end)
    .map(entry => ({ ...entry, original_salary_record_id: entry.kind === 'return' && byClaim.has(entry.original_source_key)
      ? id(byClaim.get(entry.original_source_key).salary_record_id) : null }))
    .sort((first, second) => first.order_item_id - second.order_item_id || (first.kind === second.kind
      ? (first.aftersale_item_id || 0) - (second.aftersale_item_id || 0) : first.kind === 'sale' ? -1 : 1))
  return { version: 1, ...scope, legacy_item_count: sources.legacy_item_count, ...totals(entries), entries }
}

module.exports = { planSettlement, readSnapshot, sameSettlement, context, conflict }
