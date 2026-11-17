import type { AccessoryPayloadSource } from '@/types/accessory'
export type { AccessoryPayloadSource } from '@/types/accessory'

const optional = <T>(value: T | null | undefined): T | undefined =>
  value === null || value === undefined || value === '' ? undefined : value

export const buildAccessoryStockInPayload = (source: AccessoryPayloadSource) => ({
  inventory_time: source.inventory_time,
  usage_type: source.usage_type || 'sale',
  barcode: optional(source.barcode),
  accessory_id: optional(source.accessory_id),
  name: optional(source.name),
  category: optional(source.category?.trim()),
  category_id: optional(source.category_id),
  product_model: source.product_model?.trim() || null,
  serial_tracking: source.serial_tracking,
  serial_numbers: source.serial_numbers,
  brand_id: source.brand_id,
  model_id: source.model_id,
  model_ids: source.model_ids,
  color_id: source.color_id,
  supplier_id: optional(source.supplier_id),
  purchase_cost: Number(source.purchase_cost || 0),
  ...(source.accessory_id ? {} : { sale_price: Number(source.sale_price || 0) }),
  unit: source.unit || '个',
  unit_id: optional(source.unit_id),
  status: source.status === undefined ? 1 : source.status,
  total_quantity: Number(source.total_quantity || 0),
  distribution: source.distribution || [],
  store_id: optional(source.store_id),
  remarks: optional(source.remarks),
  description: optional(source.description),
  image_url: optional(source.image_url)
})

export const buildAccessoryUpdatePayload = (source: AccessoryPayloadSource) => ({
  free_film: source.free_film,
  color_variants: source.color_variants?.map(row => ({ color_id: row.color_id,
    ...(row.barcode === undefined ? {} : { barcode: row.barcode?.trim() || null }) })),
  name: optional(source.name),
  barcode: source.barcode === undefined ? undefined : source.barcode.trim() || null,
  category: source.category === undefined ? undefined : source.category.trim() || null,
  category_id: source.category_id,
  product_model: source.product_model === undefined ? undefined : source.product_model?.trim() || null,
  serial_tracking: source.serial_tracking,
  min_stock: source.min_stock,
  brand_id: source.brand_id,
  model_id: source.model_id,
  model_ids: source.model_ids,
  color_id: source.color_id,
  supplier_id: optional(source.supplier_id),
  purchase_cost: source.purchase_cost === undefined ? undefined : Number(source.purchase_cost || 0),
  sale_price: source.sale_price === undefined ? undefined : Number(source.sale_price || 0),
  unit: optional(source.unit),
  unit_id: source.unit_id,
  status: source.status,
  description: optional(source.description),
  remarks: optional(source.remarks),
  image_url: optional(source.image_url)
})

/** 更正只能提交本批入库资料，不能顺便覆盖模板售价、名称、颜色等共享资料。 */
export const buildAccessoryStockCorrectionPayload = (source: AccessoryPayloadSource) => ({
  accessory_id: source.accessory_id,
  brand_id: source.brand_id,
  product_model: source.product_model?.trim() || null,
  supplier_id: source.supplier_id,
  store_id: source.store_id,
  total_quantity: source.total_quantity,
  purchase_cost: source.purchase_cost,
  usage_type: source.usage_type,
  serial_tracking: source.serial_tracking,
  serial_numbers: source.serial_numbers,
  remarks: source.remarks?.trim() || ''
})

export const buildAccessorySalePayload = (source: AccessoryPayloadSource) => ({
  accessory_id: optional(source.accessory_id),
  store_id: optional(source.store_id),
  customer_id: optional(source.customer_id),
  customer_name: optional(source.customer_name),
  customer_phone: optional(source.customer_phone),
  quantity: Number(source.quantity || 0),
  unit_price: Number(source.unit_price || 0),
  serial_numbers: source.serial_numbers,
  remarks: optional(source.remarks)
})
