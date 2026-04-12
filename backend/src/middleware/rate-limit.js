const rateLimit = require('express-rate-limit');
const { getDatabase, isConnected } = require('../config/database');
const log = require('../utils/log');

// 内存存储用于限流计数器
const store = {
  // Map结构存储IP访问计数 {ip: {count: number, resetTime: number}}
  requests: new Map(),

  // 获取IP的请求计数
  get: async (key) => {
    const data = store.requests.get(key);
    if (!data) {
      return null;
    }

    // 检查是否过期
    if (Date.now() > data.resetTime) {
      store.requests.delete(key);
      return null;
    }

    return { totalHits: data.count, resetTime: data.resetTime };
  },

  // 设置IP的请求计数
  set: async (key, value, ttlMs) => {
    store.requests.set(key, {
      count: value.totalHits,
      resetTime: Date.now() + ttlMs
    });
  },

  // 删除IP记录
  delete: async (key) => {
    store.requests.delete(key);
  },

  // 定期清理过期记录
  cleanup: () => {
    const now = Date.now();
    for (const [key, data] of store.requests.entries()) {
      if (now > data.resetTime) {
        store.requests.delete(key);
      }
    }
  }
};

// 每5分钟清理一次过期记录
setInterval(store.cleanup, 5 * 60 * 1000);

// 基础限流配置
const baseRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 每个IP最多100个请求
  message: {
    success: false,
    message: '请求过于频繁，请15分钟后再试',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: '900' // 15分钟
  },
  standardHeaders: true, // 返回标准的RateLimit头
  legacyHeaders: false, // 禁用X-RateLimit-*头
  store: store,
  keyGenerator: (req) => {
    // 优先使用真实IP
    return req.ip ||
           req.connection.remoteAddress ||
           req.socket.remoteAddress ||
           (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
           'unknown';
  },
  skip: (req) => {
    // 跳过健康检查等内部请求
    return req.path === '/health' || req.path === '/ping';
  }
});

// 严格的认证API限流（登录、注册等）
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 5, // 每个IP最多5次登录尝试
  message: {
    success: false,
    message: '登录尝试次数过多，请15分钟后再试',
    code: 'AUTH_RATE_LIMIT_EXCEEDED',
    retryAfter: '900'
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: store,
  keyGenerator: (req) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const identifier = req.body.username || req.body.email || 'anonymous';
    return `${ip}:${identifier}`;
  }
});

// 搜索API限流（较宽松）
const searchRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1分钟
  max: 30, // 每个IP每分钟30次搜索
  message: {
    success: false,
    message: '搜索请求过于频繁，请1分钟后再试',
    code: 'SEARCH_RATE_LIMIT_EXCEEDED',
    retryAfter: '60'
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: store
});

// 文件上传限流（更严格）
const uploadRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1小时
  max: 10, // 每个IP每小时10次上传
  message: {
    success: false,
    message: '上传请求过于频繁，请1小时后再试',
    code: 'UPLOAD_RATE_LIMIT_EXCEEDED',
    retryAfter: '3600'
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: store
});

// 数据库操作限流
const dbRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1分钟
  max: 200, // 每个IP每分钟200次数据库操作
  message: {
    success: false,
    message: '数据库操作过于频繁，请稍后再试',
    code: 'DB_RATE_LIMIT_EXCEEDED',
    retryAfter: '60'
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: store,
  skip: (req) => {
    // 跳过静态资源和健康检查
    return req.path.startsWith('/static') ||
           req.path === '/health' ||
           req.path === '/ping';
  }
});

// 自适应限流 - 根据系统负载调整限流
const adaptiveRateLimit = (req, res, next) => {
  // 检查数据库连接状态
  if (!isConnected()) {
    return res.status(503).json({
      success: false,
      message: '服务暂时不可用，请稍后再试',
      code: 'SERVICE_UNAVAILABLE'
    });
  }

  // 检查当前内存使用情况
  const memUsage = process.memoryUsage();
  const memUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

  // 如果内存使用超过80%，启用更严格的限流
  if (memUsagePercent > 80) {
    log.warn(`内存使用率过高: ${memUsagePercent.toFixed(2)}%，启用严格限流`);

    const strictLimit = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 20, // 大幅降低限制
      message: {
        success: false,
        message: '服务器负载较高，请稍后再试',
        code: 'HIGH_LOAD_RATE_LIMIT'
      },
      store: store
    });

    return strictLimit(req, res, next);
  }

  // 正常限流
  return baseRateLimit(req, res, next);
};

// 限流日志记录
const rateLimitLogger = (req, res, next) => {
  const originalSend = res.send;

  res.send = function(data) {
    // 记录限流响应
    if (res.statusCode === 429) {
      const ip = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'] || 'Unknown';

      log.warn(`限流触发 - IP: ${ip}, 路径: ${req.path}, User-Agent: ${userAgent}`);

      // 可以在这里发送告警或记录到数据库
      if (isConnected()) {
        logRateLimitEvent(ip, req.path, userAgent);
      }
    }

    return originalSend.call(this, data);
  };

  next();
};

// 记录限流事件到数据库
async function logRateLimitEvent(ip, path, userAgent) {
  try {
    const database = getDatabase();
    await database.execute(
      'INSERT INTO rate_limit_logs (ip, path, user_agent, created_at) VALUES (?, ?, ?, NOW())',
      [ip, path, userAgent]
    );
  } catch (error) {
    log.error('记录限流事件失败:', error);
  }
}

// 获取当前限流统计信息
const getRateLimitStats = () => {
  const totalIPs = store.requests.size;
  let totalRequests = 0;

  for (const data of store.requests.values()) {
    totalRequests += data.count;
  }

  return {
    totalIPs,
    totalRequests,
    memoryUsage: process.memoryUsage(),
    timestamp: new Date().toISOString()
  };
};

module.exports = {
  baseRateLimit,
  authRateLimit,
  searchRateLimit,
  uploadRateLimit,
  dbRateLimit,
  adaptiveRateLimit,
  rateLimitLogger,
  getRateLimitStats,
  store
};