const jwt = require('jsonwebtoken');
const { getDatabase, isConnected } = require('../config/database');
const config = require('../config');
const crypto = require('crypto');
const log = require('../utils/log');

// 内存存储JWT黑名单（作为缓存层）
const blacklistedTokens = new Map();

// 配置
const CONFIG = {
  BLACKLIST_TTL: 7 * 24 * 60 * 60 * 1000, // 黑名单保留7天
  CLEANUP_INTERVAL: 60 * 60 * 1000, // 每小时清理一次
  ACCESS_TOKEN_EXPIRY: '24h', // 访问令牌24小时过期（延长到1天）
  REFRESH_TOKEN_EXPIRY: '30d', // 刷新令牌30天过期（延长到30天）
  ISSUER: 'tf2025-backend', // 发行者
  AUDIENCE: 'tf2025-users', // 受众
  JWT_SECRET: config.jwt.secret, // 从配置获取JWT密钥
  // 🔒 新增：是否使用数据库持久化黑名单
  PERSIST_BLACKLIST: process.env.JWT_BLACKLIST_PERSIST === 'true',
  // 新增：Token 轮换（每次刷新时生成新的刷新令牌）
  ENABLE_TOKEN_ROTATION: true
};

// 定期清理过期的黑名单令牌
function cleanupExpiredTokens() {
  const now = Date.now();
  let cleanedCount = 0;

  for (const [token, data] of blacklistedTokens.entries()) {
    if (now > data.expiresAt) {
      blacklistedTokens.delete(token);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    log.debug(`清理过期JWT令牌: ${cleanedCount} 个`);
  }
}

// 定期清理
setInterval(cleanupExpiredTokens, CONFIG.CLEANUP_INTERVAL);

// 生成JWT令牌
function generateTokens(payload) {
  const now = Math.floor(Date.now() / 1000);

  // 🔒 新增：为每个令牌生成唯一的 JTI（JWT ID）
  const accessJti = generateJTI();
  const refreshJti = generateJTI();

  // 访问令牌负载
  const accessTokenPayload = {
    sub: payload.id,
    username: payload.username,
    name: payload.name,  // 添加用户真实姓名
    store_id: payload.store_id || null,  // 添加主门店ID
    store_ids: payload.store_ids || [],  // 添加所有关联门店ID数组
    roles: payload.roles || [],  // 使用roles数组
    role_ids: payload.role_ids || [],  // 角色ID数组
    role_codes: payload.role_codes || [],  // 角色编码数组
    type: 'access',
    jti: accessJti,  // 添加 JTI
    iat: now,
    exp: now + (24 * 60 * 60), // 24小时
    iss: CONFIG.ISSUER,
    aud: CONFIG.AUDIENCE
  };

  // 刷新令牌负载
  const refreshTokenPayload = {
    sub: payload.id,
    username: payload.username,
    name: payload.name,  // 添加用户真实姓名
    store_id: payload.store_id || null,  // 添加主门店ID
    store_ids: payload.store_ids || [],  // 添加所有关联门店ID数组
    roles: payload.roles || [],  // 使用roles数组
    role_ids: payload.role_ids || [],  // 角色ID数组
    role_codes: payload.role_codes || [],  // 角色编码数组
    type: 'refresh',
    jti: refreshJti,  // 添加 JTI
    iat: now,
    exp: now + (30 * 24 * 60 * 60), // 30天
    iss: CONFIG.ISSUER,
    aud: CONFIG.AUDIENCE
  };

  const accessToken = jwt.sign(accessTokenPayload, CONFIG.JWT_SECRET, {
    algorithm: 'HS256'
  });

  const refreshToken = jwt.sign(refreshTokenPayload, CONFIG.JWT_SECRET, {
    algorithm: 'HS256'
  });

  return { accessToken, refreshToken, accessJti, refreshJti };
}

// 验证JWT令牌
async function verifyToken(token, type = 'access') {
  try {
    // 🔒 修复：正确等待异步的黑名单检查
    const blacklisted = await isTokenBlacklisted(token);
    if (blacklisted) {
      throw new Error('Token已被吊销');
    }

    const decoded = jwt.verify(token, CONFIG.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: CONFIG.ISSUER,
      audience: CONFIG.AUDIENCE
    });

    // 检查令牌类型
    if (decoded.type !== type) {
      throw new Error(`无效的令牌类型，期望: ${type}`);
    }

    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('令牌已过期');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('无效的令牌');
    } else {
      throw error;
    }
  }
}

