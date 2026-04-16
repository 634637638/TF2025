/**
 * 全局类型定义文件
 * 为Vue3应用提供TypeScript强约束支持
 */

import type { Ref } from 'vue'
import type { Store, User } from './shared'

// ===== 基础类型定义 =====

/**
 * API响应基础接口
 */
export interface ApiResponse<T = unknown> {
  success: boolean
  message: string
  data?: T
  timestamp?: string
  code?: string
  pagination?: {
    page: number
    limit: number
    total: number
    stats?: {
      total_records?: number
      total_phones?: number
      total_days?: number
      [key: string]: unknown
    }
    [key: string]: unknown
  }
  meta?: {
    total?: number
    page?: number
    limit?: number
    stats?: {
      total_records?: number
      total_phones?: number
      total_days?: number
      [key: string]: unknown
    }
    [key: string]: unknown
  }
}

/**
 * API错误接口
 */
export interface ApiError {
  code?: string
  message: string
  details?: Record<string, unknown>
}

/**
 * 应用状态类型
 */
export type AppStatus = 'loading' | 'ready' | 'error' | 'offline'

/**
 * 网络状态类型
 */
export type NetworkStatus = 'online' | 'offline' | 'unknown'

/**
 * 电池状态类型
 */
export interface BatteryStatus {
  level: number // 0-1
  charging: boolean
  low: boolean // <20%
  critical: boolean // <10%
}

/**
 * 分页响应接口
 */
export interface PaginatedResponse<T = unknown> {
  success: boolean
  message: string
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  timestamp?: string
}

// ===== 用户和权限相关类型 =====

/**
 * 操作员信息接口
 */
export interface Operator {
  id: number
  username: string
  name: string
  role?: string
  role_type?: string
  status?: number
  store_id?: number
  store_name?: string
}

/**
 * 权限定义
 */
export interface Permission {
  id: number
  name: string
  code: string
  description?: string
  module: string
  action: string
  resource?: string
}

/**
 * 角色定义
 */
export interface Role {
  id: number
  name: string
  code: string
  description?: string
  permissions: Permission[]
  status: number
}

// ===== 菜单相关类型 =====

/**
 * 菜单项接口
 */
export interface MenuItem {
  id: number
  name: string
  url: string | null
  icon: string | null
  parent_id: number
  sort_order: number
  is_active: boolean
  target: string
  remarks: string | null
  created_at: string
  updated_at: string
  children?: MenuItem[]
  expanded?: boolean
  // 兼容字段
  key?: string
  title?: string
  path?: string
  enabled?: boolean
  order?: number
  status?: number
  menu_type?: 'menu' | 'directory' | 'button'
  permission?: string
}

// ===== 业务相关类型 =====

/**
 * 供应商信息接口
 */
export interface Supplier {
  id: number
  name: string
  code?: string
  contact_person?: string
  contact_phone?: string
  contact_email?: string
  address?: string
  status: number
  created_at?: string
  updated_at?: string
}

/**
 * 手机品牌接口
 */
export interface PhoneBrand {
  id: number
  name: string
  code?: string
  logo?: string
  description?: string
  status: number
  created_at?: string
  updated_at?: string
}

/**
 * 手机型号接口
 */
export interface PhoneModel {
  id: number
  brand_id: number
  name: string
  code?: string
  description?: string
  status: number
  created_at?: string
  updated_at?: string
  brand?: PhoneBrand
}

/**
 * 手机颜色接口
 */
export interface PhoneColor {
  id: number
  name: string
  code?: string
  hex_code?: string
  status: number
  created_at?: string
  updated_at?: string
}

/**
 * 手机内存接口
 */
export interface PhoneMemory {
  id: number
  storage: string
  code?: string
  description?: string
  status: number
  created_at?: string
  updated_at?: string
}

/**
 * 轻量品牌类型
 * 用于下拉选项、联动选择、品牌列表等通用场景
 */
export interface Brand {
  id: number
  name: string
  status?: number
  is_active?: boolean
  sort_order?: number
  created_at?: string
  updated_at?: string
  code?: string
  logo?: string
  description?: string
}

/**
 * 轻量型号类型
 * 用于下拉选项、联动选择、型号列表等通用场景
 */
export interface Model {
  id: number
  name: string
  brand_id?: number
  brand_name?: string
  status?: number
  is_active?: boolean
  sort_order?: number
  created_at?: string
  updated_at?: string
  code?: string
  description?: string
}

/**
 * 轻量颜色类型
 * 用于下拉选项、联动选择、颜色列表等通用场景
 */
export interface Color {
  id: number
  name: string
  english_name?: string
  hex_code?: string
  rgb?: string
  category?: string
  is_premium?: boolean
  description?: string
  brand_id?: number
  brand_name?: string
  status?: number
  is_active?: boolean
  sort_order?: number
  created_at?: string
  updated_at?: string
  value?: string
}

/**
 * 轻量内存选项类型
 */
export interface MemoryOption {
  id: number
  name?: string
  capacity?: string
  storage?: string
  status?: number
  created_at?: string
  updated_at?: string
  code?: string
  description?: string
}

/**
 * 通用库存项
 * 兼容库存列表、库存详情、库存结果弹窗等场景
 */
export interface InventoryItem {
  id: number
  imei?: string
  serial_number?: string
  brand?: string
  brand_name?: string
  model?: string
  model_name?: string
  color?: string
  color_name?: string
  memory?: string
  memory_name?: string
  memory_id?: number
  phone_condition?: string
  status?: string
  is_new?: number | boolean | string
  is_preordered?: number | boolean
  created_at?: string
  updated_at?: string
  purchase_number?: string
  Inventorytime?: string
  inventory_date?: string
  inventory_days?: number
  inventory_operator_id?: number
  operator_name?: string
  purchase_unit_price?: number
  purchase_price?: number
  purchase_cost?: number
  sale_price?: number
  price?: number
  supplier_id?: number
  store_id?: number
  supplier_name?: string
  store_name?: string
  purchase_operator_name?: string
  inventory_operator_name?: string
  sale_operator_name?: string
  customer_name?: string
  purchase_date?: string
  sale_date?: string
  remarks?: string
}

