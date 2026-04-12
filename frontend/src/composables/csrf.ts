/**
 * CSRF/XSRF 防护系统
 * 提供完整的跨站请求伪造防护功能
 */

import { ref } from 'vue'
import { storage } from '@/services/storage'
import { SECURITY_STORAGE_KEYS } from '@/constants/storage'
import { logger } from '@/utils/logger'

// ============ CSRF 配置 ============
export interface CsrfConfig {
  tokenHeaderName: string // CSRF Token 请求头名称
  cookieName: string // CSRF Token Cookie 名称
  localStorageKey: string // 本地存储键名
  refreshInterval: number // Token 刷新间隔（毫秒）
  maxRetries: number // 最大重试次数
  enabledEndpoints: string[] // 启用CSRF防护的端点
  excludedMethods: string[] // 排除的HTTP方法
}

export interface CsrfToken {
  value: string
  expiresAt: number
  signature: string
}

export interface CsrfResponse {
  success: boolean
  token?: string
  expiresAt?: number
  error?: string
}

// ============ CSRF 防护管理器 ============
export class CsrfProtectionManager {
  private config: CsrfConfig
  private currentToken: CsrfToken | null = null
  private refreshTimer?: number
  private isRefreshing = false
  private refreshPromise: Promise<string> | null = null
  private requestQueue: Array<{
    resolve: (token: string) => void
    reject: (error: Error) => void
    timestamp: number
  }> = []

  constructor(config: Partial<CsrfConfig> = {}) {
    this.config = {
      tokenHeaderName: 'X-CSRF-Token',
      cookieName: 'csrf-token',
      localStorageKey: SECURITY_STORAGE_KEYS.CSRF_TOKEN,
      refreshInterval: 15 * 60 * 1000, // 15分钟
      maxRetries: 3,
      enabledEndpoints: ['/api/', '/auth/'],
      excludedMethods: ['GET', 'HEAD', 'OPTIONS'],
      ...config
    }

    this.init()
  }

