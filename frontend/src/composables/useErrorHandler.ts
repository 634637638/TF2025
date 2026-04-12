import { ref, computed, inject, onUnmounted } from 'vue'
import { useMessageStore } from '@/stores/message'
import { ErrorBoundary, ErrorType, ErrorLevel, type DetailedErrorInfo } from '@/utils/error-boundary'
import { storage } from '@/services/storage'
import { AUTH_STORAGE_KEYS } from '@/constants/storage'
import { logger } from '@/utils/logger'


type HandlerLevel = 'error' | 'warning' | 'info' | 'fatal'

export enum BusinessErrorType {
  NETWORK = 'network',
  VALIDATION = 'validation',
  PERMISSION = 'permission',
  BUSINESS_LOGIC = 'business_logic',
  SYSTEM = 'system',
  USER_INPUT = 'user_input'
}

/**
 * 全局错误处理 Composable
 * 提供统一的错误捕获、处理和显示机制
 */
export function useErrorHandler() {
  const messageStore = useMessageStore()

  // 获取错误边界实例
  let errorBoundary: ErrorBoundary | null = null
  try {
    errorBoundary = inject('errorBoundary') as ErrorBoundary
  } catch (error) {
    logger.warn('ErrorBoundary not found in injection context')
  }

  // 错误记录
  const errorHistory = ref<DetailedErrorInfo[]>([])
  const currentError = ref<DetailedErrorInfo | null>(null)
  const hasErrors = computed(() => errorHistory.value.length > 0)

  const mapLevel = (level: HandlerLevel): ErrorLevel => {
    switch (level) {
      case 'fatal':
        return ErrorLevel.CRITICAL
      case 'error':
        return ErrorLevel.HIGH
      case 'warning':
        return ErrorLevel.MEDIUM
      case 'info':
      default:
        return ErrorLevel.LOW
    }
  }

  /**
   * 记录错误信息
   */
  const recordError = (
    error: Error | string,
    level: HandlerLevel = 'error',
    context?: Record<string, any>
  ) => {
    const errorInfo: DetailedErrorInfo = {
      id: `err_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: mapToErrorBoundaryType(level),
      level: mapLevel(level),
      message: typeof error === 'string' ? error : error.message,
      stack: typeof error === 'object' && 'stack' in error ? error.stack : undefined,
      context,
      timestamp: Date.now(),
      url: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      userId: getCurrentUserId() || undefined,
      sessionId: 'use-error-handler',
      resolved: false,
      retryCount: 0,
      source: 'useErrorHandler'
    }

    // 添加到历史记录
    errorHistory.value.unshift(errorInfo)

    // 限制历史记录数量
    if (errorHistory.value.length > 100) {
      errorHistory.value = errorHistory.value.slice(0, 100)
    }

    // 设置当前错误
    currentError.value = errorInfo

    // 记录到错误边界
    if (errorBoundary) {
      errorBoundary.handleError({
        type: mapToErrorBoundaryType(level),
        message: errorInfo.message,
        stack: errorInfo.stack,
        context: errorInfo.context,
        source: 'useErrorHandler'
      })
    }

    // 根据错误级别显示通知
    switch (level) {
      case 'error':
      case 'fatal':
        messageStore.error(errorInfo.message)
        break
      case 'warning':
        messageStore.warning(errorInfo.message)
        break
      case 'info':
        messageStore.info(errorInfo.message)
        break
    }

    // 记录到控制台
    const logMethod = level === 'error' || level === 'fatal' ? 'error' : 'warn'
    console[logMethod]('Error recorded:', errorInfo)

    return errorInfo
  }

  /**
   * 处理API错误
   */
  const handleApiError = (error: any, defaultMessage: string = '请求失败') => {
    let message = defaultMessage
    let level: HandlerLevel = 'error'
    let context: Record<string, any> = {}

    if (error.response) {
      // HTTP错误响应
      const { status, data } = error.response
      context = {
        status,
        url: error.config?.url,
        method: error.config?.method?.toUpperCase()
      }

      switch (status) {
        case 400:
          message = data?.message || '请求参数错误'
          level = 'warning'
          break
        case 401:
          message = '未授权，请重新登录'
          level = 'warning'
          // 清除认证信息
          clearAuth()
          // 跳转到登录页
          setTimeout(() => {
            if (typeof window !== 'undefined') {
              window.location.href = '/login'
            }
          }, 1000)
          break
        case 403:
          message = '权限不足，无法执行此操作'
          level = 'warning'
          break
        case 404:
          message = '请求的资源不存在'
          level = 'warning'
          break
        case 409:
          message = data?.message || '操作冲突，请检查数据'
          level = 'warning'
          break
        case 422:
          message = data?.message || '数据验证失败'
          level = 'warning'
          if (data?.errors && Array.isArray(data.errors)) {
            message += `：${data.errors.join('；')}`
          }
          break
        case 429:
          message = '请求过于频繁，请稍后再试'
          level = 'warning'
          break
        case 500:
          message = '服务器内部错误'
          level = 'error'
          break
        case 502:
        case 503:
        case 504:
          message = '服务暂时不可用，请稍后重试'
          level = 'error'
          break
        default:
          message = data?.message || defaultMessage
          level = 'error'
      }

      context.responseData = data
    } else if (error.request) {
      // 网络错误
      message = '网络连接失败，请检查网络设置'
      level = 'error'
      context = {
        url: error.config?.url,
        method: error.config?.method?.toUpperCase()
      }
    } else {
      // 其他错误
      message = error.message || defaultMessage
      context = { originalError: error }
    }

    return recordError(error, level, context)
  }

  /**
   * 处理表单验证错误
   */
  const handleValidationError = (errors: string[] | Record<string, string>, context?: Record<string, any>) => {
    const errorMessage = Array.isArray(errors) ? errors.join('；') : Object.values(errors).join('；')
    return recordError(new Error(errorMessage), 'warning', { type: 'validation', ...context })
  }

  /**
   * 处理业务逻辑错误
   */
  const handleBusinessError = (message: string, context?: Record<string, any>) => {
    return recordError(new Error(message), 'warning', { type: 'business', ...context })
  }

  /**
   * 处理系统错误
   */
  const handleSystemError = (error: Error | string, context?: Record<string, any>) => {
    return recordError(error, 'error', { type: 'system', ...context })
  }

  /**
   * 清除错误历史
   */
  const clearErrors = () => {
    errorHistory.value = []
    currentError.value = null
  }

  /**
   * 获取最近的错误
   */
  const getRecentErrors = (count: number = 10) => {
    return errorHistory.value.slice(0, count)
  }

  /**
   * 根据级别获取错误
   */
  const getErrorsByLevel = (level: HandlerLevel) => {
    const mappedLevel = mapLevel(level)
    return errorHistory.value.filter(error => error.level === mappedLevel)
  }

  /**
   * 获取当前用户ID
   */
  const getCurrentUserId = () => {
    try {
      const auth = storage.getAuth()
      if (auth) {
        const userData = auth as any
        return userData.id || userData.username || userData.user?.id
      }
    } catch {
      // 忽略错误
    }
    return null
  }

  /**
   * 映射到错误边界类型
   */
  const mapToErrorBoundaryType = (level: HandlerLevel): ErrorType => {
    switch (level) {
      case 'error':
      case 'fatal':
        return ErrorType.JAVASCRIPT
      case 'warning':
        return ErrorType.BUSINESS
      case 'info':
        return ErrorType.VUE
      default:
        return ErrorType.JAVASCRIPT
    }
  }

  /**
   * 清除认证信息
   */
  const clearAuth = () => {
    try {
      storage.clearAuth()
    } catch {
      // 忽略错误
    }
  }

  /**
   * 创建错误边界处理器
   */
  const createErrorHandler = (fallbackMessage: string = '操作失败') => {
    return (error: Error) => {
      handleSystemError(error, { fallbackMessage })
      throw error
    }
  }

  /**
   * 异步操作包装器
   */
  const withErrorHandling = async <T>(
    operation: () => Promise<T>,
    options?: {
      fallbackMessage?: string
      showSuccess?: boolean
      successMessage?: string
      context?: Record<string, any>
    }
  ): Promise<T | null> => {
    try {
      const result = await operation()

      if (options?.showSuccess) {
        messageStore.success(options.successMessage || '操作成功')
      }

      return result
    } catch (error) {
      if (options?.fallbackMessage) {
        recordError(
          error instanceof Error ? error : new Error(String(error)),
          'error',
          { fallbackMessage: options.fallbackMessage, ...options?.context }
        )
      } else {
        handleSystemError(error as Error, options?.context)
      }
      return null
    }
  }

  return {
    // 状态
    errorHistory,
    currentError,
    hasErrors,

    // 方法
    recordError,
    handleApiError,
    handleValidationError,
    handleBusinessError,
    handleSystemError,
    clearErrors,
    getRecentErrors,
    getErrorsByLevel,
    createErrorHandler,
    withErrorHandling,

    // 业务错误类型处理方法
    handleNetworkError: (error: any, context?: any) => handleApiError(error, context?.defaultMessage || '网络请求失败'),
    handlePermissionError: (error: any, context?: any) => handleApiError(error, context?.defaultMessage || '权限不足'),
    handleUserInputError: (message: string, context?: any) => handleValidationError([message], { ...context, type: BusinessErrorType.USER_INPUT })
  }
}

export default useErrorHandler