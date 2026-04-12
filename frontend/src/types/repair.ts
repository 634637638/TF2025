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
export type RepairStatus = 'pending' | 'diagnosed' | 'repairing' | 'completed' | 'returned' | 'cancelled'

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
  repair_number: string
  device_type: DeviceType
  device_brand?: string
  device_model?: string
  device_color?: string
  device_imei?: string
  fault_description: string
  repair_type: RepairType
  priority: RepairPriority
  warranty_status: WarrantyStatus
  customer_type: CustomerType
  customer_id?: number
  customer_name: string
  customer_phone: string
  customer_address?: string
  estimated_cost?: number
  actual_cost?: number
  deposit_amount?: number
  payment_status: RepairPaymentStatus
  store_id: number
  store_name: string
  technician_id?: number
  technician_name?: string
  status: RepairStatus
  diagnosis?: string
  repair_process?: string
  parts_used?: PartsUsed[]
  accessories?: string[]
  start_date?: string
  estimated_complete_date?: string
  actual_complete_date?: string
  return_date?: string
  remark?: string
  images?: string[]
  created_at: string
  updated_at: string
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
  device_type: DeviceType
  device_brand?: string
  device_model?: string
  device_color?: string
  device_imei?: string
  fault_description: string
  repair_type: RepairType
  priority?: RepairPriority
  warranty_status?: WarrantyStatus
  customer_type?: CustomerType
  customer_id?: number
  customer_name: string
  customer_phone: string
  customer_address?: string
  estimated_cost?: number
  deposit_amount?: number
  store_id: number
  technician_id?: number
  estimated_complete_date?: string
  remark?: string
  images?: string[]
}

/**
 * 维修单筛选条件
 */
export interface RepairOrderFilters {
  search?: string
  repair_number?: string
  device_type?: DeviceType
  repair_type?: RepairType
  priority?: RepairPriority
  status?: RepairStatus
  payment_status?: RepairPaymentStatus
  store_id?: number
  technician_id?: number
  customer_phone?: string
  start_date?: string
  end_date?: string
  is_overdue?: boolean
}

/**
 * 维修单列表响应
 */
export interface RepairOrderListResponse {
  orders: RepairOrder[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
  stats?: {
    total_count: number
    pending_count: number
    in_progress_count: number
    completed_count: number
    total_cost: number
  }
}

// ==================== 维修统计类型 ====================

/**
 * 维修统计数据
 */
export interface RepairStats {
  total_orders: number
  pending_orders: number
  in_progress_orders: number
  completed_orders: number
  returned_orders: number
  total_revenue: number
  avg_repair_time: number
  on_time_rate: number
  by_type: Record<RepairType, number>
  by_priority: Record<RepairPriority, number>
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
  remark?: string
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
