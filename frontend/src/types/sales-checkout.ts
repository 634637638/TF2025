import type { ReturnStockDetails } from './return-stock'
import type { AccessoryUsageType } from './accessory'
import type { CustomerPointsSource } from './customer-points'

/** 共同结算提交手机销售事实及本次出库确认的入库成本。 */
export interface CheckoutPhone {
  phone_id: number
  sale_price: number
  label: string
  purchase_cost?: number | null
}
/** 快速出库的待创建设备；真实 phone_id 只能由后端事务生成。 */
export interface CheckoutQuickPhone {
  brand_id: number
  model_id: number
  color_id: number
  memory_id: number
  supplier_id: number
  is_new: number
  imei: string
  serial_number: string
  purchase_cost: number | null
  sale_price: number
  inventory_time: string
}
export interface CheckoutGoodsOption {
  id: number
  name: string
  brand_name: string | null
  category?: string | null
  color_name?: string | null
  unit?: string | null
  product_model: string | null
  barcode: string | null
  sale_price: number | string | null
  purchase_cost?: number | string | null
  quantity: number
  serial_quantity: number | null
  serial_number?: string | null
}
export interface CheckoutCustomerSummary {
  available_points: number | null
  member_number: string | null
  points: number | null
  balance: number | null
}
export interface CheckoutGoodsItem {
  key: string
  accessory_id: number
  quantity: number
  unit_price: number
  sale_type: AccessoryUsageType
  linked_phone_id?: number | null
  serial_numbers?: string[]
  redeem_points?: number
  gift_return_unit_price?: number | null
}
export interface CheckoutGoodsDraft {
  key: string
  option: CheckoutGoodsOption | null
  quantity: number
  unit_price: number | null | undefined
  sale_type: AccessoryUsageType
  linked_phone_id: number | null
  serial_mode: boolean
  serial_numbers: string[]
  redeem_points?: number | null
  gift_return_unit_price: number | null | undefined
}
export interface CheckoutCustomerForm {
  customer_name: string
  customer_phone: string
  apple_id?: string
  store_id: string | number
  operator_id: string | number
  sale_time: string
  payment_method: string
  payment_channel: string
  transaction_no: string
  remarks: string
}

/** 附加商品确认仅保存草稿；外层手机销售确认时才提交共同结算。 */
export interface CheckoutAdditionalGoodsDraft {
  remarks?: string
  goods: CheckoutGoodsDraft[]
  store_id: number
  points_quote: CheckoutPointsQuote | null
  points_context: string
}
export interface SalesCheckoutInput {
  request_key: string
  store_id: number
  operator_id: number
  customer_info: { name: string; phone: string; apple_id?: string }
  phones: Array<Pick<CheckoutPhone, 'phone_id' | 'sale_price' | 'purchase_cost'>>
  quick_phone?: CheckoutQuickPhone
  film_service?: { customer_id: number; phone_id: number; mode: 'free'; quantity: number; accessory_id?: number } | { customer_id: number; phone_id: number; mode: 'paid' }
  accessories: CheckoutGoodsItem[]
  sale_time: string
  remarks?: string
  payment_info: { payment_method: string; payment_channel: string | null; transaction_no?: string | null; payment_amount: number; payment_status: 'success'; payment_time: string }
}
export interface SalesCheckoutResult {
  order_id: number
  order_no: string
  items: Array<{ id: number; type: 'phone' | 'accessory'; sale_id?: number; phone_id?: number; accessory_sale_id?: number; linked_phone_sale_id?: number | null }>
  payment_ids: number[]
  total_amount: number
  points_earned: number
  points_used: number
  /** 老幂等结果没有这两个字段，新结算始终返回。 */
  deduction_amount?: number
  paid_amount?: number
  film_service_id?: number
}

export interface FilmServiceContext {
  device?: { phone_id: number; model_id: number; model_name: string } | null
  customer_id: number
  eligible_for_free: boolean
  service_count: number
  film_quantity: number | null
  free_count: number | null
  paid_count: number | null
  device_service_count: number | null
  device_film_quantity: number | null
  data: Array<{ phone_id?: number | null; model_id?: number | null; phone_model_name?: string | null; id: number; order_id: number | null; order_no: string | null; quantity: number | null;
    store_id: number | null; store_name: string | null; operator_id: number | null; operator_name: string | null;
    business_time: string | null; created_at: string | null;
    items: Array<{ name: string | null; unit?: string | null; sale_type: AccessoryUsageType | null; quantity: number | null; total_amount: number | string | null }> }>
  pagination: { page: number; page_size: number; total: number; total_pages: number; has_next: boolean; has_prev: boolean }
}

export interface CheckoutPointsQuote {
  available_points: number
  balance: number
  redemption_ready: boolean
  points_per_yuan: number | null
  gross_cents: number
  points_used: number
  points_awarded: number
  deduction_cents: number
  payable_cents: number
  balance_after: number
  lines: Array<{ key: string; source: CustomerPointsSource; quantity: number; gross_cents: number;
    points_used: number; points_awarded: number; deduction_cents: number; payable_cents: number;
    units: Array<{ quantity: number; points_used: number; deduction_cents: number; payable_cents: number; points_awarded: number }> }>
}

