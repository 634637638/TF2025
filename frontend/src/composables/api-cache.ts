/**
 * 企业级API缓存和请求优化系统
 * 提供智能缓存、请求去重、离线支持等功能
 */

import { ref, computed, watch } from 'vue'
import type { AxiosRequestConfig, AxiosResponse } from 'axios'
import { storage } from '@/services/storage'
import { CACHE_STORAGE_KEYS } from '@/constants/storage'

// ============ 缓存配置 ============
export interface CacheConfig {
  ttl: number // 缓存生存时间(毫秒)
  maxSize: number // 最大缓存条目数
  strategy: 'lru' | 'fifo' | 'lfu' // 缓存淘汰策略
  enableBackgroundRefresh: boolean // 启用后台刷新
  refreshRatio: number // 刷新比例(剩余时间的比例)
}

export interface RequestCacheEntry {
  data: any
  timestamp: number
  ttl: number
  hits: number
  lastAccessed: number
  backgroundRefresh?: boolean
}

export interface PendingRequest {
  promise: Promise<any>
  timestamp: number
  timeoutId?: number
}

export interface RequestQueue {
  [key: string]: PendingRequest[]
}

// ============ 智能缓存管理器 ============
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
      ttl: 30000, // 30秒 - 默认缓存，实时场景请显式传入更短 TTL
      maxSize: 100,
      strategy: 'lru',
      enableBackgroundRefresh: true,
      refreshRatio: 0.8,
      ...config
    }

    // 启动定期清理
    this.startCleanup()

    // 启动后台刷新
    if (this.config.enableBackgroundRefresh) {
      this.startBackgroundRefresh()
    }
  }

  // 生成缓存键（公开供外部使用）
  generateKey(config: AxiosRequestConfig): string {
    const { method, url, params, data } = config

    // 只缓存GET请求，其他请求方法需要特殊处理
    if (method?.toLowerCase() !== 'get') {
      return `${method?.toUpperCase() || 'GET'}:${url}:${JSON.stringify({
        params,
        data
      })}`
    }

    return `${url}:${JSON.stringify(params)}`
  }

  // 获取缓存
  get(key: string): any {
    const entry = this.cache.get(key)

    if (!entry) {
      return null
    }

    const now = Date.now()

    // 检查是否过期
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      this.accessOrder.delete(key)
      this.accessCounter.delete(key)
      return null
    }

    // 更新访问信息
    entry.hits++
    entry.lastAccessed = now
    this.accessOrder.set(key, ++this.accessTime)

    // 后台刷新检查
    if (this.config.enableBackgroundRefresh && !entry.backgroundRefresh) {
      const remainingTime = entry.ttl - (now - entry.timestamp)
      const refreshTime = entry.ttl * this.config.refreshRatio

      if (remainingTime <= refreshTime) {
        entry.backgroundRefresh = true
        this.scheduleBackgroundRefresh(key)
      }
    }

    return entry.data
  }

  // 设置缓存
  set(key: string, data: any, customTtl?: number): void {
    const now = Date.now()
    const ttl = customTtl || this.config.ttl

    // 检查缓存大小限制
    if (this.cache.size >= this.config.maxSize) {
      this.evictCache()
    }

    const entry: RequestCacheEntry = {
      data,
      timestamp: now,
      ttl,
      hits: 0,
      lastAccessed: now
    }

    this.cache.set(key, entry)
    this.accessOrder.set(key, ++this.accessTime)
    this.accessCounter.set(key, 0)
  }

  // 删除缓存
  delete(key: string): boolean {
    this.accessOrder.delete(key)
    this.accessCounter.delete(key)
    return this.cache.delete(key)
  }

  // 清空缓存
  clear(): void {
    this.cache.clear()
    this.accessOrder.clear()
    this.accessCounter.clear()
  }

  // 缓存淘汰策略
  private evictCache(): void {
    const evictCount = Math.ceil(this.config.maxSize * 0.1) // 淘汰10%的条目
    const entries = Array.from(this.cache.entries())

    switch (this.config.strategy) {
      case 'lru':
        entries.sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed)
        break
      case 'lfu':
        entries.sort(([, a], [, b]) => a.hits - b.hits)
        break
      case 'fifo':
        entries.sort(([, a], [, b]) => a.timestamp - b.timestamp)
        break
    }

    for (let i = 0; i < evictCount && i < entries.length; i++) {
      const [key] = entries[i]
      this.delete(key)
    }
  }

  // 定期清理过期缓存
  private startCleanup(): void {
    this.cleanupTimer = window.setInterval(() => {
      const now = Date.now()
      const keysToDelete: string[] = []

      this.cache.forEach((entry, key) => {
        if (now - entry.timestamp > entry.ttl) {
          keysToDelete.push(key)
        }
      })

      keysToDelete.forEach(key => this.delete(key))
    }, 60000) // 每分钟清理一次
  }

  // 后台刷新
  private startBackgroundRefresh(): void {
    this.backgroundRefreshTimer = window.setInterval(() => {
      const now = Date.now()
      const keysToRefresh: string[] = []

      this.cache.forEach((entry, key) => {
        const remainingTime = entry.ttl - (now - entry.timestamp)
        const refreshTime = entry.ttl * this.config.refreshRatio

        if (remainingTime <= refreshTime && !entry.backgroundRefresh) {
          entry.backgroundRefresh = true
          keysToRefresh.push(key)
        }
      })

      // 触发后台刷新事件
      if (keysToRefresh.length > 0) {
        window.dispatchEvent(new CustomEvent('tf2025:cache:refresh', {
          detail: { keys: keysToRefresh }
        }))
      }
    }, 30000) // 每30秒检查一次
  }

  private scheduleBackgroundRefresh(key: string): void {
    // 延迟触发刷新事件，避免频繁请求
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('tf2025:cache:refresh-key', {
        detail: { key }
      }))
    }, 1000)
  }

  // 获取缓存统计信息
  getStats() {
    const now = Date.now()
    let totalHits = 0
    let totalEntries = 0
    let expiredEntries = 0

    this.cache.forEach(entry => {
      totalHits += entry.hits
      totalEntries++
      if (now - entry.timestamp > entry.ttl) {
        expiredEntries++
      }
    })

    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      totalHits,
      averageHits: totalEntries > 0 ? totalHits / totalEntries : 0,
      expiredEntries,
      hitRate: totalHits > 0 ? totalHits / (totalHits + totalEntries) : 0
    }
  }

  // 销毁缓存管理器
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }
    if (this.backgroundRefreshTimer) {
      clearInterval(this.backgroundRefreshTimer)
    }
    this.clear()
  }
}

