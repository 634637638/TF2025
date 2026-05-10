/**
 * 日志工具 - 根据环境控制日志输出
 *
 * ⭐ 这是前端日志统一入口，业务层使用此文件
 *
 * 使用方式:
 * import { logger } from '@/utils/logger'
 * logger.info('消息')
 * logger.error('错误', error)
 *
 * @see docs/guides/LOG_SYSTEM_STANDARDS.md 日志系统规范文档
 */

const LOGGER_TIMEZONE = 'Asia/Shanghai'

function formatLogTimestamp(date: Date): string {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: LOGGER_TIMEZONE,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(date)
}

interface LogConfig {
  level: 'debug' | 'info' | 'warn' | 'error' | 'none'
  enableConsole: boolean
  enableFileLog: boolean
}

class Logger {
  private config: LogConfig = {
    level: 'info',
    enableConsole: true,
    enableFileLog: false
  }

  constructor() {
    // 根据环境自动配置
    if (import.meta.env.PROD) {
      this.config = {
        level: 'none',
        enableConsole: false,
        enableFileLog: true
      }
    } else {
      this.config = {
        level: 'debug',
        enableConsole: true,
        enableFileLog: false
      }
    }
  }

  private shouldLog(level: string): boolean {
    const levels = ['debug', 'info', 'warn', 'error']
    if (this.config.level === 'none') return false
    return levels.indexOf(level) >= levels.indexOf(this.config.level)
  }

  private formatMessage(level: string, message: string, data?: any): unknown[] {
    const timestamp = formatLogTimestamp(new Date())
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`

    if (typeof data !== 'undefined') {
      return [`${prefix} ${message}:`, data]
    }

    return [`${prefix} ${message}`]
  }

  debug(message: string, data?: any): void {
    if (!this.shouldLog('debug') || !this.config.enableConsole) return
    console.debug(...this.formatMessage('debug', message, data))
  }

  info(message: string, data?: any): void {
    if (!this.shouldLog('info') || !this.config.enableConsole) return
    console.info(...this.formatMessage('info', message, data))
  }

  warn(message: string, data?: any): void {
    if (!this.shouldLog('warn') || !this.config.enableConsole) return
    console.warn(...this.formatMessage('warn', message, data))
  }

  error(message: string, error?: any): void {
    if (!this.shouldLog('error') || !this.config.enableConsole) return
    console.error(...this.formatMessage('error', message, error))

    // 错误日志可以发送到服务器
    if (this.config.enableFileLog && import.meta.env.PROD) {
      this.sendToServer(message, error)
    }
  }

  private sendToServer(message: string, error: any): void {
    // 发送错误日志到服务器
    try {
      fetch('/api/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message,
          error: error?.stack || error,
          timestamp: new Date().toISOString(),
          url: window.location.href,
          userAgent: navigator.userAgent
        })
      }).catch(() => {
        // 忽略日志发送失败
      })
    } catch {
      // 忽略日志发送失败
    }
  }

  // 创建组件日志
  createComponentLogger(componentName: string) {
    return {
      debug: (message: string, data?: any) => {
        this.debug(`[${componentName}] ${message}`, data)
      },
      info: (message: string, data?: any) => {
        this.info(`[${componentName}] ${message}`, data)
      },
      warn: (message: string, data?: any) => {
        this.warn(`[${componentName}] ${message}`, data)
      },
      error: (message: string, error?: any) => {
        this.error(`[${componentName}] ${message}`, error)
      }
    }
  }
}

// 创建全局日志实例
export const logger = new Logger()

// 为了兼容现有代码，暂时保留这些方法，但内部使用新的日志系统
export const consoleLog = {
  log: (...args: any[]) => {
    if (import.meta.env.DEV) {
      console.log(...args)
    }
  },
  info: (...args: any[]) => logger.info(args[0], args[1]),
  warn: (...args: any[]) => logger.warn(args[0], args[1]),
  error: (...args: any[]) => logger.error(args[0], args[1])
}

// 默认导出
export default logger