/** 商品售后以原共同明细为依据；试算不保留库存或积分额度。 */
export interface GoodsReturnContext {
  order_id: number
  item_id: number
  name: string | null
  sale_type: AccessoryUsageType
  quantity: number
  returned_quantity: number
  remaining_quantity: number
  serial_tracking: boolean
  serial_numbers: string[]
}
export interface GoodsReturnInput {
  request_key: string
  store_id: number
  quantity: number
  serial_numbers: string[]
  return_reason: string
  reversal_date: string
  remarks: string
  restock_confirmed: true
  settlement?: { refund_amount: number; collection_amount: number; method: string | null; channel: string | null; confirmed: boolean }
}
export interface GoodsReturnQuote {
  order_id: number
  item_id: number
  store_id: number
  quantity: number
  serial_numbers: string[]
  remaining_quantity: number
  base_refund_amount: number
  points_recovery_amount: number
  points_compensation_amount: number
  refund_amount: number
  collection_amount: number
  points_delta: number
  points_award_returned: number
  points_redemption_returned: number
}
export interface GoodsReturnResult extends GoodsReturnQuote { aftersale_id: number }

export interface GoodsExchangeContext extends GoodsReturnContext {
  replacement_sale_type: AccessoryUsageType
  gift_charge_settled: boolean
}
export interface GoodsExchangeInput extends GoodsReturnInput {
  operator_id: number
  replacement: Pick<CheckoutGoodsItem, 'accessory_id' | 'quantity' | 'unit_price' | 'serial_numbers' | 'redeem_points'>
  additional_goods?: Array<Pick<CheckoutGoodsItem, 'key' | 'accessory_id' | 'quantity' | 'unit_price' | 'sale_type' | 'serial_numbers' | 'gift_return_unit_price'>>
}
export interface GoodsExchangeQuote extends GoodsReturnQuote {
  operator_id: number
  replacement_accessory_id: number
  replacement_serial_numbers: string[]
  replacement_amount: number
  additional_amount?: number
  replacement_paid_amount: number
  additional_paid_amount?: number
  original_collection_amount: number
  points_used: number
  points_earned: number
  deduction_amount: number
  additional_goods?: Array<{ accessory_id: number; quantity: number; amount: number; sale_type: AccessoryUsageType; serial_numbers: string[] }>
}
export interface GoodsExchangeResult extends GoodsExchangeQuote {
  aftersale_id: number
  replacement_order_id: number
  replacement_item_id: number
  root_order_id: number
  root_item_id: number
  exchange_credit_amount: number
}

/** 原单赠品未退约定；null 与明确零元分别保留。 */
export interface GiftReturnAgreement {
  gift_return_unit_price: number | null
  gift_return_total: number | null
  gift_agreement_state: 'recorded' | 'not_recorded' | null
}

export interface PhoneReturnAccessoryCheck extends GiftReturnAgreement {
  item_id: number
  accessory_id: number | null
  accessory_sale_id: number
  sale_type: AccessoryUsageType | null
  name: string | null
  /** 原销售快照单位；旧接口可缺失，未知或字段脱敏为 null。 */
  unit?: string | null
  quantity: number | null
  returned_quantity: number | null
  remaining_quantity: number | null
  serial_numbers: string[] | null
  available_serial_numbers: string[] | null
  unit_price: number | null
  total_amount: number | null
  remaining_gift_return_total: number | null
}

export interface PhoneReturnChecklist {
  order_id: number
  order_no: string
  store_id: number
  phone: { item_id: number; sale_id: number; phone_id: number; total_amount: number | null; points_awarded: number | null }
  accessories: PhoneReturnAccessoryCheck[]
}

export interface PhoneReturnAccessoryDraft {
  item_id: number
  quantity: number
  serial_numbers: string[]
}

export type PhoneReturnSource =
  | { mode: 'standalone'; phone_id: number; sale_id: number }
  | ({ mode: 'checkout' } & PhoneReturnChecklist)

export interface PhoneReturnInput extends Omit<GoodsReturnInput, 'quantity' | 'serial_numbers'>,
  Partial<Pick<ReturnStockDetails, 'return_type' | 'handle_method'>> {
  accessories: Array<{ item_id: number; quantity: number; serial_numbers: string[]; charge_missing: boolean; charge_confirmed: boolean }>
}
export interface PhoneReturnQuote extends Pick<GoodsReturnQuote, 'order_id' | 'store_id' | 'base_refund_amount' |
  'points_recovery_amount' | 'points_compensation_amount' | 'refund_amount' | 'collection_amount' | 'points_delta'> {
  sale_id: number
  phone_id: number
  gift_charge_amount: number
  accessories: Array<{ item_id: number; returned_quantity: number; remaining_quantity: number; gift_charge_quantity: number; gift_charge_amount: number }>
}
export interface PhoneReturnResult extends PhoneReturnQuote { aftersale_id: number }

/** 原共同结算的只读投影；null表示原值未知或字段不可见，不能补为0。 */
export interface CheckoutOrderItem extends GiftReturnAgreement {
  id: number
  item_type: 'phone' | 'accessory'
  sale_no: string | null
  linked_phone_sale_no: string | null
  sale_type: AccessoryUsageType | null
  name: string | null
  brand_name: string | null
  product_model: string | null
  color_name: string | null
  memory: string | null
  imei: string | null
  serial_numbers: string[] | null
  unit: string | null
  quantity: number | null
  unit_price: number | null
  reference_unit_price?: number | null
  reference_total_amount?: number | null
  gross_amount: number | null
  discount_amount?: number | null
  total_amount: number | null
  points_used: number | null
  deduction_amount: number | null
  points_awarded: number | null
}
export interface CheckoutOrderDetail {
  id: number
  order_no: string | null
  customer_name: string | null
  customer_phone: string | null
  store_name: string | null
  operator_name: string | null
  sale_time: string | null
  remarks: string | null
  total_amount: number | null
  final_amount: number | null
  paid_amount: number | null
  deduction_amount: number | null
  points_used: number | null
  points_awarded: number | null
  items: CheckoutOrderItem[]
}
export type CheckoutOrderSource = 'goods' | 'phone'
