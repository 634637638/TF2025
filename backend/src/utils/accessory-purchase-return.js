'use strict'

const { validId, moneyCents } = require('./sale-input')

const conflict = () => {
  throw Object.assign(new Error('所选原批次或SN已变化、数量不足或无权查看，请刷新后重新选择'), {
    statusCode: 409, code: 'PURCHASE_RETURN_SELECTION_CONFLICT'
  })
}
const eventId = key => typeof key === 'string' && /^event:[1-9]\d*$/.test(key) && validId(key.slice(6)) ? Number(key.slice(6)) : null

/** 选择只描述原批次及实物，不接收客户端的店铺、供应商、成本或金额。 */
const parsePurchaseReturnSelection = body => {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !['batches', 'serial_ids'].includes(key)) ||
    !Array.isArray(body.batches) || body.batches.length > 100 || !Array.isArray(body.serial_ids) || body.serial_ids.length > 1000 ||
    (!body.batches.length && !body.serial_ids.length) || body.serial_ids.some(value => !validId(value)) ||
    body.batches.some(row => !row || typeof row !== 'object' || Array.isArray(row) || Object.keys(row).some(key => !['row_key', 'quantity'].includes(key)) ||
      !eventId(row.row_key) || !validId(row.quantity))) {
    throw Object.assign(new Error('请选择有效的原批次数量或在库SN，每次最多100条普通批次、1000件SN'), { statusCode: 400, code: 'VALIDATION_ERROR' })
  }
  const serialIds = body.serial_ids.map(Number), batches = body.batches.map(row => ({ row_key: row.row_key, quantity: Number(row.quantity) }))
  if (new Set(serialIds).size !== serialIds.length || new Set(batches.map(row => row.row_key)).size !== batches.length) {
    throw Object.assign(new Error('退供不能重复选择批次或SN'), { statusCode: 400, code: 'VALIDATION_ERROR' })
  }
  return { batches, serialIds }
}

/** 按原采购和当前实物分配；读取或写入调用方分别负责一致性快照或持锁，不占库、不记资金。 */
const allocatePurchaseReturn = ({ purchase, scope, currentQuantity, batches, serialIds, selected }) => {
  const unit = moneyCents(purchase.purchase_cost)
  if (!validId(purchase.id) || !validId(purchase.accessory_id) || !validId(purchase.quantity) || unit === null ||
    moneyCents(purchase.total_amount) !== unit * Number(purchase.quantity) || !Number.isSafeInteger(currentQuantity) ||
    currentQuantity < 0 || currentQuantity > Number(purchase.quantity)) conflict()
  const quantity = batches.reduce((sum, row) => sum + row.quantity, serialIds.length)
  if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > currentQuantity || !Array.isArray(selected?.batches) || !Array.isArray(selected.serials)) conflict()
  const authorized = store => validId(store) && (scope?.allStores === true || scope?.storeIds?.includes(Number(store)))
  const sameOrigin = row => Number(row.accessory_id) === Number(purchase.accessory_id) && Number(row.stock_in_id) === Number(purchase.id) && moneyCents(row.purchase_cost) === unit
  if (selected.serials.length !== serialIds.length || new Set(selected.serials.map(row => Number(row.id))).size !== serialIds.length ||
    selected.serials.some(row => !validId(row.id) || !serialIds.includes(Number(row.id)) || !sameOrigin(row) || !authorized(row.store_id) || row.status !== 'in_stock' ||
      typeof row.serial_number !== 'string' || !row.serial_number || row.serial_number.trim() !== row.serial_number || row.serial_number.length > 100 || /[\u0000-\u001f\u007f]/.test(row.serial_number)) ||
    new Set(selected.serials.map(row => row.serial_number.toUpperCase())).size !== serialIds.length) conflict()
  const serialStores = new Set(selected.serials.map(row => Number(row.store_id)))
  if (new Set(selected.batches.map(row => row.row_key)).size !== selected.batches.length || selected.batches.some(row =>
    !eventId(row.row_key) || !sameOrigin(row) || !authorized(row.store_id) || !validId(row.quantity) || Number(row.quantity) > Number(purchase.quantity) ||
    !['sale', 'gift', 'unclassified'].includes(row.usage_type) || ![0, 1].includes(Number(row.serial_tracking)) ||
    (Number(row.serial_tracking) === 0 ? !batches.some(item => item.row_key === row.row_key) : !serialStores.has(Number(row.store_id)))) ||
    selected.batches.reduce((sum, row) => sum + Number(row.quantity), 0) > currentQuantity) conflict()
  const allocations = []
  const take = (source, count, units = []) => {
    if (!source || Number(source.quantity) < count) conflict()
    allocations.push({ source_event_id: eventId(source.row_key), row_key: source.row_key,
      accessory_id: Number(purchase.accessory_id), stock_in_id: Number(purchase.id), store_id: Number(source.store_id), store_name: source.store_name,
      purchase_cost: unit / 100, quantity: count, usage_type: source.usage_type, serial_tracking: Number(source.serial_tracking),
      serial_ids: units.map(row => Number(row.id)), serial_numbers: units.map(row => row.serial_number) })
  }
  for (const batch of batches) take(selected.batches.find(row => row.row_key === batch.row_key && Number(row.serial_tracking) === 0), batch.quantity)
  for (const store of serialStores) {
    const candidates = selected.batches.filter(row => Number(row.store_id) === store && Number(row.serial_tracking) === 1)
    // SN没有逐件用途字段，同原采购/店内用途不唯一时不能猜实物归属。
    if (candidates.length !== 1) conflict()
    const units = selected.serials.filter(row => Number(row.store_id) === store).sort((a, b) => Number(a.id) - Number(b.id))
    take(candidates[0], units.length, units)
  }
  const costCents = unit * quantity
  if (!Number.isSafeInteger(costCents) || costCents >= 10000000000) conflict()
  return { quantity, costCents, allocations: allocations.sort((a, b) => a.store_id - b.store_id || a.source_event_id - b.source_event_id) }
}

module.exports = { parsePurchaseReturnSelection, allocatePurchaseReturn }
