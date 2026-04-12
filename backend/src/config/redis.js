/**
 * Redis缓存配置
 * 用于权限缓存和其他性能优化
 */

const log = require('../utils/log');

// 安全加载Redis模块
let redis;
try {
  // 尝试加载redis模块，如果失败则使用内存缓存
  redis = require('redis');
} catch (error) {
  log.fail('Redis模块加载失败:', error.message);
  redis = null;
}

// Redis配置
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  database: process.env.REDIS_DB || 0,
  keyPrefix: process.env.REDIS_KEY_PREFIX || 'tf2025:',
  defaultTTL: parseInt(process.env.REDIS_DEFAULT_TTL) || 300, // 5分钟
  retryAttempts: parseInt(process.env.REDIS_RETRY_ATTEMPTS) || 3,
  retryDelay: parseInt(process.env.REDIS_RETRY_DELAY) || 1000
};

// Redis客户端实例
let redisClient = null;

/**
 * 初始化Redis连接
 */
async function initRedis() {
  try {
    if (!redis) {
      return null;
    }

    const client = redis.createClient({
      socket: {
        host: redisConfig.host,
        port: redisConfig.port,
        reconnectStrategy: (retries) => {
          if (retries > redisConfig.retryAttempts) {
            log.error('Redis重连失败，超过最大重试次数');
            return new Error('Redis重连失败');
          }
          return Math.min(retries * 100, 3000);
        }
      },
      password: redisConfig.password,
      database: redisConfig.database
    });

    client.on('error', (err) => {
      log.error('Redis连接错误:', err);
    });

    await client.connect();

    // 测试连接
    await client.ping();

    redisClient = client;
    return client;
  } catch (error) {
    log.fail('Redis连接失败:', error);
    return null;
  }
}

/**
 * 获取Redis客户端
 */
function getRedisClient() {
  return redisClient;
}

/**
 * 检查Redis连接状态
 */
function isRedisConnected() {
  return redisClient && redisClient.isOpen;
}

/**
 * 关闭Redis连接
 */
async function closeRedis() {
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch (error) {
      log.error('❌ 关闭Redis连接失败:', error);
    }
  }
}

/**
 * 构建完整的缓存键
 */
function buildKey(key) {
  return `${redisConfig.keyPrefix}${key}`;
}

/**
 * Redis缓存操作类
 */
class RedisCacheService {
  constructor() {
    this.isEnabled = isRedisConnected();
    this.fallbackCache = new Map(); // 内存缓存作为备选
  }

  /**
   * 设置缓存
   */
  async set(key, value, ttl = redisConfig.defaultTTL) {
    try {
      const fullKey = buildKey(key);
      const serializedValue = JSON.stringify(value);

      if (this.isEnabled) {
        await redisClient.setEx(fullKey, ttl, serializedValue);
      } else {
        // 使用内存缓存作为备选
        this.fallbackCache.set(key, {
          value: serializedValue,
          expiry: Date.now() + (ttl * 1000)
        });
      }

      return true;
    } catch (error) {
      log.error('设置缓存失败:', error);
      return false;
    }
  }

  /**
   * 获取缓存
   */
  async get(key) {
    try {
      const fullKey = buildKey(key);

      if (this.isEnabled) {
        const value = await redisClient.get(fullKey);
        return value ? JSON.parse(value) : null;
      } else {
        // 使用内存缓存
        const item = this.fallbackCache.get(key);
        if (!item || Date.now() > item.expiry) {
          this.fallbackCache.delete(key);
          return null;
        }
        return JSON.parse(item.value);
      }
    } catch (error) {
      log.error('获取缓存失败:', error);
      return null;
    }
  }

  /**
   * 删除缓存
   */
  async delete(key) {
    try {
      const fullKey = buildKey(key);

      if (this.isEnabled) {
        await redisClient.del(fullKey);
      } else {
        this.fallbackCache.delete(key);
      }

      return true;
    } catch (error) {
      log.error('删除缓存失败:', error);
      return false;
    }
  }

  /**
   * 检查缓存是否存在
   */
  async exists(key) {
    try {
      const fullKey = buildKey(key);

      if (this.isEnabled) {
        const result = await redisClient.exists(fullKey);
        return result === 1;
      } else {
        const item = this.fallbackCache.get(key);
        return item && Date.now() <= item.expiry;
      }
    } catch (error) {
      log.error('检查缓存存在性失败:', error);
      return false;
    }
  }

  /**
   * 设置缓存过期时间
   */
  async expire(key, ttl) {
    try {
      const fullKey = buildKey(key);

      if (this.isEnabled) {
        await redisClient.expire(fullKey, ttl);
      } else {
        const item = this.fallbackCache.get(key);
        if (item) {
          item.expiry = Date.now() + (ttl * 1000);
        }
      }

      return true;
    } catch (error) {
      log.error('设置缓存过期时间失败:', error);
      return false;
    }
  }

  /**
   * 获取缓存剩余过期时间
   */
  async ttl(key) {
    try {
      const fullKey = buildKey(key);

      if (this.isEnabled) {
        return await redisClient.ttl(fullKey);
      } else {
        const item = this.fallbackCache.get(key);
        if (!item) return -2; // 不存在
        if (Date.now() > item.expiry) return -1; // 已过期
        return Math.floor((item.expiry - Date.now()) / 1000);
      }
    } catch (error) {
      log.error('获取缓存TTL失败:', error);
      return -1;
    }
  }

