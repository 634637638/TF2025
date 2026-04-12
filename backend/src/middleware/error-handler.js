// 统一错误处理中间件
const log = require('../utils/log');

const errorHandler = (err, req, res, next) => {
  log.error('Error:', err);
  log.error('Request URL:', req.url);
  log.error('Request Method:', req.method);

  // 数据库连接错误
  if (err.code === 'ECONNRESET' || err.code === 'PROTOCOL_CONNECTION_LOST') {
    return res.status(503).json({
      success: false,
      message: '数据库连接失败，请稍后重试',
      code: 'DB_CONNECTION_ERROR'
    });
  }

  // 数据库访问错误
  if (err.code === 'ER_ACCESS_DENIED_ERROR') {
    return res.status(500).json({
      success: false,
      message: '数据库访问权限不足',
      code: 'DB_ACCESS_ERROR'
    });
  }

  // 数据库不存在错误
  if (err.code === 'ER_BAD_DB_ERROR') {
    return res.status(500).json({
      success: false,
      message: '数据库不存在或配置错误',
      code: 'DB_NOT_FOUND'
    });
  }

  // 验证错误
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: err.message,
      code: 'VALIDATION_ERROR'
    });
  }

  // JWT错误
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: '令牌无效',
      code: 'INVALID_TOKEN'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: '令牌已过期，请重新登录',
      code: 'TOKEN_EXPIRED'
    });
  }

  // 语法错误
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      message: '请求数据格式错误',
      code: 'INVALID_JSON'
    });
  }

  // 类型错误
  if (err instanceof TypeError) {
    return res.status(400).json({
      success: false,
      message: '数据类型错误',
      code: 'TYPE_ERROR'
    });
  }

  // 范围错误
  if (err instanceof RangeError) {
    return res.status(400).json({
      success: false,
      message: '数据范围错误',
      code: 'RANGE_ERROR'
    });
  }

  // 连接池为空错误
  if (err.message && err.message.includes('连接池为空')) {
    return res.status(503).json({
      success: false,
      message: '数据库连接池暂不可用，请稍后重试',
      code: 'POOL_EMPTY'
    });
  }

  // 自定义应用错误
  if (err.isApplicationError) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message,
      code: err.code || 'APPLICATION_ERROR'
    });
  }

  // 默认错误
  res.status(err.status || 500).json({
    success: false,
    message: err.message || '服务器内部错误',
    code: err.code || 'INTERNAL_ERROR',
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      details: {
        url: req.url,
        method: req.method,
        body: req.body,
        params: req.params,
        query: req.query
      }
    })
  });
};

// 自定义应用错误类
class ApplicationError extends Error {
  constructor(message, statusCode = 500, code = 'APPLICATION_ERROR') {
    super(message);
    this.name = 'ApplicationError';
    this.statusCode = statusCode;
    this.code = code;
    this.isApplicationError = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = errorHandler;
module.exports.ApplicationError = ApplicationError;