export interface QueryBasicInfo {
  phone_id?: number
  imei?: string
  serial_number?: string
  brand?: string
  model?: string
  color?: string
  memory?: string
  condition_type?: string
  status?: string
  status_code?: string
  quality_grade?: string
  is_new?: number
  remarks?: string
  has_images?: boolean
  image_count?: number
}

export interface QuerySupplierInfo {
  supplier_id?: number | null
  supplier_name?: string
  supplier_contact?: string
  supplier_phone?: string
}

export interface QueryStoreInfo {
  store_id?: number | null
  store_name?: string
  store_address?: string
}

export interface QueryPriceInfo {
  purchase_price?: number
  sale_price?: number
  profit?: number
}

export interface QueryTimeInfo {
  Inventorytime?: string
  salestime?: string
  created_at?: string
}

export interface QueryCustomerInfo {
  customer_id?: number | null
  customer_name?: string
  customer_phone?: string
  apple_id?: string
}

export interface QueryOperatorInfo {
  operator_id?: number | null
  sale_operator_id?: number | null
  inventory_operator_id?: number | null
  inventory_operator_name?: string
  purchase_operator_name?: string
  sale_operator_name?: string
}

export interface QuerySaleInfo {
  sale_id?: number
  sale_type?: string
  payment_method?: string
  payment_channel?: string
  invoice_number?: string
  sale_date?: string
  sale_remarks?: string
}

/**
 * 综合查询明细项
 */
export interface QueryItem {
  基本信息: QueryBasicInfo
  供应商信息: QuerySupplierInfo
  店铺信息: QueryStoreInfo
  价格信息: QueryPriceInfo
  时间信息: QueryTimeInfo
  客户信息: QueryCustomerInfo
  操作员信息: QueryOperatorInfo
  销售信息: QuerySaleInfo
}

/**
 * 通用下拉选项
 */
export interface IdNameOption {
  id: number | string
  name: string
  sort_order?: number
}

/**
 * 用户选项
 */
export interface UserOption {
  id: number
  name: string
}

/**
 * 值标签选项
 */
export interface LabelValueOption {
  value: string
  label: string
}

/**
 * 查询页型号选项
 */
export interface ModelOption {
  id: number
  name: string
  brand_id?: number | null
  brand_name?: string
  brand?: string
  sort_order?: number
}

/**
 * 查询页退货设备信息
 */
export interface ReturnDeviceInfo {
  id: number
  supplier_name?: string
  brand?: string
  model?: string
  color?: string
  memory?: string
  imei?: string
  serial_number?: string
  is_new?: number | string
}

/**
 * 综合查询统计
 */
export interface QueryStatistics {
  total_phones: number
  in_stock_count: number
  sold_count: number
  new_count: number
  used_count: number
  total_purchase_cost: number
  total_sales_revenue: number
  total_profit: number
  avg_profit: number
  profit_margin: string
}

/**
 * 综合查询筛选选项
 */
export interface QueryOptions {
  suppliers: IdNameOption[]
  stores: IdNameOption[]
  brands: string[]
  models: ModelOption[]
  colors: string[]
  memories: string[]
  users: UserOption[]
  statuses: LabelValueOption[]
  conditions: LabelValueOption[]
}

/**
 * 轻量技师类型
 */
export interface Technician {
  id: number
  name: string
}

/**
 * 手机信息接口
 */
export interface Phone {
  id: number
  imei: string
  serial_number?: string
  brand_id?: number
  model_id?: number
  color_id?: number
  memory_id?: number
  brand?: string
  model?: string
  color?: string
  memory?: string
  grade?: string
  quality_grade?: string
  condition?: string
  purchase_price?: number
  purchase_cost?: number
  purchase_unit_price?: number
  selling_price?: number
  sale_price?: number
  cost?: number
  price?: number
  store_id?: number
  supplier_id?: number
  inventory_operator_id?: number
  status: 'available' | 'sold' | 'reserved' | 'maintenance' | 'returned' | 'in_stock'
  is_new?: boolean
  is_preordered?: boolean
  remarks?: string
  purchase_number?: string
  purchase_date?: string
  created_at?: string
  updated_at?: string
  image_url?: string
  // 关联数据
  store_name?: string
  supplier_name?: string
  inventory_operator_name?: string
  operator_name?: string
  // 关联对象
  phoneBrand?: PhoneBrand
  phoneModel?: PhoneModel
  phoneColor?: PhoneColor
  phoneMemory?: PhoneMemory
  brandInfo?: PhoneBrand
  modelInfo?: PhoneModel
  colorInfo?: PhoneColor
  memoryInfo?: PhoneMemory
  store?: Store
  supplier?: Supplier
}

// ===== 销售相关类型 =====

/**
 * 销售记录接口
 */
export interface SaleRecord {
  id: number
  phone_id: number
  customer_id?: number
  customer_name?: string
  customer_phone?: string
  selling_price: number
  actual_price?: number
  discount_amount?: number
  payment_method?: string
  payment_status?: string
  invoice_number?: string
  operator_id: number
  store_id: number
  sale_date: string
  remarks?: string
  status: 'completed' | 'pending' | 'cancelled' | 'refunded'
  created_at?: string
  updated_at?: string
  phone?: Phone
  operator?: User
  store?: Store
}

