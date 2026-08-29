export interface WholesaleCustomerSearchItem {
  id: number
  name: string
  phone: string
  member_number?: string
  vip_level?: string
}

export interface WholesalePhone {
  id: number
  supplier_id?: number | null
  brand?: string
  model?: string
  color?: string
  memory?: string
  purchase_cost?: number | string | null
  wholesale_price?: number | null
  supplier_name?: string
  store_name?: string
  inventory_time?: string
}

export type EditableWholesalePhone = Omit<WholesalePhone, 'purchase_cost' | 'wholesale_price'> & {
  purchase_cost: number | null
  wholesale_price: number | null
}

export interface CollectedPriceItem {
  brand_name?: string
  model_number?: string
  color_name?: string
  memory?: string
  wholesale_price?: number | string | null
  retail_price?: number | string | null
}

export interface TransferPhonePayload {
  phone_id: number
  purchase_cost: number | null
  wholesale_price: number | null
}

export interface TransferSubmitPayload {
  phone_ids: number[]
  phones: TransferPhonePayload[]
  remarks: string
  customer_id?: number
  customer_name?: string
  customer_phone?: string
  supplier_id?: number | null
  store_id?: number | null
  salesperson_name?: string
  payment_method?: string
  invoice_number?: string
  sale_time?: string
}

export interface WholesaleFormData {
  customer_id: number | null
  customer_name: string
  customer_phone: string
  supplier_id: number | null
  store_id: number | null
  salesperson_name: string
  wholesale_price: number | null
  payment_method: string
  payment_channel: string
  invoice_number: string
  sale_time: string
  remarks: string
}
