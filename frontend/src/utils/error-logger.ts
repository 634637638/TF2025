/**
 * 全局错误日志和上报系统
 * 提供错误收集、存储、分析和上报功能
 */

import { ref, computed } from 'vue'
import { unifiedApi } from './unified-api'
import { ErrorLevel, ErrorType } from './error-boundary'
import { TimeUtil } from './time'
import { storage } from '@/services/storage'
import { AUTH_STORAGE_KEYS } from '@/constants/storage'
import { logger } from './logger'

// 重新导出 ErrorLevel 和 ErrorType 以便其他模块使用
export { ErrorLevel, ErrorType } from './error-boundary'

/**
 * 错误日志条目接口
 */
export interface ErrorLogEntry {
  id: string
  timestamp: number
  formattedTime: string
  level: ErrorLevel
  type: ErrorType
  message: string
  stack?: string
  context?: Record<string, any>
  url: string
  userAgent: string
  userId?: number
  sessionId: string
  resolved: boolean
  reported: boolean
  count: number
  lastOccurred: number
  tags?: string[]
  component?: string
  action?: string
}

/**
 * 错误统计接口
 */
export interface ErrorStatistics {
  total: number
  byLevel: Record<ErrorLevel, number>
  byType: Record<ErrorType, number>
  byHour: Record<string, number>
  byComponent: Record<string, number>
  unresolved: number
  reported: number
  errorRate: number
  averageResolutionTime: number
  mostCommonErrors: Array<{
    message: string
    count: number
    lastOccurred: number
  }>
}

/**
 * 错误上报配置
 */
export interface ErrorReportingConfig {
  enabled: boolean
  endpoint: string
  batchSize: number
  reportInterval: number
  maxRetries: number
  includeUserInfo: boolean
  includeEnvironmentInfo: boolean
  autoReport: boolean
  levelsToReport: ErrorLevel[]
  typesToReport: ErrorType[]
}

/**
 * 错误日志管理器
 */
export class ErrorLogger {
  private logs: Map<string, ErrorLogEntry> = new Map()
  private config: ErrorReportingConfig
  private reportTimer?: number
  private sessionStartTime: number
  private sessionId: string
  private userActionCount = 0

  constructor(config: Partial<ErrorReportingConfig> = {}) {
    this.config = {
      enabled: false, // 临时禁用错误上报，避免 404 错误
      endpoint: '/api/logs/errors',
      batchSize: 10,
      reportInterval: 30000, // 30秒
      maxRetries: 3,
      includeUserInfo: true,
      includeEnvironmentInfo: true,
      autoReport: true,
      levelsToReport: [ErrorLevel.HIGH, ErrorLevel.CRITICAL],
      typesToReport: [ErrorType.JAVASCRIPT, ErrorType.NETWORK, ErrorType.VUE],
      ...config
    }

    this.sessionId = this.generateSessionId()
    this.sessionStartTime = Date.now()
    this.initialize()
  }

