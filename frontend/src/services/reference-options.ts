/**
 * 共享基础选项请求。
 *
 * 多个页面会同时使用品牌、门店、供应商等下拉数据。统一在这里做
 * 短期缓存和并发去重，避免每个弹窗各自发起一套相同请求。
 */

import { DEFAULT_CACHE_TTL, useCachedRequest } from '@/composables/usePageCache'
import { unifiedApi } from '@/utils/unified-api'
import type { ApiResponse } from '@/utils/unified-api'
import { useAuthStore } from '@/stores/auth'

export interface ReferenceRecord {
  id?: number | string
  name?: string
  size?: string
  capacity?: string
  brand_id?: number | string | null
  brand_name?: string
  sort_order?: number
  status?: number
  [key: string]: unknown
}

export interface QueryOptionsPayload {
  suppliers: ReferenceRecord[]
  stores: ReferenceRecord[]
  brands: ReferenceRecord[]
  models: ReferenceRecord[]
  colors: ReferenceRecord[]
  memories: ReferenceRecord[]
  statuses?: ReferenceRecord[]
  conditions?: ReferenceRecord[]
}

export interface EmployeeOptionsPayload {
  employees: ReferenceRecord[]
  total?: number
  pagination?: ReferencePagination
}

export interface ReferencePagination {
  page: number
  page_size: number
  total: number
  total_pages: number
  has_next: boolean
  has_prev: boolean
}

export interface ReferenceSearchParams {
  keyword?: string
  name?: string
  size?: string
  brand_id?: number | string
  page?: number
  page_size?: number
  status?: string | number
  store_id?: number | string
  strict_scope?: boolean
}

export interface ModelOptionsParams {
  brandId?: number | string
  keyword?: string
  status?: string | number
  includeId?: number | string | null
  activeOnly?: boolean
  all?: boolean
  page?: number
  pageSize?: number
}

export interface PhoneOptionsPayload {
  brands?: ReferenceRecord[]
  models?: ReferenceRecord[]
  colors?: ReferenceRecord[]
  memories?: ReferenceRecord[] | string[]
  stores?: ReferenceRecord[]
  [key: string]: unknown
}

const cachedGet = <T>(
  key: string,
  url: string,
  config?: Parameters<typeof unifiedApi.get>[1]
): Promise<ApiResponse<T>> => useCachedRequest<ApiResponse<T>>(
  key,
  () => unifiedApi.get<T>(url, config),
  DEFAULT_CACHE_TTL.STATIC
)

const currentUserCacheScope = () => {
  try {
    const user = useAuthStore().user as { id?: number | string } | null
    return user?.id ? String(user.id) : 'anonymous'
  } catch {
    return 'anonymous'
  }
}

export const getCachedQueryOptions = () => {
  const scope = currentUserCacheScope()
  return cachedGet<QueryOptionsPayload>(`/query/options:user:${scope}`, '/query/options')
}

/** 敏感人员选项按关键词远程查询，不作为全量公共选项缓存。 */
export const searchEmployees = (params: ReferenceSearchParams = {}) =>
  unifiedApi.get<EmployeeOptionsPayload>('/users/employees', { params })

export const searchOperators = (params: ReferenceSearchParams = {}) =>
  unifiedApi.get<ReferenceRecord[]>('/users/operators', { params })

export const searchBrands = (params: ReferenceSearchParams = {}) =>
  unifiedApi.get<ReferenceRecord[]>('/brands', { params })

/** 型号唯一公共入口。参考选项默认完整返回，避免落入管理列表分页而漏项。 */
export const getModels = (options: ModelOptionsParams = {}) => {
  const params = new URLSearchParams()
  const all = options.all ?? (options.page === undefined && options.pageSize === undefined)
  if (all) params.set('all', 'true')
  if (options.activeOnly) params.set('active_only', 'true')
  if (options.brandId !== undefined && String(options.brandId).trim()) {
    params.set('brand_id', String(options.brandId).trim())
  }
  if (options.keyword?.trim()) params.set('name', options.keyword.trim())
  if (options.status !== undefined && String(options.status).trim()) {
    params.set('status', String(options.status).trim())
  }
  if (options.includeId !== undefined && options.includeId !== null && String(options.includeId).trim()) {
    params.set('include_id', String(options.includeId).trim())
  }
  if (!all && options.page !== undefined) params.set('page', String(options.page))
  if (!all && options.pageSize !== undefined) params.set('page_size', String(options.pageSize))

  const query = params.toString()
  const url = `/models${query ? `?${query}` : ''}`
  return cachedGet<ReferenceRecord[]>(url, url)
}

export const searchColors = (params: ReferenceSearchParams = {}) =>
  unifiedApi.get<ReferenceRecord[]>('/colors', { params })

export const searchMemories = (params: ReferenceSearchParams = {}) =>
  unifiedApi.get<ReferenceRecord[]>('/memories', { params })

export const getCachedPhoneOptions = () => cachedGet<PhoneOptionsPayload>('/options/phone-options', '/options/phone-options')

export const getCachedSuppliers = () => cachedGet<ReferenceRecord[]>('/suppliers?all=true', '/suppliers?all=true')

export const getCachedStores = (strictScope = false) => {
  const scope = currentUserCacheScope()
  const suffix = strictScope ? ':strict' : ':all-scope'
  return cachedGet<ReferenceRecord[]>(`/stores?all=true:user:${scope}${suffix}`, strictScope ? '/stores?all=true&strict_scope=true' : '/stores?all=true')
}

export const getCachedBrands = () => cachedGet<ReferenceRecord[]>('/brands?status=1&all=true', '/brands?status=1&all=true')

export const getCachedColors = () => cachedGet<ReferenceRecord[]>('/colors?all=true', '/colors?all=true')

export const getCachedMemories = () => cachedGet<ReferenceRecord[]>('/memories?all=true', '/memories?all=true')

// 模板页面复用统一基础数据接口；shop/base-data 保留为后端迁移期兼容路由。
export const getTemplateBrands = () => cachedGet<ReferenceRecord[]>(
  '/brands?all=true',
  '/brands?all=true'
)

export const getTemplateColors = getCachedColors

export const getTemplateMemories = getCachedMemories