// ============ 请求去重管理器 ============
export class RequestDeduplicator {
  private pendingRequests = new Map<string, PendingRequest>()

  // 生成请求键（公开供外部使用）
  generateKey(config: AxiosRequestConfig): string {
    const { method, url, params, data } = config
    return `${method?.toUpperCase() || 'GET'}:${url}:${JSON.stringify({
      params,
      data
    })}`
  }

  // 添加待处理请求
  addRequest(key: string, promise: Promise<any>): Promise<any> {
    // 清理超时的请求
    this.cleanup()

    const pending: PendingRequest = {
      promise,
      timestamp: Date.now(),
      timeoutId: window.setTimeout(() => {
        this.pendingRequests.delete(key)
      }, 30000) // 30秒超时
    }

    // 如果已有相同请求，返回现有的promise
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key)!.promise
    }

    this.pendingRequests.set(key, pending)
    return promise
  }

  // 检查是否有待处理请求
  hasPendingRequest(key: string): boolean {
    this.cleanup()
    return this.pendingRequests.has(key)
  }

  // 获取待处理请求
  getPendingRequest(key: string): PendingRequest | undefined {
    this.cleanup()
    return this.pendingRequests.get(key)
  }

  // 清理超时的请求
  private cleanup(): void {
    const now = Date.now()
    const timeout = 30000 // 30秒

    this.pendingRequests.forEach((pending, key) => {
      if (now - pending.timestamp > timeout) {
        if (pending.timeoutId) {
          clearTimeout(pending.timeoutId)
        }
        this.pendingRequests.delete(key)
      }
    })
  }

  // 清空所有待处理请求
  clear(): void {
    this.pendingRequests.forEach(pending => {
      if (pending.timeoutId) {
        clearTimeout(pending.timeoutId)
      }
    })
    this.pendingRequests.clear()
  }
}

