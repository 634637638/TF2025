// 已完成交易的设备不再属于库存台账或销售出库候选。
const COMPLETED_TRANSACTION_STATUSES = Object.freeze([
  'sold',
  'peer_transfer',
  'supplier_proxy'
])

const getNonCompletedTransactionStatusSql = (alias = 'p') => (
  `COALESCE(${alias}.status, '') NOT IN (${COMPLETED_TRANSACTION_STATUSES.map(() => '?').join(', ')})`
)

const PHONE_STATUS_ALIASES = Object.freeze({
  in_stock: 'in_stock',
  available: 'in_stock',
  '在库': 'in_stock',
  '可售': 'in_stock',
  '可用': 'in_stock',
  sold: 'sold',
  retail: 'sold',
  '已售': 'sold',
  '零售': 'sold',
  reserved: 'reserved',
  '预订': 'reserved',
  '预定': 'reserved',
  repair: 'repair',
  '维修': 'repair',
  '维修中': 'repair',
  rented: 'rented',
  '租赁': 'rented',
  '租赁中': 'rented',
  lost: 'lost',
  '丢失': 'lost',
  peer_transfer: 'peer_transfer',
  '调货': 'peer_transfer',
  supplier_proxy: 'supplier_proxy',
  '划拨': 'supplier_proxy',
  returned: 'returned',
  '已退货': 'returned',
  damaged: 'damaged',
  '损坏': 'damaged'
})

const normalizePhoneStatus = status => {
  const value = String(status ?? '').trim()
  if (!value) return ''
  const lowerValue = value.toLowerCase()
  if (Object.prototype.hasOwnProperty.call(PHONE_STATUS_ALIASES, lowerValue)) {
    return PHONE_STATUS_ALIASES[lowerValue]
  }
  if (Object.prototype.hasOwnProperty.call(PHONE_STATUS_ALIASES, value)) {
    return PHONE_STATUS_ALIASES[value]
  }
  return value
}

const isPhoneStatusAlias = status => {
  const value = String(status ?? '').trim()
  return Boolean(value && (
    Object.prototype.hasOwnProperty.call(PHONE_STATUS_ALIASES, value.toLowerCase()) ||
    Object.prototype.hasOwnProperty.call(PHONE_STATUS_ALIASES, value)
  ))
}

const isSellablePhoneStatus = status => normalizePhoneStatus(status) === 'in_stock'

// 设备对外展示的有效状态。
// 预订只是库存设备上的业务占用标记，不能覆盖已售、维修、租赁等实体状态。
const getEffectivePhoneStatus = (status, isPreordered) => {
  const rawStatus = normalizePhoneStatus(status)

  if (rawStatus === 'sold') return 'sold'
  if (rawStatus === 'reserved') return 'reserved'
  if (rawStatus === 'in_stock' && Number(isPreordered) === 1) return 'reserved'

  return rawStatus
}

const getEffectivePhoneStatusSql = (alias = 'p') => `CASE
  WHEN LOWER(TRIM(COALESCE(${alias}.status, ''))) = 'available' AND COALESCE(${alias}.is_preordered, 0) = 1 THEN 'reserved'
  WHEN LOWER(TRIM(COALESCE(${alias}.status, ''))) = 'available' THEN 'in_stock'
  WHEN ${alias}.status = 'sold' THEN 'sold'
  WHEN ${alias}.status = 'reserved' THEN 'reserved'
  WHEN ${alias}.status = 'in_stock' AND COALESCE(${alias}.is_preordered, 0) = 1 THEN 'reserved'
  ELSE ${alias}.status
END`

module.exports = {
  COMPLETED_TRANSACTION_STATUSES,
  PHONE_STATUS_ALIASES,
  isPhoneStatusAlias,
  isSellablePhoneStatus,
  normalizePhoneStatus,
  getEffectivePhoneStatus,
  getEffectivePhoneStatusSql,
  getNonCompletedTransactionStatusSql
}
