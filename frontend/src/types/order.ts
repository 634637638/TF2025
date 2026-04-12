/**
 * 订单相关类型定义
 * 集中管理销售订单、预订单等相关类型
 */

// ==================== 基础类型 ====================

/**
 * 订单状态
 */
export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'completed' | 'cancelled' | 'refunded'

/**
 * 支付状态
 */
export type PaymentStatus = 'unpaid' | 'paid' | 'partial' | 'refunded'

/**
 * 支付方式
 */
export type PaymentMethod = 'cash' | 'card' | 'wechat' | 'alipay' | 'transfer' | 'other'

/**
 * 订单类型
 */
export type OrderType = 'new' | 'used' | 'mixed'

/**
 * 商品新旧程度
 */
export type ProductQuality = '全新' | '99新' | '95新' | '9新' | '8新' | '7新' | '其他'

// ==================== 预订单相关类型 ====================

/**
 * 预订单状态
 */
export type PreorderStatus = 'pending' | 'arrived' | 'cancelled' | 'completed'

/**
 * 预订单来源
 */
export type PreorderSource = 'store' | 'online' | 'phone' | 'referral'

/**
 * 预订单记录
 */
export interface Preorder {
  id: number
  order_number: string
  customer_name: string
  customer_phone: string
  customer_id?: number
  brand_id?: number
  brand_name?: string
  model_id?: number
  model_name?: string
  color_id?: number
  color_name?: string
  memory_id?: number
  memory_name?: string
  quality_grade?: ProductQuality
  expected_price?: number
  deposit_amount?: number
  source: PreorderSource
  status: PreorderStatus
  remark?: string
  store_id: number
  store_name: string
  operator_id: number
  operator_name: string
  follow_up_date?: string
  follow_up_record?: string
  confirmed_at?: string
  cancelled_at?: string
  completed_at?: string
  created_at: string
  updated_at: string
}

/**
 * 预订单表单数据
 */
export interface PreorderForm {
  order_number?: string
  customer_name: string
  customer_phone: string
  customer_id?: number
  brand_id?: number
  model_id?: number
  color_id?: number
  memory_id?: number
  quality_grade?: ProductQuality
  expected_price?: number
  deposit_amount?: number
  source: PreorderSource
  remark?: string
  store_id: number
  follow_up_date?: string
  follow_up_record?: string
}

/**
 * 预订单筛选条件
 */
export interface PreorderFilters {
  search?: string
  status?: PreorderStatus
  source?: PreorderSource
  store_id?: number
  brand_id?: number
  model_id?: number
  start_date?: string
  end_date?: string
}

/**
 * 预订单列表响应
 */