// ===== 仪表板相关类型 =====

/**
 * 仪表板统计接口
 */
export interface DashboardStats {
  users: number
  accessories: number
  customers: number
  todaySales: number
  totalPhones: number
  availablePhones: number
  soldPhones: number
  pendingSales: number
  monthlyRevenue: number
  weeklyRevenue: number
}

// ===== 客户相关类型 =====

/**
 * 客户信息接口
 */
export interface Customer {
  id: number
  name: string
  phone: string
  address: string
  total_orders: number
  total_amount: number
  email?: string
  status: number
  created_at?: string
  updated_at?: string
}

// ===== 配件相关类型 =====

/**
 * 配件信息接口
 */
export interface Accessory {
  id: number
  name: string
  stock: number
  min_stock: number
  price: number
  supplier: string
  description?: string
  category?: string
  status: number
  created_at?: string
  updated_at?: string
}

// ===== 系统相关类型 =====

/**
 * 系统菜单项接口
 */
export interface SystemMenuItem {
  id: number
  key: string
  title: string
  icon: string
  path: string
  enabled: boolean
  order: number
  permission?: string
}

/**
 * 系统配置接口
 */
export interface SystemConfig {
  site_name: string
  site_description?: string
  logo?: string
  favicon?: string
  theme: {
    primary_color: string
    accent_color: string
    mode: 'light' | 'dark' | 'auto'
  }
  features: {
    enable_notifications: boolean
    enable_reports: boolean
    enable_backup: boolean
    enable_maintenance_mode: boolean
  }
  limits: {
    max_upload_size: number
    max_login_attempts: number
    session_timeout: number
  }
}

// ===== 移动端相关类型 =====

/**
 * 设备信息接口
 */
export interface DeviceInfo {
  userAgent: string
  platform: string
  isIOS: boolean
  isAndroid: boolean
  isSafari: boolean
  isChrome: boolean
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  screenSize: {
    width: number
    height: number
  }
  orientation: 'portrait' | 'landscape'
  isTouchDevice: boolean
}

/**
 * 手势类型
 */
export type SwipeDirection = 'left' | 'right' | 'up' | 'down' | 'none'

/**
 * 移动端断点配置
 */
export interface Breakpoints {
  mobile: number
  tablet: number
  desktop: number
}

// ===== 主题相关类型 =====

/**
 * 主题模式
 */
export type ThemeMode = 'light' | 'dark' | 'auto'

/**
 * 主题配置接口
 */
export interface ThemeConfig {
  mode: ThemeMode
  primaryColor: string
  accentColor: string
  backgroundColor: string
  textColor: string
  borderColor: string
  shadowColor: string
  sidebarBg: string
  sidebarText: string
  headerBg: string
  cardBg: string
  inputBg: string
  hoverBg: string
}

// ===== 性能监控类型 =====

/**
 * 性能指标接口
 */
export interface PerformanceMetrics {
  FCP: number // First Contentful Paint
  TTI: number // Time to Interactive
  LCP: number // Largest Contentful Paint
  FID: number // First Input Delay
  CLS: number // Cumulative Layout Shift
  API_LATENCY: Record<string, number>
  MEMORY_USAGE?: number
}

// ===== 通知和消息类型 =====

/**
 * 消息类型
 */
export type MessageType = 'success' | 'error' | 'warning' | 'info'

/**
 * 通知接口
 */
export interface Notification {
  id: string
  type: MessageType
  title: string
  message?: string
  duration?: number
  closable?: boolean
  showClose?: boolean
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center'
}

// ===== 路由相关类型 =====

/**
 * 路由元信息接口
 */
export interface RouteMeta {
  title?: string
  requiresAuth?: boolean
  permissions?: string[]
  roles?: string[]
  layout?: string
  keepAlive?: boolean
  hideInMenu?: boolean
  icon?: string
  order?: number
}

// ===== 工具函数类型 =====

/**
 * 防抖函数类型
 */
export type DebouncedFunction<T extends (...args: any[]) => any> = {
  (...args: Parameters<T>): void
  cancel(): void
  flush(): ReturnType<T> | undefined
}

/**
 * 节流函数类型
 */
export type ThrottledFunction<T extends (...args: any[]) => any> = {
  (...args: Parameters<T>): void
  cancel(): void
  flush(): void
}

// ===== Vue组件类型扩展 =====
// 注意：GlobalComponents 的完整定义在 global.d.ts 中，这里只保留 ComponentCustomProperties

declare module '@vue/runtime-core' {
  interface ComponentCustomProperties {
    // 全局属性
    $hasPermission: (permission: string | string[], role?: string | string[]) => boolean
    $hasRole: (role: string | string[]) => boolean
    $formatDate: (date: string | Date, format?: string) => string
    $formatCurrency: (amount: number, currency?: string) => string
    $formatNumber: (num: number, options?: Intl.NumberFormatOptions) => string
    $copyToClipboard: (text: string) => Promise<boolean>
    $downloadFile: (url: string, filename?: string) => void

    // 设备信息
    $device: DeviceInfo
    $isMobile: boolean
    $isTablet: boolean
    $isDesktop: boolean

    // 主题
    $theme: ThemeConfig
    $toggleTheme: () => void

    // 全局配置
    $config: {
      apiBaseUrl: string
      uploadUrl: string
      version: string
      debug?: boolean
    }
  }
}

// ===== 环境变量类型 =====

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_API_LOGGING?: string
  readonly VITE_APP_TITLE: string
  readonly VITE_APP_VERSION: string
  readonly VITE_UPLOAD_URL: string
  readonly VITE_ENABLE_MOCK: string
  readonly VITE_ENABLE_DEVTOOLS: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// ===== 全局指令类型定义 =====

