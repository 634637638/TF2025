import type { AccessoryStockInInput, AccessoryStockInRequest, AccessoryColorStockInReceipt, AccessoryStockInReceipt, AccessoryStockCorrectionContext } from '@/types/accessory'
import { isValidAccessorySerial } from './accessory-serial'
import { isMoneyInput } from './security'
import { TimeUtil, TIME_FORMATS } from './time'

const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))
const number = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const integer = (value: unknown): value is number => number(value) && Number.isSafeInteger(value) && value >= 0
const optionalNumber = (value: unknown) => value === undefined || value === null || number(value)
const texts = ['barcode', 'name', 'category', 'unit', 'remarks', 'description', 'image_url', 'inventory_time']
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
  if (value.inventory_time !== undefined && (typeof value.inventory_time !== 'string' || value.inventory_time.length !== 19 ||
    !TimeUtil.isValid(value.inventory_time, TIME_FORMATS.DATETIME) || TimeUtil.format(value.inventory_time, TIME_FORMATS.DATETIME) !== value.inventory_time)) return false
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

export const isAccessoryStockInRequest = (value: unknown): value is AccessoryStockInRequest => {
  if (!record(value) || value.entries === undefined) return isAccessoryStockInInput(value)
  if (Object.keys(value).some(key => !['request_key', 'entries'].includes(key)) || !Array.isArray(value.entries) ||
    !value.entries.length || value.entries.length > 100) return false
  const ids = new Set<number>()
  return value.entries.every(entry => {
    if (!record(entry) || 'request_key' in entry || !isAccessoryStockInInput({ ...entry, request_key: value.request_key }) ||
      !integer(entry.accessory_id) || entry.accessory_id < 1 || ids.has(entry.accessory_id)) return false
    ids.add(entry.accessory_id)
    return true
  })
}

export const isAccessoryColorStockInReceipt = (value: unknown, count: number): value is AccessoryColorStockInReceipt => record(value) &&
  typeof value.replayed === 'boolean' && Array.isArray(value.batches) && value.batches.length === count && count > 0 &&
  value.batches.every(batch => isAccessoryStockInReceipt(batch) && batch.replayed === value.replayed) &&
  new Set(value.batches.map(batch => batch.accessory_id)).size === count

export const isAccessoryStockCorrectionContext = (value: unknown, purchaseId: number): value is AccessoryStockCorrectionContext => {
  if (!record(value) || value.purchase_id !== purchaseId || !record(value.accessory) || !integer(value.accessory.id) || value.accessory.id < 1 ||
    !integer(value.supplier_id) || value.supplier_id < 1 || !integer(value.store_id) || value.store_id < 1 ||
    !integer(value.total_quantity) || value.total_quantity < 1 || value.total_quantity > 999999 ||
    !number(value.purchase_cost) || value.purchase_cost < 0 || !isMoneyInput(value.purchase_cost) ||
    !['sale', 'gift'].includes(String(value.usage_type)) || value.serial_tracking !== 0 && value.serial_tracking !== 1) return false
  if ([value.batch_no, value.inventory_time, value.operator_name, value.remarks, value.supplier_name, value.store_name].some(text => text !== null && typeof text !== 'string')) return false
  if (value.serial_numbers === null) return value.serial_tracking === 0
  if (!Array.isArray(value.serial_numbers) || value.serial_numbers.length > 1000 || value.serial_numbers.some(serial =>
    !record(serial) || typeof serial.serial_number !== 'string' || !isValidAccessorySerial(serial.serial_number) || serial.store_id !== value.store_id)) return false
  return value.serial_tracking === 1 ? value.serial_numbers.length === value.total_quantity &&
    new Set(value.serial_numbers.map(serial => serial.serial_number)).size === value.serial_numbers.length : value.serial_numbers.length === 0
}
