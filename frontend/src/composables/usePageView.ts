/**
 * 页面视图 Composable
 * 整合页面常用的权限、通知、数据刷新等功能
 */

import { ref, type Ref, type ComputedRef } from 'vue'
import { usePagePermissions } from './usePagePermissions'
import { useNotification } from './useNotification'
import { useRefreshData } from './useRefreshData'

interface UsePageViewOptions {
  /** 模块标识（用于权限检查） */
  module: string
  /** 是否自动加载数据 */
  autoLoad?: boolean
}

interface UsePageViewReturn {
  // 权限相关
  /** 是否有查看权限 */
  canView: ComputedRef<boolean>
  /** 是否有创建权限 */
  canCreate: ComputedRef<boolean>
  /** 是否有编辑权限 */
  canEdit: ComputedRef<boolean>
  /** 是否有删除权限 */
  canDelete: ComputedRef<boolean>
  /** 是否有导出权限 */
  canExport: ComputedRef<boolean>
  /** 是否有导入权限 */
  canImport: ComputedRef<boolean>
  /** 检查指定权限 */
  hasPermission: (action: string) => boolean
  /** 处理无权限情况 */
  handleNoPermission: (action: string) => void
  /** 要求权限并执行操作 */
  requirePermission: (action: string, callback?: () => void) => boolean

  // 通知相关
  /** 成功提示 */
  success: (message: string) => void
  /** 错误提示 */
  error: (message: string) => void
  /** 警告提示 */
  warning: (message: string) => void
  /** 信息提示 */
  info: (message: string) => void
  /** 处理API错误 */
  handleApiError: (err: any) => void
  /** 确认对话框 */
  confirm: (message: string) => Promise<boolean>

  // 数据刷新相关
  /** 是否正在刷新 */
  refreshing: Ref<boolean>
  /** 刷新数据 */
  refreshData: <T>(fetchFn: () => Promise<T>, options?: any) => Promise<T | null>
  /** 简化刷新（不显示提示） */
  refresh: <T>(fetchFn: () => Promise<T>) => Promise<T | null>

  // 加载状态
  /** 是否正在加载 */
  loading: Ref<boolean>

  // 便捷方法
  /** 加载数据（带加载状态） */
  loadData: <T>(fetchFn: () => Promise<T>, successMsg?: string) => Promise<T | null>
  /** 执行操作（带权限检查和加载状态） */
  executeWithPermission: <T>(
    permission: string,
    fn: () => Promise<T>,
    options?: { successMsg?: string; errorMsg?: string }
  ) => Promise<T | null>
}

/**
 * 页面视图 Composable
 * 整合权限、通知、数据刷新等常用功能
 *
 * @param options 配置选项
 * @returns {UsePageViewReturn}
 *
 * @example
 * ```vue
 * <script setup>
 * import { usePageView } from '@/composables/usePageView'
 *
 * const {
 *   canView, canCreate, canEdit, canDelete,
 *   success, error, loading, refreshing,
 *   loadData, executeWithPermission
 * } = usePageView({ module: 'customers' })
 *
 * const customers = ref([])
 *
 * // 加载数据
 * const fetchCustomers = async () => {
 *   await loadData(async () => {
 *     const response = await unifiedApi.get('/customers')
 *     customers.value = response.data
 *   }, '加载成功')
 * }
 *
 * // 带权限的操作
 * const handleDelete = async (id) => {
 *   await executeWithPermission(
 *     'delete',
 *     () => unifiedApi.delete(`/customers/${id}`),
 *     { successMsg: '删除成功', errorMsg: '删除失败' }
 *   )
 * }
 * </script>
 * ```
 */
export function usePageView(options: UsePageViewOptions): UsePageViewReturn {
  const { module } = options

  // 权限
  const {
    canView,
    canCreate,
    canEdit,
    canDelete,
    canExport,
    canImport,
    hasPermission,
    handleNoPermission,
    requirePermission
  } = usePagePermissions(module)

  // 通知
  const { success, error, warning, info, handleApiError, confirm } =
    useNotification()

  // 数据刷新
  const { refreshing, refreshData, refresh } = useRefreshData()

  // 加载状态
  const loading = ref(false)

  /**
   * 加载数据（带加载状态和成功提示）
   */
  const loadData = async <T>(
    fetchFn: () => Promise<T>,
    successMsg?: string
  ): Promise<T | null> => {
    loading.value = true
    try {
      const result = await fetchFn()
      if (successMsg) {
        success(successMsg)
      }
      return result
    } catch (err) {
      handleApiError(err)
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * 执行带权限检查的操作
   */
  const executeWithPermission = async <T>(
    permission: string,
    fn: () => Promise<T>,
    options: { successMsg?: string; errorMsg?: string } = {}
  ): Promise<T | null> => {
    const { successMsg, errorMsg } = options

    if (!requirePermission(permission)) {
      return null
    }

    loading.value = true
    try {
      const result = await fn()
      if (successMsg) {
        success(successMsg)
      }
      return result
    } catch (err: any) {
      if (errorMsg) {
        error(errorMsg)
      } else {
        handleApiError(err)
      }
      return null
    } finally {
      loading.value = false
    }
  }

  return {
    // 权限
    canView,
    canCreate,
    canEdit,
    canDelete,
    canExport,
    canImport,
    hasPermission,
    handleNoPermission,
    requirePermission,

    // 通知
    success,
    error,
    warning,
    info,
    handleApiError,
    confirm,

    // 数据刷新
    refreshing,
    refreshData,
    refresh,

    // 加载状态
    loading,

    // 便捷方法
    loadData,
    executeWithPermission
  }
}

export type { UsePageViewOptions, UsePageViewReturn }
