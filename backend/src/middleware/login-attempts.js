const { getDatabase, isConnected } = require('../config/database');
const log = require('../utils/log');

// 内存存储登录失败记录
const loginAttempts = new Map();

// 配置
const CONFIG = {
  MAX_ATTEMPTS: 5,           // 最大尝试次数
  LOCK_TIME: 15 * 60 * 1000, // 锁定时间15分钟
  ATTEMPT_TTL: 60 * 60 * 1000, // 记录保存1小时
  CLEANUP_INTERVAL: 5 * 60 * 1000 // 清理间隔5分钟
};

const FAILED_LOGIN_WARN_THRESHOLD = 3;

// 清理过期的登录尝试记录
function cleanupExpiredRecords() {
  const now = Date.now();
  for (const [key, data] of loginAttempts.entries()) {
    if (now > data.expiresAt) {
      loginAttempts.delete(key);
      log.debug(`清理过期登录记录: ${key}`);
    }
  }
}

// 定期清理
setInterval(cleanupExpiredRecords, CONFIG.CLEANUP_INTERVAL);

// 获取客户端标识符
function getClientIdentifier(req) {
  const ip = req.ip ||
           req.connection.remoteAddress ||
           req.socket.remoteAddress ||
           (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
           'unknown';

  // 对于登录请求，结合用户名和IP进行限制
  // 安全地访问请求体，避免undefined错误
  const username = (req.body && req.body.username) || (req.body && req.body.email) || 'anonymous';
  return `${ip}:${username}`;
}

// 检查登录尝试次数
function checkLoginAttempts(identifier) {
  const now = Date.now();
  const attempts = loginAttempts.get(identifier);

  if (!attempts) {
    return {
      blocked: false,
      attempts: 0,
      remainingAttempts: CONFIG.MAX_ATTEMPTS,
      resetTime: null
    };
  }

  // 如果记录已过期，重置计数
  if (now > attempts.expiresAt) {
    loginAttempts.delete(identifier);
    return {
      blocked: false,
      attempts: 0,
      remainingAttempts: CONFIG.MAX_ATTEMPTS,
      resetTime: null
    };
  }

  // 检查是否被锁定
  if (attempts.count >= CONFIG.MAX_ATTEMPTS && now < attempts.lockUntil) {
    return {
      blocked: true,
      attempts: attempts.count,
      remainingAttempts: 0,
      resetTime: attempts.lockUntil
    };
  }

  // 如果锁定时间已过但仍在限制期内，重置锁定状态
  if (attempts.count >= CONFIG.MAX_ATTEMPTS && now >= attempts.lockUntil) {
    attempts.count = 0; // 重置计数但保留记录
    attempts.lockUntil = null;
  }

  return {
    blocked: false,
    attempts: attempts.count,
    remainingAttempts: Math.max(0, CONFIG.MAX_ATTEMPTS - attempts.count),
    resetTime: attempts.expiresAt
  };
}

// 记录登录失败
function recordFailedLogin(identifier) {
  const now = Date.now();
  let attempts = loginAttempts.get(identifier);

  if (!attempts) {
    attempts = {
      count: 0,
      firstAttempt: now,
      lastAttempt: now,
      lockUntil: null,
      expiresAt: now + CONFIG.ATTEMPT_TTL
    };
    loginAttempts.set(identifier, attempts);
  }

  attempts.count++;
  attempts.lastAttempt = now;

  // 如果达到最大尝试次数，设置锁定时间
  if (attempts.count >= CONFIG.MAX_ATTEMPTS) {
    attempts.lockUntil = now + CONFIG.LOCK_TIME;
    log.warn(`账户被锁定: ${identifier}, 尝试次数: ${attempts.count}, 锁定至: ${new Date(attempts.lockUntil).toLocaleString()}`);
  }

  return {
    attempts: attempts.count,
    remainingAttempts: Math.max(0, CONFIG.MAX_ATTEMPTS - attempts.count),
    blocked: attempts.count >= CONFIG.MAX_ATTEMPTS,
    lockUntil: attempts.lockUntil,
    resetTime: attempts.expiresAt
  };
}

// 记录登录成功
function recordSuccessfulLogin(identifier) {
  // 成功登录后清除记录
  loginAttempts.delete(identifier);
  log.debug(`登录成功，清除失败记录: ${identifier}`);

  // 可选：记录成功登录到数据库
  if (isConnected()) {
    logSuccessfulLogin(identifier);
  }
}

// 记录成功登录到数据库
async function logSuccessfulLogin(identifier) {
  try {
    const database = getDatabase();
    const [ip, username] = identifier.split(':');

    await database.execute(
      'INSERT INTO login_logs (ip, username, status, created_at) VALUES (?, ?, ?, NOW())',
      [ip, username, 'success']
    );
  } catch (error) {
    log.error('记录成功登录失败', error);
  }
}

// 记录失败登录到数据库
async function logFailedLogin(identifier, reason = 'invalid_credentials') {
  try {
    const database = getDatabase();
    const [ip, username] = identifier.split(':');

    await database.execute(
      'INSERT INTO login_logs (ip, username, status, reason, created_at) VALUES (?, ?, ?, ?, NOW())',
      [ip, username, 'failed', reason]
    );
  } catch (error) {
    log.error('记录失败登录失败', error);
  }
}

// 登录尝试限制中间件
const loginAttemptsMiddleware = (req, res, next) => {
  // 只对登录接口应用此中间件
  if (req.path !== '/api/auth/login' || req.method !== 'POST') {
    return next();
  }

  const identifier = getClientIdentifier(req);
  const result = checkLoginAttempts(identifier);

  // 添加响应头
  res.setHeader('X-Login-Attempts-Remaining', result.remainingAttempts);

  if (result.blocked) {
    const resetTime = new Date(result.resetTime).toLocaleString();

    log.warn(`登录被阻止 - IP: ${identifier.split(':')[0]}, 重置时间: ${resetTime}`);

    // 记录到数据库
    logFailedLogin(identifier, 'rate_limited');

    return res.status(429).json({
      success: false,
      message: '登录尝试次数过多，账户已被临时锁定',
      code: 'LOGIN_RATE_LIMITED',
      details: {
        resetTime,
        lockDuration: Math.ceil((result.resetTime - Date.now()) / 60000) // 分钟
      }
    });
  }

  // 将检查结果附加到请求对象，供后续中间件使用
  req.loginAttempts = result;
  next();
};

// 登录失败处理中间件
const loginFailureHandler = (req, res, next) => {
  const originalJson = res.json;

  res.json = function(data) {
    // 检查是否是登录失败的响应
    const isLoginPath = req.path === '/api/auth/login';
    const isPostMethod = req.method === 'POST';
    const hasFailedFlag = req.loginFailed;
    const isErrorResponse = data?.success === false;
    const alreadyHandled = req.loginAttemptHandled === true;

    if (isLoginPath && isPostMethod && !alreadyHandled && (hasFailedFlag || isErrorResponse)) {

      const identifier = getClientIdentifier(req);
      const result = recordFailedLogin(identifier);
      req.loginAttemptHandled = true;

      // 记录到数据库
      logFailedLogin(identifier, 'invalid_credentials');

      if (result.attempts >= FAILED_LOGIN_WARN_THRESHOLD || result.blocked) {
        log.warn(`登录失败记录 - 标识符: ${identifier}, 尝试次数: ${result.attempts}`);
      }

      // 更新响应头
      res.setHeader('X-Login-Attempts-Remaining', result.remainingAttempts);

      // 如果这是最后一次失败，添加额外信息
      if (result.blocked) {
        const resetTime = new Date(result.lockUntil).toLocaleString();
        log.warn(`账户已被锁定 - 标识符: ${identifier}, 解锁时间: ${resetTime}`);
      }
    }

    return originalJson.call(this, data);
  };

  next();
};

// 获取登录尝试统计信息
const getLoginAttemptsStats = () => {
  const now = Date.now();
  let totalAttempts = 0;
  let blockedCount = 0;
  let activeRecords = 0;

  for (const [key, data] of loginAttempts.entries()) {
    if (now <= data.expiresAt) {
      activeRecords++;
      totalAttempts += data.count;

      if (data.count >= CONFIG.MAX_ATTEMPTS && now < data.lockUntil) {
        blockedCount++;
      }
    }
  }

  return {
    activeRecords,
    totalAttempts,
    blockedCount,
    maxAttempts: CONFIG.MAX_ATTEMPTS,
    lockTime: CONFIG.LOCK_TIME,
    timestamp: new Date().toISOString()
  };
};

// 手动清除指定用户的登录限制
const clearLoginAttempts = (identifier) => {
  const deleted = loginAttempts.delete(identifier);
  if (deleted) {
    log.info(`手动清除登录限制: ${identifier}`);
  }
  return deleted;
};

// 手动解锁所有被锁定的用户
const unlockAllUsers = () => {
  let unlockedCount = 0;

  for (const [key, data] of loginAttempts.entries()) {
    if (data.lockUntil) {
      data.lockUntil = null;
      data.count = 0;
      unlockedCount++;
    }
  }

  log.info(`手动解锁用户数量: ${unlockedCount}`);
  return unlockedCount;
};

module.exports = {
  loginAttemptsMiddleware,
  loginFailureHandler,
  getLoginAttemptsStats,
  clearLoginAttempts,
  unlockAllUsers,
  recordSuccessfulLogin,
  recordFailedLogin,
  checkLoginAttempts,
  getClientIdentifier,
  CONFIG
};