/**
 * 指令绑定值类型
 */
export interface DirectiveBinding<T = unknown> {
  instance: ComponentInstance
  value: T
  oldValue: T | null
  arg?: string
  modifiers: Record<string, boolean>
  dir: Directive
}

/**
 * 组件实例类型（简化）
 */
export interface ComponentInstance {
  $props: Record<string, unknown>
  $emit: (event: string, ...args: unknown[]) => void
}

/**
 * 指令类型（简化）
 */
export interface Directive {
  created?: (el: HTMLElement, binding: DirectiveBinding) => void
  beforeMount?: (el: HTMLElement, binding: DirectiveBinding) => void
  mounted?: (el: HTMLElement, binding: DirectiveBinding) => void
  beforeUpdate?: (el: HTMLElement, binding: DirectiveBinding) => void
  updated?: (el: HTMLElement, binding: DirectiveBinding) => void
  beforeUnmount?: (el: HTMLElement, binding: DirectiveBinding) => void
  unmounted?: (el: HTMLElement, binding: DirectiveBinding) => void
}

/**
 * 权限指令值类型
 */
export interface PermissionDirectiveValue {
  permissions: string | string[]
  roles?: string | string[]
  operator?: 'AND' | 'OR'
  fallback?: string
}

/**
 * 防抖指令值类型
 */
export interface DebounceDirectiveValue {
  fn: (...args: unknown[]) => unknown
  delay?: number
  immediate?: boolean
}

/**
 * 节流指令值类型
 */
export interface ThrottleDirectiveValue {
  fn: (...args: unknown[]) => unknown
  delay?: number
}

/**
 * 长按指令值类型
 */
export interface LongPressDirectiveValue {
  fn: (...args: unknown[]) => unknown
  delay?: number
}

/**
 * 无限滚动指令值类型
 */
export interface InfiniteScrollDirectiveValue {
  fn: (...args: unknown[]) => unknown
  distance?: number
  disabled?: boolean
}

/**
 * 移动端优化指令配置
 */
export interface MobileOptimizeConfig {
  enableRipple?: boolean
  enableTouchFeedback?: boolean
  enableHapticFeedback?: boolean
}

// ===== 全局组件类型定义 =====

/**
 * 组件配置接口
 */
export interface ComponentConfig {
  name: string
  component: Component
  description?: string
  category?: 'ui' | 'form' | 'data' | 'layout' | 'business'
  props?: Record<string, unknown>
  events?: string[]
}

/**
 * 组件类型（简化）
 */
export type Component = Record<string, unknown>

/**
 * 组件使用统计记录
 */
export interface ComponentUsageRecord {
  [componentName: string]: number
}

/**
 * 组件使用统计管理器
 */
export interface ComponentUsageStats {
  recordUsage: (componentName: string) => void
  getStats: () => ComponentUsageRecord
  clearStats: () => void
}

/**
 * 全局组件调试信息
 */
export interface ComponentDebugInfo {
  configs: ComponentConfig[]
  usage: ComponentUsageStats
  list: ComponentConfig[]
  byCategory: (category: string) => ComponentConfig[]
  getManager?: () => unknown
  getStats?: () => unknown
  getRegistered?: () => string[]
  getByCategory?: (category: string) => ComponentConfig[]
  isRegistered?: (name: string) => boolean
}

// ===== 全局 Composable 类型定义 =====

/**
 * 设备检测 Composable 返回类型
 */
export interface UseDeviceReturn {
  deviceInfo: DeviceInfo
  isMobile: Ref<boolean>
  isTablet: Ref<boolean>
  isDesktop: Ref<boolean>
  isIOS: Ref<boolean>
  isAndroid: Ref<boolean>
  isSafari: Ref<boolean>
  isChrome: Ref<boolean>
  isTouchDevice: Ref<boolean>
  screenWidth: Ref<number>
  screenHeight: Ref<number>
  orientation: Ref<'portrait' | 'landscape'>
}

/**
 * 性能监控 Composable 返回类型
 */
export interface UsePerformanceReturn {
  metrics: Ref<PerformanceMetrics>
  isMonitoring: Ref<boolean>
  startMonitoring: () => void
  stopMonitoring: () => void
  recordMetric: (name: string, value: number | string | Record<string, unknown>) => void
  generateReport: () => PerformanceReport
  clearMetrics: () => void
}

/**
 * 分页 Composable 返回类型
 */
export interface UsePaginationReturn {
  pagination: Ref<PaginationState>
  setPage: (page: number) => void
  setLimit: (limit: number) => void
  setTotal: (total: number) => void
  nextPage: () => void
  prevPage: () => void
  canNextPage: Ref<boolean>
  canPrevPage: Ref<boolean>
  reset: () => void
}

/**
 * 搜索 Composable 返回类型
 */
export interface UseSearchReturn<T> {
  searchQuery: Ref<string>
  filteredData: Ref<T[]>
  isSearching: Ref<boolean>
  search: (query: string) => void
  clearSearch: () => void
  setHighlight: (term: string) => void
  highlightedText: (text: string) => string
}

/**
 * 防抖 Composable 返回类型
 */
export interface UseDebounceReturn<T extends (...args: any[]) => any> {
  debouncedFn: DebouncedFunction<T>
  isPending: Ref<boolean>
  cancel: () => void
  flush: () => ReturnType<T> | undefined
}

/**
 * 节流 Composable 返回类型
 */
export interface UseThrottleReturn<T extends (...args: any[]) => any> {
  throttledFn: ThrottledFunction<T>
  isPending: Ref<boolean>
  cancel: () => void
  flush: () => void
}

// ===== 全局 Store 类型定义 =====

