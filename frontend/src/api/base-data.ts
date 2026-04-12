/**
 * 统一基础数据 API 模块
 * 功能：品牌、型号、颜色、内存等基础数据
 * 说明：整合了 shop.ts 和 phone-stock-warnings.ts 中的基础数据 API
 * 注意：根据不同场景调用不同后端接口
 * 统一使用 unifiedApi，自动处理公开接口（/public/）无需认证
 */
import { unifiedApi } from '@/utils/unified-api'

const pickArray = <T>(payload: any, keys: string[] = []): T[] => {
  if (Array.isArray(payload)) {
    return payload as T[]
  }

  for (const key of keys) {
    const value = payload?.[key]
    if (Array.isArray(value)) {
      return value as T[]
    }
  }

  if (Array.isArray(payload?.data)) {
    return payload.data as T[]
  }

  if (Array.isArray(payload?.records)) {
    return payload.records as T[]
  }

  return []
}

// ============================================================================
// 公开接口 - H5 用户端使用（无需认证）
// unifiedApi 会自动识别 /public/ 路径，不添加认证头
// ============================================================================

/**
 * 获取品牌列表（公开）
 */
export async function getPublicBrands() {
  const response = await unifiedApi.get('/public/brands')
  return pickArray<Brand>(response, ['brands'])
}

/**
 * 获取型号列表（公开）
 */
export async function getPublicModels(brandId?: number, includeEmpty?: boolean) {
  const params: Record<string, any> = {}
  if (brandId) params.brand_id = brandId
  if (includeEmpty) params.include_empty = 'true'
  const response = await unifiedApi.get('/public/models', {
    params: Object.keys(params).length > 0 ? params : undefined
  })
  return pickArray<Model>(response, ['models'])
}

/**
 * 获取颜色列表（公开）
 */
export async function getPublicColors(includeEmpty?: boolean) {
  const response = await unifiedApi.get('/public/colors', {
    params: includeEmpty ? { include_empty: 'true' } : undefined
  })
  return pickArray<Color>(response, ['colors'])
}

/**
 * 获取内存列表（公开）
 */
export async function getPublicMemories() {
  const response = await unifiedApi.get('/public/memories')
  return pickArray<Memory>(response, ['memories'])
}

// ============================================================================
// 管理端接口 - 后台管理使用（需要认证）
// ============================================================================

/**
 * 获取品牌列表（管理端）
 */
export async function getAdminBrands() {
  const response = await unifiedApi.get('/shop/base-data/brands')
  return pickArray<Brand>(response)
}

/**
 * 获取型号列表（管理端）
 */
export async function getAdminModels(brandId?: number) {
  const response = await unifiedApi.get('/shop/base-data/models', {
    params: brandId ? { brand_id: brandId } : undefined
  })
  return pickArray<Model>(response, ['models'])
}

/**
 * 获取颜色列表（管理端）
 */
export async function getAdminColors() {
  const response = await unifiedApi.get('/shop/base-data/colors')
  return pickArray<Color>(response, ['colors'])
}

/**
 * 获取内存列表（管理端）
 */
export async function getAdminMemories() {
  const response = await unifiedApi.get('/shop/base-data/memories')
  return pickArray<Memory>(response, ['memories'])
}

// ============================================================================
// 系统管理接口 - 预警配置等使用（需要认证）
// ============================================================================

/**
 * 获取品牌列表（预警配置）
 */
export async function getWarningBrands() {
  const response = await unifiedApi.get('/phone-stock-warnings/brands')
  return pickArray<Brand>(response)
}

/**
 * 获取型号列表（预警配置）
 */
export async function getWarningModels(brandId: number) {
  const response = await unifiedApi.get('/phone-stock-warnings/models', {
    params: { brand_id: brandId }
  })
  return pickArray<Model>(response, ['models'])
}

/**
 * 获取颜色列表（预警配置）
 */
export async function getWarningColors() {
  const response = await unifiedApi.get('/phone-stock-warnings/colors')
  return pickArray<Color>(response, ['colors'])
}

/**
 * 获取内存列表（预警配置）
 */
export async function getWarningMemories() {
  const response = await unifiedApi.get('/phone-stock-warnings/memories')
  return pickArray<Memory>(response, ['memories'])
}

// ============================================================================
// 统一导出 - 提供统一的接口，内部根据参数选择不同实现
// ============================================================================

export interface BaseDataParams {
  scope?: 'public' | 'admin' | 'warning'
  brandId?: number
  includeEmpty?: boolean
}

/**
 * 获取品牌列表
 * @param scope - 数据来源：public=公开接口，admin=管理端，warning=预警配置
 */
export function getBrands(scope: 'public' | 'admin' | 'warning' = 'public') {
  switch (scope) {
    case 'admin':
      return getAdminBrands()
    case 'warning':
      return getWarningBrands()
    default:
      return getPublicBrands()
  }
}

/**
 * 获取型号列表
 * @param brandId - 品牌ID（可选）
 * @param scope - 数据来源
 */
export function getModels(brandId?: number, scope: 'public' | 'admin' | 'warning' = 'public') {
  switch (scope) {
    case 'admin':
      return getAdminModels(brandId)
    case 'warning':
      return getWarningModels(brandId!)
    default:
      return getPublicModels(brandId)
  }
}

/**
 * 获取颜色列表
 * @param scope - 数据来源
 */
export function getColors(scope: 'public' | 'admin' | 'warning' = 'public') {
  switch (scope) {
    case 'admin':
      return getAdminColors()
    case 'warning':
      return getWarningColors()
    default:
      return getPublicColors()
  }
}

/**
 * 获取内存列表
 * @param scope - 数据来源
 */
export function getMemories(scope: 'public' | 'admin' | 'warning' = 'public') {
  switch (scope) {
    case 'admin':
      return getAdminMemories()
    case 'warning':
      return getWarningMemories()
    default:
      return getPublicMemories()
  }
}

// ============================================================================
// 类型定义
// ============================================================================

export interface Brand {
  id: number
  name: string
  sort_order?: number
}

export interface Model {
  id: number
  name: string
  brand_id: number
  sort_order?: number
}

export interface Color {
  id: number
  name: string
  sort_order?: number
}

export interface Memory {
  id: number
  size: string
  sort_order?: number
}

// 统一导出
export const baseDataApi = {
  // 公开接口
  getPublicBrands,
  getPublicModels,
  getPublicColors,
  getPublicMemories,
  // 管理端接口
  getAdminBrands,
  getAdminModels,
  getAdminColors,
  getAdminMemories,
  // 预警配置接口
  getWarningBrands,
  getWarningModels,
  getWarningColors,
  getWarningMemories,
  // 统一接口（根据 scope 自动选择）
  getBrands,
  getModels,
  getColors,
  getMemories
}

export default baseDataApi
