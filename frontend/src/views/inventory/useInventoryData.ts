import { type Ref } from 'vue'
import { ElMessage } from 'element-plus'
import { extractResponseData } from '@/utils/api-response'
import { unifiedApi as api } from '@/utils/unified-api'
import { logger } from '@/utils/logger'
import type { InventoryItem } from '@/types'

interface InventoryFilters {
  supplier_id: number | string
  store_id: number | string
  operator_id: number | string
  brand: string
  model: string
  color: string
  memory: string
  is_new: boolean | string
  status: string
  date_start: string
  date_end: string
  search: string
}

interface PaginationState {
  page: number
  size: number
  total: number
}

interface StatsState {
  total: number
  inStock: number
  sold: number
  totalValue: number
}

interface LoadingController {
  setLoading: (value: boolean) => void
}

interface UseInventoryDataOptions {
  inventory: Ref<InventoryItem[]>
  filters: InventoryFilters
  pagination: PaginationState
  stats: StatsState
  statsAvailable: Ref<boolean>
  loadingStore: LoadingController
  onError: (message: string) => void
}

interface LoadOptions {
  showLoadingState?: boolean
  useCache?: boolean
}

type UnknownRecord = Record<string, unknown>

const isRecord = (value: unknown): value is UnknownRecord => (
  value !== null && typeof value === 'object'
)

const readErrorStatus = (error: unknown): number | undefined => {
  if (!isRecord(error)) return undefined
  const response = isRecord(error.response) ? error.response : undefined
  return typeof response?.status === 'number' ? response.status : undefined
}

const readErrorMessage = (error: unknown): string | undefined => {
  if (!isRecord(error)) return undefined
  const response = isRecord(error.response) ? error.response : undefined
  const data = isRecord(response?.data) ? response.data : undefined
  return typeof data?.message === 'string' ? data.message : undefined
}

export const useInventoryData = ({
  inventory,
  filters,
  pagination,
  stats,
  statsAvailable,
  loadingStore,
  onError
}: UseInventoryDataOptions) => {
  let statsRequestId = 0

  const clearStats = () => {
    // Invalidate an in-flight request so stale statistics cannot overwrite a
    // newly reset filter state.
    statsRequestId += 1
    stats.total = 0
    stats.inStock = 0
    stats.sold = 0
    stats.totalValue = 0
    statsAvailable.value = false
  }

  const updateStats = async (requestParams: Record<string, unknown> = {}) => {
    const requestId = ++statsRequestId
    try {
      const params: Record<string, unknown> = {}
      const filterKeys: Array<keyof InventoryFilters> = [
        'supplier_id',
        'store_id',
        'operator_id',
        'brand',
        'model',
        'color',
        'memory',
        'is_new',
        'status',
        'date_start',
        'date_end',
        'search'
      ]

      for (const key of filterKeys) {
        const value = Object.prototype.hasOwnProperty.call(requestParams, key)
          ? requestParams[key]
          : filters[key]
        if (value !== '' && value !== null && value !== undefined) {
          params[key] = value
        }
      }

      const response = await api.get('/inventory/stats/overview', { params })
      if (requestId !== statsRequestId) return

      if (!response.success) {
        clearStats()
        return
      }

      const data = extractResponseData<UnknownRecord>(response)
      stats.total = Number(data.total) || 0
      stats.inStock = Number(data.new_count) || 0
      stats.sold = Number(data.used_count) || 0
      stats.totalValue = Number(data.total_value) || 0
      statsAvailable.value = true
    } catch (error) {
      if (requestId !== statsRequestId) return
      logger.error('获取统计数据失败:', error)
      clearStats()
    }
  }

  const loadInventoryData = async (
    additionalParams: Record<string, unknown> = {},
    options: LoadOptions = {}
  ) => {
    const { showLoadingState = true, useCache = true } = options
    if (showLoadingState) loadingStore.setLoading(true)

    try {
      const params: Record<string, unknown> = {
        page: pagination.page,
        page_size: pagination.size,
        ...additionalParams
      }

      const filterMappings: Array<[keyof InventoryFilters, string]> = [
        ['supplier_id', 'supplier_id'],
        ['store_id', 'store_id'],
        ['operator_id', 'operator_id'],
        ['brand', 'brand'],
        ['model', 'model'],
        ['color', 'color'],
        ['memory', 'memory'],
        ['date_start', 'date_start'],
        ['date_end', 'date_end'],
        ['search', 'search']
      ]
      for (const [filterKey, paramKey] of filterMappings) {
        if (!params[paramKey] && filters[filterKey]) {
          params[paramKey] = filters[filterKey]
        }
      }

      if (filters.is_new !== '' && filters.is_new !== null && filters.is_new !== undefined) {
        params.is_new = filters.is_new
      }

      for (const key of Object.keys(params)) {
        if (params[key] === '' || params[key] === null || params[key] === undefined) {
          delete params[key]
        }
      }

      const response = await api.get('/inventory/list', { params, useCache })
      if (!response.success) {
        onError(response.message || '获取库存数据失败')
        inventory.value = []
        pagination.total = 0
        clearStats()
        return
      }

      const responseData = extractResponseData<unknown>(response)
      let records: InventoryItem[] = []
      if (Array.isArray(responseData)) {
        records = responseData as InventoryItem[]
      } else if (isRecord(responseData)) {
        const nestedRecords = responseData.data || responseData.phones || responseData.records
        if (Array.isArray(nestedRecords)) records = nestedRecords as InventoryItem[]
      }

      inventory.value = records.map(record => ({
        ...record,
        purchase_cost: record.purchase_cost ?? null,
        inventory_time: record.inventory_time ?? null,
        price: record.sale_price ?? 0
      }))

      // `extractResponseData` intentionally returns the records array. Keep
      // the pagination metadata from the original envelope as well, because
      // otherwise a filtered page would report only its current row count.
      const responseRecord = isRecord(response) ? response : undefined
      const responseDataRecord = isRecord(responseRecord?.data) ? responseRecord.data : undefined
      const paginationInfo = (
        (isRecord(responseData) ? responseData.pagination : undefined) ||
        responseDataRecord?.pagination ||
        responseRecord?.pagination
      )
      pagination.total = isRecord(paginationInfo) && paginationInfo.total
        ? Number(paginationInfo.total) || records.length
        : records.length

      if (records.length === 0) {
        const hasFilters = Object.entries(filters).some(([key, value]) => (
          Boolean(value) && key !== 'search'
        ))
        if (hasFilters) {
          ElMessage.warning('您筛选的条件无数据')
        } else if (!filters.search?.trim()) {
          ElMessage.info('暂无库存数据')
        }
      }

      await updateStats(params)
    } catch (error) {
      logger.error('获取库存数据失败:', error)
      const status = readErrorStatus(error)
      if (status === 403) onError('权限不足，无法访问库存数据')
      else if (status === 401) onError('登录已过期，请重新登录')
      else onError(readErrorMessage(error) || '获取库存数据失败')
      inventory.value = []
      pagination.total = 0
      clearStats()
    } finally {
      if (showLoadingState) loadingStore.setLoading(false)
    }
  }

  let debounceTimer: ReturnType<typeof setTimeout> | undefined
  const debounceLoadInventory = () => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      void loadInventoryData({}, { showLoadingState: false })
    }, 500)
  }

  const loadInventory = async () => {
    pagination.page = 1
    await loadInventoryData()
  }

  return {
    clearStats,
    debounceLoadInventory,
    loadInventory,
    loadInventoryData,
    updateStats
  }
}
