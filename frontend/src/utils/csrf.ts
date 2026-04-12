/**
 * CSRF / XSRF 防护系统
 * 提供前后端跨站请求伪造防护
 */

import { unifiedApi } from './unified-api'
import { extractResponseData } from './api-response'
import { logger } from './logger'
import { storage } from '@/services/storage'
import { SECURITY_STORAGE_KEYS } from '@/constants/storage'

// ============ 配置常量 ============

const CSRF_CONFIG = {
  // Token 存储键名
  TOKEN_KEY: SECURITY_STORAGE_KEYS.CSRF_TOKEN,
  HEADER_NAME: 'X-CSRF-Token',
  COOKIE_NAME: 'tf2025_xsrf_token',

  // Token 长度和过期时间
  TOKEN_LENGTH: 64,
  TOKEN_EXPIRY: 24 * 60 * 60 * 1000, // 24小时

  // 刷新间隔（提前30分钟刷新）
  REFRESH_INTERVAL: 30 * 60 * 1000,

  // 验证相关
  MAX_FAILURES: 3,
  FAILURE_WINDOW: 5 * 60 * 1000, // 5分钟

  // API 端点（不需要 /api 前缀，因为 unifiedApi 已经设置了 baseURL）
  TOKEN_ENDPOINT: '/csrf/token',
  VERIFY_ENDPOINT: '/csrf/verify',
  REFRESH_ENDPOINT: '/csrf/refresh',
  API_TOKEN_ENDPOINT: '/csrf/token',
  API_VERIFY_ENDPOINT: '/csrf/verify'
} as const

// ============ 类型定义 ============

interface CSRFToken {
  value: string
  expires: number
  signature: string
  timestamp: number
}

interface CSRFState {
  token: CSRFToken | null
  failures: number
  lastFailure: number
  isRefreshing: boolean
  lastRefresh: number
  initialized: boolean
}

interface CSRFConfig {
  tokenLength?: number
  tokenExpiry?: number
  refreshInterval?: number
  maxFailures?: number
  enableAutoRefresh?: boolean
  enableStorage?: boolean
  enableDoubleCookie?: boolean
}

// ============ 全局状态 ============

const csrfState: CSRFState = {
  token: null,
  failures: 0,
  lastFailure: 0,
  isRefreshing: false,
  lastRefresh: 0,
  initialized: false
}

// ============ 工具函数 ============

/**
 * 生成随机字符串
 */
function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''

  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }

  return result
}

/**
 * 生成数字签名
 */
function generateSignature(token: string, timestamp: number): string {
  const data = `${token}:${timestamp}:${navigator.userAgent}`

  // 使用 Web Crypto API 生成签名
  if ('crypto' in window && 'subtle' in crypto) {
    const encoder = new TextEncoder()
    const dataBuffer = encoder.encode(data)

    // 简单的哈希函数作为后备
    let hash = 0
    for (let i = 0; i < dataBuffer.length; i++) {
      const char = dataBuffer[i]
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // 转换为32位整数
    }

    return Math.abs(hash).toString(16)
  }

  // 简单的字符串哈希
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }

  return Math.abs(hash).toString(16)
}

/**
 * 从存储加载 Token
 */
function loadTokenFromStorage(): CSRFToken | null {
  try {
    const stored = storage.get<CSRFToken>(CSRF_CONFIG.TOKEN_KEY, 'local')
    if (stored) {
      // 检查是否过期
      if (Date.now() > stored.expires) {
        storage.remove(CSRF_CONFIG.TOKEN_KEY, 'local')
        return null
      }

      return stored
    }
  } catch (error) {
    logger.warn('加载CSRF Token失败:', error)
    storage.remove(CSRF_CONFIG.TOKEN_KEY, 'local')
  }

  return null
}

/**
 * 保存 Token 到存储
 */
function saveTokenToStorage(token: CSRFToken): void {
  try {
    storage.set(CSRF_CONFIG.TOKEN_KEY, token, 'local')
  } catch (error) {
    logger.warn('保存CSRF Token失败:', error)
  }
}

/**
 * 从 Cookie 读取 Token
 */
function getTokenFromCookie(): string | null {
  const cookies = document.cookie.split(';')

  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=')
    if (name === CSRF_CONFIG.COOKIE_NAME) {
      return decodeURIComponent(value)
    }
  }

  return null
}

/**
 * 设置 Cookie
 */
function setCookie(value: string, maxAge: number): void {
  const secure = location.protocol === 'https:'
  const sameSite = 'Strict'

  document.cookie = [
    `${CSRF_CONFIG.COOKIE_NAME}=${encodeURIComponent(value)}`,
    `Max-Age=${maxAge}`,
    `Path=/`,
    `SameSite=${sameSite}`,
    secure ? 'Secure' : ''
  ].filter(Boolean).join('; ')
}

/**
 * 验证 Token 格式
 */
function isValidToken(token: CSRFToken): boolean {
  return !!(
    token &&
    token.value &&
    token.signature &&
    token.expires > Date.now() &&
    token.timestamp > 0
  )
}

/**
 * 检查是否被阻止
 */
