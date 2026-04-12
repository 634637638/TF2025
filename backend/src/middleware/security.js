const helmet = require('helmet');
const log = require('../utils/log');

// 内容安全策略配置
const contentSecurityPolicy = {
  directives: {
    defaultSrc: ["'self'"],
    styleSrc: [
      "'self'",
      "'unsafe-inline'", // 允许内联样式（某些UI库需要）
      'fonts.googleapis.com'
    ],
    scriptSrc: [
      "'self'",
      "'unsafe-eval'", // Vue开发模式需要
      'cdnjs.cloudflare.com'
    ],
    imgSrc: [
      "'self'",
      'data:',
      'https:'
    ],
    fontSrc: [
      "'self'",
      'fonts.gstatic.com'
    ],
    connectSrc: [
      "'self'",
      'http://localhost:3000',
      'https://v4.cn9527.cn' // 数据库域名（如需要）
    ],
    mediaSrc: ["'self'"],
    objectSrc: ["'none'"],
    childSrc: ["'none'"],
    frameSrc: ["'none'"],
    workerSrc: ["'self'"],
    manifestSrc: ["'self'"],
    upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
  }
};

// 开发环境放宽的安全策略
const developmentSecurity = {
  contentSecurityPolicy: false, // 开发环境禁用CSP以避免Vue HMR问题
  crossOriginEmbedderPolicy: false
};

// 生产环境严格的安全策略
const productionSecurity = {
  contentSecurityPolicy: {
    ...contentSecurityPolicy,
    directives: {
      ...contentSecurityPolicy.directives,
      scriptSrc: [
        "'self'",
        'cdnjs.cloudflare.com'
      ],
      styleSrc: [
        "'self'",
        'fonts.googleapis.com'
      ],
      upgradeInsecureRequests: [] // 强制HTTPS
    }
  },
  crossOriginEmbedderPolicy: { policy: "require-corp" },
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: { policy: "same-origin" }
};

// 根据环境选择安全配置
const securityOptions = process.env.NODE_ENV === 'production'
  ? productionSecurity
  : developmentSecurity;

// 创建helmet中间件
const securityMiddleware = helmet({
  ...securityOptions,

  // 其他helmet配置
  dnsPrefetchControl: {
    allow: false
  },
  frameguard: {
    action: 'deny'
  },
  hidePoweredBy: true,
  hsts: process.env.NODE_ENV === 'production' ? {
    maxAge: 31536000, // 1年
    includeSubDomains: true,
    preload: true
  } : false,
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: false,
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin'
  },
  xssFilter: true
});

// 自定义安全头中间件
const customSecurityHeaders = (req, res, next) => {
  // 移除可能泄露服务器信息的头
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');

  // 添加自定义安全头
  res.setHeader('X-API-Version', '1.0.0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security',
    process.env.NODE_ENV === 'production'
      ? 'max-age=31536000; includeSubDomains; preload'
      : 'max-age=3600' // 开发环境较短时间
  );

  // API限流信息头（如果有）
  res.setHeader('X-RateLimit-Limit', '100');
  res.setHeader('X-RateLimit-Remaining', '99');
  res.setHeader('X-RateLimit-Reset', new Date(Date.now() + 15 * 60 * 1000).toISOString());

  next();
};

// 安全日志记录
const securityLogger = (req, res, next) => {
  const suspiciousPatterns = [
    /\.\./,           // 路径遍历
    /<script/i,      // XSS尝试
    /union.*select/i, // SQL注入尝试
    /javascript:/i,   // JavaScript协议
    /data:.*base64/i  // Base64编码内容
  ];

  const url = req.url;
  const userAgent = req.headers['user-agent'] || '';
  const ip = req.ip || req.connection.remoteAddress;

  // 检查可疑请求
  const isSuspicious = suspiciousPatterns.some(pattern =>
    pattern.test(url) || pattern.test(userAgent)
  );

  if (isSuspicious) {
    if (process.env.NODE_ENV === 'production') {
      log.warn('检测到可疑请求', {
        method: req.method,
        path: req.path
      });
    } else {
      log.warn('检测到可疑请求', {
        method: req.method,
        path: req.path,
        ip,
        userAgent
      });
    }
  }

  // 记录所有请求（开发环境）
  if (process.env.NODE_ENV !== 'production') {
    log.debug('安全日志', {
      method: req.method,
      path: req.path,
      ip
    });
  }

  next();
};

module.exports = {
  securityMiddleware,
  customSecurityHeaders,
  securityLogger,
  contentSecurityPolicy
};