/**
 * 认证状态类型
 */
export interface AuthStateType {
  token: string | null
  user: User | null
  permissions: string[]
  isAuthenticated: boolean
  isLoading: boolean
  loginTime: number | null
  expiresAt: number | null
}

/**
 * 消息状态类型
 */
export interface MessageStateType {
  messages: MessageItem[]
  nextId: number
  maxMessages: number
  defaultDuration: number
}

/**
 * 加载状态类型
 */
export interface LoadingStateType {
  globalLoading: boolean
  loadingText: string
  loadingMap: Record<string, boolean>
}

/**
 * 主题状态类型
 */
export interface ThemeStateType {
  mode: ThemeMode
  config: ThemeConfig
  systemPreference: ThemeMode
  isAutoMode: boolean
}

// ===== 路由守卫类型定义 =====

/**
 * 路由守卫上下文
 */
export interface RouteGuardContext {
  to: RouteLocationNormalized
  from: RouteLocationNormalized
  next: (to?: string | false | void) => void
  authStore: AuthStore
  messageStore: MessageStore
  loadingStore: LoadingStore
}

/**
 * 路由位置类型
 */
export interface RouteLocationNormalized {
  path: string
  name?: string | symbol
  params: Record<string, string>
  query: Record<string, string | string[]>
  hash: string
  fullPath: string
  meta: RouteMeta
}

/**
 * 认证 Store 类型
 */
export interface AuthStore {
  token: string | null
  user: User | null
  permissions: string[]
  isAuthenticated: boolean
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
}

/**
 * 登录凭证
 */
export interface LoginCredentials {
  username: string
  password: string
  captcha?: string
}

/**
 * 消息 Store 类型
 */
export interface MessageStore {
  messages: MessageItem[]
  addMessage: (message: Omit<MessageItem, 'id' | 'timestamp'>) => void
  removeMessage: (id: string) => void
  clearMessages: () => void
}

/**
 * 加载 Store 类型
 */
export interface LoadingStore {
  globalLoading: boolean
  loadingText: string
  setLoading: (loading: boolean, text?: string) => void
}

/**
 * 权限检查工具类型
 */
export interface PermissionUtils {
  hasPermission: (permission: string) => boolean
  hasAnyPermission: (permissions: string[]) => boolean
  hasAllPermissions: (permissions: string[]) => boolean
  hasRole: (role: string) => boolean
  hasAnyRole: (roles: string[]) => boolean
}

/**
 * 路由要求类型
 */
export interface RouteRequirement {
  type: 'email_verified' | 'phone_verified' | 'store_selected' | 'role' | 'permission'
  value?: string | string[]
  description: string
  redirect?: string
}

// ===== CSRF 防护类型定义 =====

/**
 * CSRF 配置
 */
export interface CSRFConfig {
  tokenHeader: string
  cookieName: string
  cookieOptions: {
    secure: boolean
    httpOnly: boolean
    sameSite: 'strict' | 'lax' | 'none'
  }
}

/**
 * CSRF 状态
 */
export interface CSRFState {
  token: string | null
  isInitialized: boolean
  lastTokenRefresh: number | null
}

// ===== 错误边界类型定义 =====

/**
 * 错误信息类型
 */
export interface ErrorInfo {
  type: 'vue' | 'javascript' | 'network' | 'async'
  message: string
  stack?: string
  timestamp: number
  url: string
  userAgent: string
  userId?: number
  componentStack?: string
  additionalInfo?: Record<string, unknown>
}

/**
 * 错误上报配置
 */
export interface ErrorReportConfig {
  enabled: boolean
  endpoint?: string
  maxErrors: number
  reportInterval: number
  includeUserInfo: boolean
  includeEnvironmentInfo: boolean
}

// ===== 全局事件总线类型定义 =====

/**
 * 事件监听器类型
 */
export type EventListener<T = any> = (payload: T) => void

/**
 * 事件总线接口
 */
export interface EventBus {
  on<T = any>(event: string, listener: EventListener<T>): () => void
  once<T = any>(event: string, listener: EventListener<T>): () => void
  off<T = any>(event: string, listener: EventListener<T>): void
  emit<T = any>(event: string, payload?: T): void
  clear(): void
}

/**
 * 应用级事件类型
 */
export interface AppEvents {
  'app:ready': void
  'app:error': ErrorInfo
  'app:performance-metric': { name: string; value: number | string | Record<string, unknown> }
  'auth:login': User
  'auth:logout': void
  'auth:token-expired': void
  'auth:token-refresh': string
  'theme:change': ThemeMode
  'device:change': DeviceInfo
  'network:online': void
  'network:offline': void
  'page:view': { path: string; title?: string }
  'page:error': { path: string; error: Error }
  'component:mounted': { name: string; props?: Record<string, unknown> }
  'component:error': { name: string; error: Error }
}

// ===== 扩展全局 Window 类型 =====

declare global {
  interface Window {
    // 性能监控
    gtag?: (command: string, targetId: string, config?: Record<string, unknown>) => void
    dataLayer?: Record<string, unknown>[]

    // 全局配置
    TF2025_CONFIG: {
      api: {
        baseURL: string
        timeout: number
        version: string
      }
      app: {
        name: string
        version: string
        env: string
        debug: boolean
      }
      performance: {
        enabled: boolean
        endpoint?: string
        reportInterval: number
      }
      errorReporting: {
        enabled: boolean
        endpoint?: string
        maxErrors: number
      }
    }

    // 全局状态 - 统一由 global.d.ts 声明

    __TF2025_ERROR_BOUNDARY__?: {
      reportError: (error: ErrorInfo) => void
      getErrors: () => ErrorInfo[]
      clearErrors: () => void
    }
  }
}

