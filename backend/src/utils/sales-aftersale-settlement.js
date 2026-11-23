'use strict'

const conflict = () => {
  throw Object.assign(new Error('售后资金归属凭据不完整，请核对原单历史'), { statusCode: 409, code: 'CHECKOUT_RETURN_CONFLICT' })
}
const integer = (value, min = 0) => {
  if (!['number', 'string'].includes(typeof value) || !/^-?\d+$/.test(String(value)) ||
    !Number.isSafeInteger(Number(value)) || Number(value) < min) conflict()
  return Number(value)
}
const signed = value => integer(value, Number.MIN_SAFE_INTEGER)
const sum = values => {
  const total = values.reduce((amount, value) => amount + BigInt(value), 0n)
  if (total > BigInt(Number.MAX_SAFE_INTEGER) || total < BigInt(Number.MIN_SAFE_INTEGER)) conflict()
  return Number(total)
}
const parseFact = value => {
  try {
    const fact = typeof value === 'string' ? JSON.parse(value) : value
    if (fact && typeof fact === 'object' && !Array.isArray(fact)) return fact
  } catch { /* 损坏历史不能按当前规则补算。 */ }
  conflict()
}
const amounts = ['base_refund_cents', 'recovery_cents', 'compensation_cents', 'refund_cents', 'collection_cents', 'points_delta']
const settlementKeys = ['version', ...amounts, 'offset_cents']

/** 最大余数分币；以原明细ID打破并列，输入顺序不影响归属，不使用浮点比例。 */
function distribute(items, total, positive) {
  const candidates = items.filter(item => positive ? item.net > 0 : item.net < 0)
  if (!total) return new Map()
  const denominator = candidates.reduce((value, item) => value + BigInt(Math.abs(item.net)), 0n)
  if (!denominator) conflict()
  const shares = candidates.map(item => {
    const numerator = BigInt(total) * BigInt(Math.abs(item.net))
    return { id: item.original_item_id, cents: Number(numerator / denominator), remainder: numerator % denominator }
  })
  const remaining = total - sum(shares.map(item => item.cents))
  shares.sort((a, b) => a.remainder === b.remainder ? a.id - b.id : a.remainder > b.remainder ? -1 : 1)
  for (let index = 0; index < remaining; index++) shares[index].cents++
  return new Map(shares.map(item => [item.id, item.cents]))
}

/** 整笔资金只确认一次；明细保存原应退/积分事实及本次实际退款、补款的分币归属。 */
function allocateAftersaleSettlement(lines, { version = 1 } = {}) {
  if (!Array.isArray(lines) || !lines.length) conflict()
  if (![1, 2, 3, 4].includes(version)) conflict()
  const items = lines.map(line => {
    if (!line || typeof line !== 'object' || Array.isArray(line)) conflict()
    const item = { original_item_id: integer(line.original_item_id, 1),
      base_refund_cents: integer(line.base_refund_cents), recovery_cents: integer(line.recovery_cents),
      compensation_cents: integer(line.compensation_cents), points_delta: integer(line.points_delta, -2147483648) }
    if (item.points_delta > 2147483647) conflict()
    if (version >= 2) item.gift_charge_cents = integer(line.gift_charge_cents)
    else if (line.gift_charge_cents !== undefined && line.gift_charge_cents !== 0) conflict()
    if (version >= 3) item.replacement_cents = integer(line.replacement_cents)
    else if (line.replacement_cents !== undefined && line.replacement_cents !== 0) conflict()
    if (version === 4) item.additional_cents = integer(line.additional_cents)
    else if (line.additional_cents !== undefined && line.additional_cents !== 0) conflict()
    return { ...item, net: sum([item.base_refund_cents, item.compensation_cents, -item.recovery_cents, -(item.gift_charge_cents || 0), -(item.replacement_cents || 0), -(item.additional_cents || 0)]) }
  }).sort((a, b) => a.original_item_id - b.original_item_id)
  if (new Set(items.map(item => item.original_item_id)).size !== items.length) conflict()
  const net = sum(items.map(item => item.net))
  const totals = Object.fromEntries(['base_refund_cents', 'recovery_cents', 'compensation_cents', 'points_delta']
    .map(key => [key, sum(items.map(item => item[key]))]))
  if (version >= 2) totals.gift_charge_cents = sum(items.map(item => item.gift_charge_cents))
  if (version >= 3) totals.replacement_cents = sum(items.map(item => item.replacement_cents))
  if (version === 4) totals.additional_cents = sum(items.map(item => item.additional_cents))
  if (totals.points_delta < -2147483648 || totals.points_delta > 2147483647) conflict()
  totals.refund_cents = Math.max(net, 0)
  totals.collection_cents = Math.max(-net, 0)
  const refunds = distribute(items, totals.refund_cents, true), collections = distribute(items, totals.collection_cents, false)
  return { totals, items: items.map(({ net: itemNet, original_item_id, ...item }) => {
    const refund = refunds.get(original_item_id) || 0, collection = collections.get(original_item_id) || 0
    return { original_item_id, settlement: { version, ...item, refund_cents: refund, collection_cents: collection,
      offset_cents: sum([itemNet, -refund, collection]) } }
  }) }
}

