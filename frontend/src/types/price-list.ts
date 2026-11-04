import type { Brand, Color, MemoryOption, Model } from './index'

export type PriceValue = number | string | null

export interface PriceListRow {
  id: number | null
  price_list_id?: number | null
  brand_id?: number | null
  model_id?: number | null
  color_id?: number | null
  memory_id?: number | null
  brand_name: string
  model_number: string
  external_model?: string
  color_name: string
  memory: string
  wholesale_price?: PriceValue
  retail_price?: PriceValue
  sales_display_price?: PriceValue
  wholesale_display_price?: PriceValue
  stock_quantity: number
  last_sync_time?: string | null
  is_collect: number
  status: number
  show_price: number
  source_config_id?: number | null
  source_name?: string
  source_type?: 'public' | 'account'
  source_login_username?: string
  price_trend?: string
  price_change_amount?: PriceValue
  remark?: string
  [key: string]: unknown
}

/** 面向客户展示的销售价记录，兼容接口中的展示价字段。 */
export interface SalesPriceDisplayRow extends PriceListRow {
  display_retail_price?: PriceValue
}

export interface PriceHistoryRecord {
  id: number
  price_list_id?: number
  wholesale_price?: PriceValue
  retail_price?: PriceValue
  change_type?: string
  change_reason?: string
  created_at?: string | null
  [key: string]: unknown
}

export interface PriceTrendRecord {
  price_list_id: number
  price_trend?: string
  price_change_amount?: PriceValue
  [key: string]: unknown
}

export interface PriceSyncConfig {
  id: number
  is_default: boolean | number
  config_name: string
  source_type: 'public' | 'account'
  source_url: string
  login_url?: string
  login_username?: string
  login_password?: string
  has_password?: boolean
  sync_interval?: number
  [key: string]: unknown
}

export interface PriceMarkupConfig {
  mode: 'fixed' | 'percentage'
  lowFixed: number
  highFixed: number
  lowPercent: number
  highPercent: number
  threshold: number
  enabled: boolean
  wholesale: {
    enabled: boolean
    adjustment: number
    sourceAdjustments: Record<string, number>
  }
  used: {
    adjustment: number
  }
}

export interface PriceInventoryRow {
  id?: number
  brand?: string
  model?: string
  color?: string
  memory?: string
  imei?: string
  serial_number?: string
  inventory_time?: string | null
  inventory_days: number
  [key: string]: unknown
}

export interface PriceReferenceOptions {
  brands: Brand[]
  models: Model[]
  allModels: Model[]
  colors: Color[]
  memories: MemoryOption[]
}

export interface PriceListEditPayload {
  id: number
  brand_name: string
  model_number: string
  color_name: string | null
  memory: string | null
  external_model: string
  wholesale_price: PriceValue
  last_sync_time: string | null
  is_collect: number
  status: number
  show_price: number
  remark: string
  source_config_id: number | null
  is_manual_edit: boolean
}
