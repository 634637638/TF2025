import { fieldPermissions } from '@/composables/useFieldPermissions'

export const ACCESSORY_FIELD_MODULE_KEY = 'accessories_accessoriesview'

export const ACCESSORY_FIELD_IDS = {
  sequence: 'basic_info.sequence', name: 'basic_info.name', barcode: 'basic_info.barcode', batch_no: 'basic_info.batch_no',
  category: 'basic_info.category', brand_name: 'basic_info.brand_name', model_name: 'basic_info.model_name',
  color_name: 'basic_info.color_name', supplier_name: 'basic_info.supplier_name', unit: 'basic_info.unit',
  specifications: 'basic_info.specifications', image_url: 'basic_info.image_url',
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

export const canViewAccessoryField = (field: AccessoryFieldName) => fieldPermissions.isFieldVisible(
  ACCESSORY_FIELD_MODULE_KEY,
  ACCESSORY_FIELD_IDS[field]
)

export const pickVisibleAccessoryFields = <T extends object>(
  source: T,
  fieldMap: Partial<Record<keyof T, AccessoryFieldName>>
) => Object.fromEntries(
  Object.entries(source as Record<string, unknown>).filter(([key]) => {
    const field = fieldMap[key as keyof T]
    return field ? canViewAccessoryField(field) : false
  })
) as Partial<T>
