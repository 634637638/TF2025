/**
 * 维修相关类型定义
 * 集中管理维修单、维修记录等相关类型
 */

// ==================== 维修单基础类型 ====================

/**
 * 维修类型
 */
export type RepairType = 'screen' | 'battery' | 'camera' | 'charging' | 'speaker' | 'mic' | 'software' | 'other'

/**
 * 维修状态
 */
export type RepairStatus = 'pending' | 'processing' | 'completed' | 'cancelled'

/**
 * 设备类型
 */
export type DeviceType = 'phone' | 'tablet' | 'laptop' | 'other'

/**
 * 维修优先级
 */
export type RepairPriority = 'low' | 'normal' | 'high' | 'urgent'

/**
 * 保修状态
 */
export type WarrantyStatus = 'in_warranty' | 'out_of_warranty' | 'extended_warranty'

/**
 * 支付状态
 */
export type RepairPaymentStatus = 'unpaid' | 'paid' | 'partial'

/**
 * 送修人类型
 */
export type CustomerType = 'owner' | 'walk_in' | 'online' | 'other'

// ==================== 维修单相关类型 ====================

/**
 * 维修单记录
 */
export interface RepairOrder {
  id: number
  order_no: string
  customer_id: number
  customer_name: string
  customer_phone: string
  brand_id?: number
  brand_name?: string
  phone_model?: string
  imei?: string
  problem_description: string
  estimated_cost?: number
  actual_cost?: number
  technician_id?: number
  technician_name?: string
  status: RepairStatus
  remarks?: string
  created_at: string
  updated_at: string
  completed_at?: string
}

/**
 * 使用配件
 */
export interface PartsUsed {
  parts_name: string
  parts_code?: string
  quantity: number
  unit_cost: number
  total_cost: number
}

/**
 * 维修单表单数据
 */
export interface RepairOrderForm {
  customer_id?: number | null
  brand_id?: number | null
  phone_model: string
  imei?: string
  problem_description: string
  estimated_cost?: number
  actual_cost?: number
  technician_id?: number | null
  remarks?: string
}

/**
 * 维修单筛选条件
 */
export interface RepairOrderFilters {
  page?: number
  page_size?: number
  search?: string
  status?: 'all' | RepairStatus
}

/**
 * 维修单列表响应
 */
export interface RepairOrderListResponse {
  data: RepairOrder[]
  pagination: {
    page: number
    page_size: number
    total: number
    total_pages: number
    has_next: boolean
    has_prev: boolean
  }
  stats?: {
    pending: number
    processing: number
    completed: number
    monthly_revenue: number
  }
}

// ==================== 维修统计类型 ====================

/**
 * 维修统计数据
 */
export interface RepairStats {
  pending: number
  processing: number
  completed: number
  monthly_revenue: number
}

/**
 * 维修类型统计
 */
export interface RepairTypeStats {
  type: RepairType
  count: number
  percentage: number
  avg_cost: number
  total_cost: number
}

/**
 * 技师工单统计
 */
export interface TechnicianStats {
  technician_id: number
  technician_name: string
  total_orders: number
  completed_orders: number
  avg_repair_time: number
  customer_satisfaction?: number
}

// ==================== 维修进度类型 ====================

/**
 * 维修进度节点
 */
export interface RepairProgressNode {
  id: string
  title: string
  description?: string
  status: 'pending' | 'current' | 'completed' | 'skipped'
  operator_id?: number
  operator_name?: string
  time?: string
  duration?: number
}

/**
 * 维修进度记录
 */
export interface RepairProgress {
  repair_id: number
  nodes: RepairProgressNode[]
  current_node: string
  completion_rate: number
  estimated_remaining_time?: number
  started_at?: string
  completed_at?: string
}

// ==================== 维修配件类型 ====================

/**
 * 配件库存
 */
export interface RepairParts {
  id: number
  name: string
  code: string
  compatible_models?: string[]
  stock_quantity: number
  min_stock_level: number
  unit_cost: number
  unit_price: number
  supplier_id?: number
  supplier_name?: string
  status: number
  created_at: string
  updated_at: string
}

/**
 * 配件入库
 */
export interface PartsStockIn {
  id: number
  parts_id: number
  parts_name: string
  quantity: number
  unit_cost: number
  total_cost: number
  supplier_id?: number
  supplier_name?: string
  operator_id: number
  operator_name: string
  remarks?: string
  created_at: string
}

// ==================== 维修评价类型 ====================

/**
 * 维修评价
 */
export interface RepairReview {
  id: number
  repair_id: number
  rating: number
  service_rating?: number
  quality_rating?: number
  speed_rating?: number
  comment?: string
  customer_name?: string
  created_at: string
}

/**
 * 评价统计
 */
export interface ReviewStats {
  avg_rating: number
  avg_service_rating?: number
  avg_quality_rating?: number
  avg_speed_rating?: number
  total_reviews: number
  rating_distribution: Record<number, number>
}
