export interface StockInPhoneItem {
  id?: number | string
  brand?: number | string
  model?: number | string
  color?: number | string
  memory?: number | string
  serial_number?: string
  imei?: string
  purchase_price?: number
  is_published?: number
  supplier_id?: number | string
  store_id?: number | string
  created_at?: string
  imeiValid?: boolean
  serialValid?: boolean
  isNoIMEIMode?: boolean
}

export interface StockInFormModel {
  id?: string
  supplier_id: string
  store_id: string | number
  stock_in_date: string
  operator_name: string
  product_status: string
  remarks: string
  phones: StockInPhoneItem[]
}
