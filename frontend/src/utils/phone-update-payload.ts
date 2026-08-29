export interface CanonicalPhoneUpdatePayload {
  brand_id: number | null
  model_id: number | null
  color_id: number | null
  memory_id: number | null
  imei: string
  serial_number: string
  condition: 'new' | 'used'
  supplier_id: number | null
  store_id: number | null
  purchase_cost: number | null
  sale_price: number | null
  inventory_time: string | null
  sale_time: string | null
  status?: string
  remarks: string
  customer_id?: number | null
  customer_name?: string | null
  customer_phone?: string | null
  apple_id?: string | null
  purchase_operator_id?: number | null
  sale_operator_id?: number | null
}

const nullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export const toCanonicalPhoneUpdatePayload = (source: Record<string, unknown>): CanonicalPhoneUpdatePayload => ({
  brand_id: nullableNumber(source.brand_id),
  model_id: nullableNumber(source.model_id),
  color_id: nullableNumber(source.color_id),
  memory_id: nullableNumber(source.memory_id),
  imei: String(source.imei || ''),
  serial_number: String(source.serial_number || ''),
  condition: source.condition === 'new' || source.condition === '全新' ? 'new' : 'used',
  supplier_id: nullableNumber(source.supplier_id),
  store_id: nullableNumber(source.store_id),
  purchase_cost: nullableNumber(source.purchase_cost),
  sale_price: nullableNumber(source.sale_price),
  inventory_time: source.inventory_time ? String(source.inventory_time) : null,
  sale_time: source.sale_time ? String(source.sale_time) : null,
  ...(source.status ? { status: String(source.status) } : {}),
  remarks: String(source.remarks || ''),
  ...(source.customer_id !== undefined ? { customer_id: nullableNumber(source.customer_id) } : {}),
  ...(source.customer_name !== undefined ? { customer_name: source.customer_name ? String(source.customer_name) : null } : {}),
  ...(source.customer_phone !== undefined ? { customer_phone: source.customer_phone ? String(source.customer_phone) : null } : {}),
  ...(source.apple_id !== undefined ? { apple_id: source.apple_id ? String(source.apple_id) : null } : {}),
  ...(source.purchase_operator_id !== undefined ? { purchase_operator_id: nullableNumber(source.purchase_operator_id) } : {}),
  ...(source.sale_operator_id !== undefined ? { sale_operator_id: nullableNumber(source.sale_operator_id) } : {})
})
