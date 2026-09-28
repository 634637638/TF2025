import { unifiedApi } from '@/utils/unified-api'
import type { ApiResponse } from '@/types'
import type { RepairDeviceSearchResult, RepairMedia, RepairOrder, RepairOrderFilters, RepairOrderForm, RepairStats } from '@/types/repair'

export interface RepairListPagination {
  page: number
  page_size: number
  total: number
  total_pages: number
  has_next: boolean
  has_prev: boolean
}

interface RepairOptions {
  brands: Array<{ id: number; name: string }>
  models: Array<{ id: number; name: string; brand_id?: number | null }>
  colors: Array<{ id: number; name: string }>
  memories: Array<{ id: number; size: string }>
  technicians: Array<{ id: number; name: string }>
}

interface RepairMediaUploadResponse {
  files: RepairMedia[]
}

export type RepairListResponse = ApiResponse<RepairOrder[]> & { pagination: RepairListPagination }

export const repairsApi = {
  list: (params: RepairOrderFilters = {}) => (
    unifiedApi.get<RepairOrder[]>('/repairs', { params, useCache: false }) as Promise<RepairListResponse>
  ),
  stats: (params: Pick<RepairOrderFilters, 'search' | 'status'> = {}) => (
    unifiedApi.get<RepairStats>('/repairs/stats', { params })
  ),
  options: () => unifiedApi.get<RepairOptions>('/repairs/options'),
  searchCustomers: (keyword: string) => unifiedApi.get<Array<{ id: number; name: string; phone: string | null }>>('/repairs/customers/search', {
    params: { keyword },
    useCache: false
  }),
  createCustomer: (data: { name: string; phone: string }) => (
    unifiedApi.post<{ id: number; name: string; phone: string }>('/repairs/customers', data)
  ),
  searchDevices: (keyword: string) => unifiedApi.get<RepairDeviceSearchResult[]>('/repairs/devices/search', {
    params: { q: keyword },
    useCache: false
  }),
  uploadMedia: (formData: FormData) => unifiedApi.upload<RepairMediaUploadResponse>('/repairs/upload/media', formData, {
    showLoading: false
  }),
  detail: (id: number) => unifiedApi.get<RepairOrder>(`/repairs/${id}`),
  create: (data: RepairOrderForm) => unifiedApi.post<RepairOrder>('/repairs', data),
  update: (id: number, data: Partial<RepairOrderForm>) => unifiedApi.put<RepairOrder>(`/repairs/${id}`, data),
  updateStatus: (id: number, status: RepairOrder['status']) => (
    unifiedApi.patch<RepairOrder>(`/repairs/${id}/status`, { status })
  ),
  cancel: (id: number) => unifiedApi.delete(`/repairs/${id}`)
}
