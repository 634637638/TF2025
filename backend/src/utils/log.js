/**
 * 统一日志工具封装
 * 提供简洁的日志接口，替代原生控制台输出
 *
 * ⭐ 这是后端日志统一入口，业务层使用此文件
 * ⭐ 禁止直接使用 logger.js（底层引擎）
 *
 * 使用方式:
 * const log = require('../utils/log')
 * log.info('消息')
 * log.error('错误', error)
 * log.debug('调试信息')
 *
 * @see docs/guides/LOG_SYSTEM_STANDARDS.md 日志系统规范文档
 */

const logger = require('./logger')

/**
 * 格式化参数
 */
const formatArgs = (args) => {
  if (args.length === 0) return ''
  if (args.length === 1) {
    const arg = args[0]
    if (typeof arg === 'object' && arg !== null) {
      if (arg instanceof Error) {
        return `${arg.message}\n${arg.stack || ''}`
      }
      try {
        return JSON.stringify(arg, null, 2)
      } catch (e) {
        return String(arg)
      }
    }
    return String(arg)
  }
  return args.map(arg => {
    if (typeof arg === 'object' && arg !== null) {
      try {
        return JSON.stringify(arg)
      } catch (e) {
        return String(arg)
      }
    }
    return String(arg)
  }).join(' ')
}

/**
 * 统一日志接口
 */
const log = {
  /**
   * 信息日志
   */
  info: (...args) => {
    logger.info(formatArgs(args))
  },

  /**
   * 错误日志
   */
  error: (...args) => {
    logger.error(formatArgs(args))
  },

  /**
   * 警告日志
   */
  warn: (...args) => {
    logger.warn(formatArgs(args))
  },

  /**
   * 调试日志（仅开发环境）
   */
  debug: (...args) => {
    if (process.env.NODE_ENV !== 'production') {
      logger.debug(formatArgs(args))
    }
  },

  /**
   * HTTP 请求日志
   */
  http: (...args) => {
    logger.http(formatArgs(args))
  },

  /**
   * 成功日志（带图标）
   */
  success: (...args) => {
    logger.info(`✅ ${formatArgs(args)}`)
  },

  /**
   * 失败日志（带图标）
   */
  fail: (...args) => {
    logger.error(`❌ ${formatArgs(args)}`)
  },

  /**
   * 开始日志（带图标）
   */
  start: (...args) => {
    logger.info(`🚀 ${formatArgs(args)}`)
  },

  /**
   * 完成日志（带图标）
   */
  done: (...args) => {
    logger.info(`🎉 ${formatArgs(args)}`)
  },

  /**
   * 数据库操作日志
   */
  db: (...args) => {
    logger.debug(`[DB] ${formatArgs(args)}`)
  },

  /**
   * API 请求日志
   */
  api: (...args) => {
    logger.http(`[API] ${formatArgs(args)}`)
  }
}

module.exports = log
