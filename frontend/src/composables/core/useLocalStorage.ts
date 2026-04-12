/**
 * 响应式存储 Composable
 * 提供响应式的 localStorage/sessionStorage 操作，基于统一存储服务
 */

import { ref, watch, type Ref } from 'vue'
import { tryOnScopeDispose } from '@vueuse/core'
import { storage } from '@/services/storage'
import type { StorageKey } from '@/constants/storage'
import { logger } from '@/utils/logger'

/**
 * 存储选项
 */
export interface UseStorageOptions<T = any> {
  /** 默认值 */
  defaultValue?: T
  /** 存储类型 */
  type?: 'local' | 'session'
  /** 是否监听其他标签页变化 */
  syncAcrossTabs?: boolean
  /** 错误回调 */
  onError?: (error: Error) => void
}

/**
 * 默认选项
 */
const defaultOptions: UseStorageOptions = {
  type: 'local',
  syncAcrossTabs: true
}

/**
 * 使用本地存储（响应式）
 * @param key 存储键
 * @param options 选项
 */
export function useLocalStorage<T = any>(
  key: StorageKey | string,
  options: UseStorageOptions<T> = {}
): Ref<T | null> {
  const { defaultValue = null, type = 'local', syncAcrossTabs = true, onError } = { ...defaultOptions, ...options }

  // 创建响应式引用
  const storedValue = ref<T | null>(defaultValue) as Ref<T | null>

  // 读取初始值
  const readValue = (): T | null => {
    try {
      const value = storage.get<T>(key, type)
      return value ?? defaultValue ?? null
    } catch (error) {
      logger.error(`[useLocalStorage] 读取失败: ${key}`, error)
      onError?.(error as Error)
      return defaultValue ?? null
    }
  }

  // 写入值
  const writeValue = (value: T | null): void => {
    try {
      if (value === null || value === undefined) {
        storage.remove(key, type)
      } else {
        storage.set(key, value, type)
      }
    } catch (error) {
      logger.error(`[useLocalStorage] 写入失败: ${key}`, error)
      onError?.(error as Error)
    }
  }

  // 初始化
  storedValue.value = readValue()

  // 监听响应式变化
  watch(storedValue, (newValue) => {
    writeValue(newValue)
  }, { deep: true })

  // 监听其他标签页变化
  const handleStorageChange = (event: StorageEvent): void => {
    if (event.key === key && event.newValue !== event.oldValue) {
      storedValue.value = event.newValue ? JSON.parse(event.newValue).value : defaultValue
    }
  }

  if (syncAcrossTabs && typeof window !== 'undefined') {
    window.addEventListener('storage', handleStorageChange)

    tryOnScopeDispose(() => {
      window.removeEventListener('storage', handleStorageChange)
    })
  }

  return storedValue
}

/**
 * 使用会话存储（响应式）
 * @param key 存储键
 * @param options 选项
 */
export function useSessionStorage<T = any>(
  key: StorageKey | string,
  options: UseStorageOptions<T> = {}
): Ref<T | null> {
  return useLocalStorage<T>(key, { ...options, type: 'session' })
}

/**
 * 本地存储工具类（静态方法，非响应式）
 * 推荐直接使用 storage 服务，此类保留用于向后兼容
 */
export class LocalStorageUtil {
  static set<T>(key: string, value: T): void {
    storage.set(key, value, 'local')
  }

  static get<T>(key: string, defaultValue?: T): T | null {
    return storage.get<T>(key, 'local', defaultValue)
  }

  static remove(key: string): void {
    storage.remove(key, 'local')
  }

  static clear(): void {
    storage.clear('local')
  }

  static keys(): string[] {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) keys.push(key)
    }
    return keys
  }

  static size(): number {
    let size = 0
    for (const key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        size += localStorage[key].length + key.length
      }
    }
    return size
  }

  static isSupported(): boolean {
    try {
      const test = '__localStorage_test__'
      localStorage.setItem(test, test)
      localStorage.removeItem(test)
      return true
    } catch {
      return false
    }
  }
}

// 重新导出统一存储服务，方便使用
export { storage } from '@/services/storage'