// ============ 离线支持管理器 ============
export class OfflineManager {
  private isOnline = navigator.onLine
  private offlineQueue: Array<{
    config: AxiosRequestConfig
    resolve: (value: any) => void
    reject: (reason: any) => void
    timestamp: number
  }> = []
  private maxQueueSize = 50

  constructor() {
    // 监听网络状态变化
    window.addEventListener('online', this.handleOnline.bind(this))
    window.addEventListener('offline', this.handleOffline.bind(this))

    // 恢复离线队列
    this.restoreOfflineQueue()
  }

  private handleOnline(): void {
    this.isOnline = true

    // 处理离线队列中的请求
    this.processOfflineQueue()

    // 清理离线缓存
    this.clearOfflineCache()

    // 触发在线事件
    window.dispatchEvent(new CustomEvent('tf2025:online'))
  }

  private handleOffline(): void {
    this.isOnline = true

    // 触发离线事件
    window.dispatchEvent(new CustomEvent('tf2025:offline'))
  }

  // 添加请求到离线队列
  addToQueue(config: AxiosRequestConfig): Promise<any> {
    return new Promise((resolve, reject) => {
      // 限制队列大小
      if (this.offlineQueue.length >= this.maxQueueSize) {
        reject(new Error('离线队列已满，请稍后再试'))
        return
      }

      this.offlineQueue.push({
        config,
        resolve,
        reject,
        timestamp: Date.now()
      })

      // 保存到本地存储
      this.saveOfflineQueue()
    })
  }

  // 处理离线队列
  private async processOfflineQueue(): Promise<void> {
    if (this.offlineQueue.length === 0) return

    const requests = [...this.offlineQueue]
    this.offlineQueue = []
    this.saveOfflineQueue()

    // 批量处理请求
    for (const request of requests) {
      try {
        // 这里需要重新发起请求
        window.dispatchEvent(new CustomEvent('tf2025:retry-request', {
          detail: { config: request.config }
        }))
        request.resolve(null) // 临时resolve，实际应该等待请求完成
      } catch (error) {
        request.reject(error)
      }
    }
  }

  // 保存离线队列
  private saveOfflineQueue(): void {
    try {
      const data = {
        queue: this.offlineQueue.slice(0, 20), // 只保存前20个
        timestamp: Date.now()
      }
      storage.set(CACHE_STORAGE_KEYS.API_CACHE, data, 'local')
    } catch (error) {
      // 静默处理
    }
  }

  // 恢复离线队列
  private restoreOfflineQueue(): void {
    try {
      const data = storage.get<{ queue: any[]; timestamp: number }>(CACHE_STORAGE_KEYS.API_CACHE, 'local')
      if (data) {
        const now = Date.now()

        this.offlineQueue = data.queue.filter(
          (item: any) => now - item.timestamp < 24 * 60 * 60 * 1000
        )
      }
    } catch (error) {
      // 静默处理
    }
  }

  // 清理离线缓存
  private clearOfflineCache(): void {
    try {
      storage.remove(CACHE_STORAGE_KEYS.API_CACHE, 'local')
    } catch (error) {
      // 静默处理
    }
  }

  // 检查网络状态
  checkOnlineStatus(): boolean {
    return this.isOnline && navigator.onLine
  }

  // 获取离线统计
  getOfflineStats() {
    return {
      isOnline: this.checkOnlineStatus(),
      queueSize: this.offlineQueue.length,
      maxQueueSize: this.maxQueueSize
    }
  }

  // 销毁离线管理器
  destroy(): void {
    window.removeEventListener('online', this.handleOnline)
    window.removeEventListener('offline', this.handleOffline)
  }
}

