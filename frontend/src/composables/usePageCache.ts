/**
 * 页面级 API 缓存工具
 * 提供统一的缓存管理，避免重复请求
 */

import { globalApiCache, globalDeduplicator } from '@/composables/api-cache'
import { logger } from '@/utils/logger'

// 默认 TTL 配置（毫秒）
export const DEFAULT_CACHE_TTL = {
  STATIC: 60000,      // 静态数据: 60秒（概览、统计）
  DYNAMIC: 30000,     // 动态数据: 30秒（趋势、图表）
  REALTIME: 5000,     // 实时数据: 5秒
  STALE: 5 * 60000    // 允许过期数据: 5分钟
}

// 请求去重 Map
const pendingRequests = new Map<string, Promise<any>>()

/**
 * 缓存请求工具函数
 * @param key 缓存键
 * @param fetcher 数据获取函数
 * @param ttl 缓存时间（毫秒）
 * @param options 额外配置
 */
export async function useCachedRequest<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = DEFAULT_CACHE_TTL.STATIC,
  options: {
    useStale?: boolean    // 是否使用过期缓存作为后备
    deduplicate?: boolean // 是否去重
  } = {}
): Promise<T> {
  const { useStale = true, deduplicate = true } = options

  // 1. 检查缓存
  const cached = globalApiCache.get(key)
  if (cached !== null) {
    return cached as T
  }

  // 2. 检查去重
  if (deduplicate && pendingRequests.has(key)) {
    return pendingRequests.get(key) as Promise<T>
  }

  // 3. 发起请求
  try {
    const requestPromise = fetcher()

    if (deduplicate) {
      pendingRequests.set(key, requestPromise as any)
    }

    const data = await requestPromise

    // 4. 存入缓存
    globalApiCache.set(key, data, ttl)

    // 5. 清理去重标记
    pendingRequests.delete(key)

    return data as T
  } catch (error) {
    // 6. 请求失败时，尝试返回过期缓存
    pendingRequests.delete(key)

    if (useStale) {
      // 尝试获取任何缓存（包括过期的）
      const staleCache = getStaleCache(key)
      if (staleCache) {
        logger.warn(`[Cache] 请求失败，使用过期缓存: ${key}`)
        return staleCache as T
      }
    }

    throw error
  }
}

/**
 * 获取过期缓存（用于后备）
 */
function getStaleCache(key: string): any {
  // 直接从缓存管理器内部获取（绕过 TTL 检查）
  const cache = (globalApiCache as any).cache
  return cache?.get(key)?.data || null
}

/**
 * 清除指定键的缓存
 */
export function clearCache(key?: string): void {
  if (key) {
    globalApiCache.delete(key)
    pendingRequests.delete(key)
  } else {
    globalApiCache.clear()
    pendingRequests.clear()
  }
}

/**
 * 检查是否有待处理的请求
 */
export function hasPendingRequest(key: string): boolean {
  return pendingRequests.has(key)
}

/**
 * 批量预加载数据
 */
export async function preloadCache(
  items: Array<{
    key: string
    fetcher: () => Promise<any>
    ttl?: number
  }>
): Promise<void> {
  await Promise.allSettled(
    items.map(item =>
      useCachedRequest(item.key, item.fetcher, item.ttl)
    )
  )
}

export default {
  useCachedRequest,
  clearCache,
  hasPendingRequest,
  preloadCache,
  DEFAULT_CACHE_TTL
}
