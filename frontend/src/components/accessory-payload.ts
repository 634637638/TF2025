export interface AccessoryPayloadSource {
  barcode?: string
  accessory_id?: number | null
  name?: string
  category?: string
  brand_id?: number | null
  model_id?: number | null
  color_id?: number | null
  supplier_id?: number | null
  purchase_cost?: number | string
  sale_price?: number | string
  unit?: string
  specifications?: string
  status?: number
  min_stock?: number
  total_quantity?: number
  distribution?: Array<{ store_id: number; store_name?: string; quantity: number }>
  store_id?: number | null
  operator_name?: string
  remarks?: string
  description?: string
  image_url?: string
  quantity?: number
  unit_price?: number | string
  customer_id?: number | null
  customer_name?: string
  customer_phone?: string
}

const optional = <T>(value: T | null | undefined): T | undefined =>
  value === null || value === undefined || value === '' ? undefined : value

export const buildAccessoryStockInPayload = (source: AccessoryPayloadSource) => ({
  barcode: optional(source.barcode),
  accessory_id: optional(source.accessory_id),
  name: optional(source.name),
  category: optional(source.category),
  brand_id: optional(source.brand_id),
  model_id: optional(source.model_id),
  color_id: optional(source.color_id),
  supplier_id: optional(source.supplier_id),
  purchase_cost: Number(source.purchase_cost || 0),
  sale_price: Number(source.sale_price || 0),
  unit: source.unit || '个',
  specifications: optional(source.specifications),
  status: source.status === undefined ? 1 : source.status,
  min_stock: Number(source.min_stock || 0),
  total_quantity: Number(source.total_quantity || 0),
  distribution: source.distribution || [],
  store_id: optional(source.store_id),
  operator_name: optional(source.operator_name),
  remarks: optional(source.remarks),
  description: optional(source.description),
  image_url: optional(source.image_url)
})

export const buildAccessoryUpdatePayload = (source: AccessoryPayloadSource) => ({
  name: optional(source.name),
  barcode: optional(source.barcode),
  category: optional(source.category),
  brand_id: optional(source.brand_id),
  model_id: optional(source.model_id),
  color_id: optional(source.color_id),
  supplier_id: optional(source.supplier_id),
  purchase_cost: source.purchase_cost === undefined ? undefined : Number(source.purchase_cost || 0),
  sale_price: source.sale_price === undefined ? undefined : Number(source.sale_price || 0),
  specifications: optional(source.specifications),
  unit: optional(source.unit),
  status: source.status,
  description: optional(source.description),
  remarks: optional(source.remarks),
  image_url: optional(source.image_url)
})

export const buildAccessorySalePayload = (source: AccessoryPayloadSource) => ({
  accessory_id: optional(source.accessory_id),
  store_id: optional(source.store_id),
  customer_id: optional(source.customer_id),
  customer_name: optional(source.customer_name),
  customer_phone: optional(source.customer_phone),
  quantity: Number(source.quantity || 0),
  unit_price: Number(source.unit_price || 0),
  remarks: optional(source.remarks)
})