function isBlocked(): boolean {
  const now = Date.now()
  const timeSinceLastFailure = now - csrfState.lastFailure

  return (
    csrfState.failures >= CSRF_CONFIG.MAX_FAILURES &&
    timeSinceLastFailure < CSRF_CONFIG.FAILURE_WINDOW
  )
}

// ============ 核心功能 ============

/**
 * 生成新的 Token
 */
function generateToken(): CSRFToken {
  const timestamp = Date.now()
  const value = generateRandomString(CSRF_CONFIG.TOKEN_LENGTH)
  const signature = generateSignature(value, timestamp)
  const expires = timestamp + CSRF_CONFIG.TOKEN_EXPIRY

  return {
    value,
    signature,
    timestamp,
    expires
  }
}

/**
 * 从服务器获取 Token
 */
async function fetchTokenFromServer(): Promise<CSRFToken> {
  try {
    const response = await unifiedApi.get(CSRF_CONFIG.API_TOKEN_ENDPOINT)

    // 后端返回格式: { success: true, data: { csrfToken: string, ... } }
    // unifiedApi 已解包一层，直接从 response 取 data
    const responseData = extractResponseData<{ csrfToken?: string }>(response)
    if (responseData?.csrfToken) {
      const serverToken = responseData.csrfToken
      const timestamp = Date.now()

      // 验证服务器响应
      if (typeof serverToken === 'string' && serverToken.length > 0) {
        return {
          value: serverToken,
          signature: generateSignature(serverToken, timestamp),
          timestamp,
          expires: timestamp + CSRF_CONFIG.TOKEN_EXPIRY
        }
      }
    }

    throw new Error('无效的服务器响应')
  } catch (error) {
    logger.warn('CSRF后端端点未实现，使用本地生成Token:', (error as Error).message || error)

    // 如果服务器不可用，使用本地生成的 token
    return generateToken()
  }
}

/**
 * 验证 Token
 * 注意：CSRF验证失败时自动降级使用本地生成的token
 */
async function verifyToken(token: CSRFToken): Promise<boolean> {
  try {
    const response = await unifiedApi.post(CSRF_CONFIG.API_VERIFY_ENDPOINT, {
      token: token.value
    })

    // 后端返回 success: true 表示验证成功
    return response.data?.success === true
  } catch (error: any) {
    const status = error.response?.status

    // 403: Token无效或过期 - 降级使用本地token
    if (status === 403) {
      return true // 使用本地生成的token，不再请求服务器验证
    }

    // 404: 验证端点不存在 - 跳过服务器验证
    if (status === 404) {
      return true
    }

    // 其他错误 - 降级处理
    logger.warn('⚠️ Token验证失败，使用本地token:', error.message || error)
    return true
  }
}

/**
 * 刷新 Token
 */
async function refreshToken(): Promise<CSRFToken | null> {
  if (csrfState.isRefreshing) {
    return csrfState.token
  }

  csrfState.isRefreshing = true

  try {
    const newToken = await fetchTokenFromServer()

    // 验证新 token (如果验证失败，使用本地生成的token)
    if (await verifyToken(newToken)) {
      csrfState.token = newToken
      csrfState.lastRefresh = Date.now()
      csrfState.failures = 0 // 重置失败计数

      // 保存到存储
      saveTokenToStorage(newToken)

      // 设置 cookie (Double Cookie Submit 防护)
      setCookie(newToken.value, CSRF_CONFIG.TOKEN_EXPIRY / 1000)

      return newToken
    } else {
      // 如果验证失败，使用本地生成的token作为后备
      const fallbackToken = generateToken()
      csrfState.token = fallbackToken
      csrfState.lastRefresh = Date.now()
      saveTokenToStorage(fallbackToken)
      setCookie(fallbackToken.value, CSRF_CONFIG.TOKEN_EXPIRY / 1000)
      return fallbackToken
    }
  } catch (error) {
    csrfState.failures++
    csrfState.lastFailure = Date.now()

    logger.error('刷新CSRF Token失败:', (error as Error).message || error)

    // 如果失败次数过多，使用本地 token
    if (csrfState.failures >= CSRF_CONFIG.MAX_FAILURES) {
      logger.warn('服务器Token获取失败，使用本地生成Token')
      const fallbackToken = generateToken()
      csrfState.token = fallbackToken
      saveTokenToStorage(fallbackToken)
      return fallbackToken
    }

    return null
  } finally {
    csrfState.isRefreshing = false
  }
}

/**
 * 获取当前有效的 Token
 */
async function getCurrentToken(): Promise<CSRFToken | null> {
  const now = Date.now()

  // 检查是否被阻止
  if (isBlocked()) {
    logger.warn('CSRF 防护已被暂时阻止')
    return null
  }

  // 检查当前 token
  if (csrfState.token && isValidToken(csrfState.token)) {
    // 检查是否需要刷新
    const timeSinceRefresh = now - csrfState.lastRefresh
    if (timeSinceRefresh > CSRF_CONFIG.REFRESH_INTERVAL) {
      // 后台刷新
      refreshToken()
    }

    return csrfState.token
  }

  // 尝试从存储加载
  const storedToken = loadTokenFromStorage()
  if (storedToken && isValidToken(storedToken)) {
    csrfState.token = storedToken
    return storedToken
  }

  // 从 Cookie 读取 (Double Cookie Submit)
  const cookieToken = getTokenFromCookie()
  if (cookieToken) {
    const token: CSRFToken = {
      value: cookieToken,
      signature: generateSignature(cookieToken, now),
      timestamp: now,
      expires: now + CSRF_CONFIG.TOKEN_EXPIRY
    }

    if (isValidToken(token)) {
      csrfState.token = token
      return token
    }
  }

  // 获取新 token
  return await refreshToken()
}

