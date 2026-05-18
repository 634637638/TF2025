/**
 * Winston 日志配置
 * 提供统一的日志管理，支持按日期分割日志文件
 *
 * ⭐ 这是底层日志引擎，业务层不可直接使用
 * ⭐ 业务层请使用 log.js 作为统一入口
 *
 * @see docs/guides/LOG_SYSTEM_STANDARDS.md 日志系统规范文档
 * @see log.js 统一日志入口
 */

const winston = require('winston');
const path = require('path');
const DailyRotateFile = require('winston-daily-rotate-file');
const { ensureLogDir } = require('./log-paths');

// 日志目录
const logDir = ensureLogDir();

// 日志格式
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// 控制台格式（开发环境）
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// 创建日志传输器
const transports = {
  // 控制台输出
  console: new winston.transports.Console({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: consoleFormat
  }),

  // 错误日志（按日期分割）
  error: new DailyRotateFile({
    filename: path.join(logDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    maxSize: '20m',
    maxFiles: '30d'
  }),

  // 组合日志（所有级别）
  combined: new DailyRotateFile({
    filename: path.join(logDir, 'combined-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d'
  }),

  // API 请求日志
  api: new DailyRotateFile({
    filename: path.join(logDir, 'api-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'http',
    maxSize: '20m',
    maxFiles: '7d'
  })
};

// 创建 logger 实例
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    transports.error,
    transports.combined,
    transports.api
  ],
  // 生产环境不输出到控制台
  ...(process.env.NODE_ENV === 'production' ? {} : {
    exceptionHandlers: [
      new winston.transports.File({ filename: path.join(logDir, 'exceptions.log') })
    ],
    rejectionHandlers: [
      new winston.transports.File({ filename: path.join(logDir, 'rejections.log') })
    ]
  })
});

// 开发环境添加控制台输出
if (process.env.NODE_ENV !== 'production') {
  logger.add(transports.console);
}

// 便捷方法
logger.api = (req, res, next) => {
  const { method, url, ip } = req;
  logger.http(`${method} ${url}`, {
    ip: ip,
    userAgent: req.get('user-agent')
  });
  next();
};

// 流式日志（用于替换原生控制台输出）
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  }
};

module.exports = logger;
