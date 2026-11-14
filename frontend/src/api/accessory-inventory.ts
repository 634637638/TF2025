import { unifiedApi } from '@/utils/unified-api'
import type { AccessoryBatchStock } from '@/types/accessory'
import type { PaginatedResponse } from '@/types'

export const getAccessoryBatchStock = (accessoryId: number, page: number, pageSize: number, signal: AbortSignal) =>
  unifiedApi.get<Pick<PaginatedResponse<AccessoryBatchStock>, 'data' | 'pagination'>>(`/accessories/${accessoryId}/batches`, {
    params: { page, page_size: pageSize }, signal, useCache: false, showLoading: false, showError: false
  })
