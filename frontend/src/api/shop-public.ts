/**
 * H5商城公开 API 封装 - 用户端（无需认证）
 * 功能：商品展示、购物车、下单、订单查询
 *
 * 注意：此模块已重构，内部使用 unifiedApi
 * unifiedApi 已内置对 /public/ 路径的支持，自动处理认证
 */

import { unifiedApi } from '@/utils/unified-api'

// 为了向后兼容，保留 publicApi 别名
export const publicApi = unifiedApi

const unwrapData = <T>(response: any): T => {
  if (response && typeof response === 'object' && 'data' in response) {
    return response.data as T
  }
  return response as T
}

const unwrapPaginated = <T>(response: any): {
  data: T[]
  page: number
  limit: number
  total: number
} => {
  const pagination = response?.pagination || {}
  return {
    data: Array.isArray(response?.data) ? response.data as T[] : [],
    page: Number(pagination.page ?? response?.page ?? 1),
    limit: Number(pagination.limit ?? response?.limit ?? 20),
    total: Number(pagination.total ?? response?.total ?? 0)
  }
}

// ============================================================================
// 类型定义
// ============================================================================

export interface Product {
  id: number
  imei?: string
  is_new: number
  sale_price: number
  quality_grade?: string
  condition_grade?: string
  created_at: string
  brand_id: number
  brand_name: string
  model_id: number
  model_name: string
  color_name: string
  memory_name: string
  store_name?: string
  main_image?: string
}

export interface ProductDetail extends Product {
  serial_number?: string
  purchase_cost?: number
  actual_sale_price?: number
  remarks?: string
  store_address?: string
  store_phone?: string
  images: Array<{
    id: number
    image_url: string
    image_type: string
    is_primary: boolean
  }>
  inspection?: {
    condition_grade?: string
    battery_status?: string
    screen_condition?: string
    screen_condition_text?: string
    system_version?: string
    model_version?: string
    warranty_date?: string
    is_warranty_expired?: boolean
    sale_price?: number
  }
}

export interface CartItem {
  cart_id: number
  id: number
  quantity: number
  sale_price: number
  is_new: number
  brand_name: string
  model_name: string
  color_name: string
  memory_name: string
  image?: string
}

export interface CartData {
  items: CartItem[]
  total: number
  count: number
}

export interface OrderItem {
  phoneId: number
  quantity: number
}

export interface OrderData {
  customerName: string
  customerPhone: string
  customerAddress?: string
  items: OrderItem[]
  paymentMethod?: string
  remarks?: string
  cartId?: string
}

export interface ShopConfig {
  shop_name: string
  shop_logo: string
  shop_phone: string
  shop_address: string
  shop_hours: string
  wechat_qrcode: string
  alipay_qrcode: string
  bank_info: string
  banner_enabled: boolean
  cart_enabled: boolean
  direct_buy_enabled: boolean
}

export interface Banner {
  id: number
  title: string
  image_url: string
  images?: string[]  // 支持多图片轮播
  link_url?: string
  link_type: string
  interval?: number  // 轮播时间间隔（毫秒），默认3000ms
}

// ============================================================================
// 商城配置 API
// ============================================================================

/**
 * 获取商城公开配置
 */
export function getPublicConfig() {
  return publicApi.get<ShopConfig>('/public/shop/config').then((response) => unwrapData<ShopConfig>(response))
}

/**
 * 获取启用的轮播图
 */
export function getActiveBanners() {
  return publicApi.get<Banner[]>('/public/shop/banners').then((response) => unwrapData<Banner[]>(response))
}

// ============================================================================
// 商品展示 API
// ============================================================================

interface ProductListParams {
  page?: number
  limit?: number
  brand_id?: number
  model_id?: number
  color_id?: number
  memory_id?: number
  is_new?: boolean
  search?: string
  sort?: string
  order?: string
}

/**
 * 获取商品列表
 */
export function getProducts(params?: ProductListParams) {
  return publicApi.get<{
    data: Product[]
    page: number
    limit: number
    total: number
  }>('/public/products', { params }).then((response) => unwrapPaginated<Product>(response))
}

/**
 * 获取商品详情
 */
export function getProductDetail(id: number) {
  return publicApi.get<ProductDetail>(`/public/products/${id}`).then((response) => unwrapData<ProductDetail>(response))
}

/**
 * 获取商品图片
 */
export function getProductImages(id: number) {
  return publicApi.get<any[]>(`/public/products/${id}/images`).then((response) => unwrapData<any[]>(response))
}

/**
 * 搜索商品
 */
export function searchProducts(keyword: string, params?: { page?: number; limit?: number }) {
  return publicApi.get<{
    data: Product[]
    page: number
    limit: number
    total: number
  }>(`/public/products/search/${encodeURIComponent(keyword)}`, { params }).then((response) => unwrapPaginated<Product>(response))
}


// ============================================================================
// 购物车 API
// ============================================================================

/**
 * 获取购物车
 */