// ===== Vue 模块扩展 =====

declare module '@vue/runtime-core' {
  interface ComponentCustomProperties {
    // 权限检查方法
    $hasPermission: (permission: string | string[], role?: string | string[]) => boolean
    $hasRole: (role: string | string[]) => boolean

    // 工具方法
    $formatDate: (date: string | Date, format?: string) => string
    $formatCurrency: (amount: number, currency?: string) => string
    $formatNumber: (num: number, options?: Intl.NumberFormatOptions) => string
    $copyToClipboard: (text: string) => Promise<boolean>
    $downloadFile: (url: string, filename?: string) => void

    // 设备信息
    $device: DeviceInfo
    $isMobile: boolean
    $isTablet: boolean
    $isDesktop: boolean

    // 主题
    $theme: ThemeConfig
    $toggleTheme: () => void

    // 全局配置
    $config: {
      apiBaseUrl: string
      uploadUrl: string
      version: string
      debug?: boolean
    }
  }

  // GlobalComponents 统一在 global.d.ts 中声明
}

declare module '@vue/runtime-core' {
  interface ComponentCustomProps {
    // 自定义 props 类型
    vLoading?: boolean
    vCopy?: string
    vDebounce?: DebounceDirectiveValue
    vThrottle?: ThrottleDirectiveValue
    vLongPress?: LongPressDirectiveValue
    vInfiniteScroll?: InfiniteScrollDirectiveValue
    vLazy?: string
    vFocus?: boolean
    vSelect?: boolean
    vNumber?: boolean
    vMobileOptimize?: MobileOptimizeConfig
    vPermission?: PermissionDirectiveValue
  }
}

// ===== 缺失的重要类型定义 =====

/**
 * 分页配置接口
 */
export interface PaginationConfig {
  page: number
  pageSize: number
  total: number
  totalItems?: number
}

/**
 * 分页状态接口
 */
export interface PaginationState extends PaginationConfig {
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
  first: number
  last: number
}

/**
 * 排序配置接口
 */
export interface SortConfig {
  field: string
  order: 'asc' | 'desc'
}

/**
 * 过滤配置接口
 */
export interface FilterConfig {
  [key: string]: unknown
}

/**
 * 消息项目接口
 */
export interface MessageItem {
  id: string
  type: MessageType
  title?: string
  message: string
  duration?: number
  closable?: boolean
  timestamp?: number
  persistent?: boolean
  metadata?: Record<string, unknown>
}

/**
 * 性能报告接口
 */
export interface PerformanceReport {
  timestamp: number
  metrics: PerformanceMetrics
  userAgent: string
  url: string
  sessionId: string
  userId?: number
  deviceInfo: DeviceInfo
  recommendations: string[]
}

/**
 * 表单验证规则类型
 */
export interface ValidationRule<T = unknown> {
  required?: boolean
  pattern?: RegExp
  min?: number
  max?: number
  minLength?: number
  maxLength?: number
  validator?: (value: T) => string | null
  message?: string
}

/**
 * 表单状态接口
 */
export interface FormState<T extends Record<string, any>> {
  data: T
  errors: Partial<Record<keyof T, string>>
  touched: Partial<Record<keyof T, boolean>>
  isValid: boolean
  isDirty: boolean
  isSubmitting: boolean
}

/**
 * 存储配置接口
 */
export interface StorageConfig {
  driver: 'localStorage' | 'sessionStorage' | 'memory'
  prefix?: string
  expires?: number // 毫秒
  encrypt?: boolean
  compression?: boolean
}

/**
 * 缓存接口
 */
export interface CacheItem<T> {
  value: T
  timestamp: number
  expires?: number
  version?: string
}

/**
 * 日志级别
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'

/**
 * 日志项接口
 */
export interface LogItem {
  timestamp: number
  level: LogLevel
  message: string
  data?: unknown
  stack?: string
  component?: string
  userId?: number
  sessionId: string
}

/**
 * 应用配置接口
 */
export interface AppConfig {
  version: string
  api: {
    baseURL: string
    timeout: number
    retries: number
  }
  auth: {
    tokenKey: string
    refreshTokenKey: string
    autoRefresh: boolean
    refreshThreshold: number
  }
  theme: {
    defaultMode: ThemeMode
    enableSystemTheme: boolean
    customThemes: Record<string, ThemeConfig>
  }
  performance: {
    enableMonitoring: boolean
    reportInterval: number
    endpoint?: string
  }
  features: {
    enablePWA: boolean
    enableOffline: boolean
    enableNotifications: boolean
    enableAnalytics: boolean
    enableDebug: boolean
  }
}

/**
 * 系统信息接口
 */
export interface SystemInfo {
  browser: {
    name: string
    version: string
    engine: string
  }
  os: {
    name: string
    version: string
    platform: string
  }
  hardware: {
    cores: number
    memory: number
    screen: {
      width: number
      height: number
      colorDepth: number
      pixelDepth: number
      availWidth: number
      availHeight: number
    }
  }
  network: {
    type: string
    effectiveType: string
    downlink: number
    rtt: number
    saveData: boolean
  }
  features: {
    webGL: boolean
    webWorker: boolean
    serviceWorker: boolean
    pushNotification: boolean
    geolocation: boolean
    camera: boolean
    microphone: boolean
  }
}

/**
 * 触摸事件状态接口
 */
export interface TouchState {
  startX: number
  startY: number
  endX: number
  endY: number
  deltaX: number
  deltaY: number
  isSwiping: boolean
  direction: 'left' | 'right' | 'up' | 'down' | ''
  startTime: number
  endTime: number
  duration: number
  velocity: number
  isLongPress: boolean
  isDoubleTap: boolean
  tapCount: number
  lastTapTime: number
}

