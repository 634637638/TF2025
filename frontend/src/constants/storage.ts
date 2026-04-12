/**
 * 统一存储键常量
 * 所有 localStorage/sessionStorage 的 key 都应该在这里定义
 */

/**
 * 存储键命名规范：
 * - 使用 snake_case 命名
 * - 按功能模块分组
 * - 添加注释说明用途
 */

// ==================== 认证相关 ====================
export const AUTH_STORAGE_KEYS = {
  /** 主认证数据 (localStorage) - 包含 user, permissions 等 */
  AUTH: 'tf2025_auth',
  /** 会话令牌 (sessionStorage) */
  TOKEN: 'tf2025_token',
  /** 开发环境令牌 (localStorage) */
  DEV_TOKEN: 'tf2025_dev_token',
  /** 认证备份 (localStorage) - 用于断线恢复 */
  AUTH_BACKUP: 'tf2025_auth_backup',
  /** 令牌备份 (localStorage) */
  TOKEN_BACKUP: 'tf2025_token_backup',
  /** 定时备份 (localStorage) */
  TIMED_BACKUP: 'tf2025_auth_timed_backup',
  /** 登出事件标记 (localStorage) */
  LOGOUT_EVENT: 'tf2025_logout_event',
  /** 后端断开标记 (localStorage) */
  BACKEND_DISCONNECTED: 'tf2025_backend_disconnected',
  /** 后端断开时间 (localStorage) */
  BACKEND_DISCONNECT_TIME: 'tf2025_backend_disconnect_time',
  /** 断开通知标记 (sessionStorage) */
  DISCONNECT_NOTIFIED: 'tf2025_disconnect_notified',
  /** 权限已加载标记 (sessionStorage) */
  PERMISSIONS_LOADED: 'tf2025_permissions_loaded',
} as const

// ==================== H5 移动端相关 ====================
export const H5_STORAGE_KEYS = {
  /** H5 认证令牌 (localStorage) */
  AUTH_TOKEN: 'h5_auth_token',
  /** H5 用户信息 (localStorage) */
  AUTH_USER: 'h5_auth_user',
  /** H5 购物车ID (localStorage) */
  CART_ID: 'h5_cart_id',
  /** H5 购物车数量 (localStorage) */
  CART_COUNT: 'h5_cart_count',
  /** H5 上次手机号 (localStorage) */
  LAST_PHONE: 'h5_last_phone',
  /** H5 上次姓名 (localStorage) */
  LAST_NAME: 'h5_last_name',
  /** 结算商品项 (sessionStorage) */
  CHECKOUT_ITEMS: 'checkout_items',
  /** 订单成功信息 (sessionStorage) */
  ORDER_SUCCESS: 'order_success',
  /** 用户默认地址 (localStorage) */
  DEFAULT_ADDRESS: 'user_default_address',
} as const

// ==================== 用户偏好设置 ====================
export const PREFERENCE_STORAGE_KEYS = {
  /** 用户偏好设置 (localStorage) */
  PREFERENCES: 'tf2025_preferences',
  /** 主题设置 (localStorage) */
  THEME: 'theme',
  /** 菜单宽度配置 (localStorage) */
  MENU_WIDTH: 'tf2025_menu_width',
  /** 菜单折叠状态 (localStorage) */
  MENU_COLLAPSED: 'tf2025_menu_collapsed',
} as const

// ==================== 安全相关 ====================
export const SECURITY_STORAGE_KEYS = {
  /** 屏幕锁定状态 (localStorage) */
  SCREEN_LOCKED: 'screen_locked',
  /** 屏幕锁定时间 (localStorage) */
  SCREEN_LOCK_TIME: 'screen_lock_time',
  /** 屏幕锁定设置 (localStorage) */
  SCREEN_LOCK_SETTINGS: 'screenLockSettings',
  /** CSRF 令牌 (localStorage) */
  CSRF_TOKEN: 'tf2025_csrf_token',
} as const

// ==================== 缓存相关 ====================
export const CACHE_STORAGE_KEYS = {
  /** 访问历史 (localStorage) */
  VISIT_HISTORY: 'tf2025_visit_history',
  /** 图标选择器缓存 (localStorage) */
  ICON_PICKER_CACHE: 'iconPicker_cache',
  /** 权限缓存 (localStorage) */
  PERMISSIONS_CACHE: 'tf2025_permissions_cache',
  /** API 缓存 (localStorage) */
  API_CACHE: 'tf2025_api_cache',
} as const

// ==================== 路由相关 ====================
export const ROUTER_STORAGE_KEYS = {
  /** 重定向冷却标记 (sessionStorage) */
  REDIRECT_COOLDOWN: 'tf2025_redirect_cooldown',
  /** 滚动位置 (sessionStorage) - 动态 key 前缀 */
  SCROLL_POSITION_PREFIX: 'tf2025_scroll_',
} as const

// ==================== 临时/会话状态 ====================
export const SESSION_STORAGE_KEYS = {
  /** 待审批通知已提醒 (sessionStorage) */
  PENDING_APPROVAL_NOTIFIED: 'pendingApprovalNotified',
} as const

// ==================== 已废弃的键（需要清理） ====================
export const DEPRECATED_STORAGE_KEYS = [
  'user',           // 旧的用户存储
  'token',          // 旧的令牌存储
  'refreshToken',   // 旧的刷新令牌
  'permissions',    // 旧的权限存储
  'access_token',   // 旧的访问令牌
] as const

/**
 * 所有存储键的联合类型
 */
export type StorageKey =
  | typeof AUTH_STORAGE_KEYS[keyof typeof AUTH_STORAGE_KEYS]
  | typeof H5_STORAGE_KEYS[keyof typeof H5_STORAGE_KEYS]
  | typeof PREFERENCE_STORAGE_KEYS[keyof typeof PREFERENCE_STORAGE_KEYS]
  | typeof SECURITY_STORAGE_KEYS[keyof typeof SECURITY_STORAGE_KEYS]
  | typeof CACHE_STORAGE_KEYS[keyof typeof CACHE_STORAGE_KEYS]
  | typeof ROUTER_STORAGE_KEYS[keyof typeof ROUTER_STORAGE_KEYS]
  | typeof SESSION_STORAGE_KEYS[keyof typeof SESSION_STORAGE_KEYS]

/**
 * 获取滚动位置存储键
 */
export function getScrollPositionKey(path: string): string {
  return `${ROUTER_STORAGE_KEYS.SCROLL_POSITION_PREFIX}${path}`
}

/**
 * 清理所有已废弃的存储键
 */
export function cleanupDeprecatedKeys(): void {
  DEPRECATED_STORAGE_KEYS.forEach(key => {
    localStorage.removeItem(key)
    sessionStorage.removeItem(key)
  })
}
