import type { Phone } from '@/types'
import { generateProductPlaceholder } from '@/utils/format'
import { logger } from '@/utils/logger'
import {
  getEffectivePhoneStatus,
  isPhoneSaleActionAvailable,
  isPhoneSellable
} from '@/constants/phoneStatuses'

// API responses include a few operational statuses that are not part of the
// canonical Phone type (for example repair/rented/lost). Keep this display
// helper tolerant of those legacy values without widening the shared model.
type SalesStatusPhone = Omit<Partial<Phone>, 'status'> & {
  is_preordered?: boolean
  status?: string
}

const placeholderCache = new Map<string, string>()

export const getNewConditionLabel = (isNew: boolean): string => isNew ? '全新' : '二手'

export const getSaleStatusClass = (phone: SalesStatusPhone): string => {
  const status = getEffectivePhoneStatus(phone)
  if (status === 'reserved') return 'reserved'
  if (status === 'repair') return 'repair'
  if (status === 'rented') return 'rented'
  if (status === 'sold') return 'sold'
  if (status === 'lost') return 'lost'
  if (status === 'damaged') return 'damaged'
  if (status === 'peer_transfer') return 'peer-transfer'
  if (status === 'supplier_proxy') return 'supplier-proxy'
  return 'in-stock'
}

export const getSaleStatusLabel = (phone: SalesStatusPhone): string => {
  const status = getEffectivePhoneStatus(phone)
  if (status === 'reserved') return '预订'
  if (status === 'repair') return '维修'
  if (status === 'rented') return '租赁'
  if (status === 'sold') return '已售'
  if (status === 'lost') return '丢失'
  if (status === 'damaged') return '损坏'
  if (status === 'peer_transfer') return '调货'
  if (status === 'supplier_proxy') return '划拨'
  return '可售'
}

export { isPhoneSaleActionAvailable, isPhoneSellable }

export const findPhoneByRouteId = (
  records: readonly Phone[],
  routePhoneId: string
): Phone | undefined => records.find(phone => String(phone.id) === routePhoneId)

export const normalizeSalesPhone = (record: Record<string, unknown>): Phone => ({
  ...record,
  purchase_cost: record.purchase_cost === null || record.purchase_cost === undefined
    ? undefined
    : Number(record.purchase_cost)
} as unknown as Phone)

export const detectEditNoImeiMode = (
  imei: string | undefined,
  serialNumber: string | undefined
): boolean => {
  if (!imei) return false
  if (/[a-zA-Z]/.test(imei)) return true
  if (imei === serialNumber && imei.length !== 15) return true
  return imei.length !== 15
}

const getPlaceholderKey = (phone?: Partial<Phone> | null): string => {
  if (!phone) return 'default'
  return [phone.brand, phone.model, phone.color, phone.memory]
    .map(value => String(value || '').trim())
    .join('|')
}

const generatePhonePlaceholderImage = (phone?: Partial<Phone> | null): string => {
  const cacheKey = getPlaceholderKey(phone)
  const cachedImage = placeholderCache.get(cacheKey)
  if (cachedImage) return cachedImage

  const imageData = generateProductPlaceholder({
    brand: phone?.brand || '',
    model: phone?.model || '',
    color: phone?.color || '',
    memory: phone?.memory || '',
    size: 320,
    layout: 'horizontal'
  })
  placeholderCache.set(cacheKey, imageData)
  return imageData
}

export const getPhoneImageSrc = (phone?: Partial<Phone> | null): string => {
  const imageUrl = typeof phone?.image_url === 'string' ? phone.image_url.trim() : ''
  return imageUrl || generatePhonePlaceholderImage(phone)
}

export const formatSalesDate = (dateValue?: string): string => {
  if (!dateValue) return '-'

  try {
    const date = new Date(dateValue)
    if (Number.isNaN(date.getTime())) return '-'

    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  } catch (error) {
    logger.error(`日期格式化错误: ${String(dateValue)}`, error)
    return '-'
  }
}
