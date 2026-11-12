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
  const operationMessages = new Map<string, { text: string; priority: number }>()
  const defaultOperationId = 'default-loading'
  let displayedOperationId: string | undefined
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
  const selectLoadingText = () => {
    let priority = -Infinity
    for (const [id, message] of operationMessages) {
      if (message.priority >= priority) {
        loadingText.value = message.text
        displayedOperationId = id
        priority = message.priority
      }
    }
  }

  const startLoading = (text = '正在处理，请稍候...', operationId?: string, priority = 0) => {
    const id = operationId || defaultOperationId
    loadingOperations.value.add(id)
    operationMessages.delete(id)
    operationMessages.set(id, { text, priority })

    // 表格/列表正在显示局部数据 Loading 时，全局 Loading 只记录任务，不抢占界面。
    if (hasLocalLoading.value) return

    isLoading.value = true
    selectLoadingText()
    loadingProgress.value = 0

  }

  // 结束加载
  const stopLoading = (operationId?: string) => {
    const id = operationId || defaultOperationId
    loadingOperations.value.delete(id)
    operationMessages.delete(id)

    // 如果没有活跃的操作，则停止全局加载
    if (loadingOperations.value.size === 0) {
      isLoading.value = false
      loadingText.value = ''
      displayedOperationId = undefined
      loadingProgress.value = 100
    } else if (isGlobalVisible.value) {
      selectLoadingText()
    }
  }

  // 更新进度
  const updateProgress = (progress: number, _operationId?: string) => {
    loadingProgress.value = progress

  }

  // 设置加载状态
  const setLoading = (loading: boolean, text?: string) => {
    if (loading) {
      startLoading(text || '正在处理，请稍候...')
    } else {
      stopLoading()
    }
  }

  // 设置加载文本
  const setLoadingText = (text: string, operationId?: string) => {
    const id = operationId || displayedOperationId
    const message = id ? operationMessages.get(id) : undefined
    if (message) {
      message.text = text
      if (isGlobalVisible.value) selectLoadingText()
    } else if (!operationId) {
      loadingText.value = text
    }
  }

  // 清除所有加载状态
  const clearAllLoading = () => {
    isLoading.value = false
    loadingText.value = ''
    loadingProgress.value = 0
    loadingOperations.value.clear()
    operationMessages.clear()
    displayedOperationId = undefined
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