/**
 * 权限检查结果接口
 */
export interface PermissionCheckResult {
  hasPermission: boolean
  missingPermissions: string[]
  missingRoles: string[]
  requirements: RouteRequirement[]
  redirectUrl?: string
}

/**
 * HTTP 请求配置接口
 */
export interface HttpConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  url: string
  data?: Record<string, unknown> | unknown
  params?: Record<string, string | number>
  headers?: Record<string, string>
  timeout?: number
  retries?: number
  retryDelay?: number
  validateStatus?: (status: number) => boolean
}

/**
 * 错误边界组件属性接口
 */
export interface ErrorBoundaryProps {
  fallback?: Component
  onError?: (error: Error, errorInfo: any) => void
  children?: any
}

/**
 * 虚拟滚动配置接口
 */
export interface VirtualScrollConfig {
  itemHeight: number
  containerHeight: number
  overscan?: number
  enabled?: boolean
  getItemKey?: (index: number, data: any) => string | number
}

/**
 * 拖拽配置接口
 */
export interface DragDropConfig {
  disabled?: boolean
  axis?: 'x' | 'y' | 'both'
  bounds?: string | Element
  grid?: [number, number]
  onStart?: (event: MouseEvent | TouchEvent) => void
  onDrag?: (event: MouseEvent | TouchEvent) => void
  onEnd?: (event: MouseEvent | TouchEvent) => void
}

/**
 * 国际化语言类型
 */
export type AppLanguage = 'zh-CN' | 'zh-TW' | 'en-US' | 'ja-JP' | 'ko-KR'

/**
 * 语言配置接口
 */
export interface LanguageConfig {
  code: AppLanguage
  name: string
  nativeName: string
  rtl: boolean
  dateFormat: string
  timeFormat: string
  numberFormat: Intl.NumberFormatOptions
  currencyFormat: Intl.NumberFormatOptions
}

/**
 * 键盘快捷键配置接口
 */
export interface KeyboardShortcut {
  key: string
  ctrlKey?: boolean
  altKey?: boolean
  shiftKey?: boolean
  metaKey?: boolean
  description: string
  action: (event: KeyboardEvent) => void
  global?: boolean
}

/**
 * 任务队列接口
 */
export interface TaskQueue {
  id: string
  name: string
  tasks: Array<{
    id: string
    fn: () => Promise<unknown>
    priority: number
    retries: number
    maxRetries: number
    status: 'pending' | 'running' | 'completed' | 'failed'
    error?: Error
  }>
  concurrency: number
  paused: boolean
}

/**
 * WebSocket 连接状态
 */
export type WebSocketState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error'

/**
 * WebSocket 配置接口
 */
export interface WebSocketConfig {
  url: string
  protocols?: string[]
  reconnectInterval: number
  maxReconnectAttempts: number
  heartbeatInterval?: number
  heartbeatMessage?: Record<string, unknown> | string
  timeout?: number
}

/**
 * 导出 Vue ref 类型
 */
export type { Ref, ComputedRef, DeepReadonly, UnwrapRef } from 'vue'

// ===== 业务模块类型导出 =====

/**
 * 员工管理相关类型
 */
export type {
  Employee,
  EmployeeForm,
  EmployeeStatus,
  EmployeeFilters,
  EmployeeListResponse,
  RoleForm,
  RoleListResponse,
  PermissionGroup,
  PermissionTreeNode,
  SalaryTemplate,
  DeductionRule,
  SalaryRecord,
  SalaryFilters,
  SalaryListResponse,
  AttendanceRecordType,
  AttendanceStatus,
  AttendanceRecord,
  AttendanceFilters,
  AttendanceListResponse,
  AttendanceStats,
  SubsidyType,
  SubsidyRecord,
  SubsidyFilters,
  SubsidyListResponse
} from './employee'

/**
 * 订单相关类型
 */
export type {
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
  OrderType,
  ProductQuality,
  PreorderStatus,
  PreorderSource,
  Preorder,
  PreorderForm,
  PreorderFilters,
  PreorderListResponse,
  SalesOrder,
  SalesOrderItem,
  SalesOrderForm,
  SalesOrderFilters,
  SalesOrderListResponse,
  ReturnOrder,
  ReturnOrderItem,
  ReturnOrderFilters,
  CustomerForm,
  CustomerFilters,
  CustomerListResponse,
  WholesaleMode,
  WholesaleStatus,
  WholesaleOrder,
  WholesaleOrderItem,
  WholesaleOrderForm,
  WholesaleOrderFilters,
  WholesaleOrderListResponse
} from './order'

/**
 * 维修相关类型
 */
export type {
  RepairType,
  RepairStatus,
  DeviceType,
  RepairPriority,
  WarrantyStatus,
  RepairPaymentStatus,
  CustomerType,
  RepairOrder,
  PartsUsed,
  RepairOrderForm,
  RepairOrderFilters,
  RepairOrderListResponse,
  RepairStats,
  RepairTypeStats,
  TechnicianStats,
  RepairProgressNode,
  RepairProgress,
  RepairParts,
  PartsStockIn,
  RepairReview,
  ReviewStats
} from './repair'

/**
 * 系统设置相关类型
 */
export type { Store, User } from './shared'

export type {
  SiteSettings,
  ThemeSettings,
  SecuritySettings,
  NotificationSettings,
  PaymentSettings,
  LogisticsSettings,
  FullSiteSettings,
  SettingsFormData,
  LogType,
  OperationLog,
  OperationLogFilters,
  OperationLogListResponse,
  LogStats,
  PermissionLog,
  ErrorLevel,
  ErrorLog,
  ErrorLogFilters,
  ErrorLogListResponse,
  ErrorStats,
  BackupType,
  BackupStatus,
  BackupRecord,
  BackupListResponse,
  BackupConfig,
  CacheInfo,
  CacheStats,
  StoreStatus,
  StoreForm,
  StoreFilters,
  StoreListResponse,
  SupplierStatus,
  SupplierForm,
  SupplierFilters,
  SupplierListResponse
} from './system'

