/**
 * 全局错误边界处理系统
 * 提供Vue组件错误捕获、网络错误处理、性能监控等功能
 */

import { ref, computed, readonly, inject, type App } from 'vue'
import logger from '@/utils/logger'

/**
 * 错误级别定义
 */
export enum ErrorLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * 错误类型定义
 */
export enum ErrorType {
  VUE = 'vue',           // Vue组件错误
  JAVASCRIPT = 'javascript', // JavaScript运行时错误
  NETWORK = 'network',   // 网络请求错误
  ASYNC = 'async',       // 异步操作错误
  PERMISSION = 'permission', // 权限错误
  VALIDATION = 'validation', // 表单验证错误
  PERFORMANCE = 'performance', // 性能错误
  BUSINESS = 'business'  // 业务逻辑错误
}

/**
 * 错误信息接口
 */
export interface DetailedErrorInfo {
  id: string
  level: ErrorLevel
  type: ErrorType
  message: string
  timestamp: number
  url: string
  userAgent: string
  stack?: string
  context?: Record<string, any>
  userId?: number
  sessionId: string
  resolved: boolean
  resolvedAt?: number
  retryCount: number
  tags?: string[]
  source?: string
  version?: string
  browserInfo?: {
    userAgent: string
    url: string
    referrer?: string
    timestamp: number
  }
}

/**
 * 错误边界配置
 */
export interface ErrorBoundaryConfig {
  enabled: boolean
  maxErrors: number
  reportInterval: number
  includeUserInfo: boolean
  includeEnvironmentInfo: boolean
  autoRetry: boolean
  maxRetries: number
  retryDelay: number
  enableConsoleLog: boolean
  enableReporting: boolean
  reportingEndpoint?: string
  onError?: (error: DetailedErrorInfo) => void
  onRecover?: (error: DetailedErrorInfo) => void
}

/**
 * 全局错误边界管理器
 */
export class ErrorBoundary {
  private config: ErrorBoundaryConfig
  private errors: Map<string, DetailedErrorInfo> = new Map()
  private errorCount = 0
  private reportTimer?: number
  private sessionId: string

  constructor(config: Partial<ErrorBoundaryConfig> = {}) {
    this.config = {
      enabled: true,
      maxErrors: 100,
      reportInterval: 30000, // 30秒
      includeUserInfo: true,
      includeEnvironmentInfo: true,
      autoRetry: true,
      maxRetries: 3,
      retryDelay: 1000,
      enableConsoleLog: true,
      enableReporting: false,
      ...config
    }

    this.sessionId = this.generateSessionId()
    this.initialize()
  }

  /**
   * 生成会话ID
   */
  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 初始化错误边界
   */
  private initialize(): void {
    if (!this.config.enabled) return

    // 设置全局错误处理器
    this.setupGlobalHandlers()

    // 启动定时报告
    this.startPeriodicReporting()

    // 页面卸载时清理
    window.addEventListener('beforeunload', () => {
      this.cleanup()
    })
  }

  /**
   * 设置全局错误处理器
   */
  private setupGlobalHandlers(): void {
    // 未捕获的JavaScript错误
    window.addEventListener('error', (event) => {
      this.handleError({
        type: ErrorType.JAVASCRIPT,
        message: event.message,
        stack: event.error?.stack,
        context: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        }
      })
    })

