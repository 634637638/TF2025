export interface PhoneStatusOption {
  value: string
  label: string
}

export const PHONE_STATUS_OPTIONS: PhoneStatusOption[] = [
  { value: 'in_stock', label: '在库' },
  { value: 'sold', label: '已售' },
  { value: 'peer_transfer', label: '调货' },
  { value: 'supplier_proxy', label: '划拨' },
  { value: 'reserved', label: '预留' },
  { value: 'repair', label: '维修中' },
  { value: 'lost', label: '丢失' },
  { value: 'returned', label: '已退货' },
  { value: 'damaged', label: '损坏' },
  { value: 'available', label: '可用' }
]

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
  lost: 'lost',
  returned: 'returned',
  damaged: 'damaged',
  available: 'in-stock'
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
    在库: 'in_stock',
    已售: 'sold',
    调货: 'peer_transfer',
    划拨: 'supplier_proxy',
    丢失: 'lost',
    已退货: 'returned',
    损坏: 'damaged',
    可用: 'available'
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