/**
 * H5管理相关类型
 */
export type {
  PublishStatus,
  ContentType,
  LinkType,
  BannerPosition,
  Banner,
  BannerForm,
  BannerFilters,
  BannerListResponse,
  SectionType,
  SectionStyle,
  HomeSection,
  HomeSectionForm,
  HomeSectionFilters,
  HomeSectionListResponse,
  SoldProduct,
  SoldProductFilters,
  SoldProductListResponse,
  H5OrderStatus,
  H5OrderSource,
  H5Order,
  H5OrderItem,
  H5OrderFilters,
  H5OrderListResponse,
  H5HomeConfig,
  H5ShareConfig,
  H5BaseConfig
} from './h5'

/**
 * 库存管理相关类型
 */
export type {
  ProductType,
  OperationType,
  StockStatus,
  SettledStatus,
  StockInRecord,
  StockInFormData,
  InventoryRecord,
  StockMovement,
  StockInFilters,
  InventoryFilters,
  Pagination,
  StockInListResponse,
  InventoryListResponse,
  StockMovementListResponse,
  StatsData,
  ProductInfo,
  PhoneInfo,
  AccessoryInfo,
  StoreInfo,
  SupplierInfo,
  BrandInfo,
  ModelInfo,
  ColorInfo,
  MemoryInfo,
  UserInfo,
  SearchSuggestion,
  ExportConfig,
  BatchOperation,
  StockAdjustment,
  StockAlert,
  StockTaking,
  StockTakingItem,
  StockInRequestConfig,
  StockInModalProps,
  StockInDetailModalProps,
  StockInEvents,
  UseStockInReturn,
  PerformanceMetrics as InventoryPerformanceMetrics,
  ErrorInfo as InventoryErrorInfo,
  Permission as InventoryPermission,
  UserPermissions
} from './inventory'

/**
 * 数据分析相关类型
 */
export type {
  BaseMetrics,
  SalesAnalytics,
  ProductSalesData,
  StoreSalesData,
  SalesPeriodData,
  RevenueForecastData,
  InventoryAnalytics,
  InventoryHealthMetrics,
  InventoryIssue,
  CategoryAnalysis,
  SupplierAnalysis,
  CustomerAnalytics,
  RetentionMetrics,
  CustomerSegment,
  CLVMetrics,
  CLVTrend,
  CustomerBehaviorData,
  PerformanceAnalytics,
  PerformanceMetric,
  SystemHealthMetrics,
  PerformanceTrend,
  FinancialAnalytics,
  RevenuePeriodData,
  ProfitByProduct,
  ExpenseTrend,
  RevenueMetrics,
  ProfitMetrics,
  ExpenseMetrics,
  CashFlowMetrics,
  CashFlowItem,
  FinancialHealthMetrics,
  FinancialRatios,
  FinancialAlert,
  FinancialProjection,
  ProjectionItem,
  GrowthMetrics,
  GrowthForecast,
  AnalyticsReport,
  ReportSummary,
  DashboardConfig,
  DashboardLayout,
  WidgetConfig,
  FilterConfig as AnalyticsFilterConfig,
  RealTimeData,
  RealTimeAlert,
  ExportConfig as AnalyticsExportConfig,
  AnalyticsApiResponse,
  AnalyticsListResponse,
  PerformanceAlert,
  OptimizationSuggestion,
  CustomerDetail,
  CustomerInsight,
  EmployeeAnalytics,
  EmployeePerformance,
  EmployeeRole,
  SalaryTrend,
  AttendanceStat,
  AttendanceAlert,
  AttendanceSummary
} from './analytics'

/**
 * 菜单相关类型
 */
export type {
  MenuConfig,
  MenuState,
  MenuAction,
  MenuNavigation,
  MenuItemComponentProps,
  MenuSearchResult,
  MenuGroup,
  MenuBreadcrumb,
  MenuPermission,
  MenuUserPreference,
  MenuEvents,
  MenuValidationRule,
  MenuExportData,
  MenuContext,
  MenuUtils
} from './menu'

/**
 * 通用组件 Props 类型
 */
export type {
  VisibleProps,
  LoadingProps,
  DateRangeProps,
  FilterProps,
  AnalyticsProps,
  ModalProps,
  ModelValueProps,
  StringModelValueProps,
  OptionalStringModelValueProps,
  ModalUpdateProps,
  UpdateModelValueEmits,
  UpdateStringModelValueEmits,
  UpdateVisibleEmits,
  CancelEmits,
  CloseEmits,
  ConfirmEmits,
  SuccessEmits,
  LoadingChangeEmits,
  ResetEmits,
  ClearEmits,
  UpdateFilterValuesEmits,
  SearchSubmitEmits,
  FilterChangeEmits,
  ModalSuccessProps,
  ListModeProps,
  PaginationProps,
  SearchProps,
  AnalyticsComponentProps,
  SalesAnalyticsProps,
  InventoryAnalyticsProps,
  EmployeeAnalyticsProps,
  CustomerAnalyticsProps,
  ProfitAnalyticsProps,
  PerformanceAnalyticsProps,
  TransferAnalyticsProps,
  FormModalProps,
  ConfirmModalProps,
  HeaderAction,
  TableAction,
  TableColumn,
  TableDataProps,
  RowClickProps,
  AdvancedFilterProps,
  DateRangePickerProps
} from './component'