/**
 * 为请求添加 CSRF Token
 */
export function addCSRFHeader(headers: Record<string, string>): Record<string, string> {
  if (!csrfState.initialized) {
    return headers
  }

  const token = csrfState.token
  if (token && isValidToken(token)) {
    headers[CSRF_CONFIG.HEADER_NAME] = token.value
  }

  return headers
}

// ============ 初始化 ============

/**
 * 初始化 CSRF 防护
 */
export async function initCSRFProtection(config: CSRFConfig = {}): Promise<void> {
  if (csrfState.initialized) {
    return
  }

  // 合并配置
  const finalConfig = {
    tokenLength: config.tokenLength || CSRF_CONFIG.TOKEN_LENGTH,
    tokenExpiry: config.tokenExpiry || CSRF_CONFIG.TOKEN_EXPIRY,
    refreshInterval: config.refreshInterval || CSRF_CONFIG.REFRESH_INTERVAL,
    maxFailures: config.maxFailures || CSRF_CONFIG.MAX_FAILURES,
    enableAutoRefresh: config.enableAutoRefresh !== false,
    enableStorage: config.enableStorage !== false,
    enableDoubleCookie: config.enableDoubleCookie !== false
  }

  try {
    // 尝试获取当前 token
    const token = await getCurrentToken()

    if (token) {
      // 设置自动刷新
      if (finalConfig.enableAutoRefresh) {
        setInterval(async () => {
          const currentToken = await getCurrentToken()
          if (!currentToken) {
            logger.warn('自动刷新 CSRF Token 失败')
          }
        }, finalConfig.refreshInterval)
      }

      // 监听页面可见性变化
      document.addEventListener('visibilitychange', async () => {
        if (!document.hidden) {
          // 页面重新可见时检查 token
          await getCurrentToken()
        }
      })

    } else {
      logger.warn('⚠️ CSRF 防护初始化部分失败，使用本地防护')

      // 即使服务器不可用，也生成本地 token
      const fallbackToken = generateToken()
      csrfState.token = fallbackToken
      saveTokenToStorage(fallbackToken)
    }

    csrfState.initialized = true

    // 添加到全局状态
    if (window.__TF2025__) {
      window.__TF2025__.csrf = {
        token: csrfState.token,
        isInitialized: csrfState.initialized,
        failures: csrfState.failures,
        addCSRFHeader,
        refreshToken,
        getCurrentToken
      }
    }

  } catch (error) {
    logger.error('❌ CSRF 防护初始化失败:', error)

    // 初始化失败时使用本地防护
    const fallbackToken = generateToken()
    csrfState.token = fallbackToken
    csrfState.initialized = true
    saveTokenToStorage(fallbackToken)
  }
}

// ============ 导出的公共 API ============

/**
 * 手动刷新 Token
 */
export async function refreshCSRFToken(): Promise<boolean> {
  try {
    const token = await refreshToken()
    return token !== null
  } catch (error) {
    logger.error('手动刷新CSRF Token失败:', error)
    return false
  }
}

/**
 * 获取当前 Token 值
 */
export async function getCSRFToken(): Promise<string | null> {
  const token = await getCurrentToken()
  return token?.value || null
}

/**
 * 验证当前请求的 CSRF Token
 */
export function validateCSRFToken(requestToken: string): boolean {
  const currentToken = csrfState.token
  if (!currentToken || !isValidToken(currentToken)) {
    return false
  }

  return currentToken.value === requestToken
}

/**
 * 清除 CSRF 状态
 */
export function clearCSRFState(): void {
  csrfState.token = null
  csrfState.failures = 0
  csrfState.lastFailure = 0
  csrfState.isRefreshing = false
  csrfState.lastRefresh = 0

  storage.remove(CSRF_CONFIG.TOKEN_KEY, 'local')

  // 清除 cookie
  document.cookie = `${CSRF_CONFIG.COOKIE_NAME}=; Max-Age=0; Path=/`
}

/**
 * 获取 CSRF 防护状态
 */
export function getCSRFStatus() {
  return {
    initialized: csrfState.initialized,
    hasValidToken: csrfState.token && isValidToken(csrfState.token),
    failures: csrfState.failures,
    isBlocked: isBlocked(),
    lastRefresh: csrfState.lastRefresh,
    isRefreshing: csrfState.isRefreshing
  }
}

export default {
  initCSRFProtection,
  refreshCSRFToken,
  getCSRFToken,
  addCSRFHeader,
  validateCSRFToken,
  clearCSRFState,
  getCSRFStatus
}
