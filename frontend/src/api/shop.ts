/**
 * H5商城 API 封装 - 员工端
 * 功能：配置管理、轮播图管理、商品图片管理、订单管理
 */

import { unifiedApi } from '@/utils/unified-api'

export interface ShopConfig {
  key: string
  value: any
  type: string
  description?: string
}

export interface ShopBanner {
  id?: number
  title: string
  image_url: string
  images?: string[]  // 支持多图片轮播
  link_url?: string
  link_type?: 'none' | 'product' | 'category' | 'external'
  sort_order?: number
  status?: 'active' | 'inactive'
  start_time?: string
  end_time?: string
  interval?: number  // 轮播时间间隔（毫秒），默认3000ms
}

export interface PhoneImage {
  id: number
  phone_id: number
  image_url: string
  image_type: string
  is_primary: boolean
  sort_order: number
}

export interface ShopOrder {
  id: number
  order_number: string
  customer_name: string
  customer_phone: string
  customer_address?: string
  total_amount: number
  payment_method?: string
  status: string
  remarks?: string
  created_at: string
  item_count?: number
}

// ============================================================================
// 全新机商品模板管理
// ============================================================================

export interface NewTemplate {
  id?: number
  brand_id: number
  model_id: number
  color_id: number
  memory_ids?: number[]  // 支持的内存ID列表
  template_name?: string
  description?: string
  price_markup?: number
  price_markup_type?: 'fixed' | 'percentage'
  is_active?: boolean | number  // 数据库返回数字，前端使用布尔
  sort_order?: number
  created_at?: string
  updated_at?: string
  // 关联数据
  brand_name?: string
  model_name?: string
  color_name?: string
  main_image?: string
  stock_count?: number | string  // COUNT返回可能是字符串
  images?: TemplateImage[]
  phones?: TemplatePhone[]
}

export interface TemplateImage {
  id: number
  template_id: number
  image_url: string
  image_type: 'main' | 'detail' | 'other' | 'video'
  is_primary: boolean
  sort_order: number
  uploaded_by?: number
  created_at?: string
}

export interface TemplatePhone {
  id: number
  imei?: string
  memory_id?: number
  memory_name?: string
  sale_price: number
  purchase_cost?: number
  quality_grade?: string
  store_id?: number
  store_name?: string
}

// ============================================================================
// 商城配置管理 API
// ============================================================================

/**
 * 获取所有商城配置
 */
export function getAllConfigs() {
  return unifiedApi.get<any>('/shop/config')
}

/**
 * 获取指定分类的配置
 */
export function getConfigsByCategory(category: string) {
  return unifiedApi.get<ShopConfig[]>(`/shop/config/category/${category}`)
}

/**
 * 更新单个配置
 */
export function updateConfig(key: string, value: any) {
  return unifiedApi.put(`/shop/config/${key}`, { value })
}

/**
 * 批量更新配置
 */
export function batchUpdateConfigs(configs: Array<{ key: string; value: any }>) {
  return unifiedApi.post('/shop/config/batch', { configs })
}

// ============================================================================
// 轮播图管理 API
// ============================================================================

/**
 * 获取所有轮播图
 */
export function getAllBanners() {
  return unifiedApi.get<ShopBanner[]>('/shop/banners')
}

/**
 * 创建轮播图
 */
export function createBanner(data: ShopBanner) {
  return unifiedApi.post('/shop/banners', data)
}

/**
 * 更新轮播图
 */
export function updateBanner(id: number, data: ShopBanner) {
  return unifiedApi.put(`/shop/banners/${id}`, data)
}

/**
 * 删除轮播图
 */
export function deleteBanner(id: number) {
  return unifiedApi.delete(`/shop/banners/${id}`)
}

/**
 * 批量更新轮播图排序
 */
export function reorderBanners(orders: Array<{ id: number; sort_order: number }>) {
  return unifiedApi.put('/shop/banners/reorder', { orders })
}

