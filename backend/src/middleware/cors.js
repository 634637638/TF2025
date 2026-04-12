const cors = require('cors');
const log = require('../utils/log');

// 从环境变量获取允许的域名，默认包含开发环境
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : [
      'http://localhost:5173',  // Vite开发服务器
      'http://localhost:5176',  // Vite开发服务器（备用）
      'http://localhost:3000',  // 备用前端端口
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5176',
      'http://127.0.0.1:3000'
    ];

// CORS配置选项
const corsOptions = {
  origin: (origin, callback) => {
    // 允许没有origin的请求（如移动应用、Postman等）
    if (!origin) {
      return callback(null, true);
    }

    // 如果配置了 '*' ，允许所有域名
    if (allowedOrigins.includes('*')) {
      return callback(null, true);
    }

    // 检查origin是否在允许列表中
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      log.warn(`CORS阻止的请求来源: ${origin}`);
      callback(new Error('不被CORS策略允许'));
    }
  },

  // 允许的HTTP方法
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],

  // 允许的请求头
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'X-Device-Info',
    'X-Required-Permission',
    'X-CSRF-Token'
  ],

  // 暴露给客户端的响应头
  exposedHeaders: [
    'X-Total-Count',
    'X-Page-Count',
    'X-Login-Attempts-Remaining'
  ],

  // 是否允许发送凭据（cookies, authorization headers等）
  credentials: true,

  // 预检请求的缓存时间（秒）
  maxAge: 86400, // 24小时

  // 预检请求的状态码
  optionsSuccessStatus: 200,

  // 是否通过预检请求
  preflightContinue: false,

  // 传递CORS错误给错误处理中间件
  passErrorToNext: false
};

// 开发环境的宽松CORS配置
const developmentCorsOptions = {
  ...corsOptions,
  origin: true, // 开发环境允许所有来源
  credentials: true
};

// 根据环境选择CORS配置
const corsMiddleware = process.env.NODE_ENV === 'production'
  ? cors(corsOptions)
  : cors(developmentCorsOptions);

// 日志记录中间件
const corsLogger = (req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    log.debug(`CORS请求 - 来源: ${origin}, 方法: ${req.method}, 路径: ${req.path}`);
  }
  next();
};

module.exports = {
  corsMiddleware,
  corsLogger,
  corsOptions,
  allowedOrigins
};
