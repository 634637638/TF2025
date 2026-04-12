const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { getDatabase } = require('../config/database');
const log = require('../utils/log');

/**
 * 🔒 增强的 CSRF 配置
 */
const CSRF_CONFIG = {
  TOKEN_LENGTH: 32,           // Token 长度（字节）
  TOKEN_EXPIRY: 3600,         // Token 过期时间（秒，1小时）
  TOKEN_TTL: 3600000,         // Token 保留时间（毫秒，1小时）
  MAX_TOKENS_PER_USER: 10,    // 每个用户最多持有的 Token 数量
  ENABLE_PERSISTENCE: true,   // 是否启用数据库持久化
  ENABLE_RATE_LIMIT: true,    // 是否启用速率限制
  CLEANUP_INTERVAL: 30 * 60 * 1000 // 清理过期 Token 的间隔（30分钟）
};

// 内存存储 CSRF Token（作为缓存）
const csrfTokens = new Map();

/**
 * 🔒 生成加密安全的 CSRF Token
 */
function generateSecureCSRFToken() {
  return crypto.randomBytes(CSRF_CONFIG.TOKEN_LENGTH).toString('hex');
}

/**
 * 🔒 生成 Token ID
 */
function generateTokenId() {
  return 'csrf_' + crypto.randomBytes(16).toString('hex') + '_' + Date.now();
}

/**
 * 🔒 存储 CSRF Token
 */
async function storeCSRFToken(userId, tokenId, token) {
  const expiresAt = Date.now() + CSRF_CONFIG.TOKEN_TTL;

  // 存储到内存
  csrfTokens.set(tokenId, {
    userId,
    token,
    createdAt: Date.now(),
    expiresAt
  });

  // 如果启用了持久化，存储到数据库
  if (CSRF_CONFIG.ENABLE_PERSISTENCE) {
    try {
      const db = getDatabase();
      await db.execute(
        `INSERT INTO csrf_tokens (token_id, user_id, token, created_at, expires_at)
         VALUES (?, ?, ?, NOW(), FROM_UNIXTIME(?))`,
        [tokenId, userId, token, expiresAt / 1000]
      );
    } catch (error) {
      log.error('存储 CSRF Token 到数据库失败:', error);
    }
  }
}

/**
 * 🔒 清理过期的 CSRF Token
 */
async function cleanupExpiredTokens(userId) {
  const now = Date.now();

  // 清理内存中的过期 Token
  for (const [tokenId, data] of csrfTokens.entries()) {
    if (data.userId === userId && now > data.expiresAt) {
      csrfTokens.delete(tokenId);
    }
  }

  // 限制每个用户的 Token 数量
  const userTokens = [];
  for (const [tokenId, data] of csrfTokens.entries()) {
    if (data.userId === userId && now <= data.expiresAt) {
      userTokens.push({ tokenId, createdAt: data.createdAt });
    }
  }

  // 按创建时间排序，删除最旧的
  if (userTokens.length > CSRF_CONFIG.MAX_TOKENS_PER_USER) {
    userTokens.sort((a, b) => a.createdAt - b.createdAt);
    const toDelete = userTokens.slice(0, userTokens.length - CSRF_CONFIG.MAX_TOKENS_PER_USER);

    for (const item of toDelete) {
      csrfTokens.delete(item.tokenId);

      // 从数据库删除
      if (CSRF_CONFIG.ENABLE_PERSISTENCE) {
        try {
          const db = getDatabase();
          await db.execute('DELETE FROM csrf_tokens WHERE token_id = ?', [item.tokenId]);
        } catch (error) {
          log.error('删除过期 CSRF Token 失败:', error);
        }
      }
    }
  }
}

/**
 * 🔒 验证 CSRF Token
 */
async function verifyCSRFToken(userId, token) {
  const now = Date.now();

  // 首先检查内存
  for (const [tokenId, data] of csrfTokens.entries()) {
    if (data.userId === userId && data.token === token && now <= data.expiresAt) {
      return true;
    }
  }

  // 如果内存中没有，检查数据库
  if (CSRF_CONFIG.ENABLE_PERSISTENCE) {
    try {
      const db = getDatabase();
      const [rows] = await db.execute(
        `SELECT token_id FROM csrf_tokens
         WHERE user_id = ? AND token = ? AND expires_at > NOW()
         LIMIT 1`,
        [userId, token]
      );

      if (rows.length > 0) {
        // 找到有效 Token，添加到内存缓存
        const tokenId = rows[0].token_id;
        csrfTokens.set(tokenId, {
          userId,
          token,
          createdAt: Date.now(),
          expiresAt: now + CSRF_CONFIG.TOKEN_TTL
        });
        return true;
      }
    } catch (error) {
      log.error('从数据库验证 CSRF Token 失败:', error);
    }
  }

  return false;
}

/**
 * 生成CSRF Token
 * 前端可以通过 GET /api/csrf/token 获取Token
 * 注意：此端点允许未登录用户获取临时 Token（用于初始会话）
 */
