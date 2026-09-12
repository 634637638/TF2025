/**
 * 页面级 API 缓存存储。
 *
 * 请求鉴权、错误处理、Loading 和重试统一由 unifiedApi 负责；
 * 这里仅保留页面缓存所需的存储和后台刷新能力。
 */

import type { AxiosRequestConfig } from 'axios'

export interface CacheConfig {
  ttl: number
  maxSize: number
  strategy: 'lru' | 'fifo' | 'lfu'
  enableBackgroundRefresh: boolean
  refreshRatio: number
}

export interface RequestCacheEntry {
  data: unknown
  timestamp: number
  ttl: number
  hits: number
  lastAccessed: number
  backgroundRefresh?: boolean
}

export type CacheScope = string | RegExp

const matchesScope = (key: string, scope: CacheScope): boolean => {
  if (scope instanceof RegExp) {
    scope.lastIndex = 0
    return scope.test(key)
  }
  return key.includes(scope)
}

export class SmartCacheManager {
  private cache = new Map<string, RequestCacheEntry>()
  private accessOrder = new Map<string, number>()
  private accessCounter = new Map<string, number>()
  private config: CacheConfig
  private cleanupTimer?: number
  private backgroundRefreshTimer?: number
  private accessTime = 0

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      ttl: 30000,
      maxSize: 100,
      strategy: 'lru',
      enableBackgroundRefresh: true,
      refreshRatio: 0.8,
      ...config
    }

    this.startCleanup()
    if (this.config.enableBackgroundRefresh) {
      this.startBackgroundRefresh()
    }
  }

  generateKey(config: AxiosRequestConfig): string {
    const { method, url, params, data } = config

    if (method?.toLowerCase() !== 'get') {
      return `${method?.toUpperCase() || 'GET'}:${url}:${JSON.stringify({ params, data })}`
    }

    return `${url}:${JSON.stringify(params)}`
  }

  get<T = unknown>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    const now = Date.now()
    if (now - entry.timestamp > entry.ttl) {
      this.delete(key)
      return null
    }

    entry.hits++
    entry.lastAccessed = now
    this.accessOrder.set(key, ++this.accessTime)

    if (this.config.enableBackgroundRefresh && !entry.backgroundRefresh) {
      const remainingTime = entry.ttl - (now - entry.timestamp)
      if (remainingTime <= entry.ttl * this.config.refreshRatio) {
        entry.backgroundRefresh = true
        this.scheduleBackgroundRefresh(key)
      }
    }

    return entry.data as T
  }

  set(key: string, data: unknown, customTtl?: number): void {
    const now = Date.now()
    const ttl = customTtl || this.config.ttl

    if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
      this.evictCache()
    }

    this.cache.set(key, {
      data,
      timestamp: now,
      ttl,
      hits: 0,
      lastAccessed: now
    })
    this.accessOrder.set(key, ++this.accessTime)
    this.accessCounter.set(key, 0)
  }

  delete(key: string): boolean {
    this.accessOrder.delete(key)
    this.accessCounter.delete(key)
    return this.cache.delete(key)
  }

  deleteByScope(scope: CacheScope): number {
    const keys = Array.from(this.cache.keys()).filter(key => matchesScope(key, scope))
    keys.forEach(key => this.delete(key))
    return keys.length
  }

  getStale<T = unknown>(key: string): T | null {
    return (this.cache.get(key)?.data as T | undefined) ?? null
  }

  clear(): void {
    this.cache.clear()
    this.accessOrder.clear()
    this.accessCounter.clear()
  }

  private evictCache(): void {
    const evictCount = Math.max(1, Math.ceil(this.config.maxSize * 0.1))
    const entries = Array.from(this.cache.entries())

    switch (this.config.strategy) {
    case 'lfu':
      entries.sort(([, a], [, b]) => a.hits - b.hits)
      break
    case 'fifo':
      entries.sort(([, a], [, b]) => a.timestamp - b.timestamp)
      break
    case 'lru':
    default:
      entries.sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed)
      break
    }

    entries.slice(0, evictCount).forEach(([key]) => this.delete(key))
  }

  private startCleanup(): void {
    this.cleanupTimer = window.setInterval(() => {
      const now = Date.now()
      Array.from(this.cache.entries())
        .filter(([, entry]) => now - entry.timestamp > entry.ttl)
        .forEach(([key]) => this.delete(key))
    }, 60000)
  }

  private startBackgroundRefresh(): void {
    this.backgroundRefreshTimer = window.setInterval(() => {
      const now = Date.now()
      const keysToRefresh: string[] = []

      this.cache.forEach((entry, key) => {
        const remainingTime = entry.ttl - (now - entry.timestamp)
        if (remainingTime <= entry.ttl * this.config.refreshRatio && !entry.backgroundRefresh) {
          entry.backgroundRefresh = true
          keysToRefresh.push(key)
        }
      })

      if (keysToRefresh.length > 0) {
        window.dispatchEvent(new CustomEvent('tf2025:cache:refresh', {
          detail: { keys: keysToRefresh }
        }))
      }
    }, 30000)
  }

  private scheduleBackgroundRefresh(key: string): void {
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('tf2025:cache:refresh-key', {
        detail: { key }
      }))
    }, 1000)
  }

  getStats() {
    const now = Date.now()
    let totalHits = 0
    let expiredEntries = 0

    this.cache.forEach(entry => {
      totalHits += entry.hits
      if (now - entry.timestamp > entry.ttl) {
        expiredEntries++
      }
    })

    const totalEntries = this.cache.size
    return {
      size: totalEntries,
      maxSize: this.config.maxSize,
      totalHits,
      averageHits: totalEntries > 0 ? totalHits / totalEntries : 0,
      expiredEntries,
      hitRate: totalHits > 0 ? totalHits / (totalHits + totalEntries) : 0
    }
  }

  destroy(): void {
    if (this.cleanupTimer) {
      window.clearInterval(this.cleanupTimer)
    }
    if (this.backgroundRefreshTimer) {
      window.clearInterval(this.backgroundRefreshTimer)
    }
    this.clear()
  }
}

export const globalApiCache = new SmartCacheManager()

export default {
  SmartCacheManager,
  globalApiCache
}
