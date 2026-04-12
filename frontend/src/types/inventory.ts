/**
 * 库存管理相关类型定义
 * 支持完整的TypeScript强约束
 */

// 基础类型定义
export type ProductType = 'phone' | 'accessory'
export type OperationType = 'in' | 'out' | 'adjust' | 'sale'
export type StockStatus = 'normal' | 'low' | 'overstock' | 'out_of_stock'
export type SettledStatus = 0 | 1

// 入库记录接口
export interface StockInRecord {
  id: number
  product_type: ProductType
  product_id: number
  product_name: string
  brand_id?: number
  brand_name?: string
  model_id?: number
  model_name?: string
  color_id?: number
  color_name?: string
  memory_id?: number
  memory_name?: string
  imei?: string
  serial_number?: string
  quantity: number
  unit_cost: number
  total_cost: number
  store_id: number
  store_name: string
  supplier_id?: number
  supplier_name?: string
  operation_type: OperationType
  operator_id: number
  operator_name: string
  reason?: string
  note?: string
  is_settled: SettledStatus
  reference_type?: string
  reference_id?: string
  created_at: string
  updated_at?: string
}

// 入库表单数据接口
export interface StockInFormData {
  product_type: ProductType
  product_id: number
  quantity: number
  unit_cost: number
  store_id: number
  supplier_id?: number
  operation_type: OperationType
  reason?: string
  note?: string
  reference_type?: string
  reference_id?: string
  imei?: string
  serial_number?: string
}

// 库存记录接口
export interface InventoryRecord {
  id: number
  product_type: ProductType
  product_id: number
  product_name: string
  brand_name?: string
  model_name?: string
  color_name?: string
  memory_name?: string
  imei?: string
  current_stock: number
  available_stock: number
  reserved_stock: number
  min_stock_level: number
  max_stock_level: number
  reorder_point: number
  unit_cost: number
  total_value: number
  store_id: number
  store_name: string
  last_stock_in?: string
  last_stock_out?: string
  stock_status: StockStatus
  notes?: string
  created_at: string
  updated_at: string
}

// 库存变动记录接口
export interface StockMovement {
  id: number
  inventory_id: number
  movement_type: 'stock_in' | 'stock_out' | 'reserve' | 'unreserve' | 'adjust'
  quantity: number
  reference_type?: string
  reference_id?: string
  reason?: string
  operator_id: number
  operator_name: string
  movement_date: string
  created_at: string
}

// 筛选条件接口
export interface StockInFilters {
  productType?: ProductType
  brandId?: string
  storeId?: string
  supplierId?: string
  operationType?: OperationType
  isSettled?: SettledStatus
  startDate?: string
  endDate?: string
}

export interface InventoryFilters {
  productType?: ProductType
  brandId?: string
  storeId?: string
  stockStatus?: StockStatus
  lowStock?: boolean
  outOfStock?: boolean
  search?: string
}

// 分页接口
export interface Pagination {
  page: number
  limit: number
  total: number
  pages: number
}

// API响应接口
export interface StockInListResponse {
  records: StockInRecord[]
  pagination: Pagination
}

export interface InventoryListResponse {
  inventory: InventoryRecord[]
  pagination: Pagination
}

export interface StockMovementListResponse {
  movements: StockMovement[]
  pagination: Pagination
}

// 统计数据接口
export interface StatsData {
  todayStockIn: number
  totalItems: number
  totalValue: number
  lowStockItems: number
  outOfStockItems: number
  normalItems: number
  overstockItems: number
  byStore: Record<string, number>
  byBrand: Record<string, number>
}

// 商品信息接口
export interface ProductInfo {
  id: number
  name: string
  type: ProductType
  brand_id?: number
  brand_name?: string
  model_id?: number
  model_name?: string
  color_id?: number
  color_name?: string
  memory_id?: number
  memory_name?: string
  price?: number
  cost?: number
  status: 'active' | 'inactive'
  created_at: string
  updated_at?: string
}

// 手机信息接口
export interface PhoneInfo extends ProductInfo {
  imei?: string
  serial_number?: string
  storage_capacity?: string
  network_type?: string
}

// 配件信息接口
export interface AccessoryInfo extends ProductInfo {
  compatibility?: string
  specifications?: string
  warranty_period?: number
}

// 门店信息接口
export interface StoreInfo {
  id: number
  name: string
  code: string
  address?: string
  phone?: string
  manager_id?: number
  manager_name?: string
  status: 'active' | 'inactive'
  created_at: string
  updated_at?: string
}

// 供应商信息接口
export interface SupplierInfo {
  id: number
  name: string
  code: string
  contact_person?: string
  phone?: string
  email?: string
  address?: string
  status: 'active' | 'inactive'
  created_at: string
  updated_at?: string
}

