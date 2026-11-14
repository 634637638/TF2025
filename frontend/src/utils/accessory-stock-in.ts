import type { AccessoryStockInInput, AccessoryStockInReceipt } from '@/types/accessory'

const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))
const number = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const integer = (value: unknown): value is number => number(value) && Number.isSafeInteger(value) && value >= 0
const optionalNumber = (value: unknown) => value === undefined || value === null || number(value)
const texts = ['barcode', 'name', 'category', 'unit', 'remarks', 'description', 'image_url']
const numbers = ['accessory_id', 'category_id', 'brand_id', 'model_id', 'color_id', 'supplier_id', 'unit_id', 'status', 'min_stock', 'store_id', 'total_quantity']
const keys = new Set([...texts, ...numbers, 'request_key', 'product_model', 'purchase_cost', 'sale_price', 'usage_type', 'serial_tracking', 'serial_numbers', 'model_ids', 'distribution'])

/** 会话持久化属于不可信边界，恢复时只接受唯一入库DTO内的字段和类型。 */
export const isAccessoryStockInInput = (value: unknown): value is AccessoryStockInInput => {
  if (!record(value) || typeof value.request_key !== 'string' || !/^[a-f0-9]{32}$/.test(value.request_key) ||
    Object.keys(value).some(key => !keys.has(key))) return false
  if (!texts.every(key => value[key] === undefined || typeof value[key] === 'string') ||
    !numbers.every(key => optionalNumber(value[key])) ||
    !(value.product_model === undefined || value.product_model === null || typeof value.product_model === 'string')) return false
  for (const key of ['purchase_cost', 'sale_price']) if (value[key] !== undefined && !number(value[key]) && typeof value[key] !== 'string') return false
  if (value.usage_type !== undefined && value.usage_type !== 'sale' && value.usage_type !== 'gift' ||
    value.serial_tracking !== undefined && value.serial_tracking !== 0 && value.serial_tracking !== 1) return false
  if (value.model_ids !== undefined && (!Array.isArray(value.model_ids) || !value.model_ids.every(integer))) return false
  if (value.distribution !== undefined && (!Array.isArray(value.distribution) || value.distribution.length > 1000 || !value.distribution.every(item =>
    record(item) && integer(item.store_id) && integer(item.quantity) && Object.keys(item).every(key => ['store_id', 'quantity'].includes(key))))) return false
  return value.serial_numbers === undefined || Array.isArray(value.serial_numbers) && value.serial_numbers.length <= 1000 && value.serial_numbers.every(item =>
    record(item) && typeof item.serial_number === 'string' && item.serial_number.length <= 100 && integer(item.store_id) &&
    Object.keys(item).every(key => ['serial_number', 'store_id'].includes(key)))
}

export const isAccessoryStockInReceipt = (value: unknown): value is AccessoryStockInReceipt => record(value) &&
  integer(value.accessory_id) && value.accessory_id > 0 && typeof value.replayed === 'boolean' &&
  (value.stock_in_id === null || integer(value.stock_in_id) && value.stock_in_id > 0) &&
  (value.batch_no === null || typeof value.batch_no === 'string' && value.batch_no.length > 0) &&
  (value.quantity === null || integer(value.quantity) && value.quantity > 0) &&
  (value.total_amount === null || number(value.total_amount) && value.total_amount >= 0) &&
  (value.inventory_time === null || typeof value.inventory_time === 'string' && value.inventory_time.length > 0)
