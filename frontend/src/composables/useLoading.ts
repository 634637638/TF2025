import { ref, computed } from 'vue'
import type { Ref } from 'vue'
import { logger } from '@/utils/logger'

/**
 * 简洁的 Loading 状态管理 Composable
 *
 * 使用示例：
 * ```typescript
 * const { loading, start, stop, wrap } = useLoadingState()
 *
 * // 方式1：手动控制
 * loading.value = true
 * try {
 *   await api()
 * } finally {
 *   loading.value = false
 * }
 *
 * // 方式2：使用 wrap 自动处理
 * await wrap(async () => {
 *   await api()
 * })
 * ```
 */
export function useLoadingState(initial = false) {
  const loading = ref(initial)

  const start = () => {
    loading.value = true
  }

  const stop = () => {
    loading.value = false
  }

  /**
   * 包装异步操作，自动处理 loading 状态
   */
  const wrap = async <T>(fn: () => Promise<T>): Promise<T> => {
    loading.value = true
    try {
      return await fn()
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    isLoading: loading,
    start,
    stop,
    wrap
  }
}

/**
 * 全局Loading状态管理 Composable
 * 提供统一的Loading状态管理和视觉反馈
 */
export function useLoading() {
  // Loading状态映射
  const loadingStates: Ref<Record<string, boolean>> = ref({})

  // 全局Loading状态
  const globalLoading = ref(false)
  const loadingMessage = ref('')
  const loadingProgress = ref(0)

  /**
   * 设置Loading状态
   */
  const setLoading = (key: string, loading: boolean, message?: string) => {
    loadingStates.value[key] = loading

    // 更新全局Loading状态
    const hasAnyLoading = Object.values(loadingStates.value).some(state => state)
    globalLoading.value = hasAnyLoading

    if (message) {
      loadingMessage.value = message
    } else if (!hasAnyLoading) {
      loadingMessage.value = ''
    }
  }

  /**
   * 获取特定Loading状态
   */
  const isLoading = (key: string) => {
    return computed(() => loadingStates.value[key] || false)
  }

  /**
   * 检查是否有任何Loading状态
   */
  const hasAnyLoading = computed(() => {
    return Object.values(loadingStates.value).some(state => state)
  })

  /**
   * 获取所有Loading状态
   */
  const getAllLoading = computed(() => {
    return loadingStates.value
  })

  /**
   * 清除所有Loading状态
   */
  const clearAllLoading = () => {
    Object.keys(loadingStates.value).forEach(key => {
      loadingStates.value[key] = false
    })
    globalLoading.value = false
    loadingMessage.value = ''
    loadingProgress.value = 0
  }

  /**
   * 设置Loading进度
   */
  const setLoadingProgress = (progress: number) => {
    loadingProgress.value = Math.max(0, Math.min(100, progress))
  }

  /**
   * 执行带Loading的异步操作
   */
  const withLoading = async <T>(
    key: string,
    operation: () => Promise<T>,
    options?: {
      message?: string
      showError?: boolean
      onSuccess?: (result: T) => void
      onError?: (error: Error) => void
    }
  ): Promise<T | null> => {
    try {
      setLoading(key, true, options?.message)

      const result = await operation()

      options?.onSuccess?.(result)
      return result
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))

      if (options?.showError !== false) {
        logger.error(`Loading operation failed for ${key}:`, err)
      }

      options?.onError?.(err)
      return null
    } finally {
      setLoading(key, false)
    }
  }

  return {
    // 状态
    loadingStates,
    globalLoading,
    loadingMessage,
    loadingProgress,

    // 计算属性
    isLoading,
    hasAnyLoading,
    getAllLoading,

    // 方法
    setLoading,
    clearAllLoading,
    setLoadingProgress,
    withLoading
  }
}

/**
 * 创建单个Loading实例的便捷函数
 */
export function createLoading(key: string, initialMessage?: string) {
  const { isLoading, setLoading, withLoading } = useLoading()

  // 设置初始状态
  if (initialMessage) {
    setLoading(key, false, initialMessage)
  }

  return {
    isLoading: isLoading(key),
    start: (message?: string) => setLoading(key, true, message),
    stop: () => setLoading(key, false),
    withOperation: <T>(operation: () => Promise<T>, options?: any) =>
      withLoading(key, operation, options)
  }
}

export default useLoading