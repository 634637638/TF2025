export interface WholesaleCustomerSearchItem {
  id: number
  name: string
  phone: string
}

export interface WholesalePhone {
  id: number
  supplier_id?: number | null
  brand?: string
  model?: string
  color?: string
  memory?: string
  purchase_cost?: number | string | null
  purchase_price?: number | string | null
  editCost?: number | null
  wholesalePrice?: number | null
  supplier_name?: string
  store_name?: string
  Inventorytime?: string
  purchase_date?: string
  created_at?: string
}

export interface EditableWholesalePhone extends WholesalePhone {
  editCost: number
  wholesalePrice: number
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
  purchase_cost: number
  wholesale_price: number
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
  sale_date?: string
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
  sale_date: string
  remarks: string
}
