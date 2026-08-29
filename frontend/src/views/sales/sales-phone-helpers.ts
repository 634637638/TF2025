import type { Phone } from '@/types'
import { generateProductPlaceholder } from '@/utils/format'
import { logger } from '@/utils/logger'

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
  if (phone.is_preordered || phone.status === 'reserved') return 'reserved'
  if (phone.status === 'repair') return 'repair'
  if (phone.status === 'rented') return 'rented'
  if (phone.status === 'sold') return 'sold'
  if (phone.status === 'lost') return 'lost'
  return 'in-stock'
}

export const getSaleStatusLabel = (phone: SalesStatusPhone): string => {
  if (phone.is_preordered) return '已预订'
  if (phone.status === 'repair') return '维修'
  if (phone.status === 'rented') return '租赁'
  if (phone.status === 'sold') return '已售'
  if (phone.status === 'reserved') return '预定'
  if (phone.status === 'lost') return '丢失'
  return '可售'
}

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