    // 未捕获的Promise rejection
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError({
        type: ErrorType.ASYNC,
        message: event.reason?.message || 'Unhandled Promise Rejection',
        stack: event.reason?.stack,
        context: { promise: event.reason }
      })
    })

    // 资源加载错误
    window.addEventListener('error', (event) => {
      if (event.target !== window) {
        this.handleError({
          type: ErrorType.NETWORK,
          message: `Resource loading failed: ${(event.target as any)?.src || (event.target as any)?.href}`,
          context: { target: event.target }
        })
      }
    }, true)
  }

  /**
   * 处理错误
   */
  public handleError(error: Partial<DetailedErrorInfo>): string {
    if (!this.config.enabled) return ''

    // 过滤 ResizeObserver 相关警告（Element Plus 组件的已知问题）
    if (error.message &&
        (error.message.includes('ResizeObserver loop completed with undelivered notifications') ||
         error.message.includes('ResizeObserver loop limit exceeded'))) {
      return '' // 不记录这些无害的警告
    }

    const errorId = this.generateErrorId()
    const detailedError: DetailedErrorInfo = {
      id: errorId,
      type: error.type || ErrorType.JAVASCRIPT,
      level: this.determineErrorLevel(error),
      message: error.message || 'Unknown error',
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      sessionId: this.sessionId,
      resolved: false,
      retryCount: 0,
      stack: error.stack,
      context: error.context,
      userId: error.userId,
      tags: error.tags,
      source: error.source,
      version: import.meta.env?.VITE_APP_VERSION,
      browserInfo: {
        userAgent: navigator.userAgent,
        url: window.location.href,
        referrer: document.referrer,
        timestamp: Date.now()
      }
    }

    // 存储错误
    this.errors.set(errorId, detailedError)
    this.errorCount++

    // 控制台输出
    if (this.config.enableConsoleLog) {
      this.logToConsole(detailedError)
    }

    // 触发错误回调
    if (this.config.onError) {
      try {
        this.config.onError(detailedError)
      } catch (callbackError) {
        logger.error('ErrorBoundary onError 回调执行失败', callbackError)
      }
    }

    // 自动重试
    if (this.config.autoRetry && this.shouldRetry(detailedError)) {
      this.scheduleRetry(detailedError)
    }

    // 清理旧错误
    this.cleanupOldErrors()

    return errorId
  }

  /**
   * 生成错误ID
   */
  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
  }

  /**
   * 确定错误级别
   */
  private determineErrorLevel(error: Partial<DetailedErrorInfo>): ErrorLevel {
    // 关键错误模式
    const criticalPatterns = [
      /chunk.*failed/i,
      /network.*error/i,
      /permission.*denied/i,
      /unauthorized/i,
      /token.*expired/i
    ]

    const message = error.message || ''

    if (criticalPatterns.some(pattern => pattern.test(message))) {
      return ErrorLevel.CRITICAL
    }

    // 高级错误模式
    const highPatterns = [
      /cannot.*property/i,
      /undefined.*not.*function/i,
      /null.*reference/i,
      /type.*error/i
    ]

    if (highPatterns.some(pattern => pattern.test(message))) {
      return ErrorLevel.HIGH
    }

    // 根据错误类型判断
    switch (error.type) {
      case ErrorType.NETWORK:
        return ErrorLevel.HIGH
      case ErrorType.PERMISSION:
        return ErrorLevel.HIGH
      case ErrorType.PERFORMANCE:
        return ErrorLevel.MEDIUM
      case ErrorType.VALIDATION:
        return ErrorLevel.LOW
      default:
        return ErrorLevel.MEDIUM
    }
  }

  /**
   * 判断是否应该重试
   */
  private shouldRetry(error: DetailedErrorInfo): boolean {
    return error.retryCount < this.config.maxRetries &&
           (error.type === ErrorType.NETWORK || error.type === ErrorType.ASYNC)
  }

  /**
   * 计划重试
   */
  private scheduleRetry(error: DetailedErrorInfo): void {
    setTimeout(() => {
      error.retryCount++

      if (this.shouldRetry(error)) {
        this.scheduleRetry(error)
      } else {
        this.resolveError(error.id)
      }
    }, this.config.retryDelay * Math.pow(2, error.retryCount))
  }

  /**
   * 解决错误
   */
  public resolveError(errorId: string): void {
    const error = this.errors.get(errorId)
    if (error) {
      error.resolved = true
      error.resolvedAt = Date.now()

      if (this.config.onRecover) {
        try {
          this.config.onRecover(error)
        } catch (callbackError) {
          logger.error('ErrorBoundary onRecover 回调执行失败', callbackError)
        }
      }
    }
  }

  /**
   * 获取错误列表
   */
  public getErrors(): DetailedErrorInfo[] {
    return Array.from(this.errors.values())
      .sort((a, b) => b.timestamp - a.timestamp)
  }

  /**
   * 获取未解决的错误
   */
  public getUnresolvedErrors(): DetailedErrorInfo[] {
    return this.getErrors().filter(error => !error.resolved)
  }

  /**
   * 获取错误统计
   */
  public getErrorStats(): {
    total: number
    unresolved: number
    byLevel: Record<ErrorLevel, number>
    byType: Record<ErrorType, number>
  } {
    const errors = this.getErrors()
    const stats = {
      total: errors.length,
      unresolved: this.getUnresolvedErrors().length,
      byLevel: {} as Record<ErrorLevel, number>,
      byType: {} as Record<ErrorType, number>
    }

    // 初始化计数器
    Object.values(ErrorLevel).forEach(level => {
      stats.byLevel[level] = 0
    })
    Object.values(ErrorType).forEach(type => {
      stats.byType[type] = 0
    })

    // 统计错误
    errors.forEach(error => {
      stats.byLevel[error.level]++
      stats.byType[error.type]++
    })

    return stats
  }

  /**
   * 清理旧错误
   */
  private cleanupOldErrors(): void {
    if (this.errors.size <= this.config.maxErrors) return

    const sortedErrors = Array.from(this.errors.entries())
      .sort(([, a], [, b]) => a.timestamp - b.timestamp)

    const toDelete = sortedErrors.slice(0, this.errors.size - this.config.maxErrors)
    toDelete.forEach(([id]) => {
      this.errors.delete(id)
    })
  }

  /**
   * 控制台日志
   */
  private logToConsole(error: DetailedErrorInfo): void {
    logger.error(`[ErrorBoundary] ${error.level.toUpperCase()}: ${error.message}`, {
      id: error.id,
      type: error.type,
      timestamp: new Date(error.timestamp).toISOString(),
      url: error.url,
      context: error.context,
      stack: error.stack
    })
  }

  /**
   * 启动定时报告
   */
  private startPeriodicReporting(): void {
    if (!this.config.enableReporting || !this.config.reportingEndpoint) return

    this.reportTimer = window.setInterval(() => {
      this.reportErrors()
    }, this.config.reportInterval)
  }

  /**
   * 报告错误到服务器
   */
  private async reportErrors(): Promise<void> {
    if (!this.config.reportingEndpoint) return

    const unresolvedErrors = this.getUnresolvedErrors()
    if (unresolvedErrors.length === 0) return

    try {
      await fetch(this.config.reportingEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId: this.sessionId,
          errors: unresolvedErrors,
          timestamp: Date.now(),
          userAgent: navigator.userAgent,
          url: window.location.href
        })
      })
    } catch (reportError) {
      logger.error('ErrorBoundary 上报失败', reportError)
    }
  }

  /**
   * 清理资源
   */
  public cleanup(): void {
    if (this.reportTimer) {
      clearInterval(this.reportTimer)
      this.reportTimer = undefined
    }

    // 最后报告一次错误
    if (this.config.enableReporting) {
      this.reportErrors()
    }
  }

  /**
   * 重置错误状态
   */
  public reset(): void {
    this.errors.clear()
    this.errorCount = 0
  }

  /**
   * 更新配置
   */
  public updateConfig(newConfig: Partial<ErrorBoundaryConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }
}

