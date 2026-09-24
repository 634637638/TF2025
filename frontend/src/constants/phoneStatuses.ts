export interface PhoneStatusOption {
  value: string
  label: string
}

export const PHONE_STATUS_OPTIONS: PhoneStatusOption[] = [
  { value: 'in_stock', label: '可售' },
  { value: 'sold', label: '已售' },
  { value: 'peer_transfer', label: '调货' },
  { value: 'supplier_proxy', label: '划拨' },
  { value: 'reserved', label: '预订' },
  { value: 'repair', label: '维修' },
  { value: 'rented', label: '租赁' },
  { value: 'lost', label: '丢失' },
  { value: 'returned', label: '退货' },
  { value: 'damaged', label: '损坏' }
]

// 编辑库存和销售设备时，只允许选择尚未完成交易的状态。
// 历史查询页面仍应使用完整的 PHONE_STATUS_OPTIONS。
export const COMPLETED_TRANSACTION_STATUSES = ['sold', 'peer_transfer', 'supplier_proxy'] as const

export const PHONE_EDIT_STATUS_OPTIONS = PHONE_STATUS_OPTIONS.filter((option) => (
  !COMPLETED_TRANSACTION_STATUSES.includes(
    option.value as typeof COMPLETED_TRANSACTION_STATUSES[number]
  )
))

export const PHONE_STATUS_LABEL_MAP: Record<string, string> = PHONE_STATUS_OPTIONS.reduce((acc, item) => {
  acc[item.value] = item.label
  return acc
}, {} as Record<string, string>)

export const PHONE_STATUS_CLASS_MAP: Record<string, string> = {
  in_stock: 'in-stock',
  sold: 'sold',
  peer_transfer: 'peer-transfer',
  supplier_proxy: 'supplier-proxy',
  reserved: 'reserved',
  repair: 'repair',
  rented: 'rented',
  lost: 'lost',
  returned: 'returned',
  damaged: 'damaged'
}

export const normalizePhoneStatus = (value?: string | null) => {
  const raw = String(value || '').trim()
  if (!raw) return ''

  if (PHONE_STATUS_LABEL_MAP[raw]) {
    return raw
  }

  const legacyMap: Record<string, string> = {
    零售: 'sold',
    retail: 'sold',
    批发: 'peer_transfer',
    wholesale: 'peer_transfer',
    预定: 'reserved',
    维修: 'repair',
    租赁: 'rented',
    租赁中: 'rented',
    在库: 'in_stock',
    已售: 'sold',
    调货: 'peer_transfer',
    划拨: 'supplier_proxy',
    丢失: 'lost',
    已退货: 'returned',
    损坏: 'damaged',
    // 旧数据曾使用 available 表示可售，统一归并到唯一的可售状态。
    available: 'in_stock',
    可用: 'in_stock'
  }

  if (legacyMap[raw]) {
    return legacyMap[raw]
  }

  const matched = PHONE_STATUS_OPTIONS.find((item) => item.label === raw)
  return matched?.value || raw
}

export const getPhoneStatusLabel = (value?: string | null) => {
  const normalized = normalizePhoneStatus(value)
  return PHONE_STATUS_LABEL_MAP[normalized] || String(value || '').trim() || '-'
}

export const getPhoneStatusClass = (value?: string | null) => {
  const normalized = normalizePhoneStatus(value)
  return PHONE_STATUS_CLASS_MAP[normalized] || ''
}

export const isCompletedTransactionStatus = (value?: string | null) => (
  COMPLETED_TRANSACTION_STATUSES.includes(
    normalizePhoneStatus(value) as typeof COMPLETED_TRANSACTION_STATUSES[number]
  )
)

export interface PhoneStatusRecord {
  status?: string | null
  is_preordered?: boolean | number | string | null
}

// 业务展示状态：已售优先，预订只代表仍在库但已被预留。
export const getEffectivePhoneStatus = (record: PhoneStatusRecord | null | undefined) => {
  const status = normalizePhoneStatus(record?.status)
  if (status === 'sold') return 'sold'
  if (status === 'reserved') return 'reserved'
  if (status === 'in_stock' && (
    record?.is_preordered === true ||
    Number(record?.is_preordered) === 1
  )) {
    return 'reserved'
  }
  return status
}

export const getEffectivePhoneStatusLabel = (record: PhoneStatusRecord | null | undefined) => (
  getPhoneStatusLabel(getEffectivePhoneStatus(record))
)

export const getEffectivePhoneStatusClass = (record: PhoneStatusRecord | null | undefined) => (
  getPhoneStatusClass(getEffectivePhoneStatus(record))
)

export const isPhoneSellable = (record: PhoneStatusRecord | null | undefined) => (
  getEffectivePhoneStatus(record) === 'in_stock'
)

export const isPhoneSaleActionAvailable = (record: PhoneStatusRecord | null | undefined) => {
  const status = getEffectivePhoneStatus(record)
  return status === 'in_stock' || status === 'reserved'
}
