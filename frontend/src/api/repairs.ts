import { unifiedApi } from '@/utils/unified-api'
import type { ApiResponse } from '@/types'
import type { RepairOrder, RepairOrderFilters, RepairOrderForm, RepairStats } from '@/types/repair'

export interface RepairListPagination {
  page: number
  page_size: number
  total: number
  total_pages: number
  has_next: boolean
  has_prev: boolean
}

interface RepairOptions {
  customers: Array<{ id: number; name: string; phone: string }>
  brands: Array<{ id: number; name: string }>
  technicians: Array<{ id: number; name: string }>
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
  detail: (id: number) => unifiedApi.get<RepairOrder>(`/repairs/${id}`),
  create: (data: RepairOrderForm) => unifiedApi.post<RepairOrder>('/repairs', data),
  update: (id: number, data: RepairOrderForm) => unifiedApi.put<RepairOrder>(`/repairs/${id}`, data),
  updateStatus: (id: number, status: RepairOrder['status']) => (
    unifiedApi.patch<RepairOrder>(`/repairs/${id}/status`, { status })
  ),
  cancel: (id: number) => unifiedApi.delete(`/repairs/${id}`)
}
