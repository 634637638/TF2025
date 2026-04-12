/**
 * Token 过期检测和自动刷新
 * 在 Token 即将过期前主动刷新，避免用户操作中断
 */

import { useAuthStore } from '@/stores/auth'
import { ElNotification } from 'element-plus'
import logger from '@/utils/logger'

// Token 过期检测配置
const TOKEN_CHECK_INTERVAL = 5 * 60 * 1000 // 每5分钟检查一次
const TOKEN_EXPIRY_WARNING = 10 * 60 * 1000 // Token 过期前10分钟提醒
const TOKEN_AUTO_REFRESH_THRESHOLD = 5 * 60 * 1000 // Token 过期前5分钟自动刷新

let checkTimer: NodeJS.Timeout | null = null
let hasShownWarning = false

/**
 * 解析 JWT Token 获取过期时间
 */
function parseTokenExpiry(token: string): number | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      return null
    }

    const payload = JSON.parse(atob(parts[1]))
    return payload.exp ? payload.exp * 1000 : null // 转换为毫秒
  } catch (error) {
    logger.warn('解析 Token 失败', error)
    return null
  }
}

/**
 * 检查 Token 是否即将过期
 */
function checkTokenExpiry() {
  const authStore = useAuthStore()

  if (!authStore.isAuthenticated || !authStore.token) {
    return
  }

  const expiryTime = parseTokenExpiry(authStore.token)
  if (!expiryTime) {
    logger.warn('无法解析 Token 过期时间')
    return
  }

  const now = Date.now()
  const timeUntilExpiry = expiryTime - now

  // Token 已过期
  if (timeUntilExpiry <= 0) {
    handleTokenExpired()
    return
  }

  // Token 即将过期（5分钟内），自动刷新
  if (timeUntilExpiry <= TOKEN_AUTO_REFRESH_THRESHOLD) {
    refreshToken()
    return
  }

  // Token 即将过期（10分钟内），显示提醒
  if (timeUntilExpiry <= TOKEN_EXPIRY_WARNING && !hasShownWarning) {
    const minutes = Math.floor(timeUntilExpiry / 1000 / 60)
    showExpiryWarning(minutes)
    hasShownWarning = true
  }
}

/**
 * 显示 Token 即将过期的提醒
 */
function showExpiryWarning(minutes: number) {
  ElNotification({
    title: '登录即将过期',
    message: `您的登录将在 ${minutes} 分钟后过期，请注意保存数据`,
    type: 'warning',
    duration: 8000,
    position: 'top-right'
  })
}

/**
 * 刷新 Token
 */
async function refreshToken() {
  const authStore = useAuthStore()

  try {
    await authStore.refreshAuth()
    hasShownWarning = false // 重置警告标志

    ElNotification({
      title: '登录已续期',
      message: '您的登录已自动续期',
      type: 'success',
      duration: 3000,
      position: 'top-right'
    })
  } catch (error) {
    logger.error('Token 刷新失败', error)
    handleTokenExpired()
  }
}

/**
 * 处理 Token 过期
 */
function handleTokenExpired() {
  const authStore = useAuthStore()

  ElNotification({
    title: '登录已过期',
    message: '您的登录已过期，请重新登录',
    type: 'error',
    duration: 5000,
    position: 'top-right'
  })

  // 清除认证数据
  authStore.logout()

  // 延迟跳转，让用户看到提示
  setTimeout(() => {
    window.location.href = '/login'
  }, 2000)
}

/**
 * 启动 Token 过期检测
 */
export function startTokenExpiryCheck() {
  if (checkTimer) {
    return
  }

  // 立即检查一次
  checkTokenExpiry()

  // 定期检查
  checkTimer = setInterval(() => {
    checkTokenExpiry()
  }, TOKEN_CHECK_INTERVAL)
}

/**
 * 停止 Token 过期检测
 */
export function stopTokenExpiryCheck() {
  if (checkTimer) {
    clearInterval(checkTimer)
    checkTimer = null
    hasShownWarning = false
  }
}

/**
 * 重置警告标志（用于 Token 刷新后）
 */
export function resetExpiryWarning() {
  hasShownWarning = false
}
