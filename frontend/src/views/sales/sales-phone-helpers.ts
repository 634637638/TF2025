import type { Phone } from '@/types'
import type { RecordDetailField } from '@/types/component'
import { formatAmount, generateProductPlaceholder } from '@/utils/format'
import { logger } from '@/utils/logger'
import { TIME_FORMATS, TimeUtil } from '@/utils/time'
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

/** 图文和表格模式共用同一详情字段、权限及长字段声明。 */
export const getSalesPhoneDetailFields = (
  row: Phone | null,
  canViewField: (field: string) => boolean,
  canViewPrice: boolean,
  formatDate: (value?: string) => string
): RecordDetailField[] => row ? [
  { key: 'supplier_name', label: '供应商', value: row.supplier_name, visible: canViewField('supplier_name') },
  { key: 'store_name', label: '店铺', value: row.store_name, visible: canViewField('store_name') },
  { key: 'brand', label: '品牌', value: row.brand, visible: canViewField('brand') },
  { key: 'model', label: '型号', value: row.model, visible: canViewField('model') },
  { key: 'color', label: '颜色', value: row.color, visible: canViewField('color') },
  { key: 'memory', label: '内存', value: row.memory, visible: canViewField('memory') },
  { key: 'serial_number', label: '序列号', value: row.serial_number, visible: canViewField('serial_number'), wide: true },
  { key: 'imei', label: 'IMEI', value: row.imei, visible: canViewField('imei'), wide: true },
  { key: 'inventory_operator_name', label: '入库员', value: row.inventory_operator_name, visible: canViewField('inventory_operator_name') },
  { key: 'condition', label: '成色', value: getNewConditionLabel(Boolean(row.is_new)), visible: canViewField('condition') },
  { key: 'inventory_time', label: '入库时间', value: formatDate(row.inventory_time), visible: canViewField('inventory_time'), wide: true },
  { key: 'purchase_cost', label: '入库价格', value: formatAmount(row.purchase_cost ?? 0), visible: canViewPrice }
] : []

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

const phoneStatuses: Phone['status'][] = [
  'sold', 'reserved', 'maintenance', 'repair', 'rented', 'lost', 'damaged',
  'returned', 'in_stock', 'peer_transfer', 'supplier_proxy'
]

const normalizePhoneStatus = (value: unknown): Phone['status'] => (
  typeof value === 'string' && phoneStatuses.includes(value as Phone['status'])
    ? value as Phone['status']
    : 'in_stock'
)

export const normalizeSalesPhone = (record: Record<string, unknown>): Phone => ({
  ...record,
  id: Number(record.id || 0),
  imei: String(record.imei || ''),
  status: normalizePhoneStatus(record.status),
  purchase_cost: record.purchase_cost === null || record.purchase_cost === undefined
    ? undefined
    : Number(record.purchase_cost)
})

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
    const formatted = TimeUtil.format(dateValue, TIME_FORMATS.DATE)
    return formatted === 'Invalid Date' ? '-' : formatted
  } catch (error) {
    logger.error(`日期格式化错误: ${String(dateValue)}`, error)
    return '-'
  }
}
