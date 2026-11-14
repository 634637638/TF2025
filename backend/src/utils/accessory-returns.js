'use strict'

const { moneyCents } = require('./sale-input')
const fail = message => { throw Object.assign(new Error(message), { statusCode: 409, code: 'ACCESSORY_RETURN_CONFLICT' }) }
const sameCost = (a, b) => moneyCents(a) === moneyCents(b)
const validId = value => ['number', 'string'].includes(typeof value) && /^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) && Number(value) > 0

/** 只按原出库事件返还；普通件按原分配顺序，SN按实物原采购来源。 */
const validateReturnFacts = ({ sale, events }) => {
  const originals = events.filter(row => ['sale', 'gift'].includes(row.event_type))
  const returned = events.filter(row => ['sale_return', 'gift_return'].includes(row.event_type))
  if (!originals.length || !['sale', 'gift'].includes(sale.sale_type) || events.length !== originals.length + returned.length ||
    !Number.isSafeInteger(Number(sale.quantity)) || Number(sale.quantity) < 1 || Number(sale.quantity) > 999999) fail('原销售缺少可核对批次流水，不能猜测来源返库')
  const byId = new Map()
  for (const row of originals) {
    if (!validId(row.id) || byId.has(Number(row.id)) || Number(row.accessory_id) !== Number(sale.accessory_id) ||
      Number(row.store_id) !== Number(sale.store_id) || Number(row.sale_id) !== Number(sale.id) || row.event_type !== sale.sale_type ||
      !Number.isSafeInteger(Number(row.quantity_delta)) || Number(row.quantity_delta) >= 0 ||
      ![0, 1].includes(Number(row.serial_tracking)) || !['sale', 'gift', 'unclassified'].includes(row.usage_type) ||
      row.stock_in_id !== null && !validId(row.stock_in_id) || row.purchase_cost !== null && moneyCents(row.purchase_cost) === null) fail('原出库批次凭据异常')
    byId.set(Number(row.id), { ...row, available: -Number(row.quantity_delta) })
  }
  if (originals.reduce((sum, row) => sum - Number(row.quantity_delta), 0) !== Number(sale.quantity) ||
    originals.some(row => Number(row.serial_tracking) !== Number(originals[0].serial_tracking))) fail('原出库数量或追踪方式不一致')
  const originalCost = originals.some(row => row.purchase_cost === null) ? null
    : originals.reduce((sum, row) => sum - moneyCents(row.purchase_cost) * Number(row.quantity_delta), 0)
  if (originalCost !== moneyCents(sale.purchase_cost)) fail('原销售成本与批次分配不守恒')
  for (const row of returned) {
    const source = byId.get(Number(row.source_event_id))
    if (!source || Number(row.accessory_id) !== Number(sale.accessory_id) || Number(row.sale_id) !== Number(sale.id) ||
      row.event_type !== `${sale.sale_type}_return` || !validId(row.store_id) ||
      Number(row.stock_in_id) !== Number(source.stock_in_id) || !sameCost(row.purchase_cost, source.purchase_cost) ||
      row.usage_type !== source.usage_type || Number(row.serial_tracking) !== Number(source.serial_tracking) ||
      !Number.isSafeInteger(Number(row.quantity_delta)) || Number(row.quantity_delta) <= 0 ||
      typeof row.return_key !== 'string' || !/^[A-Za-z0-9:_-]{8,100}$/.test(row.return_key) ||
      typeof row.return_hash !== 'string' || !/^[a-f0-9]{64}$/.test(row.return_hash)) fail('已退商品批次关联异常')
    source.available -= Number(row.quantity_delta)
    if (source.available < 0) fail('原出库批次已重复返库')
  }
  return { originals, returned, byId }
}

const allocateReturn = ({ sale, events, quantity, serials = [] }) => {
  const { originals, returned, byId } = validateReturnFacts({ sale, events })
  if (Number(originals[0].serial_tracking) !== Number(serials.length > 0)) fail('SN出库须指定原销售SN，普通出库不能使用SN返库')
  if (serials.length && serials.length !== quantity) fail('SN退回数量与实物不一致')
  const allocations = []
  const pending = new Map()
  const take = (row, count) => {
    row.available -= count
    const part = pending.get(Number(row.id)) || { source_event_id: Number(row.id), stock_in_id: row.stock_in_id,
      purchase_cost: row.purchase_cost === null ? null : Number(row.purchase_cost), usage_type: row.usage_type,
      serial_tracking: Number(row.serial_tracking), quantity: 0 }
    part.quantity += count; pending.set(Number(row.id), part)
  }
  if (serials.length) {
    for (const serial of serials) {
      const row = [...byId.values()].find(row => row.available > 0 && Number(row.stock_in_id) === Number(serial.stock_in_id) &&
        sameCost(row.purchase_cost, serial.stock_in_id ? serial.purchase_cost : null))
      if (!row) fail('SN原采购来源与销售批次不符，或已返库')
      take(row, 1)
    }
  } else {
    let remaining = quantity
    for (const row of byId.values()) {
      const count = Math.min(remaining, row.available)
      if (count) take(row, count)
      remaining -= count
      if (!remaining) break
    }
    if (remaining) fail('退回数量超过原单剩余可退数量')
  }
  allocations.push(...pending.values())
  const costCents = allocations.some(row => row.purchase_cost === null) ? null
    : allocations.reduce((sum, row) => sum + moneyCents(row.purchase_cost) * row.quantity, 0)
  return { allocations, costCents,
    remaining_quantity: Number(sale.quantity) - returned.reduce((sum, row) => sum + Number(row.quantity_delta), 0) - quantity }
}

module.exports = { allocateReturn, validateReturnFacts }
