/**
 * 国补模块共享类型。
 * 搜索设备、详情和申请提交共用这些字段，避免页面各自声明动态对象。
 */

export interface NationalSubsidyHandlerInfo {
  has_different_handler?: boolean | number | null
  handler_name?: string | null
  handler_phone?: string | null
  handler_idcard?: string | null
}

export interface NationalSubsidyExistingRecord {
  id: number
  apply_status: string
  subsidy_amount?: number | string | null
}

export interface NationalSubsidyRecord {
  id: number
  sale_id?: number | null
  phone_id?: number | null
  customer_name?: string | null
  customer_phone?: string | null
  customer_idcard?: string | null
  phone_brand?: string | null
  phone_model?: string | null
  phone_color?: string | null
  phone_memory?: string | number | null
  serial_number?: string | null
  imei1?: string | null
  imei2?: string | null
  sale_price?: number | string | null
  sale_time?: string | null
  store_id?: number | null
  store_name?: string | null
  salesman_name?: string | null
  subsidy_amount?: number | string | null
  subsidy_rate?: number | string | null
  apply_time?: string | null
  apply_status?: string | null
  arrival_time?: string | null
  remarks?: string | null
  subsidy_photos?: string[]
  is_new?: number | boolean | null
  inventory_time?: string | null
  has_different_handler?: boolean | number | null
  handler_info?: NationalSubsidyHandlerInfo | null
  handler_name?: string | null
  handler_phone?: string | null
  handler_idcard?: string | null
}

export interface NationalSubsidyStoreStats {
  store_id: number
  store_name: string
  total_count: number
  pending_count?: number
  completed_count?: number
  approved_count?: number
  total_arrived_amount?: number
  total_subsidy_amount?: number
}

export interface NationalSubsidyStats {
  total_count: number
  pending_count?: number
  completed_count?: number
  approved_count?: number
  total_arrived_amount?: number
  total_subsidy_amount?: number
  handler_count?: number
  store_stats?: NationalSubsidyStoreStats[]
}

export interface NationalSubsidyDevice {
  phone_id: number
  imei: string | null
  serial_number: string | null
  is_new: number | boolean | null
  inventory_time: string | null
  status: string | null
  brand: string | null
  model: string | null
  color: string | null
  memory: string | number | null
  sale_price: number
  sale_time: string | null
  store_name: string | null
  customer_name: string
  customer_phone: string
  has_subsidy: boolean
  subsidy_status: string | null
  subsidy_amount: number | string
  can_apply_subsidy: boolean
  reason: string
}

export interface NationalSubsidyPhoneDetail {
  phone_id: number
  sale_id: number
  customer_id: number
  customer_name: string
  customer_phone: string
  customer_idcard: string
  phone_brand: string | null
  phone_model: string | null
  phone_color: string | null
  phone_memory: string | number | null
  serial_number: string | null
  is_new: number | boolean | null
  inventory_time: string | null
  imei1: string | null
  imei2: string | null
  sale_price: number
  sale_time: string | null
  store_id: number | null
  store_name: string | null
  salesman_id: number | null
  salesman_name: string | null
  subsidy_amount: number
  subsidy_rate: number
  eligible: boolean
  eligible_reason: string
  existing_subsidy: NationalSubsidyExistingRecord | null
  handler_info?: NationalSubsidyHandlerInfo | null
}

export interface NationalSubsidyApplyPayload extends NationalSubsidyPhoneDetail {
  imei2: string
  remarks: string
  subsidy_photos: string[]
  subsidy_calc_price: number
  has_different_handler: boolean
  handler_info: NationalSubsidyHandlerInfo | null
}

export interface NationalSubsidyUploadResponse {
  url: string
  preview_url?: string
  name?: string
  mime?: string
}

export interface NationalSubsidyEditForm {
  customer_name: string
  customer_phone: string
  sale_time: string
  customer_idcard: string
  serial_number: string
  phone_brand: string
  phone_model: string
  phone_color: string
  phone_memory: string | number
  sale_price: number | null
  store_id: number | string | null
  imei1: string
  imei2: string
  apply_time: string
  arrival_time: string
  remarks: string
  has_different_handler: boolean
  handler_name: string
  handler_phone: string
  handler_idcard: string
}