// ============ API优化Composable ============
export function useOptimizedApi(cacheConfig?: Partial<CacheConfig>) {
  const loading = ref(false)
  const error = ref<string | null>(null)
  const cacheManager = new SmartCacheManager(cacheConfig)
  const deduplicator = new RequestDeduplicator()
  const offlineManager = new OfflineManager()

  // 优化后的请求方法
  const optimizedRequest = async <T>(
    config: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> => {
    const cacheKey = cacheManager.generateKey(config)

    // 对于GET请求，优先使用缓存
    if (config.method?.toLowerCase() === 'get') {
      const cachedData = cacheManager.get(cacheKey)
      if (cachedData) {
        return {
          data: cachedData,
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
          request: {}
        } as AxiosResponse<T>
      }
    }

    // 检查重复请求
    if (deduplicator.hasPendingRequest(cacheKey)) {
      return deduplicator.getPendingRequest(cacheKey)!.promise
    }

    // 检查网络状态
    if (!offlineManager.checkOnlineStatus()) {
      // 对于GET请求，尝试返回缓存数据
      if (config.method?.toLowerCase() === 'get') {
        const cachedData = cacheManager.get(cacheKey)
        if (cachedData) {
          return {
            data: cachedData,
            status: 200,
            statusText: 'OK (Cached)',
            headers: {},
            config,
            request: {}
          } as AxiosResponse<T>
        }
      }

      // 其他请求添加到离线队列
      if (config.method?.toLowerCase() !== 'get') {
        return offlineManager.addToQueue(config)
      }

      throw new Error('网络连接不可用，且无可用缓存')
    }

    // 发起新请求
    loading.value = true
    error.value = null

    try {
      // 创建请求promise
      const requestPromise = window.fetch(config.baseURL! + config.url, {
        method: config.method || 'GET',
        headers: config.headers as HeadersInit,
        body: config.data ? JSON.stringify(config.data) : undefined
      }).then(async response => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        return response.json()
      })

      // 添加去重管理
      deduplicator.addRequest(cacheKey, requestPromise)

      const data = await requestPromise

      // 缓存GET请求的响应
      if (config.method?.toLowerCase() === 'get') {
        cacheManager.set(cacheKey, data)
      }

      return {
        data,
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
        request: {}
      } as AxiosResponse<T>

    } catch (err: any) {
      error.value = err.message || '请求失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  // 清除指定缓存
  const clearCache = (key?: string) => {
    if (key) {
      cacheManager.delete(key)
    } else {
      cacheManager.clear()
    }
  }

  // 预加载数据
  const preloadData = async (configs: AxiosRequestConfig[]) => {
    for (const config of configs) {
      try {
        await optimizedRequest(config)
      } catch (error) {
        // 静默处理
      }
    }
  }

  // 批量请求
  const batchRequest = async <T>(configs: AxiosRequestConfig[]): Promise<T[]> => {
    const promises = configs.map(config => optimizedRequest<T>(config))
    return Promise.all(promises).then(responses => responses.map(res => res.data))
  }

  // 获取统计信息
  const getStats = () => ({
    cache: cacheManager.getStats(),
    offline: offlineManager.getOfflineStats(),
    loading: loading.value,
    error: error.value
  })

  // 监听后台刷新事件
  watch(() => {}, () => {
    window.addEventListener('tf2025:cache:refresh-key', async (event: any) => {
      const { key } = event.detail
      try {
        // 从缓存键解析原始请求配置
        // 这里需要更复杂的逻辑来还原请求配置
      } catch (error) {
        // 静默处理
      }
    })
  })

  return {
    loading,
    error,
    optimizedRequest,
    clearCache,
    preloadData,
    batchRequest,
    getStats,
    cacheManager,
    deduplicator,
    offlineManager
  }
}

// ============ 全局实例 ============
export const globalApiCache = new SmartCacheManager()
export const globalDeduplicator = new RequestDeduplicator()
export const globalOfflineManager = new OfflineManager()

export default {
  SmartCacheManager,
  RequestDeduplicator,
  OfflineManager,
  useOptimizedApi,
  globalApiCache,
  globalDeduplicator,
  globalOfflineManager
}
