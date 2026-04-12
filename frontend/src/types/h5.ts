/**
 * H5管理相关类型定义
 * 集中管理H5相关的数据类型
 */

// ==================== 基础类型 ====================

/**
 * 上下架状态
 */
export type PublishStatus = 'draft' | 'published' | 'unpublished' | 'archived'

/**
 * 内容类型
 */
export type ContentType = 'banner' | 'article' | 'product' | 'activity' | 'link' | 'other'

/**
 * 链接类型
 */
export type LinkType = 'product' | 'category' | 'page' | 'url' | 'mini_program'

// ==================== Banner管理类型 ====================

/**
 * Banner位置
 */
export type BannerPosition = 'home' | 'category' | 'product' | 'personal' | 'splash' | 'popup'

/**
 * Banner记录
 */
export interface Banner {
  id: number
  title: string
  subtitle?: string
  image_url: string
  link_type?: LinkType
  link_url?: string
  link_target?: string
  link_product_id?: number
  link_category_id?: number
  link_page?: string
  position: BannerPosition
  sort_order: number
  start_date?: string
  end_date?: string
  is_active: boolean
  click_count?: number
  exposure_count?: number
  status: PublishStatus
  operator_id: number
  operator_name: string
  created_at: string
  updated_at: string
}

/**
 * Banner表单数据
 */
export interface BannerForm {
  title: string
  subtitle?: string
  image_url: string
  link_type?: LinkType
  link_url?: string
  link_target?: string
  link_product_id?: number
  link_category_id?: number
  link_page?: string
  position: BannerPosition
  sort_order?: number
  start_date?: string
  end_date?: string
  is_active?: boolean
}

/**
 * Banner筛选条件
 */
export interface BannerFilters {
  position?: BannerPosition
  status?: PublishStatus
  is_active?: boolean
  start_date?: string
  end_date?: string
}

/**
 * Banner列表响应
 */
export interface BannerListResponse {
  banners: Banner[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

// ==================== 首页区块类型 ====================

/**
 * 区块类型
 */
export type SectionType = 'banner' | 'icons' | 'products' | 'news' | 'notice' | 'custom' | 'blank'

/**
 * 区块样式
 */
export type SectionStyle = 'default' | 'card' | 'list' | 'grid' | 'carousel' | 'swiper'

/**
 * 首页区块
 */
export interface HomeSection {
  id: number
  name: string
  type: SectionType
  style: SectionStyle
  title?: string
  subtitle?: string
  image_url?: string
  link_url?: string
  sort_order: number
  is_show: boolean
  show_title: boolean
  show_more: boolean
  more_link?: string
  more_text?: string
  data_source?: string
  data_config?: Record<string, unknown>
  style_config?: Record<string, unknown>
  background_color?: string
  padding_top?: number
  padding_bottom?: number
  item_count?: number
  item_style?: string
  operator_id: number
  operator_name: string
  created_at: string
  updated_at: string
}

/**
 * 区块表单数据
 */
export interface HomeSectionForm {
  name: string
  type: SectionType
  style: SectionStyle
  title?: string
  subtitle?: string
  image_url?: string
  link_url?: string
  sort_order?: number
  is_show?: boolean
  show_title?: boolean
  show_more?: boolean
  more_link?: string
  more_text?: string
  data_source?: string
  data_config?: Record<string, unknown>
  style_config?: Record<string, unknown>
  background_color?: string
  padding_top?: number
  padding_bottom?: number
  item_count?: number
  item_style?: string
}

/**
 * 首页区块筛选条件
 */
export interface HomeSectionFilters {
  type?: SectionType
  is_show?: boolean
}

/**
 * 首页区块列表响应
 */
export interface HomeSectionListResponse {
  sections: HomeSection[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

// ==================== 已售商品类型 ====================

/**
 * 已售商品记录
 */
export interface SoldProduct {
  id: number
  product_name: string
  brand_name: string
  model_name: string
  color_name?: string
  memory_name?: string
  imei?: string
  quality_grade?: string
  selling_price: number
  sale_price?: number
  sale_date: string
  customer_name: string
  customer_phone?: string
  store_id: number
  store_name: string
  operator_id: number
  operator_name: string
  status: 'normal' | 'returned' | 'exchanged'
  return_date?: string
  return_reason?: string
  warranty_expired_date?: string
  is_under_warranty: boolean
  remark?: string
  images?: string[]
  created_at: string
  updated_at: string
}

/**
 * 已售商品筛选条件
 */
export interface SoldProductFilters {
  search?: string
  brand_id?: number
  model_id?: number
  store_id?: number
  status?: 'normal' | 'returned' | 'exchanged'
  start_date?: string
  end_date?: string
  warranty_status?: 'valid' | 'expired'
}

/**
 * 已售商品列表响应
 */
export interface SoldProductListResponse {
  products: SoldProduct[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
  stats?: {
    total_count: number
    returned_count: number
    total_amount: number
  }
}

// ==================== H5订单类型 ====================

/**
 * H5订单状态
 */
export type H5OrderStatus = 'pending' | 'paid' | 'shipped' | 'delivered' | 'completed' | 'cancelled' | 'refunded'

/**
 * H5订单来源
 */
export type H5OrderSource = 'h5' | 'mini_program' | 'wechat' | 'app' | 'other'

/**
 * H5订单
 */
export interface H5Order {
  id: number
  order_number: string
  source: H5OrderSource
  customer_id: number
  customer_name: string
  customer_phone: string
  customer_address: string
  total_amount: number
  discount_amount?: number
  shipping_fee?: number
  actual_amount: number
  payment_method?: string
  payment_status: 'unpaid' | 'paid' | 'refunded'
  payment_time?: string
  status: H5OrderStatus
  shipping_method?: string
  tracking_number?: string
  shipped_at?: string
  delivered_at?: string
  completed_at?: string
  remark?: string
  store_id: number
  store_name: string
  operator_id?: number
  operator_name?: string
  items: H5OrderItem[]
  created_at: string
  updated_at: string
}

/**
 * H5订单明细
 */
export interface H5OrderItem {
  id: number
  order_id: number
  product_type: 'phone' | 'accessory' | 'service'
  product_id: number
  product_name: string
  product_image?: string
  quantity: number
  unit_price: number
  discount?: number
  subtotal: number
  specifications?: Record<string, string>
}

/**
 * H5订单筛选条件
 */
export interface H5OrderFilters {
  search?: string
  order_number?: string
  source?: H5OrderSource
  status?: H5OrderStatus
  payment_status?: string
  store_id?: number
  customer_phone?: string
  start_date?: string
  end_date?: string
}

/**
 * H5订单列表响应
 */
export interface H5OrderListResponse {
  orders: H5Order[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
  stats?: {
    total_amount: number
    total_count: number
    pending_count: number
  }
}

// ==================== H5配置类型 ====================

/**
 * H5首页配置
 */
export interface H5HomeConfig {
  id: number
  name: string
  version: string
  is_published: boolean
  published_at?: string
  sections: HomeSection[]
  created_at: string
  updated_at: string
}

/**
 * H5分享配置
 */
export interface H5ShareConfig {
  title: string
  description: string
  image?: string
  link?: string
  min_program_link?: string
}

/**
 * H5基础配置
 */
export interface H5BaseConfig {
  app_name: string
  logo?: string
  share: H5ShareConfig
  contact_phone?: string
  contact_qq?: string
  contact_wechat?: string
  service_hours?: string
  about_us_url?: string
  privacy_policy_url?: string
  user_agreement_url?: string
}
