/**
 * 刷新数据 Composable
 * 统一管理数据刷新逻辑，减少代码重复
 */

import { ref } from 'vue'
import { useNotification } from './useNotification'
import logger from '@/utils/logger'

interface RefreshDataOptions {
  /** 成功提示消息 */
  successMessage?: string
  /** 错误提示消息 */
  errorMessage?: string
  /** 是否显示成功提示 */
  showSuccess?: boolean
  /** 是否显示错误提示 */
  showError?: boolean
  /** 刷新前的回调 */
  onBeforeRefresh?: () => void | Promise<void>
  /** 刷新后的回调 */
  onAfterRefresh?: () => void | Promise<void>
}

interface UseRefreshDataReturn {
  /** 是否正在刷新 */
  refreshing: ReturnType<typeof ref<boolean>>
  /**
   * 刷新数据
   * @param fetchFn 获取数据的函数
   * @param options 配置选项
   */
  refreshData: <T>(fetchFn: () => Promise<T>, options?: RefreshDataOptions) => Promise<T | null>
  /**
   * 简化版刷新（不处理提示）
   * @param fetchFn 获取数据的函数
   */
  refresh: <T>(fetchFn: () => Promise<T>) => Promise<T | null>
}

/**
 * 刷新数据 Composable
 * @returns {UseRefreshDataReturn}
 *
 * @example
 * ```vue
 * <script setup>
 * import { useRefreshData } from '@/composables/useRefreshData'
 *
 * const { refreshing, refreshData } = useRefreshData()
 *
 * const fetchData = async () => {
 *   const response = await unifiedApi.get('/data')
 *   data.value = response.data
 * }
 *
 * // 使用 refreshData（带提示）
 * const handleRefresh = () => {
 *   refreshData(fetchData, {
 *     successMessage: '刷新成功',
 *     errorMessage: '刷新失败'
 *   })
 * }
 *
 * // 使用 refresh（不带提示）
 * const handleSimpleRefresh = () => {
 *   refresh(fetchData)
 * }
 * </script>
 *
 * <template>
 *   <button @click="handleRefresh" :disabled="refreshing">
 *     <i :class="refreshing ? 'fas fa-spinner fa-spin' : 'fas fa-sync-alt'"></i>
 *     {{ refreshing ? '刷新中...' : '刷新' }}
 *   </button>
 * </template>
 * ```
 */
export function useRefreshData(): UseRefreshDataReturn {
  const refreshing = ref(false)
  const { success, error } = useNotification()

  /**
   * 刷新数据（完整版）
   */
  const refreshData = async <T>(
    fetchFn: () => Promise<T>,
    options: RefreshDataOptions = {}
  ): Promise<T | null> => {
    const {
      successMessage = '数据已刷新',
      errorMessage = '刷新失败，请重试',
      showSuccess = true,
      showError = true,
      onBeforeRefresh,
      onAfterRefresh
    } = options

    refreshing.value = true

    try {
      // 刷新前回调
      await onBeforeRefresh?.()

      // 执行数据获取
      const result = await fetchFn()

      // 显示成功提示
      if (showSuccess) {
        success(successMessage)
      }

      // 刷新后回调
      await onAfterRefresh?.()

      return result
    } catch (err: any) {
      // 显示错误提示
      if (showError) {
        error(errorMessage)
      }
      logger.error('刷新数据失败', err)
      return null
    } finally {
      refreshing.value = false
    }
  }

  /**
   * 简化版刷新（不显示提示）
   */
  const refresh = async <T>(fetchFn: () => Promise<T>): Promise<T | null> => {
    return refreshData(fetchFn, {
      showSuccess: false,
      showError: false
    })
  }

  return {
    refreshing,
    refreshData,
    refresh
  }
}

/**
 * 带分页的刷新数据 Composable
 * 适用于列表页面
 */
export function useRefreshWithPagination() {
  const { refreshing, refreshData } = useRefreshData()
  const pagination = ref({
    page: 1,
    limit: 10,
    total: 0
  })

  /**
   * 刷新并重置到第一页
   */
  const refreshToFirstPage = async <T>(
    fetchFn: (page: number, limit: number) => Promise<T>,
    options?: RefreshDataOptions
  ): Promise<T | null> => {
    pagination.value.page = 1
    return refreshData(
      () => fetchFn(pagination.value.page, pagination.value.limit),
      options
    )
  }

  /**
   * 刷新当前页
   */
  const refreshCurrentPage = async <T>(
    fetchFn: (page: number, limit: number) => Promise<T>,
    options?: RefreshDataOptions
  ): Promise<T | null> => {
    return refreshData(
      () => fetchFn(pagination.value.page, pagination.value.limit),
      options
    )
  }

  return {
    refreshing,
    pagination,
    refreshToFirstPage,
    refreshCurrentPage
  }
}

export type { UseRefreshDataReturn, RefreshDataOptions }
