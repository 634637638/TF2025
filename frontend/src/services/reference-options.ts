/**
 * 共享基础选项请求。
 *
 * 多个页面会同时使用品牌、门店、供应商等下拉数据。统一在这里做
 * 短期缓存和并发去重，避免每个弹窗各自发起一套相同请求。
 */

import { DEFAULT_CACHE_TTL, useCachedRequest } from '@/composables/usePageCache'
import { unifiedApi } from '@/utils/unified-api'
import type { ApiResponse, BusinessScope } from '@/types'
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
  has_salary_template?: boolean
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
  business_scope?: BusinessScope
  store_id?: number | string
  strict_scope?: boolean
}

export interface StoreOptions {
  /** 严格按当前账号绑定范围返回业务可用门店。 */
  strictScope?: boolean
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

export interface AccessoryEntryOptions {
  film_ready?: boolean
  default_store_id?: number | null
  categories: ReferenceRecord[]
  units: ReferenceRecord[]
  brands: ReferenceRecord[]
  model_brands: ReferenceRecord[]
  models: ReferenceRecord[]
  colors: ReferenceRecord[]
  suppliers: ReferenceRecord[]
  stores: ReferenceRecord[]
}

export interface GoodsFilterOptionsPayload {
  brands: ReferenceRecord[]
  categories: ReferenceRecord[]
}

export interface ProductNameOptionsParams {
  keyword?: string
  store_id?: number
}

/** 配件入库只读取公共主档；适配型号按手机品牌加载，不创建手机资料。 */
export const getAccessoryEntryOptions = (params: { brand_id?: number; accessory_id?: number; model_ids?: number[]; stock_in?: boolean } = {}) =>
  unifiedApi.get<AccessoryEntryOptions>(params.stock_in ? '/accessories/stock-in/options' : '/accessories/options', {
    params: { brand_id: params.brand_id, accessory_id: params.accessory_id, model_ids: params.model_ids?.join(',') },
    useCache: false
  })

/** 综合查询商品模式的只读筛选选项，权限绑定 query:view + query:goods-view。 */
export const getGoodsFilterOptions = () => unifiedApi.get<GoodsFilterOptionsPayload>('/query/goods/filter-options', { useCache: false }).then(response => ({
  ...response,
  data: response.data ? {
    ...response.data,
    brands: sortOptionsByOrder(response.data.brands || []),
    categories: sortOptionsByOrder(response.data.categories || [])
  } : response.data
}))

/** 综合查询商品模式只返回当前授权销售范围内匹配的成交商品名称。 */
export const getGoodsProductNameOptions = (params: ProductNameOptionsParams, signal?: AbortSignal) =>
  unifiedApi.get<string[]>('/query/goods/product-name-options', { params, signal, useCache: false, showLoading: false, showError: false })

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

export const getCachedQueryOptions = () => {
  return unifiedApi.get<QueryOptionsPayload>('/query/options', { useCache: false }).then(response => ({
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

export const searchOperators = (params: ReferenceSearchParams = {}, options: { signal?: AbortSignal } = {}) =>
  sortResponseRecords(unifiedApi.get<ReferenceRecord[]>('/users/operators', { params, signal: options.signal }))

export const searchBrands = (params: ReferenceSearchParams = {}) =>
  sortResponseRecords(unifiedApi.get<ReferenceRecord[]>('/brands', { params: { business_scope: 'phone', ...params } }))

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

export const getCachedPhoneOptions = () => unifiedApi.get<PhoneOptionsPayload>('/options/phone-options', { useCache: false }).then(response => ({
  ...response,
  data: response.data ? sortOptionGroups(response.data) : response.data
}))

export const getCachedSuppliers = () => sortResponseRecords(
  cachedGet<ReferenceRecord[]>('/suppliers?all=true', '/suppliers?all=true')
)

/**
 * 门店公共入口。
 * 业务表单使用 strictScope=true；权限绑定和管理场景使用默认完整范围。
 * 门店范围与当前账号相关，禁止缓存，避免不同账号之间串用候选数据。
 */
export const getStores = ({ strictScope = false }: StoreOptions = {}) => sortResponseRecords(
  unifiedApi.get<ReferenceRecord[]>('/stores', {
    params: { all: true, strict_scope: strictScope },
    useCache: false
  })
)

export const getCachedBrands = () => sortResponseRecords(
  cachedGet<ReferenceRecord[]>('/brands?status=1&all=true&business_scope=phone', '/brands?status=1&all=true&business_scope=phone')
)

export const getCachedColors = () => sortResponseRecords(
  cachedGet<ReferenceRecord[]>('/colors?all=true', '/colors?all=true')
)

export const getCachedMemories = () => sortResponseRecords(
  cachedGet<ReferenceRecord[]>('/memories?all=true', '/memories?all=true')
)

// 模板页面复用统一基础数据接口，不再调用历史 shop/base-data 路由。
export const getTemplateBrands = () => sortResponseRecords(cachedGet<ReferenceRecord[]>(
  '/brands?all=true&business_scope=phone',
  '/brands?all=true&business_scope=phone'
))

export const getTemplateColors = getCachedColors

export const getTemplateMemories = getCachedMemories
