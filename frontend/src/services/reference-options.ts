/**
 * 共享基础选项请求。
 *
 * 多个页面会同时使用品牌、门店、供应商等下拉数据。统一在这里做
 * 短期缓存和并发去重，避免每个弹窗各自发起一套相同请求。
 */

import { DEFAULT_CACHE_TTL, useCachedRequest } from '@/composables/usePageCache'
import { unifiedApi } from '@/utils/unified-api'
import type { ApiResponse } from '@/utils/unified-api'

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

export const getCachedQueryOptions = () => cachedGet<QueryOptionsPayload>('/query/options', '/query/options')

export const getCachedEmployees = () => cachedGet<EmployeeOptionsPayload>('/users/employees', '/users/employees')

export const getCachedOperators = () => cachedGet<ReferenceRecord[]>('/users/operators', '/users/operators')

export const getCachedPhoneOptions = () => cachedGet<PhoneOptionsPayload>('/options/phone-options', '/options/phone-options')

export const getCachedModelsByBrand = (
  brandId: number | string,
  keyword = '',
  includeId?: number | string | null
) => {
  const params = new URLSearchParams({
    brand_id: String(brandId),
    page_size: '50'
  })
  if (keyword.trim()) params.set('name', keyword.trim())
  if (includeId !== undefined && includeId !== null && String(includeId)) {
    params.set('include_id', String(includeId))
  }
  const query = params.toString()
  return cachedGet<ReferenceRecord[]>(`/query/models:${query}`, `/query/models?${query}`)
}

export const getCachedSuppliers = () => cachedGet<ReferenceRecord[]>('/suppliers?page=1&page_size=500', '/suppliers?page=1&page_size=500')

export const getCachedStores = () => cachedGet<ReferenceRecord[]>('/stores?all=true', '/stores?all=true')

export const getCachedBrands = () => cachedGet<ReferenceRecord[]>('/brands?status=1&page_size=100', '/brands?status=1&page_size=100')

export const getCachedColors = () => cachedGet<ReferenceRecord[]>('/colors?page_size=100', '/colors?page_size=100')

export const getCachedMemories = () => cachedGet<ReferenceRecord[]>('/memories?page_size=100', '/memories?page_size=100')
