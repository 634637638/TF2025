import type { ModelOption, ModelValueProps, QueryOperationOptions } from '@/types'

export interface QuickSaleProps extends ModelValueProps {
  options: QueryOperationOptions
  initialData?: {
    brand_id?: number
    model_id?: number
    color_id?: number
    memory_id?: number
    is_new?: string | number | boolean
    imei?: string
    serial_number?: string
    supplier_id?: number | null
    store_id?: number | null
    purchase_cost?: number | null
    sale_price?: number | null
  } | null
}

export interface QuickSaleCustomerOption {
  id: number
  name: string
  phone: string
  apple_id: string
  member_number: string
  vip_level: string
}

export type BrandModelOption = ModelOption

export interface QuickSaleFormState {
  brand_id: number | null
  model_id: number | null
  color_id: number | null
  memory_id: number | null
  is_new: string
  status: string
  imei: string
  serial_number: string
  supplier_id: number | null
  store_id: number | null
  purchase_cost: number | null
  sale_price: number | null
  customer_name: string
  customer_phone: string
  apple_id: string
  inventory_time: string
  purchase_operator_id: number | null
  sale_time: string
  sale_operator_id: number | null
  payment_method: string
  payment_channel: string
  isNoIMEIMode: boolean
  remarks: string
}

export type PriceField = 'purchase_cost' | 'sale_price'
