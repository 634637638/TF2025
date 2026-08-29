import type { Customer, PhoneBrand } from '@/types'
import type { Operator, Store, Supplier } from '@/types'

export interface BatchCustomer extends Customer {
  apple_id?: string
}

export interface SalesCustomer {
  id: number
  name: string
  phone: string
  apple_id?: string
  member_number?: string
  vip_level?: 'normal' | 'silver' | 'gold' | 'platinum' | string
}

export interface SalesCheckoutFormData {
  customer_name: string
  customer_phone: string
  customer_apple_id: string
  sale_price: string
  purchase_cost: string
  store_id: string
  operator_id: string
  sale_time: string
  payment_method: string
  payment_channel: string
  transaction_no: string
  remarks: string
}

export interface BatchSaleFormData {
  customer_name: string
  customer_phone: string
  apple_id: string
  sale_price: string
  store_id: string
  operator_id: string
  sale_time: string
  payment_method: string
  payment_channel: string
  transaction_no: string
  remarks: string
}

export interface SalesNamedOption {
  id?: number | string
  name?: string
  sort_order?: number
  size?: string
  capacity?: string
}

export interface SalesBrandRecord extends PhoneBrand {
  sort_order?: number
}

export interface SalesModelRecord {
  id: number
  name: string
  status: number
  sort_order: number
}

export interface SalesFilters {
  brand: string
  model: string
  color: string
  memory: string
  store_id: string
  supplier_id: string
  operator_id: string
  is_new: string
  date_range: string
  start_date: string
  end_date: string
  search: string
}

export type SalesStoreOption = Store
export type SalesSupplierOption = Supplier
export type SalesOperatorOption = Operator

export type SalesColorResponse = SalesNamedOption[] | { colors?: SalesNamedOption[] }
export type SalesMemoryResponse = SalesNamedOption[] | { memories?: SalesNamedOption[] }

export const hasSalesOptionName = (
  item: SalesNamedOption
): item is SalesNamedOption & { name: string } => {
  return typeof item?.name === 'string' && item.name.trim().length > 0
}

export interface InventorySummaryItem {
  supplier_id?: number | string
  supplier_name?: string
  store_id?: number | string
  store_name?: string
  brand: string
  model: string
  color: string
  memory: string
  condition: string
  quantity?: number
  earliest_date?: string
  latest_date?: string
}

export interface InventoryDetailItem {
  id: number | string
  supplier_name?: string
  store_name?: string
  brand?: string
  model?: string
  color?: string
  memory?: string
  imei?: string
  serial_number?: string
  purchase_cost?: number | string
  inventory_time?: string
  inventory_days?: number
  is_new?: boolean | number
}

export interface SalesEditForm {
  brand_id: number | null
  model_id: number | null
  color_id: number | null
  memory_id: number | null
  brand: string
  model: string
  color: string
  memory: string
  serial_number: string
  imei: string
  purchase_cost: number | null
  sale_price: number | null
  supplier_id: number | null
  store_id: number | null
  operator_id: string
  operator_name: string
  condition: string
  status: string
  inventory_time: string | null
  remarks: string
}