export interface PreorderListResponse {
  preorders: Preorder[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
  stats?: {
    total_count: number
    pending_count: number
    confirmed_count: number
  }
}

// ==================== 销售单相关类型 ====================

/**
 * 销售单记录
 */
export interface SalesOrder {
  id: number
  order_number: string
  type: OrderType
  customer_id?: number
  customer_name: string
  customer_phone: string
  total_amount: number
  actual_amount?: number
  discount_amount?: number
  payment_method?: PaymentMethod
  payment_status: PaymentStatus
  invoice_required?: boolean
  invoice_number?: string
  store_id: number
  store_name: string
  operator_id: number
  operator_name: string
  remark?: string
  items?: SalesOrderItem[]
  status: OrderStatus
  sale_date: string
  created_at: string
  updated_at: string
}

/**
 * 销售单明细
 */
export interface SalesOrderItem {
  id: number
  order_id: number
  product_type: 'phone' | 'accessory'
  product_id: number
  product_name: string
  brand_name?: string
  model_name?: string
  color_name?: string
  memory_name?: string
  imei?: string
  quantity: number
  unit_price: number
  discount?: number
  subtotal: number
  cost_price?: number
}

/**
 * 销售单表单数据
 */
export interface SalesOrderForm {
  order_number?: string
  type: OrderType
  customer_name: string
  customer_phone: string
  customer_id?: number
  total_amount: number
  actual_amount?: number
  discount_amount?: number
  payment_method?: PaymentMethod
  payment_status?: PaymentStatus
  invoice_required?: boolean
  store_id: number
  remark?: string
  items: SalesOrderItem[]
}

/**
 * 销售单筛选条件
 */
export interface SalesOrderFilters {
  search?: string
  order_number?: string
  type?: OrderType
  status?: OrderStatus
  payment_status?: PaymentStatus
  store_id?: number
  operator_id?: number
  customer_phone?: string
  start_date?: string
  end_date?: string
}

/**
 * 销售单列表响应
 */
export interface SalesOrderListResponse {
  orders: SalesOrder[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
  stats?: {
    total_amount: number
    total_count: number
  }
}

// ==================== 退货单相关类型 ====================

/**
 * 退货单记录
 */
export interface ReturnOrder {
  id: number
  return_number: string
  original_order_id: number
  original_order_number: string
  customer_id?: number
  customer_name: string
  customer_phone: string
  return_amount: number
  return_reason: string
  return_type: 'refund' | 'exchange' | 'repair'
  status: 'pending' | 'approved' | 'processing' | 'completed' | 'rejected'
  approved_by?: number
  approved_by_name?: string
  approved_at?: string
  processed_at?: string
  completed_at?: string
  store_id: number
  store_name: string
  operator_id: number
  operator_name: string
  remark?: string
  items?: ReturnOrderItem[]
  created_at: string
  updated_at: string
}

/**
 * 退货单明细
 */
export interface ReturnOrderItem {
  id: number
  return_id: number
  product_type: 'phone' | 'accessory'
  product_id: number
  product_name: string
  imei?: string
  quantity: number
  unit_price: number
  return_amount: number
  reason?: string
}

/**
 * 退货单筛选条件
 */
export interface ReturnOrderFilters {
  search?: string
  status?: string
  return_type?: 'refund' | 'exchange' | 'repair'
  store_id?: number
  start_date?: string
  end_date?: string
}

// ==================== 客户相关类型 ====================

/**
 * 客户信息
 */
export interface Customer {
  id: number
  name: string
  phone: string
  email?: string
  address?: string
  birthday?: string
  gender?: 'male' | 'female' | 'other'
  total_orders: number
  total_amount: number
  avg_order_value?: number
  last_order_date?: string
  first_order_date?: string
  source?: string
  tags?: string[]
  remark?: string
  status: number
  created_at: string
  updated_at: string
}

/**
 * 客户表单数据
 */
export interface CustomerForm {
  name: string
  phone: string
  email?: string
  address?: string
  birthday?: string
  gender?: 'male' | 'female' | 'other'
  source?: string
  tags?: string[]
  remark?: string
}

/**
 * 客户筛选条件
 */
export interface CustomerFilters {
  search?: string
  phone?: string
  store_id?: number
  start_date?: string
  end_date?: string
}

/**
 * 客户列表响应
 */
export interface CustomerListResponse {
  customers: Customer[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

// ==================== 批发/代发相关类型 ====================

/**
 * 批发单模式
 */
export type WholesaleMode = 'wholesale' | 'proxy'

/**
 * 批发单状态
 */
export type WholesaleStatus = 'pending' | 'confirmed' | 'shipped' | 'completed' | 'cancelled'

/**
 * 批发单记录
 */
export interface WholesaleOrder {
  id: number
  order_number: string
  mode: WholesaleMode
  customer_name: string
  customer_phone: string
  customer_address?: string
  total_quantity: number
  total_amount: number
  discount_amount?: number
  actual_amount?: number
  shipping_fee?: number
  shipping_method?: string
  tracking_number?: string
  status: WholesaleStatus
  store_id: number
  store_name: string
  operator_id: number
  operator_name: string
  remark?: string
  items?: WholesaleOrderItem[]
  shipped_at?: string
  completed_at?: string
  created_at: string
  updated_at: string
}

/**
 * 批发单明细
 */
export interface WholesaleOrderItem {
  id: number
  order_id: number
  phone_id: number
  imei: string
  product_name: string
  brand_name: string
  model_name: string
  color_name: string
  memory_name: string
  quantity: number
  unit_price: number
  cost_price?: number
  subtotal: number
}

/**
 * 批发单表单数据
 */
export interface WholesaleOrderForm {
  mode: WholesaleMode
  customer_name: string
  customer_phone: string
  customer_address?: string
  total_amount?: number
  discount_amount?: number
  actual_amount?: number
  shipping_fee?: number
  shipping_method?: string
  store_id: number
  phone_ids: number[]
  remark?: string
}

/**
 * 批发单筛选条件
 */
export interface WholesaleOrderFilters {
  search?: string
  mode?: WholesaleMode
  status?: WholesaleStatus
  store_id?: number
  start_date?: string
  end_date?: string
}

/**
 * 批发单列表响应
 */
export interface WholesaleOrderListResponse {
  orders: WholesaleOrder[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
  stats?: {
    total_amount: number
    total_quantity: number
  }
}