router.get('/token', async (req, res) => {
  try {
    // 获取用户 ID（如果已登录）或生成临时 ID（未登录）
    let userId;
    let isTemporary = false;

    if (req.user && req.user.id) {
      userId = req.user.id;
    } else {
      // 未登录用户使用 session ID 或生成临时 ID
      const sessionId = req.sessionID || req.ip || 'anonymous_' + Date.now();
      userId = 'temp_' + sessionId;
      isTemporary = true;
    }

    // 清理过期 Token
    await cleanupExpiredTokens(userId);

    // 生成新的 CSRF Token
    const token = generateSecureCSRFToken();
    const tokenId = generateTokenId();

    // 存储 Token
    await storeCSRFToken(userId, tokenId, token);

    // 设置 CSRF 相关的 HTTP 头
    res.setHeader('X-CSRF-Token', token);
    res.setHeader('X-CSRF-Token-Id', tokenId);

    res.json({
      success: true,
      message: isTemporary ? '临时 CSRF Token 生成成功' : 'CSRF Token 生成成功',
      data: {
        csrfToken: token,
        tokenId: tokenId,
        expiresIn: CSRF_CONFIG.TOKEN_EXPIRY, // 1小时过期
        isTemporary: isTemporary
      }
    });
  } catch (error) {
    log.error('生成 CSRF Token 失败:', error);
    res.status(500).json({
      success: false,
      message: '生成 CSRF Token 失败',
      error: error.message
    });
  }
});

/**
 * 验证CSRF Token
 * 前端通过 POST /api/csrf/verify 验证Token
 * 注意：未登录用户也可以验证临时 Token
 */
router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: '缺少 CSRF Token'
      });
    }

    // 获取用户 ID（如果已登录）或临时 ID（未登录）
    let userId;
    if (req.user && req.user.id) {
      userId = req.user.id;
    } else {
      // 未登录用户使用 session ID 或临时 ID
      const sessionId = req.sessionID || req.ip || 'anonymous_' + Date.now();
      userId = 'temp_' + sessionId;
    }

    const isValid = await verifyCSRFToken(userId, token);

    if (!isValid) {
      return res.status(403).json({
        success: false,
        message: 'CSRF Token 无效或已过期'
      });
    }

    // 验证通过
    res.json({
      success: true,
      message: 'CSRF Token 验证成功'
    });
  } catch (error) {
    log.error('验证 CSRF Token 失败:', error);
    res.status(500).json({
      success: false,
      message: '验证 CSRF Token 失败',
      error: error.message
    });
  }
});

// 保持向后兼容
router.get('/csrf-token', (req, res) => {
  req.url = '/token';
  return router.handle(req, res);
});

/**
 * 🔒 验证 CSRF Token 的中间件（增强版）
 */
function validateCSRFToken(req, res, next) {
  return (async () => {
    // 对于安全的方法（GET、HEAD、OPTIONS），跳过 CSRF 验证
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }

    // 检查用户是否已认证
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: '需要先登录',
        code: 'AUTHENTICATION_REQUIRED'
      });
    }

    // 获取 Token
    const token = req.headers['x-csrf-token'] || req.body._csrf || req.body.csrfToken;

    if (!token) {
      return res.status(403).json({
        success: false,
        message: '缺少 CSRF Token',
        code: 'CSRF_TOKEN_MISSING'
      });
    }

    // 验证 Token
    const isValid = await verifyCSRFToken(req.user.id, token);

    if (!isValid) {
      return res.status(403).json({
        success: false,
        message: 'CSRF Token 无效或已过期',
        code: 'CSRF_TOKEN_INVALID'
      });
    }

    // 验证通过，继续处理请求
    next();
  })().catch(error => {
    log.error('CSRF 验证中间件错误:', error);
    res.status(500).json({
      success: false,
      message: 'CSRF 验证失败',
      code: 'CSRF_VALIDATION_ERROR'
    });
  });
}

/**
 * 🔒 可选的 CSRF 验证中间件
 * 仅在提供了 Token 时进行验证
 */
function optionalCSRFValidation(req, res, next) {
  return (async () => {
    // 对于安全的方法，跳过
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }

    // 检查用户是否已认证
    if (!req.user || !req.user.id) {
      return next(); // 未认证用户跳过
    }

    // 获取 Token
    const token = req.headers['x-csrf-token'] || req.body._csrf || req.body.csrfToken;

    if (!token) {
      return next(); // 没有提供 Token，跳过验证
    }

    // 验证 Token
    const isValid = await verifyCSRFToken(req.user.id, token);

    if (!isValid) {
      return res.status(403).json({
        success: false,
        message: 'CSRF Token 无效或已过期',
        code: 'CSRF_TOKEN_INVALID'
      });
    }

    next();
  })().catch(error => {
    log.error('可选 CSRF 验证中间件错误:', error);
    next(); // 出错时不阻止请求
  });
}

/**
 * 🔒 全局清理过期的 CSRF Token
 * 清理数据库中的所有过期 Token
 */
async function cleanupAllExpiredTokens() {
  try {
    const db = getDatabase();
    const [result] = await db.execute(
      'DELETE FROM csrf_tokens WHERE expires_at < NOW()'
    );
    if (result.affectedRows > 0) {
      log.debug(`🧹 清理了 ${result.affectedRows} 个过期的 CSRF Token`);
    }
  } catch (error) {
    log.error('清理过期 CSRF Token 失败:', error);
  }
}

// 启动定期清理任务（每30分钟清理一次）
setInterval(cleanupAllExpiredTokens, CSRF_CONFIG.CLEANUP_INTERVAL);

// 启动时立即执行一次清理
setTimeout(() => {
  log.debug('🔄 CSRF Token 定期清理任务已启动，每30分钟清理一次过期数据');
  cleanupAllExpiredTokens().catch(err => {
    log.warn('启动时CSRF Token清理失败（非致命错误）:', err.message);
  });
}, 5000);

module.exports = {
  router,
  validateCSRFToken,
  optionalCSRFValidation,
  CSRF_CONFIG,
  generateSecureCSRFToken,
  verifyCSRFToken
};