  // 初始化CSRF防护
  private init(): void {
    // 从本地存储恢复token
    this.restoreToken()

    // 启动自动刷新
    this.startAutoRefresh()

    // 监听页面可见性变化
    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this))

    // 监听存储变化（多标签页同步）
    window.addEventListener('storage', this.handleStorageChange.bind(this))
  }

  // 从本地存储恢复token
  private restoreToken(): void {
    try {
      const stored = storage.get<CsrfToken>(this.config.localStorageKey, 'local')
      if (stored) {
        if (this.isTokenValid(stored)) {
          this.currentToken = stored
        } else {
          storage.remove(this.config.localStorageKey, 'local')
        }
      }
    } catch (error) {
      logger.warn('恢复CSRF token失败:', error)
      storage.remove(this.config.localStorageKey, 'local')
    }
  }

  // 保存token到本地存储
  private saveToken(token: CsrfToken): void {
    try {
      storage.set(this.config.localStorageKey, token, 'local')
    } catch (error) {
      logger.warn('保存CSRF token失败:', error)
    }
  }

  // 检查token是否有效
  private isTokenValid(token: CsrfToken | null): boolean {
    if (!token) return false
    return Date.now() < token.expiresAt && token.value.length > 0
  }

  // 获取当前token
  public async getToken(): Promise<string> {
    // 如果token有效，直接返回
    if (this.currentToken && this.isTokenValid(this.currentToken)) {
      return this.currentToken.value
    }

    // 如果正在刷新，等待刷新完成
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise
    }

    // 否则刷新token
    return this.refreshToken()
  }

  // 刷新CSRF token
  public async refreshToken(): Promise<string> {
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise
    }

    this.isRefreshing = true

    this.refreshPromise = new Promise((resolve, reject) => {
      this.requestQueue.push({ resolve, reject, timestamp: Date.now() })
      this.processTokenRefresh()
    })

    try {
      const token = await this.refreshPromise
      return token
    } finally {
      this.isRefreshing = false
      this.refreshPromise = null
    }
  }

  // 处理token刷新请求
  private async processTokenRefresh(): Promise<void> {
    let retries = 0

    while (retries < this.config.maxRetries) {
      try {
        const response = await this.fetchNewToken()

        if (response.success && response.token) {
          const token: CsrfToken = {
            value: response.token,
            expiresAt: response.expiresAt || Date.now() + this.config.refreshInterval,
            signature: this.generateSignature(response.token)
          }

          this.currentToken = token
          this.saveToken(token)

          // 解析所有等待的请求
          this.requestQueue.forEach(({ resolve }) => {
            resolve(token.value)
          })
          this.requestQueue = []

          // 触发token刷新事件
          window.dispatchEvent(new CustomEvent('tf2025:csrf:refreshed', {
            detail: { token: token.value, expiresAt: token.expiresAt }
          }))

          return
        } else {
          throw new Error(response.error || '获取CSRF token失败')
        }
      } catch (error) {
        retries++
        logger.warn(`CSRF token刷新失败 (尝试 ${retries}/${this.config.maxRetries}):`, error)

        if (retries >= this.config.maxRetries) {
          // 拒绝所有等待的请求
          this.requestQueue.forEach(({ reject }) => {
            reject(error instanceof Error ? error : new Error('CSRF token刷新失败'))
          })
          this.requestQueue = []

          // 触发token错误事件
          window.dispatchEvent(new CustomEvent('tf2025:csrf:error', {
            detail: { error: error instanceof Error ? error.message : '未知错误' }
          }))

          return
        }

        // 指数退避重试
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000))
      }
    }
  }

  // 从服务器获取新的CSRF token
  private async fetchNewToken(): Promise<CsrfResponse> {
    const response = await fetch('/api/csrf-token', {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return response.json()
  }

  // 生成token签名
  private generateSignature(token: string): string {
    // 简单的签名生成（实际项目中应该使用更安全的方法）
    const data = `${token}:${Date.now()}:${window.location.origin}`
    let hash = 0
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // 转换为32位整数
    }
    return Math.abs(hash).toString(36)
  }

  // 验证请求是否需要CSRF防护
  public shouldProtectRequest(url: string, method: string): boolean {
    // 检查方法是否被排除
    if (this.config.excludedMethods.includes(method.toUpperCase())) {
      return false
    }

    // 检查URL是否匹配启用端点
    return this.config.enabledEndpoints.some(endpoint =>
      url.startsWith(endpoint)
    )
  }

  // 为请求添加CSRF防护
  public async addProtectionToRequest(
    url: string,
    method: string,
    headers: Record<string, string> = {}
  ): Promise<Record<string, string>> {
    if (!this.shouldProtectRequest(url, method)) {
      return headers
    }

    try {
      const token = await this.getToken()
      headers[this.config.tokenHeaderName] = token
      headers['X-Requested-With'] = 'XMLHttpRequest' // 防止CSRF的额外保护
    } catch (error) {
      logger.error('获取CSRF token失败:', error)
      throw new Error('CSRF protection failed: Unable to obtain valid token')
    }

    return headers
  }

  // 启动自动刷新
  private startAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer)
    }

    this.refreshTimer = window.setInterval(() => {
      if (this.currentToken) {
        const timeUntilExpiry = this.currentToken.expiresAt - Date.now()
        const refreshTime = this.config.refreshInterval * 0.8 // 在80%的时间时刷新

        if (timeUntilExpiry <= refreshTime) {
          this.refreshToken().catch(error => {
            logger.warn('自动刷新CSRF token失败:', error)
          })
        }
      }
    }, 60000) // 每分钟检查一次
  }

  // 停止自动刷新
  private stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer)
      this.refreshTimer = undefined
    }
  }

  // 处理页面可见性变化
  private handleVisibilityChange(): void {
    if (document.visibilityState === 'visible') {
      // 页面重新可见时，检查并刷新token
      if (!this.currentToken || !this.isTokenValid(this.currentToken)) {
        this.refreshToken().catch(error => {
          logger.warn('页面可见时刷新CSRF token失败:', error)
        })
      }
    }
  }

  // 处理存储变化（多标签页同步）
  private handleStorageChange(event: StorageEvent): void {
    if (event.key === this.config.localStorageKey && event.newValue) {
      try {
        const tokenData: CsrfToken = JSON.parse(event.newValue)
        if (this.isTokenValid(tokenData) &&
            (!this.currentToken || tokenData.expiresAt > this.currentToken.expiresAt)) {
          this.currentToken = tokenData

          window.dispatchEvent(new CustomEvent('tf2025:csrf:synced', {
            detail: { token: tokenData.value, expiresAt: tokenData.expiresAt }
          }))
        }
      } catch (error) {
        logger.warn('同步CSRF token失败:', error)
      }
    }
  }

  // 清除当前token
  public clearToken(): void {
    this.currentToken = null
    storage.remove(this.config.localStorageKey, 'local')

    window.dispatchEvent(new CustomEvent('tf2025:csrf:cleared'))
  }

  // 手动设置token（用于测试或特殊情况）
  public setToken(token: string, expiresAt?: number): void {
    this.currentToken = {
      value: token,
      expiresAt: expiresAt || Date.now() + this.config.refreshInterval,
      signature: this.generateSignature(token)
    }
    this.saveToken(this.currentToken)
  }

  // 获取当前token信息
  public getTokenInfo(): { hasToken: boolean; expiresAt?: number; isExpired: boolean } {
    if (!this.currentToken) {
      return { hasToken: false, isExpired: true }
    }

    return {
      hasToken: true,
      expiresAt: this.currentToken.expiresAt,
      isExpired: !this.isTokenValid(this.currentToken)
    }
  }

  // 销毁CSRF管理器
  public destroy(): void {
    this.stopAutoRefresh()
    this.clearToken()
    document.removeEventListener('visibilitychange', this.handleVisibilityChange)
    window.removeEventListener('storage', this.handleStorageChange)
  }
}

