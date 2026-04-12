/**
 * 统一通知服务 Composable
 * 合并了 useNotification、useNotificationService、useNotificationWithDebounce 的功能
 *
 * 功能：
 * - 基础通知（success/error/warning/info）
 * - 对话框（confirm/alert/prompt）
 * - 加载状态
 * - 防抖功能（可配置）
 * - API错误处理
 * - 历史记录
 *
 * 使用示例：
 * const { success, error } = useNotification()
 * const { success, error } = useNotification({ debounce: true })
 */
import { ref, computed, inject, type InjectionKey } from 'vue'
import { simpleNotification } from '@/services/notification-simple'
import type { NotificationOptions, NotificationConfig } from '@/services/notification-simple'

// 类型定义
export interface Notification {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
  duration?: number
  persistent?: boolean
  timestamp: number
}

export interface UseNotificationOptions {
  /** 是否启用防抖 */
  debounce?: boolean
  /** 防抖时间配置（毫秒） */
  debounceDelay?: number
  /** 是否启用历史记录 */
  history?: boolean
  /** 最大历史记录数 */
  maxHistory?: number
}

// 防抖配置
const DEBOUNCE_CONFIG = {
  success: 1000,
  error: 500,
  warning: 1000,
  info: 1000
}

// 通知缓存（用于防抖）
const notificationCache = new Map<string, { timestamp: number; type: string }>()

/**
 * 生成消息的唯一键
 */
const getNotificationKey = (message: string, type: string): string => {
  return `${type}:${message.slice(0, 50).replace(/\s+/g, ' ').trim()}`
}

/**
 * 检查消息是否应该被忽略（防抖）
 */
const shouldIgnoreNotification = (
  message: string,
  type: 'success' | 'error' | 'warning' | 'info'
): boolean => {
  const key = getNotificationKey(message, type)
  const cached = notificationCache.get(key)
  const now = Date.now()

  if (cached && (now - cached.timestamp) < DEBOUNCE_CONFIG[type]) {
    return true
  }

  notificationCache.set(key, { timestamp: now, type })
  return false
}

// 清理过期缓存
setInterval(() => {
  const now = Date.now()
  const maxAge = Math.max(...Object.values(DEBOUNCE_CONFIG)) * 2

  for (const [key, value] of notificationCache.entries()) {
    if (now - value.timestamp > maxAge) {
      notificationCache.delete(key)
    }
  }
}, 60000)

// 响应式通知列表
const notifications = ref<Notification[]>([])

/**
 * 添加通知
 */
const addNotification = (
  type: 'success' | 'error' | 'warning' | 'info',
  title: string,
  message?: string,
  options?: Partial<Omit<Notification, 'id' | 'type' | 'title' | 'message' | 'timestamp'>>
): string => {
  const id = Date.now().toString() + Math.random().toString(36).substr(2, 9)
  const duration = type === 'error' ? 8000 : type === 'success' ? 3000 : 5000

  const notification: Notification = {
    id,
    type,
    title,
    message,
    duration: options?.duration || duration,
    persistent: options?.persistent || false,
    timestamp: Date.now()
  }

  notifications.value.push(notification)

  // 自动移除
  if (!notification.persistent) {
    setTimeout(() => removeNotification(id), notification.duration)
  }

  return id
}

/**
 * 移除通知
 */
const removeNotification = (id: string) => {
  const index = notifications.value.findIndex(n => n.id === id)
  if (index > -1) {
    notifications.value.splice(index, 1)
  }
}

/**
 * 清除所有通知
 */
const clearAll = () => {
  notifications.value = []
}

