/**
 * 页面状态管理组合式函数
 * 统一管理页面的加载状态、错误状态、分页等
 *
 * 使用示例：
 * const pageState = usePageState()
 * pageState.setDataLoading(true)
 * pageState.goToPage(2)
 */

import { ref, reactive, computed, nextTick } from 'vue'
import { useNotification } from './useNotification'
import { usePagination, type PaginationReturn } from './usePagination'
import { logger } from '@/utils/logger'

export interface LoadingState {
  permission: boolean
  data: boolean
  submit: boolean
  export: boolean
}

export interface ErrorState {
  message: string
  code?: string
  details?: any
}

export interface UsePageStateOptions {
  initialPageSize?: number
  enableHistory?: boolean
}

export const usePageState = (options: UsePageStateOptions = {}) => {
  const { initialPageSize = 20, enableHistory = false } = options
  const { error: showError } = useNotification()

  // 加载状态
  const loading = reactive<LoadingState>({
    permission: false,
    data: false,
    submit: false,
    export: false
  })

  // 错误状态
  const errorMessage = ref('')
  const errorDetails = ref<any>(null)

  // 分页状态 - 使用统一的 usePagination
  const pagination = usePagination({ limit: initialPageSize, total: 0 })

  // 搜索关键词
  const searchKeyword = ref('')

  // 计算属性
  const isLoading = computed(() => loading.data || loading.permission)
  const isSubmitting = computed(() => loading.submit)
  const isExporting = computed(() => loading.export)
  const hasError = computed(() => !!errorMessage.value)
  const hasData = computed(() => pagination.total.value > 0)

  // 设置方法
  const setPermissionLoading = (value: boolean) => {
    loading.permission = value
  }

  const setDataLoading = (value: boolean) => {
    loading.data = value
    if (value) clearError()
  }

  const setSubmitLoading = (value: boolean) => {
    loading.submit = value
  }

  const setExportLoading = (value: boolean) => {
    loading.export = value
  }

  const setError = (message: string, details?: any) => {
    errorMessage.value = message
    errorDetails.value = details
  }

  const clearError = () => {
    errorMessage.value = ''
    errorDetails.value = null
  }

  // 搜索操作
  const setSearchKeyword = (keyword: string) => {
    searchKeyword.value = keyword
  }

  const clearSearch = () => {
    searchKeyword.value = ''
  }

  // 重置所有状态
  const resetAll = () => {
    loading.permission = false
    loading.data = false
    loading.submit = false
    loading.export = false
    clearError()
    pagination.reset()
    clearSearch()
  }

  // 错误处理
  const handleApiError = (err: any, customMessage?: string) => {
    logger.error('页面操作错误:', err)
    const message = customMessage || err?.message || '操作失败'
    const details = err?.response?.data || err?.details
    setError(message, details)
    showError(message)
  }

  // 等待下一帧
  const waitForNextTick = () => nextTick()

  // 状态快照
  const getStateSnapshot = () => ({
    loading: { ...loading },
    error: {
      message: errorMessage.value,
      details: errorDetails.value
    },
    pagination: {
      page: pagination.page.value,
      limit: pagination.limit.value,
      total: pagination.total.value
    },
    search: searchKeyword.value
  })

  return {
    // 状态
    loading,
    errorMessage,
    errorDetails,
    searchKeyword,

    // 分页（直接暴露 pagination 对象）
    pagination,

    // 计算属性
    isLoading,
    isSubmitting,
    isExporting,
    hasError,
    hasData,
    // 分页计算属性
    totalPages: pagination.totalPages,
    hasNextPage: pagination.hasNextPage,
    hasPrevPage: pagination.hasPrevPage,

    // 设置方法
    setPermissionLoading,
    setDataLoading,
    setSubmitLoading,
    setExportLoading,
    setError,
    clearError,

    // 分页方法（直接暴露）
    goToPage: pagination.goToPage,
    nextPage: pagination.nextPage,
    prevPage: pagination.prevPage,
    firstPage: pagination.firstPage,
    lastPage: pagination.lastPage,
    setLimit: pagination.setLimit,
    setTotal: pagination.setTotal,
    resetPagination: pagination.reset,

    // 搜索方法
    setSearchKeyword,
    clearSearch,

    // 工具方法
    resetAll,
    handleApiError,
    waitForNextTick,
    getStateSnapshot
  }
}

// 扩展：表格状态管理
export const useTableState = (initialPageSize: number = 20) => {
  const pageState = usePageState({ initialPageSize })

  // 表格特定状态
  const selectedRows = ref<any[]>([])
  const sortField = ref('')
  const sortOrder = ref<'asc' | 'desc'>('asc')

  // 选择操作
  const toggleRowSelection = (row: any) => {
    const index = selectedRows.value.findIndex(item => item.id === row.id)
    if (index > -1) {
      selectedRows.value.splice(index, 1)
    } else {
      selectedRows.value.push(row)
    }
  }

  const selectAllRows = (rows: any[]) => {
    selectedRows.value = [...rows]
  }

  const clearSelection = () => {
    selectedRows.value = []
  }

  const toggleAllSelection = (rows: any[]) => {
    if (selectedRows.value.length === rows.length) {
      clearSelection()
    } else {
      selectAllRows(rows)
    }
  }

  // 排序操作
  const setSorting = (field: string, order: 'asc' | 'desc' = 'asc') => {
    sortField.value = field
    sortOrder.value = order
  }

  const clearSorting = () => {
    sortField.value = ''
    sortOrder.value = 'asc'
  }

  const toggleSortOrder = () => {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  }

  return {
    ...pageState,

    // 表格特定状态
    selectedRows,
    sortField,
    sortOrder,

    // 选择操作
    toggleRowSelection,
    selectAllRows,
    clearSelection,
    toggleAllSelection,

    // 排序操作
    setSorting,
    clearSorting,
    toggleSortOrder,

    // 计算属性
    hasSelection: computed(() => selectedRows.value.length > 0),
    selectedCount: computed(() => selectedRows.value.length)
  }
}

export default usePageState
