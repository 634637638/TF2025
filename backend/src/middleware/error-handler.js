// 统一错误处理中间件
const log = require('../utils/log')
const { isDatabaseAvailabilityError } = require('../utils/database-errors')
const { redactUrl, redactValue } = require('../utils/sensitive-data')

const errorHandler = (err, req, res, _next) => {
  const sendError = (statusCode, message, code) => res.status(statusCode).json({
    success: false,
    message: statusCode >= 500 ? '服务器内部错误，请稍后重试' : message,
    code,
    request_id: req.requestId
  })

  log.error('请求处理失败', {
    requestId: req.requestId,
    method: req.method,
    url: redactUrl(req.originalUrl || req.url),
    error: redactValue(err)
  })

  // 数据库连接错误
  if (isDatabaseAvailabilityError(err)) {
    return sendError(503, '数据库连接暂时不可用，请稍后重试', 'DB_CONNECTION_ERROR')
  }

  // 数据库访问错误
  if (err.code === 'ER_ACCESS_DENIED_ERROR') {
    return sendError(500, '数据库访问权限不足', 'DB_ACCESS_ERROR')
  }

  // 数据库不存在错误
  if (err.code === 'ER_BAD_DB_ERROR') {
    return sendError(500, '数据库不存在或配置错误', 'DB_NOT_FOUND')
  }

  // 验证错误
  if (err.name === 'ValidationError') {
    return sendError(400, err.message, 'VALIDATION_ERROR')
  }

  // JWT错误
  if (err.name === 'JsonWebTokenError') {
    return sendError(401, '令牌无效', 'INVALID_TOKEN')
  }

  if (err.name === 'TokenExpiredError') {
    return sendError(401, '令牌已过期，请重新登录', 'TOKEN_EXPIRED')
  }

  // 语法错误
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return sendError(400, '请求数据格式错误', 'INVALID_JSON')
  }

  // 类型错误
  if (err instanceof TypeError) {
    return sendError(400, '数据类型错误', 'TYPE_ERROR')
  }

  // 范围错误
  if (err instanceof RangeError) {
    return sendError(400, '数据范围错误', 'RANGE_ERROR')
  }

  // 自定义应用错误
  if (err.isApplicationError) {
    return sendError(err.statusCode || 500, err.message, err.code || 'APPLICATION_ERROR')
  }

  // 所有环境统一使用安全响应；详细错误只保留在服务端日志并通过 request_id 关联。
  const statusCode = Number.isInteger(err.status) ? err.status : 500
  const isClientError = statusCode >= 400 && statusCode < 500
  return sendError(
    statusCode,
    isClientError ? (err.message || '请求处理失败') : '服务器内部错误，请稍后重试',
    isClientError ? (err.code || 'REQUEST_ERROR') : 'INTERNAL_ERROR'
  )
}

// 自定义应用错误类
class ApplicationError extends Error {
  constructor(message, statusCode = 500, code = 'APPLICATION_ERROR') {
    super(message)
    this.name = 'ApplicationError'
    this.statusCode = statusCode
    this.code = code
    this.isApplicationError = true
    Error.captureStackTrace(this, this.constructor)
  }
}

module.exports = errorHandler
module.exports.ApplicationError = ApplicationError