// 将令牌加入黑名单
async function addToBlacklist(token, reason = 'logout') {
  try {
    // 解码令牌获取过期时间
    const decoded = jwt.decode(token);
    if (!decoded) {
      throw new Error('无效的令牌');
    }

    const expiresAt = Date.now() + CONFIG.BLACKLIST_TTL;
    const tokenInfo = {
      jti: decoded.jti || generateJTI(),
      sub: decoded.sub,
      type: decoded.type,
      reason: reason,
      addedAt: Date.now(),
      expiresAt: expiresAt
    };

    // 添加到内存
    blacklistedTokens.set(token, tokenInfo);

    // 🔒 改进：如果启用了持久化，记录到数据库
    if (CONFIG.PERSIST_BLACKLIST && isConnected()) {
      await logBlacklistEvent(tokenInfo);
    }

    log.info(`JWT令牌已加入黑名单 - 用户: ${decoded.sub}, 原因: ${reason}, 持久化: ${CONFIG.PERSIST_BLACKLIST}`);
    return true;
  } catch (error) {
    log.error('将令牌加入黑名单失败', error);
    return false;
  }
}

// 检查令牌是否在黑名单中
async function isTokenBlacklisted(token) {
  // 首先检查内存缓存
  const inMemory = blacklistedTokens.has(token);

  if (inMemory) {
    const tokenInfo = blacklistedTokens.get(token);

    // 检查是否过期
    if (Date.now() > tokenInfo.expiresAt) {
      blacklistedTokens.delete(token);
      // 如果启用了持久化，也从数据库删除
      if (CONFIG.PERSIST_BLACKLIST) {
        await removeFromDatabase(tokenInfo.jti);
      }
      return false;
    }
    return true;
  }

  // 如果内存中没有，但启用了持久化，检查数据库
  if (CONFIG.PERSIST_BLACKLIST && isConnected()) {
    return await checkInDatabase(token);
  }

  return false;
}

// 🔒 新增：从数据库检查黑名单
async function checkInDatabase(token) {
  try {
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.jti) {
      return false;
    }

    const db = getDatabase();
    const [rows] = await db.execute(
      `SELECT id, expires_at FROM jwt_blacklist
       WHERE jti = ? AND expires_at > NOW()
       LIMIT 1`,
      [decoded.jti]
    );

    if (rows.length > 0) {
      // 找到记录，添加到内存缓存
      const tokenInfo = {
        jti: decoded.jti,
        sub: decoded.sub,
        type: decoded.type,
        addedAt: Date.now(),
        expiresAt: new Date(rows[0].expires_at).getTime()
      };
      blacklistedTokens.set(token, tokenInfo);
      return true;
    }

    return false;
  } catch (error) {
    log.error('从数据库检查黑名单失败', error);
    return false;
  }
}

// 🔒 新增：从数据库删除黑名单记录
async function removeFromDatabase(jti) {
  try {
    const db = getDatabase();
    await db.execute(
      'DELETE FROM jwt_blacklist WHERE jti = ?',
      [jti]
    );
  } catch (error) {
    log.error('从数据库删除黑名单记录失败', error);
  }
}

// 生成JTI（JWT ID）- 使用加密安全的随机数
function generateJTI() {
  return 'jti_' + crypto.randomBytes(16).toString('hex') + '_' + Date.now();
}

// 记录黑名单事件到数据库
async function logBlacklistEvent(tokenInfo) {
  try {
    const database = getDatabase();
    await database.execute(
      'INSERT INTO jwt_blacklist (jti, user_id, token_type, reason, created_at, expires_at) VALUES (?, ?, ?, ?, NOW(), FROM_UNIXTIME(?))',
      [
        tokenInfo.jti,
        tokenInfo.sub,
        tokenInfo.type,
        tokenInfo.reason,
        tokenInfo.expiresAt / 1000
      ]
    );
  } catch (error) {
    log.error('记录黑名单事件失败', error);
  }
}

// 获取黑名单统计信息
const getBlacklistStats = () => {
  const now = Date.now();
  let activeCount = 0;
  let expiredCount = 0;
  let accessTokens = 0;
  let refreshTokens = 0;

  for (const [token, data] of blacklistedTokens.entries()) {
    if (now <= data.expiresAt) {
      activeCount++;
      if (data.type === 'access') accessTokens++;
      if (data.type === 'refresh') refreshTokens++;
    } else {
      expiredCount++;
    }
  }

  return {
    total: blacklistedTokens.size,
    active: activeCount,
    expired: expiredCount,
    accessTokens,
    refreshTokens,
    ttl: CONFIG.BLACKLIST_TTL,
    timestamp: new Date().toISOString()
  };
};

// 手动从黑名单中移除令牌
const removeFromBlacklist = (token) => {
  const removed = blacklistedTokens.delete(token);
  if (removed) {
    log.info('JWT令牌已从黑名单移除');
  }
  return removed;
};

// 清空黑名单
const clearBlacklist = () => {
  const count = blacklistedTokens.size;
  blacklistedTokens.clear();
  log.info(`JWT黑名单已清空，移除 ${count} 个令牌`);
  return count;
};

module.exports = {
  generateTokens,
  verifyToken,
  addToBlacklist,
  isTokenBlacklisted,
  getBlacklistStats,
  removeFromBlacklist,
  clearBlacklist,
  CONFIG
};
