import type { AccessorySaleDetail } from './accessory'

export interface ReceiptItem {
  /** 原手机销售ID，用于精确关联本次随单配件。 */
  sale_id?: number
  phone_id: number
  brand: string
  model: string
  color: string
  memory: string
  imei: string
  serialNumber: string
  salePrice: number
  isNew: number
}

export interface SearchPhoneResult {
  sale_id?: number
  id: number
  phone_id?: number
  brand?: string
  brand_name?: string
  model?: string
  model_name?: string
  color?: string
  color_name?: string
  memory?: string
  memory_size?: string
  imei?: string
  serial_number?: string
  sale_price?: number | string
  price?: number | string
  is_new?: number
}


/** 原手机凭证的配件只读投影，不返回采购成本或供应商。 */
export type PhoneReceiptAccessory = Pick<AccessorySaleDetail, 'id' | 'name' | 'brand_name' | 'product_model' |
  'color_name' | 'unit' | 'quantity' | 'unit_price' | 'total_price' | 'sale_type' |
  'points_used' | 'deduction_amount' | 'serial_numbers'>