// 品牌信息接口
export interface BrandInfo {
  id: number
  name: string
  code: string
  logo?: string
  description?: string
  status: 'active' | 'inactive'
  created_at: string
  updated_at?: string
}

// 型号信息接口
export interface ModelInfo {
  id: number
  brand_id: number
  brand_name: string
  name: string
  code: string
  description?: string
  status: 'active' | 'inactive'
  created_at: string
  updated_at?: string
}

// 颜色信息接口
export interface ColorInfo {
  id: number
  name: string
  code: string
  hex?: string
  status: 'active' | 'inactive'
  created_at: string
  updated_at?: string
}

// 内存信息接口
export interface MemoryInfo {
  id: number
  name: string
  capacity: string
  status: 'active' | 'inactive'
  created_at: string
  updated_at?: string
}

// 用户信息接口
export interface UserInfo {
  id: number
  username: string
  name: string
  email?: string
  phone?: string
  role: string
  store_id?: number
  store_name?: string
  status: 'active' | 'inactive'
  last_login?: string
  created_at: string
  updated_at?: string
}

// 搜索建议接口
export interface SearchSuggestion {
  id: number
  text: string
  type: 'product' | 'imei' | 'brand' | 'model'
  data?: any
}

// 导出配置接口
export interface ExportConfig {
  format: 'excel' | 'csv' | 'pdf'
  filters?: StockInFilters | InventoryFilters
  fields?: string[]
  filename?: string
}

// 批量操作接口
export interface BatchOperation {
  type: 'settle' | 'delete' | 'export' | 'adjust'
  ids: number[]
  data?: any
}

// 库存调整接口
export interface StockAdjustment {
  id?: number
  product_id: number
  product_type: ProductType
  store_id: number
  adjustment_type: 'increase' | 'decrease' | 'set'
  quantity: number
  reason?: string
  operator_id: number
  reference_type?: string
  reference_id?: string
}

// 库存预警接口
export interface StockAlert {
  id: number
  inventory_id: number
  product_name: string
  current_stock: number
  min_stock_level: number
  max_stock_level: number
  alert_type: 'low_stock' | 'out_of_stock' | 'overstock'
  store_id: number
  store_name: string
  created_at: string
  is_resolved: boolean
  resolved_at?: string
  resolved_by?: number
}

// 库存盘点接口
export interface StockTaking {
  id: number
  store_id: number
  store_name: string
  title: string
  description?: string
  status: 'draft' | 'in_progress' | 'completed' | 'cancelled'
  start_date: string
  end_date?: string
  operator_id: number
  operator_name: string
  total_items: number
  checked_items: number
  difference_items: number
  created_at: string
  updated_at: string
}

// 盘点明细接口
export interface StockTakingItem {
  id: number
  stock_taking_id: number
  inventory_id: number
  product_name: string
  system_quantity: number
  actual_quantity: number
  difference: number
  reason?: string
  checker_id?: number
  checker_name?: string
  checked_at?: string
  created_at: string
}

// API请求配置接口
export interface StockInRequestConfig {
  showLoading?: boolean
  showError?: boolean
  showSuccess?: boolean
  successMessage?: string
}

// 组件Props接口
export interface StockInModalProps {
  visible: boolean
  mode: 'create' | 'edit'
  data?: StockInRecord | null
}

export interface StockInDetailModalProps {
  visible: boolean
  record: StockInRecord | null
}

// 事件接口
export interface StockInEvents {
  success: () => void
  cancel: () => void
}

// 组合式函数返回类型
export interface UseStockInReturn {
  data: StockInRecord[]
  loading: boolean
  error: Error | null
  pagination: Pagination
  filters: StockInFilters
  loadData: () => Promise<void>
  createRecord: (data: StockInFormData) => Promise<StockInRecord>
  updateRecord: (id: number, data: Partial<StockInFormData>) => Promise<StockInRecord>
  deleteRecord: (id: number) => Promise<void>
  settleRecord: (id: number) => Promise<void>
  batchSettle: (ids: number[]) => Promise<void>
  batchDelete: (ids: number[]) => Promise<void>
  exportData: (config?: ExportConfig) => Promise<void>
}

// 性能监控接口
export interface PerformanceMetrics {
  pageLoadTime: number
  apiCallTime: number
  renderTime: number
  memoryUsage: number
  errorCount: number
}

// 错误信息接口
export interface ErrorInfo {
  code?: string
  message: string
  details?: any
  stack?: string
  timestamp: string
  url: string
  userAgent: string
}

// 权限接口
export interface Permission {
  resource: string
  actions: string[]
}

// 用户权限接口
export interface UserPermissions {
  id: number
  userId: number
  permissions: Permission[]
  roles: string[]
}