import { fieldPermissions } from '@/composables/useFieldPermissions'

export const PREORDER_FIELD_MODULE_KEY = 'preorders_preordersview'

export const PREORDER_FIELD_IDS = {
  stats_pending_count: 'stats.pending_count',
  stats_matched_count: 'stats.matched_count',
  stats_delivered_count: 'stats.delivered_count',
  stats_cancelled_count: 'stats.cancelled_count',
  preorder_number: 'basic_info.preorder_number',
  supplier_name: 'supplier_info.supplier_name',
  store_name: 'store_info.store_name',
  customer_name: 'customer_info.customer_name',
  customer_phone: 'customer_info.customer_phone',
  brand_name: 'product_info.brand_name',
  model_name: 'product_info.model_name',
  color_name: 'product_info.color_name',
  memory_size: 'product_info.memory_size',
  is_new: 'product_info.is_new',
  imei: 'product_info.imei',
  serial_number: 'product_info.serial_number',
  deposit_amount: 'price_info.deposit_amount',
  total_price: 'price_info.total_price',
  matchable_sale_price: 'price_info.matchable_sale_price',
  actual_price: 'price_info.actual_price',
  remaining_amount: 'price_info.remaining_amount',
  status: 'status_info.status',
  expected_arrival: 'time_info.expected_arrival',
  created_at: 'time_info.created_at',
  matched_time: 'time_info.matched_time',
  delivered_time: 'time_info.delivered_time',
  operator_name: 'operator_info.operator_name',
  preorder_person_name: 'operator_info.operator_name',
  sales_operator_name: 'operator_info.operator_name',
  remarks: 'other_info.remarks',
  operations: 'system_info.operations'
} as const

export type PreorderFieldName = keyof typeof PREORDER_FIELD_IDS

export const getPreorderFieldId = (fieldName: PreorderFieldName) => PREORDER_FIELD_IDS[fieldName]

export const canViewPreorderField = (fieldName: PreorderFieldName) => (
  fieldPermissions.isFieldVisible(PREORDER_FIELD_MODULE_KEY, getPreorderFieldId(fieldName))
)

export const pickVisiblePreorderFields = <T extends Record<string, unknown>>(
  source: T,
  fieldMap: Partial<Record<keyof T, PreorderFieldName>>
) => Object.fromEntries(
  Object.entries(source).filter(([key]) => {
    const fieldName = fieldMap[key as keyof T]
    return fieldName ? canViewPreorderField(fieldName) : false
  })
) as Partial<T>