export function getCart(cartId: string) {
  return publicApi.get<CartData>(`/public/cart/${cartId}`).then((response) => unwrapData<CartData>(response))
}

/**
 * 添加商品到购物车
 */
export function addToCart(cartId: string, phoneId: number, quantity: number = 1) {
  return publicApi.post('/public/cart/add', { cartId, phoneId, quantity })
}

/**
 * 更新购物车商品数量
 */
export function updateCartItem(id: number, quantity: number) {
  return publicApi.put(`/public/cart/${id}`, { quantity })
}

/**
 * 删除购物车商品
 */
export function removeFromCart(id: number) {
  return publicApi.delete(`/public/cart/${id}`)
}

/**
 * 清空购物车
 */
export function clearCart(cartId: string) {
  return publicApi.delete(`/public/cart/${cartId}/clear`)
}

// ============================================================================
// 订单 API
// ============================================================================

interface CreateOrderResult {
  orderId: number
  orderNumber: string
  totalAmount: number
  status: string
}

/**
 * 创建订单
 */
export function createOrder(orderData: OrderData) {
  return publicApi.post<CreateOrderResult>('/public/orders/create', orderData)
}

/**
 * 根据订单号查询订单
 */
export function getOrderByNumber(orderNumber: string) {
  return publicApi.get<any>(`/public/orders/${orderNumber}`).then((response) => unwrapData<any>(response))
}

/**
 * 用户确认支付
 */
export function confirmPayment(orderNumber: string) {
  return publicApi.post<any>(`/public/orders/${orderNumber}/confirm-payment`)
}

/**
 * 取消订单
 */
export function cancelOrder(orderId: number, reason?: string) {
  return publicApi.put(`/public/orders/${orderId}/cancel`, { reason })
}

/**
 * 根据手机号查询订单列表
 */
export function getOrdersByPhone(phone: string, params?: { page?: number; limit?: number }) {
  return publicApi.get<{
    data: any[]
    page: number
    limit: number
    total: number
  }>(`/public/orders/phone/${phone}`, { params })
}

/**
 * 修改订单状态（需要管理员权限）
 */
export function updateOrderStatus(orderId: number, status: string) {
  return publicApi.put(`/public/orders/${orderId}/status`, { status })
}

// ============================================================================
// 聚合商品 API（按品牌+型号+颜色聚合）
// ============================================================================

/**
 * 聚合商品内存选项
 */
export interface AggregatedMemory {
  id: number
  name: string
  stock: number
  price: number
}

/**
 * 聚合商品
 */
export interface AggregatedProduct {
  product_key: string
  brand_id: number
  brand_name: string
  brand_icon?: string
  model_id: number
  model_name: string
  color_id: number
  color_name: string
  is_new: number | string  // 支持数字或字符串类型
  min_price: number | string
  max_price: number | string
  total_stock: number | string
  main_image?: string
  images?: string[]  // 模板图片数组
  template_id?: number  // 全新机模板ID
  memory_ids?: number[]  // 全新机可用内存ID列表
  memories: AggregatedMemory[]
}

/**
 * 聚合商品列表参数
 */
interface AggregatedProductsParams {
  page?: number
  limit?: number
  brand_id?: number
  model_id?: number
  color_id?: number
  is_new?: boolean
  search?: string
}

/**
 * 获取聚合商品列表
 */
export function getAggregatedProducts(params?: AggregatedProductsParams) {
  return publicApi.get<{
    data: AggregatedProduct[]
    page: number
    limit: number
    total: number
  }>('/public/products/aggregate', { params }).then((response) => unwrapPaginated<AggregatedProduct>(response))
}

/**
 * 库存分布中的店铺信息
 */
export interface StoreStock {
  store_id: number
  store_name: string
  store_address?: string
  store_phone?: string
  stock_count: number
  items: Array<{
    phone_id: number
    imei?: string
    quality_grade?: string
    condition_grade?: string
    sale_price: number
    image_url?: string
  }>
}

/**
 * 库存分布响应
 */
export interface StockDistribution {
  brand_id: number
  model_id: number
  color_id: number
  memory_id: number
  is_new: boolean
  total_stock: number
  stores: StoreStock[]
}

/**
 * 获取库存分布
 */
export function getStockDistribution(params: {
  brand_id: number
  model_id: number
  color_id: number
  memory_id: number
  is_new: boolean
}) {
  return publicApi.get<StockDistribution>('/public/products/stock/distribution', { params }).then((response) => unwrapData<StockDistribution>(response))
}

/**
 * 获取模板商品列表
 * GET /api/public/templates/:id/phones
 */
export function getTemplatePhones(templateId: number) {
  return publicApi.get<PublicTemplatePhone[]>(`/public/templates/${templateId}/phones`).then((response) => unwrapData<PublicTemplatePhone[]>(response))
}

export interface PublicTemplatePhone {
  id: number
  imei?: string
  is_new?: number
  sale_price?: number
  brand_name?: string
  model_name?: string
  color_name?: string
  memory_name?: string
  main_image?: string
}

export default publicApi
