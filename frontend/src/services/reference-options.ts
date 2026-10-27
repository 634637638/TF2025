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
import { sortOptionsByOrder } from '@/utils/option-sort'

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

const sortResponseRecords = <T>(request: Promise<ApiResponse<T[]>>): Promise<ApiResponse<T[]>> =>
  request.then(response => ({
    ...response,
    data: Array.isArray(response.data) ? sortOptionsByOrder(response.data) : response.data
  }))

// 只处理基础资料；日期、采购编号、全新/二手等业务枚举保留原顺序。
const referenceGroupKeys = new Set(['suppliers', 'stores', 'brands', 'models', 'colors', 'memories'])

const sortOptionGroups = <T extends object>(groups: T): T => Object.fromEntries(
  Object.entries(groups).map(([key, value]) => [
    key,
    referenceGroupKeys.has(key) && Array.isArray(value) && value.every(item => typeof item === 'object' && item !== null)
      ? sortOptionsByOrder(value, key === 'memories' ? { labelKeys: ['size', 'capacity', 'name'] } : {})
      : value
  ])
) as T

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
  return cachedGet<QueryOptionsPayload>(`/query/options:user:${scope}`, '/query/options').then(response => ({
    ...response,
    data: response.data ? sortOptionGroups(response.data) : response.data
  }))
}

/** 敏感人员选项按关键词远程查询，不作为全量公共选项缓存。 */
export const searchEmployees = (params: ReferenceSearchParams = {}) =>
  unifiedApi.get<EmployeeOptionsPayload>('/users/employees', { params }).then(response => ({
    ...response,
    data: response.data && Array.isArray(response.data.employees)
      ? { ...response.data, employees: sortOptionsByOrder(response.data.employees) }
      : response.data
  }))

export const searchOperators = (params: ReferenceSearchParams = {}) =>
  sortResponseRecords(unifiedApi.get<ReferenceRecord[]>('/users/operators', { params }))

export const searchBrands = (params: ReferenceSearchParams = {}) =>
  sortResponseRecords(unifiedApi.get<ReferenceRecord[]>('/brands', { params }))

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
  return sortResponseRecords(cachedGet<ReferenceRecord[]>(url, url))
}

export const searchColors = (params: ReferenceSearchParams = {}) =>
  sortResponseRecords(unifiedApi.get<ReferenceRecord[]>('/colors', { params }))

export const searchMemories = (params: ReferenceSearchParams = {}) =>
  sortResponseRecords(unifiedApi.get<ReferenceRecord[]>('/memories', { params }))

export const getCachedPhoneOptions = () => cachedGet<PhoneOptionsPayload>('/options/phone-options', '/options/phone-options').then(response => ({
  ...response,
  data: response.data ? sortOptionGroups(response.data) : response.data
}))

export const getCachedSuppliers = () => sortResponseRecords(
  cachedGet<ReferenceRecord[]>('/suppliers?all=true', '/suppliers?all=true')
)

export const getCachedStores = (strictScope = false) => {
  const scope = currentUserCacheScope()
  const suffix = strictScope ? ':strict' : ':all-scope'
  return sortResponseRecords(cachedGet<ReferenceRecord[]>(
    `/stores?all=true:user:${scope}${suffix}`,
    strictScope ? '/stores?all=true&strict_scope=true' : '/stores?all=true'
  ))
}

export const getCachedBrands = () => sortResponseRecords(
  cachedGet<ReferenceRecord[]>('/brands?status=1&all=true', '/brands?status=1&all=true')
)

export const getCachedColors = () => sortResponseRecords(
  cachedGet<ReferenceRecord[]>('/colors?all=true', '/colors?all=true')
)

export const getCachedMemories = () => sortResponseRecords(
  cachedGet<ReferenceRecord[]>('/memories?all=true', '/memories?all=true')
)

// 模板页面复用统一基础数据接口；shop/base-data 保留为后端迁移期兼容路由。
export const getTemplateBrands = () => sortResponseRecords(cachedGet<ReferenceRecord[]>(
  '/brands?all=true',
  '/brands?all=true'
))

export const getTemplateColors = getCachedColors

export const getTemplateMemories = getCachedMemories