// 主 composable
export const useNotification = (options: UseNotificationOptions = {}) => {
  const {
    debounce = false,
    debounceDelay = 300,
    history = false,
    maxHistory = 100
  } = options

  // 尝试注入全局通知服务
  const injectedNotification = inject('notification', simpleNotification)

  // 历史记录
  const notificationHistory = ref<Notification[]>([])

  // 便捷方法 - 内部实现
  const baseSuccess = (message: string, options?: NotificationOptions) => {
    if (debounce && shouldIgnoreNotification(message, 'success')) return
    simpleNotification.success(message, options)
    if (history) addToHistory('success', '操作成功', message)
  }

  const baseError = (message: string, options?: NotificationOptions) => {
    if (debounce && shouldIgnoreNotification(message, 'error')) return
    simpleNotification.error(message, options)
    if (history) addToHistory('error', '操作失败', message)
  }

  const baseWarning = (message: string, options?: NotificationOptions) => {
    if (debounce && shouldIgnoreNotification(message, 'warning')) return
    simpleNotification.warning(message, options)
    if (history) addToHistory('warning', '警告', message)
  }

  const baseInfo = (message: string, options?: NotificationOptions) => {
    if (debounce && shouldIgnoreNotification(message, 'info')) return
    simpleNotification.info(message, options)
    if (history) addToHistory('info', '提示', message)
  }

  // 添加到历史记录
  const addToHistory = (
    type: Notification['type'],
    title: string,
    message?: string
  ) => {
    const notification: Notification = {
      id: Date.now().toString(),
      type,
      title,
      message,
      timestamp: Date.now()
    }

    notificationHistory.value.unshift(notification)

    // 限制历史记录数量
    if (notificationHistory.value.length > maxHistory) {
      notificationHistory.value = notificationHistory.value.slice(0, maxHistory)
    }
  }

  // 对话框方法
  const confirm = (message: string, title?: string, opts?: any): Promise<boolean> => {
    return simpleNotification.confirm(message, title, opts)
  }

  const alert = (message: string, title?: string, type?: string): Promise<void> => {
    return simpleNotification.alert(message, title, type as any)
  }

  const prompt = (message: string, title?: string, opts?: any): Promise<{ value: string } | null> => {
    return simpleNotification.prompt(message, title, opts)
  }

  // 加载状态
  const loading = (message?: string): (() => void) => {
    return simpleNotification.loading(message)
  }

  // 进度通知
  const progress = (message: string, progressValue: number, opts?: NotificationOptions) => {
    simpleNotification.progress(message, progressValue, opts)
  }

  // API错误处理
  const handleApiError = (error: any, defaultMessage: string = '操作失败') => {
    let message = defaultMessage

    if (error?.response?.data?.message) {
      message = error.response.data.message
    } else if (error?.response?.data?.errors?.length > 0) {
      message = error.response.data.errors.join('; ')
    } else if (error?.message) {
      message = error.message
    }

    // HTTP状态码处理
    if (error?.response?.status === 400) {
      message = error?.response?.data?.message || '请求参数错误'
    } else if (error?.response?.status === 401) {
      message = '登录已过期，请重新登录'
    } else if (error?.response?.status === 403) {
      message = '权限不足，无法执行此操作'
    } else if (error?.response?.status === 404) {
      message = '请求的资源不存在'
    } else if (error?.response?.status === 422) {
      message = '数据验证失败：' + message
    } else if (error?.response?.status === 500) {
      message = '服务器内部错误，请稍后重试'
    }

    baseError(message)
    if (history) addToHistory('error', defaultMessage, message)
  }

  // API成功处理
  const handleApiSuccess = (response: any, defaultMessage: string = '操作成功') => {
    const message = response?.message || defaultMessage
    baseSuccess(message)
    if (history) addToHistory('success', defaultMessage, message)
  }

  // 按类型清除
  const clearByType = (type: 'success' | 'error' | 'warning' | 'info') => {
    // 对于simpleNotification，清除所有
    simpleNotification.clearAll()
  }

  // 批量通知
  const batchNotify = (
    items: Array<{
      type: 'success' | 'error' | 'warning' | 'info'
      message: string
      options?: NotificationOptions
    }>
  ) => {
    // 按类型分组
    const grouped = items.reduce((acc, item) => {
      if (!acc[item.type]) acc[item.type] = []
      acc[item.type].push(item)
      return acc
    }, {} as Record<string, typeof items>)

    // 每种类型只显示最后一条
    Object.entries(grouped).forEach(([type, typeItems]) => {
      if (typeItems.length > 0) {
        const last = typeItems[typeItems.length - 1]
        const msg = typeItems.length > 1
          ? `${last.message}（还有 ${typeItems.length - 1} 条${type}消息）`
          : last.message

        switch (type) {
          case 'success': baseSuccess(msg, last.options); break
          case 'error': baseError(msg, last.options); break
          case 'warning': baseWarning(msg, last.options); break
          case 'info': baseInfo(msg, last.options); break
        }
      }
    })
  }

  // 配置方法
  const setDefaultConfig = (config: Partial<NotificationConfig>) => {
    simpleNotification.setDefaultConfig(config)
  }

  const getDefaultConfig = (): NotificationConfig => {
    return simpleNotification.getDefaultConfig()
  }

  return {
    // 实例
    notification: injectedNotification,

    // 便捷方法
    success: baseSuccess,
    error: baseError,
    warning: baseWarning,
    info: baseInfo,
    notify: simpleNotification.notify,

    // 对话框
    confirm,
    alert,
    prompt,

    // 特殊功能
    loading,
    progress,

    // API处理
    handleApiError,
    handleApiSuccess,

    // 管理功能
    clearAll,
    clearByType,
    batchNotify,

    // 历史记录
    history: computed(() => notificationHistory.value),

    // 配置
    setDefaultConfig,
    getDefaultConfig,

    // 原始服务
    raw: simpleNotification
  }
}

// 导出通知列表供组件使用
export { notifications }

// 别名导出，兼容旧代码
export const useNotificationService = useNotification
export const useNotificationWithDebounce = (options: UseNotificationOptions = {}) => {
  return useNotification({ ...options, debounce: true })
}

// 默认导出
export default useNotification
