'use strict'

const fail = message => { throw Object.assign(new Error(message), { statusCode: 409, code: 'INVENTORY_LEDGER_CONFLICT' }) }
const cents = value => value === null || value === undefined ? null : Math.round(Number(value) * 100)
const batchKey = row => JSON.stringify([row.stock_in_id ? Number(row.stock_in_id) : null, cents(row.purchase_cost), row.usage_type, Number(row.serial_tracking)])

/** 库存汇总与流水必须一致；调用方持有根模板、门店库存锁。 */
const assertBatchBalance = (balances, quantity) => {
  if (balances.some(row => !Number.isSafeInteger(Number(row.quantity)) || Number(row.quantity) < 0 ||
    (row.purchase_cost !== null && row.purchase_cost !== undefined && (!Number.isSafeInteger(cents(row.purchase_cost)) || cents(row.purchase_cost) < 0)))) fail('批次库存或成本异常，请核对库存流水')
  if (balances.reduce((sum, row) => sum + Number(row.quantity), 0) !== Number(quantity)) fail('批次库存与门店汇总不一致，请核对后再操作')
}

/** 旧普通库存仅接续当前数量，来源/成本保持未知；SN已有采购事实独立保留。 */
const openingBatches = (quantity, serials) => {
  if (!Number.isSafeInteger(Number(quantity)) || Number(quantity) < serials.length) fail('历史SN与门店汇总不一致，请先核对库存')
  const groups = new Map()
  for (const serial of serials) {
    const row = { stock_in_id: serial.stock_in_id ? Number(serial.stock_in_id) : null,
      purchase_cost: serial.stock_in_id ? serial.purchase_cost : null, usage_type: 'unclassified', serial_tracking: 1 }
    const key = batchKey(row)
    const group = groups.get(key) || { ...row, quantity: 0 }
    group.quantity++
    groups.set(key, group)
  }
  if (Number(quantity) > serials.length) groups.set('plain', { stock_in_id: null, purchase_cost: null, usage_type: 'unclassified', serial_tracking: 0, quantity: Number(quantity) - serials.length })
  return [...groups.values()]
}

/** 普通库存按原采购日期/批次先进先出，SN按实物来源；调用方提供稳定排序的余额。 */
const allocateBatches = ({ balances, quantity, serials = [], operation = 'transfer', remarks = '' }) => {
  const allocations = []
  const take = (row, count) => {
    if (operation === 'sale' && row.usage_type === 'gift') return false
    if (operation === 'gift' && row.usage_type !== 'gift' && !remarks.trim()) return false
    allocations.push({ stock_in_id: row.stock_in_id ? Number(row.stock_in_id) : null,
      purchase_cost: row.purchase_cost === null || row.purchase_cost === undefined ? null : Number(row.purchase_cost),
      usage_type: row.usage_type, serial_tracking: Number(row.serial_tracking), quantity: count })
    return true
  }
  if (serials.length) {
    const pending = new Map()
    for (const serial of serials) {
      const candidates = balances.filter(row => Number(row.serial_tracking) === 1 && Number(row.stock_in_id || 0) === Number(serial.stock_in_id || 0) && cents(row.purchase_cost) === cents(serial.stock_in_id ? serial.purchase_cost : null))
      const row = candidates.find(item => Number(item.quantity) > (pending.get(batchKey(item))?.quantity || 0))
      if (!row) fail('SN与批次来源不一致，请核对库存')
      const key = batchKey(row), group = pending.get(key) || { row, quantity: 0 }
      group.quantity++; pending.set(key, group)
    }
    for (const { row, quantity: count } of pending.values()) if (!take(row, count)) fail(operation === 'sale' ? '赠送用途商品不能按收费销售' : '收费或历史库存转赠送须填写原因')
  } else {
    let remaining = quantity
    for (const row of balances) {
      if (Number(row.serial_tracking) !== 0 || Number(row.quantity) <= 0) continue
      const count = Math.min(remaining, Number(row.quantity))
      if (count && take(row, count)) remaining -= count
      if (!remaining) break
    }
    if (remaining) fail(operation === 'sale' ? '可收费批次库存不足，赠送库存不能收费销售' : operation === 'gift' ? '可赠送库存不足，收费或历史库存转赠送须填写原因' : '可划拨批次库存不足')
  }
  const costKnown = allocations.every(row => row.purchase_cost !== null)
  const costCents = costKnown ? allocations.reduce((sum, row) => sum + cents(row.purchase_cost) * row.quantity, 0) : null
  if (costCents !== null && (!Number.isSafeInteger(costCents) || costCents >= 10000000000)) fail('批次采购成本超出单据范围')
  return { allocations, costCents }
}

module.exports = { batchKey, assertBatchBalance, openingBatches, allocateBatches }
