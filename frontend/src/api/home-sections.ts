/**
 * H5首页推荐 API 封装
 */
import { unifiedApi } from '@/utils/unified-api'

// ============================================================================
// 类型定义
// ============================================================================

export interface HomeSection {
  id: number
  section_key: string
  section_name: string
  section_type: 'products' | 'banner' | 'custom'
  icon: string
  is_enabled: boolean
  sort_order: number
  product_limit: number
  fill_count: number
  auto_fill: boolean
  product_count?: number
  products?: HomeSectionProduct[]
}

export interface HomeSectionProduct {
  id: number
  sort_order: number
  phone_id?: number
  template_id?: number
  first_phone_id?: number
  template_name?: string
  brand_id: number
  brand_name: string
  model_id: number
  model_name: string
  color_id: number
  color_name: string
  main_image?: string
  min_price?: number
  sale_price?: number
  stock_count?: number
  is_new: number
  product_type: 'new' | 'used'
  display_text?: string
  imei?: string
  quality_grade?: string | number
  condition_grade?: string
  memory_name?: string
}

export interface SearchProduct {
  template_id?: number
  phone_id?: number
  template_name?: string
  brand_id: number
  brand_name: string
  model_id: number
  model_name: string
  color_id: number
  color_name: string
  main_image?: string
  price?: number
  product_type: 'new' | 'used'
  display_text: string
}

// ============================================================================
// 公开API（移动端使用）
// ============================================================================

/**
 * 获取所有启用的推荐区域及其商品
 */
export function getActiveHomeSections() {
  return unifiedApi.get<HomeSection[]>('/public/home/sections')
}

// ============================================================================
// 管理API（需要认证）
// ============================================================================

/**
 * 获取所有推荐区域
 */
export function getAllHomeSections() {
  return unifiedApi.get<HomeSection[]>('/home/sections')
}

/**
 * 创建推荐区域
 */
export function createHomeSection(data: Partial<HomeSection>) {
  return unifiedApi.post<HomeSection>('/home/sections', data)
}

/**
 * 更新推荐区域
 */
export function updateHomeSection(id: number, data: Partial<HomeSection>) {
  return unifiedApi.put<HomeSection>(`/home/sections/${id}`, data)
}

/**
 * 删除推荐区域
 */
export function deleteHomeSection(id: number) {
  return unifiedApi.delete(`/home/sections/${id}`)
}

/**
 * 获取推荐区域的商品列表
 */
export function getSectionProducts(sectionId: number) {
  return unifiedApi.get<HomeSectionProduct[]>(`/home/sections/${sectionId}/products`)
}

/**
 * 添加商品到推荐区域
 */
export function addProductToSection(sectionId: number, data: { phone_id?: number; template_id?: number; sort_order?: number }) {
  return unifiedApi.post(`/home/sections/${sectionId}/products`, data)
}

/**
 * 批量添加商品到推荐区域
 */
export function addProductsToSection(sectionId: number, products: Array<{ phone_id?: number; template_id?: number; sort_order?: number }>) {
  return unifiedApi.post(`/home/sections/${sectionId}/products/batch`, { products })
}

/**
 * 移除推荐商品
 */
export function removeProductFromSection(sectionId: number, productId: number) {
  return unifiedApi.delete(`/home/sections/${sectionId}/products/${productId}`)
}

/**
 * 更新推荐商品排序
 */
export function updateProductSort(sectionId: number, productId: number, sort_order: number) {
  return unifiedApi.put(`/home/sections/${sectionId}/products/${productId}/sort`, { sort_order })
}

/**
 * 清空推荐区域的所有商品
 */
export function clearSectionProducts(sectionId: number) {
  return unifiedApi.delete(`/home/sections/${sectionId}/products/clear`)
}

/**
 * 搜索可添加的商品
 */
export function searchProducts(keyword: string, type: 'all' | 'new' | 'used' = 'all') {
  return unifiedApi.get<SearchProduct[]>('/home/products/search', { params: { keyword, type } })
}
