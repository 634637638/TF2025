/**
 * 系统设置相关类型定义
 * 集中管理站点设置、配置、日志等相关类型
 */

// ==================== 站点设置类型 ====================

/**
 * 站点基础设置
 */
export interface SiteSettings {
  site_name: string
  site_description?: string
  logo?: string
  favicon?: string
  keywords?: string
  icp_number?: string
  police_number?: string
  contact_phone?: string
  contact_email?: string
  contact_address?: string
  copyright?: string
}

/**
 * 主题设置
 */
export interface ThemeSettings {
  mode: 'light' | 'dark' | 'auto'
  primary_color: string
  accent_color: string
  sidebar_collapsed: boolean
  show_logo: boolean
  show_breadcrumb: boolean
  show_footer: boolean
  footer_text?: string
}

/**
 * 安全设置
 */
export interface SecuritySettings {
  allow_register: boolean
  require_email_verify: boolean
  require_phone_verify: boolean
  password_min_length: number
  password_require_number: boolean
  password_require_special: boolean
  session_timeout: number
  max_login_attempts: number
  login_captcha_enabled: boolean
}

/**
 * 通知设置
 */
export interface NotificationSettings {
  email_enabled: boolean
  sms_enabled: boolean
  push_enabled: boolean
  notify_on_order: boolean
  notify_on_payment: boolean
  notify_on_shipment: boolean
  notify_on_review: boolean
}

/**
 * 支付设置
 */
export interface PaymentSettings {
  wechat_enabled: boolean
  alipay_enabled: boolean
  card_enabled: boolean
  cash_enabled: boolean
  transfer_enabled: boolean
  min_withdraw_amount: number
  withdraw_fee_rate: number
}

/**
 * 物流设置
 */
export interface LogisticsSettings {
  default_shipping_method?: string
  free_shipping_threshold: number
  shipping_fee: number
  packing_fee: number
  insurance_fee: number
  express_company?: string
}

/**
 * 完整站点设置
 */
export interface FullSiteSettings {
  site: SiteSettings
  theme: ThemeSettings
  security: SecuritySettings
  notification: NotificationSettings
  payment: PaymentSettings
  logistics: LogisticsSettings
  updated_at?: string
}

/**
 * 系统设置表单数据
 */
export interface SettingsFormData {
  category: 'site' | 'theme' | 'security' | 'notification' | 'payment' | 'logistics'
  data: SiteSettings | ThemeSettings | SecuritySettings | NotificationSettings | PaymentSettings | LogisticsSettings
}

// ==================== 操作日志类型 ====================

/**
 * 操作日志类型
 */
export type LogType = 'login' | 'logout' | 'create' | 'update' | 'delete' | 'export' | 'import' | 'approve' | 'reject' | 'other'

/**
 * 操作日志
 */
export interface OperationLog {
  id: number
  type: LogType
  module: string
  action: string
  target_type?: string
  target_id?: number | string
  target_name?: string
  request_method?: string
  request_url?: string
  request_ip?: string
  request_location?: string
  request_params?: Record<string, unknown>
  request_body?: Record<string, unknown>
  response_code?: number
  response_message?: string
  user_id: number
  user_name: string
  user_role?: string
  user_agent?: string
  duration?: number
  created_at: string
}

/**
 * 操作日志筛选条件
 */
export interface OperationLogFilters {
  type?: LogType
  module?: string
  user_id?: number
  target_type?: string
  start_date?: string
  end_date?: string
  request_ip?: string
  search?: string
}

/**
 * 操作日志列表响应
 */
