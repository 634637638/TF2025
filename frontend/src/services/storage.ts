/**
 * 统一存储服务
 * 提供类型安全的存储操作，统一管理 localStorage 和 sessionStorage
 */

import { AUTH_STORAGE_KEYS, H5_STORAGE_KEYS, PREFERENCE_STORAGE_KEYS, SECURITY_STORAGE_KEYS, CACHE_STORAGE_KEYS, ROUTER_STORAGE_KEYS, SESSION_STORAGE_KEYS, type StorageKey } from '@/constants/storage'
import logger from '@/utils/logger'

/**
 * 存储类型
 */
export type StorageType = 'local' | 'session'

/**
 * 存储配置
 */
interface StorageConfig {
  /** 是否加密存储 */
  encrypt?: boolean
  /** 过期时间（毫秒） */
  ttl?: number
  /** 是否在控制台输出调试信息 */
  debug?: boolean
}

/**
 * 存储数据结构
 */
interface StorageData<T> {
  value: T
  timestamp: number
  ttl?: number
}

/**
 * 统一存储服务类
 */
class UnifiedStorageService {
  private prefix = 'tf2025_'
  private debug = false

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
  }

  /**
   * 设置调试模式
   */
  setDebug(enabled: boolean): void {
    this.debug = enabled
  }

  /**
   * 获取存储实例
   */
  private getStorage(type: StorageType): Storage {
    return type === 'session' ? sessionStorage : localStorage
  }

  /**
   * 序列化值
   */
  private serialize<T>(value: T, config?: StorageConfig): string {
    const data: StorageData<T> = {
      value,
      timestamp: Date.now(),
      ttl: config?.ttl
    }
    return JSON.stringify(data)
  }

  /**
   * 反序列化值
   */
  private deserialize<T>(raw: string | null, config?: StorageConfig): T | null {
    if (!raw) return null

    try {
      const data: StorageData<T> = JSON.parse(raw)

      // 检查是否过期
      if (data.ttl && data.timestamp) {
        const now = Date.now()
        if (now - data.timestamp > data.ttl) {
          return null
        }
      }

      return data.value
    } catch {
      // 尝试直接解析（兼容旧格式）
      try {
        return JSON.parse(raw) as T
      } catch {
        return raw as unknown as T
      }
    }
  }

  // ==================== 基础方法 ====================

  /**
   * 设置值
   */
  set<T>(key: StorageKey | string, value: T, type: StorageType = 'local', config?: StorageConfig): void {
    try {
      const storage = this.getStorage(type)
      const serialized = this.serialize(value, config)
      storage.setItem(key, serialized)

      if (this.debug) {
        logger.debug(`[Storage] SET ${type}:${key}`)
      }
    } catch (error) {
      logger.error(`[Storage] 设置失败: ${key} - ${this.getErrorMessage(error)}`)
    }
  }

  /**
   * 获取值
   */
  get<T>(key: StorageKey | string, type: StorageType = 'local', defaultValue?: T): T | null {
    try {
      const storage = this.getStorage(type)
      const raw = storage.getItem(key)
      const value = this.deserialize<T>(raw)

      if (this.debug) {
        logger.debug(`[Storage] GET ${type}:${key}`)
      }

      return value ?? defaultValue ?? null
    } catch (error) {
      logger.error(`[Storage] 获取失败: ${key} - ${this.getErrorMessage(error)}`)
      return defaultValue ?? null
    }
  }

  /**
   * 删除值
   */
  remove(key: StorageKey | string, type: StorageType = 'local'): void {
    try {
      const storage = this.getStorage(type)
      storage.removeItem(key)

      if (this.debug) {
        logger.debug(`[Storage] REMOVE ${type}:${key}`)
      }
    } catch (error) {
      logger.error(`[Storage] 删除失败: ${key} - ${this.getErrorMessage(error)}`)
    }
  }

  /**
   * 检查键是否存在
   */
  has(key: StorageKey | string, type: StorageType = 'local'): boolean {
    const storage = this.getStorage(type)
    return storage.getItem(key) !== null
  }

  /**
   * 清空指定类型的所有存储
   */
  clear(type: StorageType = 'local'): void {
    try {
      const storage = this.getStorage(type)
      // 只清除带有前缀的键
      const keysToRemove: string[] = []
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i)
        if (key?.startsWith(this.prefix) || key?.startsWith('h5_') || key?.startsWith('screen') || key?.startsWith('theme') || key?.startsWith('user_') || key?.startsWith('iconPicker_') || key?.startsWith('checkout_') || key?.startsWith('order_')) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach(key => storage.removeItem(key))

      if (this.debug) {
        logger.debug(`[Storage] CLEAR ${type}: ${keysToRemove.length} items`)
      }
    } catch (error) {
      logger.error(`[Storage] 清空失败 - ${this.getErrorMessage(error)}`)
    }
  }

  // ==================== 认证相关（仅 sessionStorage）====================
  // 🔐 安全策略：认证数据仅存储在 sessionStorage，关闭浏览器后自动清除

  /**
   * 获取认证数据
   */
  getAuth<T = any>(): T | null {
    return this.get<T>(AUTH_STORAGE_KEYS.AUTH, 'session')
  }

  /**
   * 设置认证数据
   */
  setAuth<T = any>(data: T): void {
    this.set(AUTH_STORAGE_KEYS.AUTH, data, 'session')
  }

  /**
   * 获取令牌
   */
  getToken(): string | null {
    // 仅从 sessionStorage 获取
    return this.get<string>(AUTH_STORAGE_KEYS.TOKEN, 'session')
  }

  /**
   * 设置令牌
   */
  setToken(token: string): void {
    this.set(AUTH_STORAGE_KEYS.TOKEN, token, 'session')
  }

  /**
   * 清除所有认证数据
   */
  clearAuth(): void {
    // 清除 sessionStorage 中的认证数据
    this.remove(AUTH_STORAGE_KEYS.AUTH, 'session')
    this.remove(AUTH_STORAGE_KEYS.TOKEN, 'session')
    this.remove(AUTH_STORAGE_KEYS.DISCONNECT_NOTIFIED, 'session')
    this.remove(AUTH_STORAGE_KEYS.PERMISSIONS_LOADED, 'session')
    this.remove(ROUTER_STORAGE_KEYS.REDIRECT_COOLDOWN, 'session')

    // 清除 localStorage 中的认证数据（向后兼容）
    this.remove(AUTH_STORAGE_KEYS.AUTH, 'local')
    this.remove(AUTH_STORAGE_KEYS.AUTH_BACKUP, 'local')
    this.remove(AUTH_STORAGE_KEYS.TOKEN_BACKUP, 'local')
    this.remove(AUTH_STORAGE_KEYS.TIMED_BACKUP, 'local')
    this.remove(AUTH_STORAGE_KEYS.LOGOUT_EVENT, 'local')

    // 清除 cookie
    if (typeof document !== 'undefined') {
      document.cookie = 'tf2025_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
    }
  }

  /**
   * 备份认证数据（已禁用，仅保留接口兼容）
   * @deprecated 关闭浏览器后需重新登录，不再支持备份恢复
   */
  backupAuth(): void {
    // 已禁用，认证数据仅存 sessionStorage
  }

  /**
   * 恢复认证数据（已禁用）
   * @deprecated 关闭浏览器后需重新登录，不再支持恢复
   */
  restoreAuth(): { auth: any; token: string } | null {
    // 已禁用，返回 null
    return null
  }

  /**
   * 检查是否已认证
   */
  isAuthenticated(): boolean {
    return !!this.getToken()
  }

  // ==================== H5 移动端相关 ====================

  /**
   * H5: 获取购物车ID
   */
  getH5CartId(): string | null {
    return this.get<string>(H5_STORAGE_KEYS.CART_ID, 'local')
  }

  /**
   * H5: 设置购物车ID
   */
  setH5CartId(cartId: string): void {
    this.set(H5_STORAGE_KEYS.CART_ID, cartId, 'local')
  }

  /**
   * H5: 获取购物车数量
   */
  getH5CartCount(): number {
    const count = this.get<string>(H5_STORAGE_KEYS.CART_COUNT, 'local')
    return count ? parseInt(count, 10) : 0
  }

  /**
   * H5: 设置购物车数量
   */
  setH5CartCount(count: number): void {
    this.set(H5_STORAGE_KEYS.CART_COUNT, count.toString(), 'local')
  }

  /**
   * H5: 清除购物车相关数据
   */
  clearH5Cart(): void {
    this.remove(H5_STORAGE_KEYS.CART_ID, 'local')
    this.remove(H5_STORAGE_KEYS.CART_COUNT, 'local')
  }

  /**
   * H5: 获取认证令牌
   */
  getH5AuthToken(): string | null {
    return this.get<string>(H5_STORAGE_KEYS.AUTH_TOKEN, 'local')
  }

  /**
   * H5: 设置认证令牌
   */
  setH5AuthToken(token: string): void {
    this.set(H5_STORAGE_KEYS.AUTH_TOKEN, token, 'local')
  }

  /**
   * H5: 清除认证数据
   */
  clearH5Auth(): void {
    this.remove(H5_STORAGE_KEYS.AUTH_TOKEN, 'local')
    this.remove(H5_STORAGE_KEYS.AUTH_USER, 'local')
  }

  // ==================== 偏好设置相关 ====================

  /**
   * 获取用户偏好设置
   */
  getPreferences<T = any>(): T | null {
    return this.get<T>(PREFERENCE_STORAGE_KEYS.PREFERENCES, 'local')
  }

  /**
   * 设置用户偏好设置
   */
  setPreferences<T = any>(preferences: T): void {
    this.set(PREFERENCE_STORAGE_KEYS.PREFERENCES, preferences, 'local')
  }

  /**
   * 获取主题设置
   */
  getTheme(): { mode: string } | null {
    return this.get<{ mode: string }>(PREFERENCE_STORAGE_KEYS.THEME, 'local')
  }

  /**
   * 设置主题
   */
  setTheme(mode: string): void {
    this.set(PREFERENCE_STORAGE_KEYS.THEME, { mode }, 'local')
  }

  // ==================== 安全相关 ====================

  /**
   * 获取屏幕锁定状态
   */
  isScreenLocked(): boolean {
    return this.get<string>(SECURITY_STORAGE_KEYS.SCREEN_LOCKED, 'local') === 'true'
  }

  /**
   * 设置屏幕锁定状态
   */
  setScreenLocked(locked: boolean): void {
    if (locked) {
      this.set(SECURITY_STORAGE_KEYS.SCREEN_LOCKED, 'true', 'local')
      this.set(SECURITY_STORAGE_KEYS.SCREEN_LOCK_TIME, new Date().toISOString(), 'local')
    } else {
      this.remove(SECURITY_STORAGE_KEYS.SCREEN_LOCKED, 'local')
      this.remove(SECURITY_STORAGE_KEYS.SCREEN_LOCK_TIME, 'local')
    }
  }

  /**
   * 获取屏幕锁定设置
   */
  getScreenLockSettings<T = any>(): T | null {
    return this.get<T>(SECURITY_STORAGE_KEYS.SCREEN_LOCK_SETTINGS, 'local')
  }

  /**
   * 设置屏幕锁定设置
   */
  setScreenLockSettings<T = any>(settings: T): void {
    this.set(SECURITY_STORAGE_KEYS.SCREEN_LOCK_SETTINGS, settings, 'local')
  }

  // ==================== 缓存相关 ====================

  /**
   * 设置缓存（带过期时间）
   */
  setCache<T>(key: string, value: T, ttl?: number): void {
    this.set(key, value, 'local', { ttl })
  }

  /**
   * 获取缓存
   */
  getCache<T>(key: string): T | null {
    return this.get<T>(key, 'local')
  }

  /**
   * 清除所有缓存
   */
  clearCache(): void {
    this.remove(CACHE_STORAGE_KEYS.VISIT_HISTORY, 'local')
    this.remove(CACHE_STORAGE_KEYS.ICON_PICKER_CACHE, 'local')
    this.remove(CACHE_STORAGE_KEYS.PERMISSIONS_CACHE, 'local')
    this.remove(CACHE_STORAGE_KEYS.API_CACHE, 'local')
  }

  // ==================== 调试工具 ====================

  /**
   * 导出所有存储数据（用于调试）
   */
  exportAll(): { local: Record<string, any>; session: Record<string, any> } {
    const local: Record<string, any> = {}
    const session: Record<string, any> = {}

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) {
        local[key] = this.get(key, 'local')
      }
    }

    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i)
      if (key) {
        session[key] = this.get(key, 'session')
      }
    }

    return { local, session }
  }

  /**
   * 获取存储使用情况
   */
  getUsage(): { local: number; session: number; localKeys: number; sessionKeys: number } {
    let localSize = 0
    let sessionSize = 0

    for (const key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        localSize += localStorage[key].length + key.length
      }
    }

    for (const key in sessionStorage) {
      if (sessionStorage.hasOwnProperty(key)) {
        sessionSize += sessionStorage[key].length + key.length
      }
    }

    return {
      local: localSize,
      session: sessionSize,
      localKeys: localStorage.length,
      sessionKeys: sessionStorage.length
    }
  }
}

// 导出单例
export const storage = new UnifiedStorageService()

// 导出类型
export type { StorageConfig }
