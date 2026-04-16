import type { Supplier, Store } from '@/types/system'
import type { ModelValueProps, User } from '@/types'

export interface QuickSaleProps extends ModelValueProps {
  options: {
    suppliers: Supplier[]
    stores: Store[]
    brands: string[]
    colors: string[]
    memories: string[]
    users: User[]
  }
  initialData?: {
    brand_id?: string
    model_id?: string
    color_id?: string
    memory_id?: string
    is_new?: string | number | boolean
    imei?: string
    serial_number?: string
    supplier_id?: number | null
    store_id?: number | null
    purchase_price?: number | null
    sale_price?: number | null
  } | null
}

export interface CustomerOption {
  id: number
  name: string
  phone: string
  apple_id: string
  member_number: string
}

export interface BrandModelOption {
  name: string
  status?: number
  sort_order?: number
}

export interface QuickSaleFormState {
  brand_id: string
  model_id: string
  color_id: string
  memory_id: string
  is_new: string
  imei: string
  serial_number: string
  supplier_id: number | null
  store_id: number | null
  purchase_price: number | null
  sale_price: number | null
  customer_name: string
  customer_phone: string
  apple_id: string
  stock_in_date: string
  stock_in_operator_id: number | null
  sale_date: string
  sale_operator_id: number | null
  payment_method: string
  payment_channel: string
  isNoIMEIMode: boolean
  remarks: string
}

export type PriceField = 'purchase_price' | 'sale_price'
