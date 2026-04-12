/**
 * 认证数据保护脚本（简化版）
 * 防止认证数据被意外清除或修改
 */

// 验证token格式
const isValidTokenFormat = (token) => {
  if (!token || typeof token !== 'string') return false
  const parts = token.split('.')
  return parts.length === 3 && parts.every(part => part.length > 0)
}

// 保护localStorage的关键项
const PROTECTED_KEYS = [
  'tf2025_auth',
  'tf2025_auth_backup',
  'tf2025_token_backup'
]

// 保护sessionStorage的关键项
const SESSION_PROTECTED_KEYS = [
  'tf2025_token'
]

// 导入 logger
import { logger } from '@/utils/logger'

// 创建存储保护层
export const createStorageProtection = () => {
  if (typeof window === 'undefined') return

  // 保存原始方法
  const originalSetItem = localStorage.setItem
  const originalRemoveItem = localStorage.removeItem
  const originalClear = localStorage.clear

  const originalSessionSetItem = sessionStorage.setItem
  const originalSessionRemoveItem = sessionStorage.removeItem
  const originalSessionClear = sessionStorage.clear

  // localStorage保护
  localStorage.setItem = function(key, value) {
    // 如果是保护的关键项，记录操作
    if (PROTECTED_KEYS.includes(key)) {
      // 静默保护，避免日志干扰

      // 验证数据
      if (key === 'tf2025_auth') {
        try {
          const parsed = JSON.parse(value)
          if (!parsed.token || !parsed.user) {
            logger.warn('⚠️ 拒绝保存无效的认证数据')
            return
          }
        } catch (e) {
          logger.warn('⚠️ 拒绝保存格式错误的认证数据')
          return
        }
      }
    }

    return originalSetItem.apply(this, arguments)
  }

  localStorage.removeItem = function(key) {
    // 防止清除受保护的项，但允许在全局清除事件中清除
    if (PROTECTED_KEYS.includes(key) && !window.__TF2025__GLOBAL_CLEAR__) {
      logger.warn(`🔒 localStorage保护: 阻止删除 ${key}`)
      return
    }

    return originalRemoveItem.apply(this, arguments)
  }

  localStorage.clear = function() {
    // 检查是否有需要保护的认证数据
    const hasProtectedData = PROTECTED_KEYS.some(key => localStorage.getItem(key))

    if (hasProtectedData) {
      logger.warn('🔒 localStorage保护: 阻止清空存储（存在认证数据）')
      return
    }

    return originalClear.apply(this, arguments)
  }

  // sessionStorage保护
  sessionStorage.setItem = function(key, value) {
    if (SESSION_PROTECTED_KEYS.includes(key) && key === 'tf2025_token') {
      // 验证token格式
      if (!isValidTokenFormat(value)) {
        logger.warn('⚠️ 拒绝保存格式无效的token')
        return
      }
    }

    return originalSessionSetItem.apply(this, arguments)
  }

  sessionStorage.removeItem = function(key) {
    if (SESSION_PROTECTED_KEYS.includes(key) && !window.__TF2025__GLOBAL_CLEAR__) {
      logger.warn(`🔒 sessionStorage保护: 阻止删除 ${key}`)
      return
    }

    return originalSessionRemoveItem.apply(this, arguments)
  }

  sessionStorage.clear = function() {
    const hasProtectedData = SESSION_PROTECTED_KEYS.some(key => sessionStorage.getItem(key))

    if (hasProtectedData) {
      logger.warn('🔒 sessionStorage保护: 阻止清空存储（存在token）')
      return
    }

    return originalSessionClear.apply(this, arguments)
  }

  }

// 创建定时备份机制
export const createBackupMechanism = () => {
  if (typeof window === 'undefined') return

  // 每30秒备份一次认证数据
  setInterval(() => {
    const token = sessionStorage.getItem('tf2025_token')
    const auth = localStorage.getItem('tf2025_auth')

    if (token && auth) {
      // 创建带时间戳的备份
      const backup = {
        token,
        auth,
        timestamp: Date.now()
      }
      localStorage.setItem('tf2025_auth_timed_backup', JSON.stringify(backup))
    }
  }, 30000)

  }

// 创建页面可见性保护
export const createVisibilityProtection = () => {
  if (typeof window === 'undefined') return

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      // 页面变为可见时检查认证数据
      const token = sessionStorage.getItem('tf2025_token')
      const auth = localStorage.getItem('tf2025_auth')

      if (!token && auth) {
        try {
          const authData = JSON.parse(auth)
          if (authData.token && isValidTokenFormat(authData.token)) {
            sessionStorage.setItem('tf2025_token', authData.token)
          }
        } catch (e) {
          logger.error('❌ token恢复失败:', e)
        }
      }
    }
  })

  }

// 初始化所有保护机制
export const initAuthProtection = () => {
  createStorageProtection()
  createBackupMechanism()
  createVisibilityProtection()
}

// 默认导出初始化函数
export default initAuthProtection