  /**
   * 初始化错误日志系统
   */
  private initialize(): void {
    // 监听用户操作
    this.trackUserActions()

    // 页面可见性变化时上报错误
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.flushReports()
      }
    })

    // 页面卸载时上报错误
    window.addEventListener('beforeunload', () => {
      this.flushReports()
    })

    // 启动定时上报
    if (this.config.autoReport) {
      this.startPeriodicReporting()
    }

    // 监听网络状态变化
    this.trackNetworkStatus()
  }

  /**
   * 生成会话ID
   */
  private generateSessionId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 记录错误
   */
  public logError(error: {
    level: ErrorLevel
    type: ErrorType
    message: string
    stack?: string
    context?: Record<string, any>
    component?: string
    action?: string
    tags?: string[]
  }): string {
    const errorId = this.generateErrorId(error.message)
    const now = Date.now()

    // 检查是否已存在相同错误
    const existing = this.logs.get(errorId)
    if (existing) {
      existing.count++
      existing.lastOccurred = now
      existing.resolved = false
      return errorId
    }

    const logEntry: ErrorLogEntry = {
      id: errorId,
      timestamp: now,
      formattedTime: TimeUtil.format(now, 'YYYY-MM-DD HH:mm:ss.SSS'),
      level: error.level,
      type: error.type,
      message: error.message,
      stack: error.stack,
      context: error.context,
      url: window.location.href,
      userAgent: navigator.userAgent,
      userId: this.getCurrentUserId(),
      sessionId: this.sessionId,
      resolved: false,
      reported: false,
      count: 1,
      lastOccurred: now,
      tags: error.tags,
      component: error.component,
      action: error.action
    }

    this.logs.set(errorId, logEntry)

    // 输出到控制台（开发环境）
    if (import.meta.env.DEV) {
      this.logToConsole(logEntry)
    }

    // 高优先级错误立即上报
    if (error.level === ErrorLevel.CRITICAL) {
      this.reportError(logEntry)
    }

    return errorId
  }

  /**
   * 生成错误ID
   */
  private generateErrorId(message: string): string {
    // 基于错误消息和URL生成唯一ID
    const content = `${message}_${window.location.pathname}`
    return `err_${this.simpleHash(content)}`
  }

  /**
   * 简单哈希函数
   */
  private simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return Math.abs(hash).toString(36)
  }

  /**
   * 获取当前用户ID
   */
  private getCurrentUserId(): number | undefined {
    try {
      const authData = storage.getAuth()
      if (authData) {
        return (authData as any).user?.id || (authData as any).userId
      }
    } catch (error) {
      logger.warn('获取用户ID失败:', error)
    }
    return undefined
  }

  /**
   * 控制台日志输出
   */
  private logToConsole(entry: ErrorLogEntry): void {
    const styles = {
      [ErrorLevel.CRITICAL]: 'color: #ff4444; font-weight: bold; background: #ffebee; padding: 2px 4px; border-radius: 2px',
      [ErrorLevel.HIGH]: 'color: #ff6b6b; font-weight: bold; background: #fff3e0; padding: 2px 4px; border-radius: 2px',
      [ErrorLevel.MEDIUM]: 'color: #ffa726; font-weight: bold; background: #f3e5f5; padding: 2px 4px; border-radius: 2px',
      [ErrorLevel.LOW]: 'color: #66bb6a; background: #e8f5e8; padding: 2px 4px; border-radius: 2px'
    }

  }

  /**
   * 监听用户操作
   */
  private trackUserActions(): void {
    const events = ['click', 'scroll', 'keydown', 'touchstart']
    const throttledAction = this.throttle(() => {
      this.userActionCount++
    }, 1000)

    events.forEach(event => {
      document.addEventListener(event, throttledAction, { passive: true })
    })
  }

  /**
   * 监听网络状态
   */
  private trackNetworkStatus(): void {
    const logNetworkStatus = () => {
      this.logError({
        level: ErrorLevel.MEDIUM,
        type: ErrorType.NETWORK,
        message: `网络状态变化: ${navigator.onLine ? '在线' : '离线'}`,
        context: {
          online: navigator.onLine,
          connection: (navigator as any).connection?.effectiveType,
          userActionCount: this.userActionCount
        },
        tags: ['network', 'connectivity']
      })
    }

    window.addEventListener('online', logNetworkStatus)
    window.addEventListener('offline', logNetworkStatus)
  }

  /**
   * 节流函数
   */
  private throttle<T extends (...args: any[]) => any>(func: T, delay: number): T {
    let timeoutId: number | null = null
    let lastExecTime = 0

    return ((...args: any[]) => {
      const currentTime = Date.now()

      if (currentTime - lastExecTime > delay) {
        func.apply(this, args)
        lastExecTime = currentTime
      } else {
        if (timeoutId) {
          clearTimeout(timeoutId)
        }
        timeoutId = window.setTimeout(() => {
          func.apply(this, args)
          lastExecTime = Date.now()
        }, delay - (currentTime - lastExecTime))
      }
    }) as T
  }

  /**
   * 获取错误统计
   */
  public getStatistics(): ErrorStatistics {
    const logs = Array.from(this.logs.values())
    const byLevel: Record<ErrorLevel, number> = {} as any
    const byType: Record<ErrorType, number> = {} as any
    const byHour: Record<string, number> = {}
    const byComponent: Record<string, number> = {}

    // 初始化计数器
    Object.values(ErrorLevel).forEach(level => {
      byLevel[level] = 0
    })
    Object.values(ErrorType).forEach(type => {
      byType[type] = 0
    })

    // 统计错误
    logs.forEach(log => {
      byLevel[log.level]++
      byType[log.type]++

      const hour = new Date(log.timestamp).getHours()
      const hourKey = `${hour}:00`
      byHour[hourKey] = (byHour[hourKey] || 0) + 1

      if (log.component) {
        byComponent[log.component] = (byComponent[log.component] || 0) + 1
      }
    })

    // 计算错误率
    const sessionDuration = Date.now() - this.sessionStartTime
    const errorRate = this.userActionCount > 0 ? (logs.length / this.userActionCount) * 100 : 0

    // 最常见错误
    const errorGroups = new Map<string, { count: number; last: number }>()
    logs.forEach(log => {
      const key = log.message
      const existing = errorGroups.get(key) || { count: 0, last: 0 }
      existing.count += log.count
      existing.last = Math.max(existing.last, log.lastOccurred)
      errorGroups.set(key, existing)
    })

    const mostCommonErrors = Array.from(errorGroups.entries())
      .map(([message, data]) => ({
        message,
        count: data.count,
        lastOccurred: data.last
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    return {
      total: logs.length,
      byLevel,
      byType,
      byHour,
      byComponent,
      unresolved: logs.filter(l => !l.resolved).length,
      reported: logs.filter(l => l.reported).length,
      errorRate,
      averageResolutionTime: this.calculateAverageResolutionTime(),
      mostCommonErrors
    }
  }

  /**
   * 计算平均解决时间
   */
  private calculateAverageResolutionTime(): number {
    const resolvedLogs = Array.from(this.logs.values()).filter(l => l.resolved)
    if (resolvedLogs.length === 0) return 0

    const totalTime = resolvedLogs.reduce((sum, log) => {
      return sum + (log.resolved ? (Date.now() - log.timestamp) : 0)
    }, 0)

    return totalTime / resolvedLogs.length
  }

  /**
   * 启动定时上报
   */
  private startPeriodicReporting(): void {
    this.reportTimer = window.setInterval(() => {
      this.flushReports()
    }, this.config.reportInterval)
  }

  /**
   * 上报单个错误
   */
  private async reportError(entry: ErrorLogEntry): Promise<void> {
    if (!this.config.enabled || entry.reported) return

    // 检查是否需要上报
    if (!this.shouldReport(entry)) return

    try {
      const reportData = {
        sessionId: this.sessionId,
        userId: entry.userId,
        error: {
          id: entry.id,
          level: entry.level,
          type: entry.type,
          message: entry.message,
          stack: entry.stack,
          context: entry.context,
          component: entry.component,
          action: entry.action,
          tags: entry.tags,
          timestamp: entry.timestamp,
          url: entry.url,
          userAgent: entry.userAgent
        },
        environment: this.getEnvironmentInfo(),
        session: {
          startTime: this.sessionStartTime,
          duration: Date.now() - this.sessionStartTime,
          userActionCount: this.userActionCount,
          errorCount: this.logs.size
        }
      }

      await unifiedApi.post(this.config.endpoint, reportData)
      entry.reported = true

    } catch (error) {
      logger.warn('错误上报失败:', error)
    }
  }

  /**
   * 判断是否应该上报
   */
  private shouldReport(entry: ErrorLogEntry): boolean {
    // 检查级别
    if (!this.config.levelsToReport.includes(entry.level)) {
      return false
    }

    // 检查类型
    if (!this.config.typesToReport.includes(entry.type)) {
      return false
    }

    return true
  }

  /**
   * 获取环境信息
   */
  private getEnvironmentInfo(): Record<string, any> {
    return {
      appVersion: import.meta.env.VITE_APP_VERSION,
      buildTime: import.meta.env.VITE_BUILD_TIME,
      mode: import.meta.env.MODE,
      url: window.location.href,
      referrer: document.referrer,
      screen: {
        width: screen.width,
        height: screen.height,
        colorDepth: screen.colorDepth
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      connection: (navigator as any).connection ? {
        effectiveType: (navigator as any).connection.effectiveType,
        downlink: (navigator as any).connection.downlink,
        rtt: (navigator as any).connection.rtt
      } : null,
      memory: (performance as any).memory ? {
        usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
        totalJSHeapSize: (performance as any).memory.totalJSHeapSize
      } : null
    }
  }

  /**
   * 批量上报错误
   */
  public async flushReports(): Promise<void> {
    if (!this.config.enabled) return

    const unreportedLogs = Array.from(this.logs.values())
      .filter(log => !log.reported && this.shouldReport(log))
      .slice(0, this.config.batchSize)

    if (unreportedLogs.length === 0) return

    try {
      const reportData = {
        sessionId: this.sessionId,
        userId: this.getCurrentUserId(),
        errors: unreportedLogs.map(log => ({
          id: log.id,
          level: log.level,
          type: log.type,
          message: log.message,
          stack: log.stack,
          context: log.context,
          component: log.component,
          action: log.action,
          tags: log.tags,
          timestamp: log.timestamp,
          count: log.count,
          url: log.url,
          userAgent: log.userAgent
        })),
        environment: this.getEnvironmentInfo(),
        session: {
          startTime: this.sessionStartTime,
          duration: Date.now() - this.sessionStartTime,
          userActionCount: this.userActionCount,
          errorCount: this.logs.size
        },
        statistics: this.getStatistics()
      }

      await unifiedApi.post(this.config.endpoint, reportData)

      // 标记为已上报
      unreportedLogs.forEach(log => {
        log.reported = true
      })

    } catch (error) {
      logger.warn('批量错误上报失败:', error)
    }
  }

  /**
   * 标记错误为已解决
   */
  public resolveError(errorId: string): void {
    const log = this.logs.get(errorId)
    if (log) {
      log.resolved = true
    }
  }

  /**
   * 清理旧日志
   */
  public cleanup(maxAge: number = 7 * 24 * 60 * 60 * 1000): void {
    const cutoff = Date.now() - maxAge
    for (const [id, log] of this.logs.entries()) {
      if (log.timestamp < cutoff && log.resolved) {
        this.logs.delete(id)
      }
    }
  }

  /**
   * 导出日志
   */
  public exportLogs(): string {
    const logs = Array.from(this.logs.values()).sort((a, b) => b.timestamp - a.timestamp)
    const exportData = {
      sessionId: this.sessionId,
      exportTime: TimeUtil.now().toISOString(),
      statistics: this.getStatistics(),
      logs
    }
    return JSON.stringify(exportData, null, 2)
  }

  /**
   * 清空日志
   */
  public clear(): void {
    this.logs.clear()
  }

  /**
   * 获取日志列表
   */
  public getLogs(): ErrorLogEntry[] {
    return Array.from(this.logs.values()).sort((a, b) => b.timestamp - a.timestamp)
  }

  /**
   * 根据条件过滤日志
   */
  public filterLogs(filters: {
    level?: ErrorLevel
    type?: ErrorType
    resolved?: boolean
    component?: string
    timeRange?: { start: number; end: number }
  }): ErrorLogEntry[] {
    return this.getLogs().filter(log => {
      if (filters.level && log.level !== filters.level) return false
      if (filters.type && log.type !== filters.type) return false
      if (filters.resolved !== undefined && log.resolved !== filters.resolved) return false
      if (filters.component && log.component !== filters.component) return false
      if (filters.timeRange) {
        if (log.timestamp < filters.timeRange.start || log.timestamp > filters.timeRange.end) {
          return false
        }
      }
      return true
    })
  }

  /**
   * 销毁日志系统
   */
  public destroy(): void {
    if (this.reportTimer) {
      clearInterval(this.reportTimer)
    }
    this.flushReports()
  }
}

// 创建全局实例
export const globalErrorLogger = new ErrorLogger()

// 导出Composable
export function useErrorLogger() {
  const logs = ref<ErrorLogEntry[]>([])
  const statistics = computed(() => globalErrorLogger.getStatistics())

  const logError = (error: {
    level: ErrorLevel
    type: ErrorType
    message: string
    stack?: string
    context?: Record<string, any>
    component?: string
    action?: string
    tags?: string[]
  }) => {
    const errorId = globalErrorLogger.logError(error)
    logs.value = globalErrorLogger.getLogs()
    return errorId
  }

  const resolveError = (errorId: string) => {
    globalErrorLogger.resolveError(errorId)
    logs.value = globalErrorLogger.getLogs()
  }

  const getLogs = (filters?: Parameters<typeof globalErrorLogger.filterLogs>[0]) => {
    if (filters) {
      return globalErrorLogger.filterLogs(filters)
    }
    return globalErrorLogger.getLogs()
  }

  const exportLogs = () => {
    return globalErrorLogger.exportLogs()
  }

  const clearLogs = () => {
    globalErrorLogger.clear()
    logs.value = []
  }

  const flushReports = () => {
    return globalErrorLogger.flushReports()
  }

  return {
    logs,
    statistics,
    logError,
    resolveError,
    getLogs,
    exportLogs,
    clearLogs,
    flushReports
  }
}

export default globalErrorLogger