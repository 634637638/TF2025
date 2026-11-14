import type { PaginatedResponse } from '@/types'
import type { CheckoutOrderDetail } from '@/types/sales-checkout'
import type { CustomerGoodsRecord, GoodsAftersaleRecord } from '@/types/accessory'

const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))
const integer = (value: unknown, min = 0): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= min
const money = (value: unknown): value is number => typeof value === 'number' && value >= 0 &&
  Number.isSafeInteger(Math.round(value * 100)) && Math.abs(value * 100 - Math.round(value * 100)) < 0.000001
const signedMoney = (value: unknown): value is number => typeof value === 'number' && money(Math.abs(value))
const textFields = ['return_reason', 'store_name', 'operator_name', 'settlement_method', 'settlement_channel', 'business_time', 'created_at', 'remarks']
const moneyFields = ['base_refund_amount', 'points_recovery_amount', 'points_compensation_amount', 'refund_amount', 'collection_amount',
  'gift_charge_amount', 'replacement_amount', 'exchange_credit_amount']
const serialList = (value: unknown): value is string[] | null => value === null || Array.isArray(value) &&
  value.every(sn => typeof sn === 'string' && Boolean(sn.trim())) && new Set(value).size === value.length

const validRow = (value: unknown): value is GoodsAftersaleRecord => {
  if (!record(value) || !integer(value.id, 1) ||
    typeof value.operation_type !== 'string' || !['goods_return', 'phone_return', 'goods_exchange'].includes(value.operation_type) ||
    textFields.some(key => value[key] !== null && typeof value[key] !== 'string') ||
    ['store_id', 'operator_id'].some(key => value[key] !== null && !integer(value[key], 1)) ||
    ['quantity', 'gift_charge_quantity'].some(key => value[key] !== null && !integer(value[key])) ||
    value.quantity === 0 && (typeof value.gift_charge_quantity !== 'number' || value.gift_charge_quantity < 1) ||
    ['points_award_returned', 'points_redemption_returned'].some(key => value[key] !== null && !integer(value[key])) ||
    value.points_delta !== null && !integer(value.points_delta, -2147483648)) return false
  const serials = value.serial_numbers, replacement = value.replacement
  if (!serialList(serials) || serials && serials.length > 0 && value.quantity !== null && serials.length !== value.quantity) return false
  if (value.operation_type === 'goods_exchange') {
    if (!record(replacement) || ['name', 'sale_no', 'order_no', 'operator_name'].some(key =>
      replacement[key] !== null && (typeof replacement[key] !== 'string' || !replacement[key].trim())) ||
      !serialList(replacement.serial_numbers) || replacement.serial_numbers && replacement.serial_numbers.length > 0 &&
      value.quantity !== null && replacement.serial_numbers.length !== value.quantity || value.quantity === 0) return false
  } else if (replacement !== null || [value.replacement_amount, value.exchange_credit_amount].some(amount => amount !== null && amount !== 0)) return false
  const amounts = moneyFields.map(key => value[key])
  const financial = [...amounts, value.settlement_offset_amount, value.points_delta, value.points_award_returned,
    value.points_redemption_returned, value.settlement_method, value.settlement_channel]
  if (amounts.some(amount => amount !== null && !money(amount)) ||
    value.settlement_offset_amount !== null && !signedMoney(value.settlement_offset_amount)) return false
  if (amounts.every(amount => amount === null)) {
    if (financial.some(item => item !== null)) return false
  } else {
    if (!amounts.every(money) || !signedMoney(value.settlement_offset_amount) ||
      ['points_delta', 'points_award_returned', 'points_redemption_returned'].some(key => value[key] === null)) return false
    const [base, recovery, compensation, refund, collection, charge, newAmount, credit] = amounts.map(amount => Math.round(amount * 100))
    const offset = Math.round(value.settlement_offset_amount * 100)
    const net = base + compensation - recovery - charge - newAmount - offset
    if (![base + compensation, base + compensation - recovery - charge, net].every(Number.isSafeInteger) ||
      refund && collection || net !== refund - collection ||
      value.operation_type === 'goods_exchange' && (credit !== Math.max(0, newAmount - collection) || offset !== 0 || charge !== 0)) return false
  }
  return true
}

/** 分页与每条资金回执均校验；脱敏 null 不得被当作零值。 */
const validPage = (value: unknown, page: number, pageSize: number): value is { data: unknown[]; pagination: PaginatedResponse<unknown>['pagination'] } => {
  if (!record(value) || !record(value.pagination) || !Array.isArray(value.data)) return false
  const pagination = value.pagination
  if (!integer(pagination.total)) return false
  const totalPages = Math.ceil(pagination.total / pageSize)
  return pagination.page === page && pagination.page_size === pageSize &&
    pagination.total_pages === totalPages && pagination.has_next === (page < totalPages) &&
    pagination.has_prev === (page > 1) && value.data.length <= pageSize &&
    value.data.length === Math.min(pageSize, Math.max(0, pagination.total - (page - 1) * pageSize))
}

export const isGoodsAftersalesPage = (value: unknown, page: number, pageSize: number): value is Pick<PaginatedResponse<GoodsAftersaleRecord>, 'data' | 'pagination'> =>
  validPage(value, page, pageSize) && value.data.every(validRow) && new Set(value.data.map(row => row.id)).size === value.data.length

