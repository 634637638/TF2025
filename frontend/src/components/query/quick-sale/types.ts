import type { Supplier, Store } from '@/types/system'
import type { Brand, Color, MemoryOption, Model, ModelValueProps, User } from '@/types'

export interface QuickSaleProps extends ModelValueProps {
  options: {
    suppliers: Supplier[]
    stores: Store[]
    brands: Brand[]
    models: Model[]
    colors: Color[]
    memories: MemoryOption[]
    users: User[]
  }
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

export interface CustomerOption {
  id: number
  name: string
  phone: string
  apple_id: string
  member_number: string
  vip_level: string
}

export type BrandModelOption = Model

export interface QuickSaleFormState {
  brand_id: number | null
  model_id: number | null
  color_id: number | null
  memory_id: number | null
  is_new: string
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