// ============ CSRF Composable ============
export function useCsrfProtection(config?: Partial<CsrfConfig>) {
  const csrfManager = new CsrfProtectionManager(config)
  const tokenInfo = ref(csrfManager.getTokenInfo())

  // 监听CSRF相关事件
  const setupEventListeners = () => {
    window.addEventListener('tf2025:csrf:refreshed', (event: any) => {
      tokenInfo.value = {
        hasToken: true,
        expiresAt: event.detail.expiresAt,
        isExpired: false
      }
    })

    window.addEventListener('tf2025:csrf:error', () => {
      tokenInfo.value = { hasToken: false, isExpired: true }
    })

    window.addEventListener('tf2025:csrf:cleared', () => {
      tokenInfo.value = { hasToken: false, isExpired: true }
    })

    window.addEventListener('tf2025:csrf:synced', (event: any) => {
      tokenInfo.value = {
        hasToken: true,
        expiresAt: event.detail.expiresAt,
        isExpired: false
      }
    })
  }

  setupEventListeners()

  // 获取token
  const getToken = () => csrfManager.getToken()

  // 刷新token
  const refreshToken = () => csrfManager.refreshToken()

  // 为请求添加保护
  const protectRequest = async (url: string, method: string, headers?: Record<string, string>) => {
    return csrfManager.addProtectionToRequest(url, method, headers)
  }

  // 清除token
  const clearToken = () => {
    csrfManager.clearToken()
    tokenInfo.value = { hasToken: false, isExpired: true }
  }

  return {
    tokenInfo,
    getToken,
    refreshToken,
    protectRequest,
    clearToken,
    manager: csrfManager
  }
}

// ============ 全局实例 ============
export const globalCsrfManager = new CsrfProtectionManager()

export default {
  CsrfProtectionManager,
  useCsrfProtection,
  globalCsrfManager
}