// 简单的内存缓存中间件
const cache = new Map();

// 默认缓存配置
const defaultOptions = {
  ttl: 30 * 1000, // 30秒 - 平衡性能与实时性，减少数据库压力
  maxSize: 1000,      // 最大缓存条目数
  keyGenerator: (req) => `${req.method}:${req.originalUrl}:${JSON.stringify(req.query)}`
};

// 清理过期缓存
function cleanupExpiredCache() {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now > value.expiresAt) {
      cache.delete(key);
    }
  }
}

// 如果缓存过大，删除最旧的条目
function evictOldestEntries() {
  if (cache.size > defaultOptions.maxSize) {
    const entries = Array.from(cache.entries())
      .sort((a, b) => a[1].createdAt - b[1].createdAt);

    const toDelete = entries.slice(0, cache.size - defaultOptions.maxSize);
    toDelete.forEach(([key]) => cache.delete(key));
  }
}

// 缓存中间件
function cacheMiddleware(options = {}) {
  const opts = { ...defaultOptions, ...options };

  // 定期清理过期缓存
  setInterval(cleanupExpiredCache, 60000); // 每分钟清理一次

  return (req, res, next) => {
    // 只缓存GET请求
    if (req.method !== 'GET') {
      return next();
    }

    const key = opts.keyGenerator(req);
    const cached = cache.get(key);

    if (cached && Date.now() <= cached.expiresAt) {
      // 缓存命中，静默返回
      return res.json(cached.data);
    }

    // 保存原始的 res.json 方法
    const originalJson = res.json;

    // 重写 res.json 方法来缓存响应
    res.json = function(data) {
      // 只缓存成功响应
      if (data && data.success) {
        const cacheEntry = {
          data,
          createdAt: Date.now(),
          expiresAt: Date.now() + opts.ttl
        };

        cache.set(key, cacheEntry);
        evictOldestEntries();
      }

      return originalJson.call(this, data);
    };

    next();
  };
}

// 清除特定缓存
function clearCache(pattern = null) {
  if (pattern) {
    const regex = new RegExp(pattern);
    let clearedCount = 0;
    for (const key of cache.keys()) {
      if (regex.test(key)) {
        cache.delete(key);
        clearedCount++;
      }
    }
    return { cleared: clearedCount };
  } else {
    const total = cache.size;
    cache.clear();
    return { cleared: total };
  }
}

// 获取缓存统计信息
function getCacheStats() {
  const now = Date.now();
  let expiredCount = 0;
  let validCount = 0;

  for (const [key, value] of cache.entries()) {
    if (now > value.expiresAt) {
      expiredCount++;
    } else {
      validCount++;
    }
  }

  return {
    total: cache.size,
    valid: validCount,
    expired: expiredCount,
    maxSize: defaultOptions.maxSize,
    memoryUsage: process.memoryUsage()
  };
}

module.exports = {
  cacheMiddleware,
  clearCache,
  getCacheStats,
  cleanupExpiredCache
};