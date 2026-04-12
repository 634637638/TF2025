import { getPhoneStatusLabel, normalizePhoneStatus, type PhoneStatusOption } from './phoneStatuses'

export interface SaleTypeOption extends PhoneStatusOption {}

export const SALE_TYPE_OPTIONS: SaleTypeOption[] = [
  { value: 'sold', label: '已售' },
  { value: 'peer_transfer', label: '调货' },
  { value: 'supplier_proxy', label: '划拨' }
]

export const SALE_TYPE_LABEL_MAP: Record<string, string> = SALE_TYPE_OPTIONS.reduce((acc, item) => {
  acc[item.value] = item.label
  return acc
}, {} as Record<string, string>)

export const normalizeSaleType = (value?: string | null) => {
  const normalized = normalizePhoneStatus(value)
  return normalized || ''
}

export const getSaleTypeLabel = (value?: string | null) => {
  const normalized = normalizeSaleType(value)
  return SALE_TYPE_LABEL_MAP[normalized] || getPhoneStatusLabel(value)
}