  /**
   * 清空所有缓存
   */
  async clear() {
    try {
      if (this.isEnabled) {
        const pattern = buildKey('*');
        const keys = await redisClient.keys(pattern);
        if (keys.length > 0) {
          await redisClient.del(keys);
        }
      } else {
        this.fallbackCache.clear();
      }

      return true;
    } catch (error) {
      log.error('清空缓存失败:', error);
      return false;
    }
  }

  /**
   * 批量获取缓存
   */
  async mget(keys) {
    try {
      const fullKeys = keys.map(key => buildKey(key));

      if (this.isEnabled) {
        const values = await redisClient.mGet(fullKeys);
        return values.map(value => value ? JSON.parse(value) : null);
      } else {
        return keys.map(key => this.get(key));
      }
    } catch (error) {
      log.error('批量获取缓存失败:', error);
      return new Array(keys.length).fill(null);
    }
  }

  /**
   * 批量设置缓存
   */
  async mset(keyValuePairs, ttl = redisConfig.defaultTTL) {
    try {
      const pairs = [];
      const fullKeys = [];

      for (const [key, value] of Object.entries(keyValuePairs)) {
        const fullKey = buildKey(key);
        const serializedValue = JSON.stringify(value);
        pairs.push(fullKey, serializedValue);
        fullKeys.push(fullKey);
      }

      if (this.isEnabled) {
        await redisClient.mSet(pairs);

        // 设置过期时间
        for (const fullKey of fullKeys) {
          await redisClient.expire(fullKey, ttl);
        }
      } else {
        const expiry = Date.now() + (ttl * 1000);
        for (const [key, value] of Object.entries(keyValuePairs)) {
          this.fallbackCache.set(key, {
            value: JSON.stringify(value),
            expiry: expiry
          });
        }
      }

      return true;
    } catch (error) {
      log.error('批量设置缓存失败:', error);
      return false;
    }
  }

  /**
   * 获取缓存统计信息
   */
  async getStats() {
    try {
      const stats = {
        connected: this.isEnabled,
        fallback: !this.isEnabled,
        fallbackSize: this.fallbackCache.size
      };

      if (this.isEnabled) {
        const info = await redisClient.info('memory');
        const match = info.match(/used_memory_human:(.+)/);
        stats.memory = match ? match[1].trim() : 'unknown';
      }

      return stats;
    } catch (error) {
      log.error('获取缓存统计失败:', error);
      return {
        connected: false,
        fallback: true,
        fallbackSize: this.fallbackCache.size
      };
    }
  }
}

// 创建全局缓存服务实例
const cacheService = new RedisCacheService();

/**
 * 权限专用缓存服务
 */
class PermissionCacheService {
  constructor(cacheClient) {
    this.cache = cacheClient;
    this.ttl = redisConfig.defaultTTL;
  }

  /**
   * 缓存用户权限
   */
  async setUserPermissions(userId, permissions) {
    const key = `user:${userId}:permissions`;
    return await this.cache.set(key, permissions, this.ttl);
  }

  /**
   * 获取用户权限
   */
  async getUserPermissions(userId) {
    const key = `user:${userId}:permissions`;
    return await this.cache.get(key);
  }

  /**
   * 删除用户权限缓存
   */
  async deleteUserPermissions(userId) {
    const key = `user:${userId}:permissions`;
    return await this.cache.delete(key);
  }

  /**
   * 缓存角色权限
   */
  async setRolePermissions(roleId, permissions) {
    const key = `role:${roleId}:permissions`;
    return await this.cache.set(key, permissions, this.ttl);
  }

  /**
   * 获取角色权限
   */
  async getRolePermissions(roleId) {
    const key = `role:${roleId}:permissions`;
    return await this.cache.get(key);
  }

  /**
   * 缓存权限检查结果
   */
  async setPermissionCheck(userKey, resource, result) {
    const checkKey = `check:${userKey}:${resource}`;
    return await this.cache.set(checkKey, result, 60); // 权限检查结果缓存1分钟
  }

  /**
   * 获取权限检查结果
   */
  async getPermissionCheck(userKey, resource) {
    const checkKey = `check:${userKey}:${resource}`;
    return await this.cache.get(checkKey);
  }

  /**
   * 刷新用户所有相关缓存
   */
  async refreshUserCache(userId) {
    await this.deleteUserPermissions(userId);
    // 可以扩展删除其他相关的用户缓存
  }

  /**
   * 清空所有权限缓存
   */
  async clearPermissionCache() {
    return await this.cache.clear();
  }
}

// 创建权限缓存实例
const permissionCache = new PermissionCacheService(cacheService);

// 初始化Redis
if (require.main === module) {
  initRedis()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      log.fail('Redis初始化失败:', error);
      process.exit(1);
    });
}

module.exports = {
  initRedis,
  getRedisClient,
  isRedisConnected,
  closeRedis,
  buildKey,
  redisConfig,
  cacheService,
  permissionCache,
  RedisCacheService,
  PermissionCacheService
};