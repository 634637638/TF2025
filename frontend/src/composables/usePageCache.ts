/**
 * 页面级 API 缓存工具
 * 提供统一的缓存管理，避免重复请求
 */

import { globalApiCache, type CacheScope } from '@/composables/page-cache-store'
import { logger } from '@/utils/logger'

// 默认 TTL 配置（毫秒）
export const DEFAULT_CACHE_TTL = {
  STATIC: 60000,      // 静态数据: 60秒（概览、统计）
  DYNAMIC: 30000,     // 动态数据: 30秒（趋势、图表）
  REALTIME: 5000,     // 实时数据: 5秒
  STALE: 5 * 60000    // 允许过期数据: 5分钟
}

// 请求去重 Map
const pendingRequests = new Map<string, Promise<unknown>>()
let cacheGeneration = 0

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
  const cached = globalApiCache.get<T>(key)
  if (cached !== null) {
    return cached
  }

  // 2. 检查去重
  if (deduplicate && pendingRequests.has(key)) {
    return pendingRequests.get(key) as Promise<T>
  }

  // 3. 发起请求
  try {
    const requestGeneration = cacheGeneration
    const requestPromise = fetcher()

    if (deduplicate) {
      pendingRequests.set(key, requestPromise)
    }

    const data = await requestPromise

    // 4. 存入缓存
    if (requestGeneration === cacheGeneration) {
      globalApiCache.set(key, data, ttl)
    }

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
function getStaleCache(key: string): unknown {
  // 请求失败时允许使用当前条目的过期值作为后备。
  return globalApiCache.getStale(key)
}

/**
 * 清除页面级缓存。
 * key 为字符串时按包含关系清理，支持一次清掉同一模块的多个派生 key。
 */
export function clearCache(key?: CacheScope | CacheScope[]): void {
  cacheGeneration += 1
  if (key) {
    const scopes = Array.isArray(key) ? key : [key]
    scopes.forEach(scope => globalApiCache.deleteByScope(scope))

    Array.from(pendingRequests.keys()).forEach(requestKey => {
      const matches = scopes.some(scope => {
        if (scope instanceof RegExp) {
          scope.lastIndex = 0
          return scope.test(requestKey)
        }
        return requestKey.includes(scope)
      })
      if (matches) {
        pendingRequests.delete(requestKey)
      }
    })
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
    fetcher: () => Promise<unknown>
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