const customerGoodsRow = (value: unknown): value is CustomerGoodsRecord => {
  if (!record(value) || !integer(value.id, 1) || typeof value.has_order !== 'boolean' ||
    value.has_snapshot !== true && value.has_snapshot !== false && value.has_snapshot !== 0 && value.has_snapshot !== 1 ||
    ['sale_no', 'order_no', 'linked_phone_invoice', 'store_name', 'name', 'category', 'brand_name', 'product_model', 'color_name',
      'unit', 'operator_name', 'sale_time', 'remarks'].some(key => value[key] !== null && typeof value[key] !== 'string') ||
    value.sale_type !== null && value.sale_type !== 'sale' && value.sale_type !== 'gift') return false
  const numeric = (input: unknown, amount = false) => input === null ||
    (typeof input === 'number' || typeof input === 'string' && /^\d+(?:\.\d{1,2})?$/.test(input)) &&
    (amount ? money(Number(input)) : integer(Number(input)))
  if (value.quantity !== null && !integer(value.quantity, 1) ||
    value.points_awarded !== null && !integer(value.points_awarded) ||
    ['returned_quantity', 'remaining_quantity', 'points_used'].some(key => !numeric(value[key])) ||
    ['unit_price', 'total_price', 'deduction_amount'].some(key => !numeric(value[key], true))) return false
  const quantity = value.quantity, returned = value.returned_quantity, remaining = value.remaining_quantity
  return quantity === null || returned === null || remaining === null ||
    Number(quantity) > 0 && Number(returned) + Number(remaining) === Number(quantity)
}

/** 客户列表允许合法脱敏空值，拒绝分页错位、重复记录及错误退货数量。 */
export const isCustomerGoodsPage = (value: unknown, page: number, pageSize: number): value is Pick<PaginatedResponse<CustomerGoodsRecord>, 'data' | 'pagination'> =>
  validPage(value, page, pageSize) && value.data.every(customerGoodsRow) && new Set(value.data.map(row => row.id)).size === value.data.length

/** 原单完整性校验兼容脱敏null，不把残缺金额拼成看似完整的订单。 */
export const isCheckoutOrderDetail = (value: unknown): value is CheckoutOrderDetail => {
  if (!record(value) || !integer(value.id, 1) || !Array.isArray(value.items) || !value.items.length ||
    ['order_no', 'customer_name', 'customer_phone', 'store_name', 'operator_name', 'sale_time', 'remarks'].some(key =>
      value[key] !== null && typeof value[key] !== 'string')) return false
  const totals = ['total_amount', 'final_amount', 'paid_amount', 'deduction_amount', 'points_used', 'points_awarded']
  if (totals.some(key => value[key] !== null && !(key.startsWith('points_') ? integer(value[key]) : money(value[key])))) return false
  const ids = new Set<number>()
  let gross = 0, net = 0, deduction = 0, used = 0, awarded = 0, complete = true
  for (const row of value.items) {
    if (!record(row) || !integer(row.id, 1) || ids.has(row.id) || !['phone', 'accessory'].includes(String(row.item_type)) ||
      ['sale_no', 'linked_phone_sale_no', 'name', 'brand_name', 'product_model', 'color_name', 'memory', 'imei', 'unit'].some(key =>
        row[key] !== null && typeof row[key] !== 'string') || (row.sale_type !== null && row.sale_type !== 'sale' && row.sale_type !== 'gift') ||
      row.quantity !== null && !integer(row.quantity, 1) || !serialList(row.serial_numbers) ||
      row.serial_numbers && row.serial_numbers.length > 0 && row.quantity !== null && row.serial_numbers.length !== row.quantity) return false
    ids.add(row.id)
    const keys = ['unit_price', 'gross_amount', 'total_amount', 'deduction_amount', 'points_used', 'points_awarded']
    if (keys.some(key => row[key] !== null && !(key.startsWith('points_') ? integer(row[key]) : money(row[key])))) return false
    if (keys.every(key => row[key] === null)) complete = false
    else {
      if (keys.some(key => row[key] === null) || !integer(row.quantity, 1) || row.sale_type === null ||
        Math.round(Number(row.unit_price) * 100) * row.quantity !== Math.round(Number(row.gross_amount) * 100) ||
        Math.round(Number(row.gross_amount) * 100) - Math.round(Number(row.deduction_amount) * 100) !== Math.round(Number(row.total_amount) * 100) ||
        row.sale_type === 'gift' && keys.some(key => row[key] !== 0)) return false
      gross += Math.round(Number(row.gross_amount) * 100); net += Math.round(Number(row.total_amount) * 100)
      deduction += Math.round(Number(row.deduction_amount) * 100); used += Number(row.points_used); awarded += Number(row.points_awarded)
    }
  }
  if (totals.every(key => value[key] === null)) return true
  return complete && totals.every(key => value[key] !== null) &&
    Math.round(Number(value.total_amount) * 100) === gross && Math.round(Number(value.final_amount) * 100) === net &&
    Math.round(Number(value.deduction_amount) * 100) === deduction && Number(value.points_used) === used &&
    Number(value.points_awarded) === awarded && Number(value.paid_amount) <= Number(value.final_amount)
}
