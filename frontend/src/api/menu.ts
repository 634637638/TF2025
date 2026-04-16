import { unifiedApi, type RequestConfig } from '@/utils/unified-api'
import type { MenuItem } from '@/types/menu'
import type { ApiResponse } from '@/types'

export interface MenuListParams {
  [key: string]: unknown
}

export interface MenuMutationPayload {
  [key: string]: unknown
}

export interface MenuSortPayload {
  [key: string]: unknown
}

export interface MenuStatusPayload {
  [key: string]: unknown
}

export interface MenuBatchDeletePayload {
  ids: Array<string | number>
}

export interface MenuStatsResponse {
  [key: string]: unknown
}

type MenuApiResponse<T> = Promise<ApiResponse<T>>

// 菜单 API
export const menuApi = {
  getList(params?: MenuListParams): MenuApiResponse<MenuItem[]> {
    return unifiedApi.get<MenuItem[]>('/menus', { params } as RequestConfig)
  },

  getUserMenus(): MenuApiResponse<MenuItem[]> {
    return unifiedApi.get<MenuItem[]>('/permissions/user-menu')
  },

  getById(id: string | number): MenuApiResponse<MenuItem> {
    return unifiedApi.get<MenuItem>(`/menus/${id}`)
  },

  create(data: MenuMutationPayload): MenuApiResponse<MenuItem> {
    return unifiedApi.post<MenuItem>('/menus', data)
  },

  update(id: string | number, data: MenuMutationPayload): MenuApiResponse<MenuItem> {
    return unifiedApi.put<MenuItem>(`/menus/${id}`, data)
  },

  delete(id: string | number): MenuApiResponse<void> {
    return unifiedApi.delete<void>(`/menus/${id}`)
  },

  updateStatus(id: string | number, data: MenuStatusPayload): MenuApiResponse<void> {
    return unifiedApi.patch<void>(`/menus/${id}/status`, data)
  },

  batchUpdateSort(data: MenuSortPayload): MenuApiResponse<void> {
    return unifiedApi.patch<void>('/menus/sort', data)
  },

  copy(id: string | number, data?: MenuMutationPayload): MenuApiResponse<MenuItem> {
    return unifiedApi.post<MenuItem>(`/menus/${id}/copy`, data)
  },

  batchUpdateStatus(data: MenuStatusPayload): MenuApiResponse<void> {
    return unifiedApi.patch<void>('/menus/batch/status', data)
  },

  batchDelete(ids: Array<string | number>): MenuApiResponse<void> {
    return unifiedApi.delete<void>('/menus/batch', { data: { ids } as MenuBatchDeletePayload })
  },

  exportExcel(): MenuApiResponse<Blob> {
    return unifiedApi.get<Blob>('/menus/export/excel', {
      responseType: 'blob'
    } as RequestConfig)
  },

  importExcel(formData: FormData): MenuApiResponse<unknown> {
    return unifiedApi.upload('/menus/import/excel', formData)
  },

  getParentOptions(): MenuApiResponse<MenuItem[]> {
    return unifiedApi.get<MenuItem[]>('/menus/options/parents')
  },

  getStats(): MenuApiResponse<MenuStatsResponse> {
    return unifiedApi.get<MenuStatsResponse>('/menus/stats/overview')
  }
}

export default menuApi
