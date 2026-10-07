/**
 * Loading Store - 全局加载状态管理
 * App.vue 中的 GlobalLoading 统一监听这里，避免多套全屏 Loading 重复显示。
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { logger } from '@/utils/logger'

export const useLoadingStore = defineStore('loading', () => {
  // 全局加载状态
  const isLoading = ref(false)
  const loadingText = ref('')
  const loadingProgress = ref(0)
  const loadingOperations = ref(new Set<string>())
  const localLoadingCount = ref(0)

  // 计算属性
  const hasActiveOperations = computed(() => loadingOperations.value.size > 0)
  const activeOperationCount = computed(() => loadingOperations.value.size)
  const hasLocalLoading = computed(() => localLoadingCount.value > 0)
  const isGlobalVisible = computed(() => isLoading.value && !hasLocalLoading.value)

  // 局部数据 Loading 拥有更高展示优先级，保证一次操作只有一个可见 Loading。
  const startLocalLoading = () => {
    localLoadingCount.value += 1
    if (isLoading.value) {
      isLoading.value = false
      loadingText.value = ''
    }
  }

  const stopLocalLoading = () => {
    localLoadingCount.value = Math.max(0, localLoadingCount.value - 1)
  }

  // 开始加载
  const startLoading = (text = '加载中...', operationId?: string) => {
    if (operationId) {
      loadingOperations.value.add(operationId)
    }

    // 表格/列表正在显示局部数据 Loading 时，全局 Loading 只记录任务，不抢占界面。
    if (hasLocalLoading.value) return

    isLoading.value = true
    loadingText.value = text
    loadingProgress.value = 0

  }

  // 结束加载
  const stopLoading = (operationId?: string) => {
    if (operationId) {
      loadingOperations.value.delete(operationId)
    }

    // 如果没有活跃的操作，则停止全局加载
    if (loadingOperations.value.size === 0) {
      isLoading.value = false
      loadingText.value = ''
      loadingProgress.value = 100

    }
  }

  // 更新进度
  const updateProgress = (progress: number, _operationId?: string) => {
    loadingProgress.value = progress

  }

  // 设置加载状态
  const setLoading = (loading: boolean, text?: string) => {
    if (loading) {
      startLoading(text || '加载中...')
    } else {
      stopLoading()
    }
  }

  // 设置加载文本
  const setLoadingText = (text: string) => {
    loadingText.value = text

  }

  // 清除所有加载状态
  const clearAllLoading = () => {
    isLoading.value = false
    loadingText.value = ''
    loadingProgress.value = 0
    loadingOperations.value.clear()
    localLoadingCount.value = 0

  }

  // 检查操作是否正在加载
  const isOperationLoading = (operationId: string) => {
    return loadingOperations.value.has(operationId)
  }

  // 执行异步操作（带加载状态）
  const executeWithLoading = async <T>(
    operation: () => Promise<T>,
    options: {
      text?: string
      operationId?: string
      onError?: (error: Error) => void
      onSuccess?: (result: T) => void
    } = {}
  ): Promise<T> => {
    const { text = '处理中...', operationId, onError, onSuccess } = options

    try {
      startLoading(text, operationId)
      const result = await operation()

      if (onSuccess) {
        onSuccess(result)
      }

      return result
    } catch (error) {
      logger.error('操作执行失败:', error)

      if (onError) {
        onError(error as Error)
      }

      throw error
    } finally {
      stopLoading(operationId)
    }
  }

  return {
    // 状态
    isLoading: computed(() => isLoading.value),
    isGlobalVisible,
    loadingText: computed(() => loadingText.value),
    loadingProgress: computed(() => loadingProgress.value),
    hasActiveOperations,
    activeOperationCount,
    hasLocalLoading,

    // 方法
    startLoading,
    stopLoading,
    setLoading,
    updateProgress,
    setLoadingText,
    clearAllLoading,
    isOperationLoading,
    executeWithLoading,
    startLocalLoading,
    stopLocalLoading
  }
})

export default useLoadingStore