/** 只在确切的单明细旧商品退货中读取头金额；多明细必须逐行记账并与共同头守恒。 */
function readAftersaleSettlement(header, rows, { verifiedItemOrders } = {}) {
  if (!header || typeof header !== 'object' || !Array.isArray(rows) || !rows.length) conflict()
  const head = Object.fromEntries(amounts.map(key => [key, key === 'points_delta' ? integer(header[key], -2147483648) : integer(header[key])]))
  const charge = header.gift_charge_cents === undefined ? 0 : integer(header.gift_charge_cents)
  const replacement = header.replacement_cents === undefined ? 0 : integer(header.replacement_cents)
  const additional = header.additional_cents === undefined ? 0 : integer(header.additional_cents)
  if (head.points_delta > 2147483647 || head.refund_cents && head.collection_cents ||
    sum([head.base_refund_cents, head.compensation_cents, -head.recovery_cents, -charge, -replacement, -additional]) !== head.refund_cents - head.collection_cents) conflict()
  const ids = new Set()
  const entries = rows.map(row => {
    if (!row || typeof row !== 'object') conflict()
    const id = integer(row.id, 1), itemId = integer(row.original_item_id, 1), fact = parseFact(row.fact_snapshot)
    const itemOrderId = integer(row.item_order_id, 1), orderId = integer(header.order_id, 1)
    const crossOrder = itemOrderId !== orderId
    if (ids.has(id) || integer(row.aftersale_id, 1) !== integer(header.id, 1) ||
      crossOrder && (header.operation_type !== 'phone_return' || row.item_type !== 'accessory' ||
        !(verifiedItemOrders instanceof Map) || verifiedItemOrders.get(itemId) !== itemOrderId)) conflict()
    ids.add(id)
    let settlement
    if (!Object.hasOwn(fact, 'settlement')) {
      if (rows.length !== 1 || header.operation_type !== 'goods_return' || row.item_type !== 'accessory') conflict()
      settlement = { version: 1, ...head, offset_cents: 0 }
    } else {
      const value = fact.settlement
      if (!value || typeof value !== 'object' || Array.isArray(value) || ![1, 2, 3, 4].includes(value.version)) conflict()
      const keys = [...settlementKeys, ...(value.version >= 2 ? ['gift_charge_cents'] : []), ...(value.version >= 3 ? ['replacement_cents'] : []), ...(value.version === 4 ? ['additional_cents'] : [])]
      if (Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) conflict()
      settlement = Object.fromEntries(keys.map(key => [key, ['offset_cents', 'points_delta'].includes(key) ? signed(value[key]) : integer(value[key])]))
    }
    if (integer(fact.payable_cents) !== settlement.base_refund_cents) conflict()
    if (crossOrder && settlement.version !== 2) conflict()
    if (settlement.version === 1 ? charge !== 0 || fact.gift_charge !== undefined || fact.gift_refund_cents !== undefined :
      header.gift_charge_cents === undefined || integer(fact.gift_charge?.amount_cents ?? 0) !== settlement.gift_charge_cents) conflict()
    if (settlement.version >= 3) {
      const exchange = fact.exchange, keys = ['replacement_order_id', 'replacement_item_id', 'replacement_cents', ...(settlement.version === 4 ? ['additional_cents'] : []), 'quantity', 'root_order_id', 'root_item_id']
      if (settlement.version === 3 && rows.length !== 1 || row.item_type !== 'accessory' || header.replacement_cents === undefined || header.operation_type !== 'goods_exchange' ||
        !exchange || typeof exchange !== 'object' || Array.isArray(exchange) || Object.keys(exchange).length !== keys.length || keys.some(key => !Object.hasOwn(exchange, key)) ||
        integer(exchange.replacement_cents) !== settlement.replacement_cents || settlement.version === 4 && integer(exchange.additional_cents) !== settlement.additional_cents ||
        integer(exchange.quantity, 1) !== integer(row.quantity, 1) || exchange.quantity > 999999 ||
        integer(exchange.replacement_item_id, 1) <= itemId || integer(exchange.replacement_order_id, 1) === integer(header.order_id, 1) ||
        integer(exchange.root_item_id, 1) > itemId || !integer(exchange.root_order_id, 1)) conflict()
    } else if (replacement !== 0 || fact.exchange !== undefined) conflict()
    return { row, fact, original_item_id: itemId, settlement }
  })
  const version = entries[0].settlement.version
  if (entries.some(entry => entry.settlement.version !== version)) conflict()
  const expected = allocateAftersaleSettlement(entries.map(entry => ({ original_item_id: entry.original_item_id, ...entry.settlement })), { version })
  if (amounts.some(key => head[key] !== expected.totals[key])) conflict()
  if (version >= 2 && charge !== expected.totals.gift_charge_cents) conflict()
  if (version >= 3 && replacement !== expected.totals.replacement_cents) conflict()
  if (version === 4 && additional !== expected.totals.additional_cents) conflict()
  const byId = new Map(expected.items.map(item => [item.original_item_id, item.settlement]))
  for (const entry of entries) {
    const target = byId.get(entry.original_item_id)
    if (Object.keys(target).some(key => entry.settlement[key] !== target[key])) conflict()
  }
  return entries
}

module.exports = { allocateAftersaleSettlement, readAftersaleSettlement }
