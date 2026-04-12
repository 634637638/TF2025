/**
 * 异步操作 Composable
 * 提供统一的异步状态管理
 */

import { ref } from 'vue'
import type { Ref } from 'vue'
import type { AsyncState } from '../types'
import logger from '@/utils/logger'

/**
 * 创建异步状态管理
 * @param asyncFunction 异步函数
 * @param initialData 初始数据
 * @param options 配置选项
 */
export function useAsync<T = any>(
  asyncFunction: (...args: any[]) => Promise<T>,
  initialData: T | null = null,
  options: {
    immediate?: boolean
    onSuccess?: (data: T) => void
    onError?: (error: Error) => void
    resetOnExecute?: boolean
  } = {}
): AsyncState<T> {
  const { immediate = false, onSuccess, onError, resetOnExecute = false } = options

  // 状态定义
  const data = ref<T | null>(initialData) as Ref<T | null>
  const loading = ref(false)
  const error = ref<string | null>(null)
  const success = ref(false)

  // 执行异步操作
  const execute = async (...args: any[]): Promise<T | null> => {
    try {
      // 重置状态
      if (resetOnExecute) {
        data.value = initialData
        error.value = null
        success.value = false
      }

      loading.value = true
      error.value = null
      success.value = false

      // 执行异步函数
      const result = await asyncFunction(...args)

      // 更新状态
      data.value = result
      success.value = true
      loading.value = false

      // 成功回调
      if (onSuccess) {
        onSuccess(result)
      }

      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'

      // 更新错误状态
      error.value = errorMessage
      loading.value = false
      success.value = false

      // 错误回调
      if (onError) {
        onError(err as Error)
      }

      logger.error('异步操作失败', err)

      return null
    }
  }

  // 重置状态
  const reset = (): void => {
    data.value = initialData
    loading.value = false
    error.value = null
    success.value = false
  }

  // 立即执行（如果配置了）
  if (immediate) {
    execute()
  }

  return {
    data: data as Ref<T | null>,
    loading,
    error,
    success,
    execute,
    reset
  }
}

/**
 * 创建可重用的异步状态
 * @param initialData 初始数据
 */
export function createAsyncState<T = any>(initialData: T | null = null): AsyncState<T> {
  const data = ref<T | null>(initialData) as Ref<T | null>
  const loading = ref(false)
  const error = ref<string | null>(null)
  const success = ref(false)

  const execute = async (asyncFunction: (...args: any[]) => Promise<T>): Promise<T | null> => {
    try {
      loading.value = true
      error.value = null
      success.value = false

      const result = await asyncFunction()

      data.value = result
      success.value = true
      loading.value = false

      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'

      error.value = errorMessage
      loading.value = false
      success.value = false

      logger.error('异步操作失败', err)

      return null
    }
  }

  const reset = (): void => {
    data.value = initialData
    loading.value = false
    error.value = null
    success.value = false
  }

  return {
    data,
    loading,
    error,
    success,
    execute,
    reset
  }
}

/**
 * 创建加载状态
 */
export function useLoading(initialState = false): Ref<boolean> {
  const loading = ref(initialState)

  const start = (): void => {
    loading.value = true
  }

  const stop = (): void => {
    loading.value = false
  }

  const toggle = (): void => {
    loading.value = !loading.value
  }

  return Object.assign(loading, { start, stop, toggle })
}