/**
 * 创建全局错误边界实例
 */
export const createErrorBoundary = (config?: Partial<ErrorBoundaryConfig>) => {
  return new ErrorBoundary(config)
}

/**
 * Vue插件安装
 */
export const ErrorBoundaryPlugin = {
  install(app: App, config?: Partial<ErrorBoundaryConfig>) {
    const errorBoundary = createErrorBoundary(config)

    // 挂载到全局属性
    app.config.globalProperties.$errorBoundary = errorBoundary
    app.provide('errorBoundary', errorBoundary)

    // Vue错误处理器
    app.config.errorHandler = (error: Error, instance, info) => {
      errorBoundary.handleError({
        type: ErrorType.VUE,
        message: error.message,
        stack: error.stack,
        context: {
          component: instance?.$options?.name || 'Unknown',
          info
        }
      })
    }

    // Vue警告处理器
    app.config.warnHandler = (msg, instance, trace) => {
      errorBoundary.handleError({
        type: ErrorType.VUE,
        level: ErrorLevel.LOW,
        message: `Vue Warning: ${msg}`,
        context: {
          component: instance?.$options?.name || 'Unknown',
          trace
        }
      })
    }
  }
}

// 声明全局属性类型
declare module '@vue/runtime-core' {
  interface ComponentCustomProperties {
    $errorBoundary: ErrorBoundary
  }
}

/**
 * Composable: 使用错误边界
 */
export function useErrorBoundary() {
  const errorBoundary = inject<ErrorBoundary>('errorBoundary')

  if (!errorBoundary) {
    throw new Error('ErrorBoundary not found. Make sure ErrorBoundaryPlugin is installed.')
  }

  const errors = ref<DetailedErrorInfo[]>([])
  const stats = computed(() => errorBoundary.getErrorStats())

  const handleError = (error: Partial<DetailedErrorInfo>) => {
    const errorId = errorBoundary.handleError(error)
    errors.value = errorBoundary.getErrors()
    return errorId
  }

  const resolveError = (errorId: string) => {
    errorBoundary.resolveError(errorId)
    errors.value = errorBoundary.getErrors()
  }

  const getUnresolvedErrors = () => {
    return errorBoundary.getUnresolvedErrors()
  }

  const reset = () => {
    errorBoundary.reset()
    errors.value = []
  }

  return {
    errorBoundary,
    errors: readonly(errors),
    stats,
    handleError,
    resolveError,
    getUnresolvedErrors,
    reset
  }
}

// 默认导出
export default ErrorBoundaryPlugin
