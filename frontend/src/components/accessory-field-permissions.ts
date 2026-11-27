import { fieldPermissions } from '@/composables/useFieldPermissions'

export const ACCESSORY_FIELD_MODULE_KEY = 'accessories_accessoriesview'

export const ACCESSORY_FIELD_IDS = {
  sequence: 'basic_info.sequence', name: 'basic_info.name', barcode: 'basic_info.barcode', batch_no: 'basic_info.batch_no',
  category: 'basic_info.category', brand_name: 'basic_info.brand_name', model_name: 'basic_info.model_name',
  color_name: 'basic_info.color_name', supplier_name: 'basic_info.supplier_name', unit: 'basic_info.unit',
  free_film: 'basic_info.usage_type',
  usage_type: 'basic_info.usage_type', serial_tracking: 'basic_info.serial_tracking', serial_number: 'basic_info.serial_number',
  product_model: 'basic_info.specifications', image_url: 'basic_info.image_url',
  purchase_cost: 'price_info.purchase_cost', sale_price: 'price_info.sale_price', profit: 'price_info.profit',
  unit_price: 'price_info.unit_price', total_amount: 'price_info.total_amount', total_price: 'price_info.total_price',
  total_stock: 'stock_info.total_stock', total_in: 'stock_info.total_in', total_out: 'stock_info.total_out',
  remaining_stock: 'stock_info.remaining_stock', min_stock: 'stock_info.min_stock',
  total_quantity: 'stock_info.total_quantity', distribution: 'stock_info.distribution', stock_status: 'stock_info.stock_status',
  customer_name: 'customer_info.customer_name', customer_phone: 'customer_info.customer_phone', status: 'status_info.status',
  description: 'other_info.description', remarks: 'other_info.remarks', created_at: 'time_info.created_at',
  updated_at: 'time_info.updated_at', inventory_time: 'time_info.inventory_time', operator_name: 'operator_info.operator_name',
  operations: 'system_info.operations'
} as const

export type AccessoryFieldName = keyof typeof ACCESSORY_FIELD_IDS

const canViewField = (moduleKey: string, field: AccessoryFieldName) => {
  const visible = (key: AccessoryFieldName) => fieldPermissions.isFieldVisible(moduleKey, ACCESSORY_FIELD_IDS[key])
  if (!visible(field)) return false
  if (field === 'profit') return visible('purchase_cost') && visible(moduleKey === 'query_goods' ? 'unit_price' : 'sale_price')
  if (field === 'remaining_stock') return visible('total_stock')
  return true
}

export const canViewAccessoryField = (field: AccessoryFieldName) => canViewField(ACCESSORY_FIELD_MODULE_KEY, field)

/** 综合查询商品模式的字段与商品档案独立，后端按角色兼容未单独保存的旧限制。 */
export const canViewQueryGoodsField = (field: AccessoryFieldName) => canViewField('query_goods', field)

export const QUERY_GOODS_STAT_FIELD_IDS = {
  monthlySales: 'stats.monthly_sales', monthlyGifts: 'stats.monthly_gifts',
  customerVisits: 'stats.customer_visits', monthlyBestSellers: 'stats.monthly_best_sellers'
} as const

export type QueryGoodsStatField = keyof typeof QUERY_GOODS_STAT_FIELD_IDS

export const canViewQueryGoodsStat = (field: QueryGoodsStatField) =>
  fieldPermissions.isFieldVisible('query_goods', QUERY_GOODS_STAT_FIELD_IDS[field])

export const pickVisibleAccessoryFields = <T extends object>(
  source: T,
  fieldMap: Partial<Record<keyof T, AccessoryFieldName>>
) => Object.fromEntries(
  Object.entries(source as Record<string, unknown>).filter(([key]) => {
    const field = fieldMap[key as keyof T]
    return field ? canViewAccessoryField(field) : false
  })
) as Partial<T>
