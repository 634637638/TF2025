// 已完成交易的设备不再属于库存台账或销售出库候选。
const COMPLETED_TRANSACTION_STATUSES = Object.freeze([
  'sold',
  'peer_transfer',
  'supplier_proxy'
])

const getNonCompletedTransactionStatusSql = (alias = 'p') => (
  `COALESCE(${alias}.status, '') NOT IN (${COMPLETED_TRANSACTION_STATUSES.map(() => '?').join(', ')})`
)

// 设备对外展示的有效状态。
// 预订只是库存设备上的业务占用标记，不能覆盖已售、维修、租赁等实体状态。
const getEffectivePhoneStatus = (status, isPreordered) => {
  const rawValue = String(status || '').trim()
  // `available` was the historical name for the sellable stock state.
  const rawStatus = rawValue === 'available' ? 'in_stock' : rawValue

  if (rawStatus === 'sold') return 'sold'
  if (rawStatus === 'reserved') return 'reserved'
  if (rawStatus === 'in_stock' && Number(isPreordered) === 1) return 'reserved'

  return rawStatus
}

const getEffectivePhoneStatusSql = (alias = 'p') => `CASE
  WHEN ${alias}.status = 'sold' THEN 'sold'
  WHEN ${alias}.status = 'reserved' THEN 'reserved'
  WHEN ${alias}.status = 'in_stock' AND COALESCE(${alias}.is_preordered, 0) = 1 THEN 'reserved'
  ELSE ${alias}.status
END`

module.exports = {
  COMPLETED_TRANSACTION_STATUSES,
  getEffectivePhoneStatus,
  getEffectivePhoneStatusSql,
  getNonCompletedTransactionStatusSql
}
