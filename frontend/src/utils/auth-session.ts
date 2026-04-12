/**
 * 认证会话管理工具
 * 统一管理认证相关的存储操作
 */

import { AUTH_STORAGE_KEYS } from '@/constants/storage'
import { storage } from '@/services/storage'

export const BACKEND_DISCONNECT_GRACE_MS = 60 * 1000

interface ClearAuthOptions {
  notifyOtherWindows?: boolean
  clearDisconnectState?: boolean
}

/**
 * 清除持久化认证数据
 */
export const clearPersistedAuthData = (options: ClearAuthOptions = {}): void => {
  const {
    notifyOtherWindows = true,
    clearDisconnectState = true
  } = options

  ;(window as any).__TF2025__GLOBAL_CLEAR__ = true

  // 清除 sessionStorage 中的认证数据
  storage.remove(AUTH_STORAGE_KEYS.AUTH, 'session')
  storage.remove(AUTH_STORAGE_KEYS.TOKEN, 'session')

  if (clearDisconnectState) {
    storage.remove(AUTH_STORAGE_KEYS.BACKEND_DISCONNECTED, 'session')
    storage.remove(AUTH_STORAGE_KEYS.BACKEND_DISCONNECT_TIME, 'session')
    storage.remove(AUTH_STORAGE_KEYS.DISCONNECT_NOTIFIED, 'session')
  }

  // 清除 cookie
  document.cookie = 'tf2025_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'

  // 清除 localStorage 中的备份数据（向后兼容）
  storage.remove(AUTH_STORAGE_KEYS.AUTH, 'local')
  storage.remove(AUTH_STORAGE_KEYS.AUTH_BACKUP, 'local')
  storage.remove(AUTH_STORAGE_KEYS.TOKEN_BACKUP, 'local')
  storage.remove(AUTH_STORAGE_KEYS.TIMED_BACKUP, 'local')

  if (notifyOtherWindows) {
    storage.set(AUTH_STORAGE_KEYS.LOGOUT_EVENT, Date.now().toString(), 'session')
  }

  ;(window as any).__TF2025__GLOBAL_CLEAR__ = false
}

/**
 * 设置后端断开状态
 */
export const setBackendDisconnectedState = (disconnected: boolean): void => {
  if (disconnected) {
    storage.set(AUTH_STORAGE_KEYS.BACKEND_DISCONNECTED, 'true', 'session')
    storage.set(AUTH_STORAGE_KEYS.BACKEND_DISCONNECT_TIME, Date.now().toString(), 'session')
    return
  }

  storage.remove(AUTH_STORAGE_KEYS.BACKEND_DISCONNECTED, 'session')
  storage.remove(AUTH_STORAGE_KEYS.BACKEND_DISCONNECT_TIME, 'session')
  storage.remove(AUTH_STORAGE_KEYS.DISCONNECT_NOTIFIED, 'session')
}

/**
 * 获取后端断开信息
 */
export const getBackendDisconnectInfo = () => {
  const disconnected = storage.get<string>(AUTH_STORAGE_KEYS.BACKEND_DISCONNECTED, 'session') === 'true'
  const rawTime = storage.get<string>(AUTH_STORAGE_KEYS.BACKEND_DISCONNECT_TIME, 'session')
  const disconnectedAt = rawTime ? parseInt(rawTime, 10) : 0
  const elapsed = disconnectedAt ? Date.now() - disconnectedAt : 0

  return {
    disconnected,
    disconnectedAt,
    elapsed,
    graceExceeded: disconnected && disconnectedAt > 0 && elapsed >= BACKEND_DISCONNECT_GRACE_MS
  }
}