// ============================================================================
// 商品图片管理 API
// ============================================================================

/**
 * 获取商品图片列表
 */
export function getPhoneImages(phoneId: number) {
  return unifiedApi.get<PhoneImage[]>(`/shop/phones/${phoneId}/images`)
}

/**
 * 设置主图
 */
export function setPrimaryImage(imageId: number) {
  return unifiedApi.put(`/shop/images/${imageId}/primary`)
}

/**
 * 删除商品图片
 */
export function deleteImage(imageId: number) {
  return unifiedApi.delete(`/shop/images/${imageId}`)
}

// ============================================================================
// 订单管理 API
// ============================================================================

interface OrderListParams {
  page?: number
  limit?: number
  status?: string
  startDate?: string
  endDate?: string
  search?: string
}

/**
 * 获取订单列表
 */
export function getOrders(params?: OrderListParams) {
  return unifiedApi.get<{
    data: ShopOrder[]
    page: number
    limit: number
    total: number
  }>('/shop/orders', { params })
}

/**
 * 获取订单详情
 */
export function getOrderDetail(orderId: number) {
  return unifiedApi.get<ShopOrder & { items: any[] }>(`/shop/orders/${orderId}`)
}

/**
 * 更新订单状态
 */
export function updateOrderStatus(orderId: number, status: string) {
  return unifiedApi.put(`/shop/orders/${orderId}/status`, { status })
}

// ============================================================================
// 全新机商品模板管理 API
// ============================================================================

/**
 * 获取所有模板
 */
export async function getTemplates(): Promise<NewTemplate[]> {
  const response = await unifiedApi.get<NewTemplate[]>('/shop/templates')
  return response.data as NewTemplate[]
}

/**
 * 获取模板详情
 */
export async function getTemplateDetail(templateId: number): Promise<NewTemplate> {
  const response = await unifiedApi.get<NewTemplate>(`/shop/templates/${templateId}`)
  return response.data as NewTemplate
}

/**
 * 创建模板
 */
export async function createTemplate(data: NewTemplate): Promise<NewTemplate> {
  const response = await unifiedApi.post<NewTemplate>('/shop/templates', data)
  return response.data as NewTemplate
}

/**
 * 更新模板
 */
export async function updateTemplate(templateId: number, data: NewTemplate): Promise<NewTemplate> {
  const response = await unifiedApi.put<NewTemplate>(`/shop/templates/${templateId}`, data)
  return response.data as NewTemplate
}

/**
 * 删除模板
 */
export function deleteTemplate(templateId: number) {
  return unifiedApi.delete(`/shop/templates/${templateId}`)
}

/**
 * 上传模板媒体
 */
export function uploadTemplateImage(templateId: number, file: File) {
  const formData = new FormData()
  formData.append('image', file)
  return unifiedApi.post(`/shop/templates/${templateId}/images`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
}

/**
 * 删除模板图片
 */
export function deleteTemplateImage(templateId: number, imageId: number) {
  return unifiedApi.delete(`/shop/templates/${templateId}/images/${imageId}`)
}

/**
 * 设置模板主图
 */
export function setTemplatePrimaryImage(templateId: number, imageId: number) {
  return unifiedApi.put(`/shop/templates/${templateId}/images/${imageId}/primary`)
}

/**
 * 批量更新模板排序
 */
export function reorderTemplates(orders: Array<{ id: number; sort_order: number }>) {
  return unifiedApi.put('/shop/templates/reorder', { orders })
}

/**
 * 批量更新模板图片排序
 */
export function reorderTemplateImages(templateId: number, orders: Array<{ id: number; sort_order: number }>) {
  return unifiedApi.put(`/shop/templates/${templateId}/images/reorder`, { orders })
}

// 重新导出统一模块的类型
export type { Brand, Model, Color, Memory } from './base-data'

// 重新导出统一模块（便于直接使用）
export { baseDataApi } from './base-data'