export interface OperationLogListResponse {
  logs: OperationLog[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

/**
 * 日志统计
 */
export interface LogStats {
  total_count: number
  by_type: Record<LogType, number>
  by_module: Record<string, number>
  recent_activity: {
    date: string
    count: number
  }[]
}

/**
 * 权限操作日志
 */
export interface PermissionLog {
  id: number
  action: string
  username: string
  description: string
  ip_address: string
  status: 'success' | 'error'
  created_at: string
}

// ==================== 错误日志类型 ====================

/**
 * 错误日志级别
 */
export type ErrorLevel = 'debug' | 'info' | 'warning' | 'error' | 'critical'

/**
 * 错误日志
 */
export interface ErrorLog {
  id: number
  level: ErrorLevel
  type: 'vue' | 'javascript' | 'network' | 'api' | 'database' | 'server'
  message: string
  stack?: string
  url?: string
  line?: number
  column?: number
  file?: string
  user_id?: number
  user_name?: string
  user_agent?: string
  request_ip?: string
  request_location?: string
  request_params?: Record<string, unknown>
  request_body?: Record<string, unknown>
  response_code?: number
  session_id?: string
  browser_info?: string
  device_info?: string
  resolution?: string
  is_resolved: boolean
  resolved_by?: number
  resolved_at?: string
  resolution_note?: string
  created_at: string
}

/**
 * 错误日志筛选条件
 */
export interface ErrorLogFilters {
  level?: ErrorLevel
  type?: string
  is_resolved?: boolean
  start_date?: string
  end_date?: string
  search?: string
}

/**
 * 错误日志列表响应
 */
export interface ErrorLogListResponse {
  logs: ErrorLog[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

/**
 * 错误统计
 */
export interface ErrorStats {
  total_count: number
  unresolved_count: number
  by_level: Record<ErrorLevel, number>
  by_type: Record<string, number>
  recent_errors: ErrorLog[]
}

// ==================== 数据备份类型 ====================

/**
 * 备份类型
 */
export type BackupType = 'full' | 'database' | 'files' | 'config'

/**
 * 备份状态
 */
export type BackupStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'restoring'

/**
 * 备份记录
 */
export interface BackupRecord {
  id: number
  name: string
  type: BackupType
  status: BackupStatus
  size?: number
  file_path?: string
  download_url?: string
  expires_at?: string
  description?: string
  operator_id: number
  operator_name: string
  started_at: string
  completed_at?: string
  error_message?: string
  created_at: string
}

/**
 * 备份记录列表响应
 */
export interface BackupListResponse {
  backups: BackupRecord[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

/**
 * 备份配置
 */
export interface BackupConfig {
  auto_backup_enabled: boolean
  auto_backup_interval: 'daily' | 'weekly' | 'monthly'
  auto_backup_time: string
  max_backup_count: number
  backup_path?: string
  compress_enabled: boolean
  encryption_enabled: boolean
  remote_backup_enabled: boolean
  remote_backup_path?: string
}

// ==================== 缓存管理类型 ====================

/**
 * 缓存信息
 */
export interface CacheInfo {
  key: string
  type: 'string' | 'hash' | 'list' | 'set' | 'zset'
  ttl?: number
  size?: number
  hits?: number
  misses?: number
  created_at?: string
  updated_at?: string
}

/**
 * 缓存统计数据
 */
export interface CacheStats {
  used_memory: number
  total_keys: number
  hit_rate: number
  ops_per_second: number
  connected_clients: number
  uptime: number
}

// ==================== 门店管理类型 ====================

/**
 * 门店状态
 */
export type StoreStatus = 0 | 1 | 'active' | 'inactive' | 'suspended'

/**
 * 门店信息
 */
export interface Store {
  id: number
  name: string
  code: string
  type?: 'retail' | 'wholesale' | 'service' | 'mixed'
  province?: string
  city?: string
  district?: string
  address?: string
  location?: string // 兼容 location 或 address
  phone?: string
  contact_person?: string
  manager_id?: number
  manager_name?: string
  manager?: string // 兼容 manager_name 或 manager
  business_hours?: string
  status: StoreStatus
  is_default?: boolean
  sort_order?: number
  description?: string
  created_at?: string
  updated_at?: string
}

/**
 * 门店表单数据
 */
export interface StoreForm {
  name: string
  code: string
  type?: 'retail' | 'wholesale' | 'service' | 'mixed'
  province?: string
  city?: string
  district?: string
  address?: string
  phone?: string
  contact_person?: string
  manager_id?: number | string
  business_hours?: string
  status?: StoreStatus
  is_default?: boolean
  sort_order?: number
  description?: string
}

/**
 * 门店表单数据类型（兼容表单输入，manager_id 可以是字符串）
 */
export interface StoreFormData {
  name: string
  code?: string
  address?: string
  manager_id?: number | string
  phone?: string
  status?: number
  sort_order?: number
}

/**
 * 门店筛选条件
 */
export interface StoreFilters {
  search?: string
  status?: StoreStatus
  type?: string
  province?: string
  city?: string
}

/**
 * 门店列表响应
 */
export interface StoreListResponse {
  stores: Store[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

// ==================== 供应商管理类型 ====================

/**
 * 供应商状态
 */
export type SupplierStatus = 0 | 1 | 'active' | 'inactive'

/**
 * 供应商信息
 */
export interface Supplier {
  id: number
  name: string
  code?: string
  contact_person?: string
  contact_phone?: string
  phone?: string // 兼容 contact_phone 或 phone
  contact_email?: string
  province?: string
  city?: string
  district?: string
  address?: string
  bank_name?: string
  bank_account?: string
  bank_info?: string // 银行信息汇总
  tax_number?: string
  payment_terms?: string
  credit_rating?: string
  status: SupplierStatus
  sort_order?: number
  remark?: string
  remarks?: string // 兼容 remark 或 remarks
  contact?: string // 兼容 contact_person 或 contact
  total_orders?: number
  total_amount?: number
  created_at?: string
  updated_at?: string
}

/**
 * 供应商表单数据
 */
export interface SupplierForm {
  name: string
  code?: string
  contact_person?: string
  contact_phone?: string
  contact_email?: string
  province?: string
  city?: string
  district?: string
  address?: string
  bank_name?: string
  bank_account?: string
  tax_number?: string
  payment_terms?: string
  credit_rating?: string
  status?: SupplierStatus
  remark?: string
}

/**
 * 供应商筛选条件
 */
export interface SupplierFilters {
  search?: string
  status?: SupplierStatus
}

/**
 * 供应商列表响应
 */
export interface SupplierListResponse {
  suppliers: Supplier[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}
