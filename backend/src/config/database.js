const mysql = require('mysql2/promise');
const config = require('./index');
const log = require('../utils/log');

// 数据库连接状态
let dbConnected = false;
let pool = null;
let poolStatsTimer = null;
let poolLeakCheckTimer = null;
const activeConnections = new Map();

const DEFAULT_POOL_CONFIG = {
  connectionLimit: 20,
  queueLimit: 50,
  connectTimeout: 30000,
  idleTimeout: 300000,
  maxIdle: 10,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000
};

const POOL_MONITOR_CONFIG = {
  statsIntervalMs: parseEnvInt(process.env.DB_POOL_STATS_INTERVAL_MS, 60000, { min: 5000 }),
  leakThresholdMs: parseEnvInt(process.env.DB_CONNECTION_LEAK_THRESHOLD_MS, 30000, { min: 5000 }),
  leakCheckIntervalMs: parseEnvInt(process.env.DB_CONNECTION_LEAK_CHECK_INTERVAL_MS, 15000, { min: 1000 }),
  usageWarnThreshold: parseEnvFloat(process.env.DB_POOL_USAGE_WARN_THRESHOLD, 0.8, { min: 0.1, max: 1 }),
  queueWarnThreshold: parseEnvInt(process.env.DB_POOL_QUEUE_WARN_THRESHOLD, 10, { min: 0 }),
  logStats: process.env.DB_POOL_LOG_STATS !== 'false'
};

function parseEnvInt(value, fallback, options = {}) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  if (options.min !== undefined && parsed < options.min) {
    return fallback;
  }

  if (options.max !== undefined && parsed > options.max) {
    return fallback;
  }

  return parsed;
}

function parseEnvFloat(value, fallback, options = {}) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  if (options.min !== undefined && parsed < options.min) {
    return fallback;
  }

  if (options.max !== undefined && parsed > options.max) {
    return fallback;
  }

  return parsed;
}

function getCorePool() {
  return pool?.pool || null;
}

function getResolvedPoolConfig() {
  const connectionLimit = parseEnvInt(
    process.env.DB_CONNECTION_LIMIT,
    DEFAULT_POOL_CONFIG.connectionLimit,
    { min: 1 }
  );

  const maxIdle = Math.min(
    connectionLimit,
    parseEnvInt(
      process.env.DB_MAX_IDLE,
      DEFAULT_POOL_CONFIG.maxIdle,
      { min: 1 }
    )
  );

  return {
    connectionLimit,
    queueLimit: parseEnvInt(
      process.env.DB_QUEUE_LIMIT,
      DEFAULT_POOL_CONFIG.queueLimit,
      { min: 0 }
    ),
    connectTimeout: parseEnvInt(
      process.env.DB_CONNECT_TIMEOUT,
      DEFAULT_POOL_CONFIG.connectTimeout,
      { min: 1000 }
    ),
    idleTimeout: parseEnvInt(
      process.env.DB_IDLE_TIMEOUT,
      DEFAULT_POOL_CONFIG.idleTimeout,
      { min: 10000 }
    ),
    maxIdle,
    enableKeepAlive: process.env.DB_ENABLE_KEEP_ALIVE !== 'false',
    keepAliveInitialDelay: parseEnvInt(
      process.env.DB_KEEP_ALIVE_INITIAL_DELAY,
      DEFAULT_POOL_CONFIG.keepAliveInitialDelay,
      { min: 0 }
    )
  };
}

function clearPoolMonitoringTimers() {
  if (poolStatsTimer) {
    clearInterval(poolStatsTimer);
    poolStatsTimer = null;
  }

  if (poolLeakCheckTimer) {
    clearInterval(poolLeakCheckTimer);
    poolLeakCheckTimer = null;
  }
}

function captureCheckoutStack() {
  const stack = new Error().stack || '';
  return stack
    .split('\n')
    .slice(2, 8)
    .map(line => line.trim())
    .join('\n');
}

function updateActiveConnectionMetadata(connection, updates = {}) {
  const threadId = connection?.threadId;
  if (!threadId) {
    return;
  }

  const existing = activeConnections.get(threadId);
  if (!existing) {
    return;
  }

  activeConnections.set(threadId, {
    ...existing,
    ...updates
  });
}

function getPoolStats() {
  const corePool = getCorePool();
  if (!corePool) {
    return null;
  }

  const totalConnections = corePool._allConnections.length;
  const freeConnections = corePool._freeConnections.length;
  const queuedRequests = corePool._connectionQueue.length;
  const activeCheckedOut = Math.max(totalConnections - freeConnections, 0);
  const connectionLimit = corePool.config.connectionLimit || 0;
  const usageRate = connectionLimit > 0
    ? Number((activeCheckedOut / connectionLimit).toFixed(2))
    : 0;

  return {
    totalConnections,
    freeConnections,
    activeCheckedOut,
    queuedRequests,
    connectionLimit,
    usageRate,
    trackedActiveConnections: activeConnections.size
  };
}

function logPoolStats(level = 'debug', message = '数据库连接池状态') {
  const stats = getPoolStats();
  if (!stats) {
    return;
  }

  log[level](`${message}:`, stats);
}

function setupTrackedConnection(poolConnection, checkoutStack) {
  const coreConnection = poolConnection?.connection;
  if (!coreConnection?.threadId) {
    return poolConnection;
  }

  updateActiveConnectionMetadata(coreConnection, {
    checkoutStack,
    checkoutAt: Date.now()
  });

  return poolConnection;
}

function startPoolMonitoring() {
  clearPoolMonitoringTimers();

  poolStatsTimer = setInterval(() => {
    const stats = getPoolStats();
    if (!stats) {
      return;
    }

    if (
      stats.usageRate >= POOL_MONITOR_CONFIG.usageWarnThreshold ||
      stats.queuedRequests >= POOL_MONITOR_CONFIG.queueWarnThreshold
    ) {
      log.warn('数据库连接池压力偏高:', stats);
      return;
    }

    if (POOL_MONITOR_CONFIG.logStats) {
      logPoolStats('debug');
    }
  }, POOL_MONITOR_CONFIG.statsIntervalMs);

  poolLeakCheckTimer = setInterval(() => {
    const now = Date.now();

    for (const [threadId, metadata] of activeConnections.entries()) {
      const heldMs = now - metadata.acquiredAt;
      if (heldMs < POOL_MONITOR_CONFIG.leakThresholdMs || metadata.warned) {
        continue;
      }

      activeConnections.set(threadId, {
        ...metadata,
        warned: true,
        lastWarnedAt: now
      });

      log.warn('检测到长时间占用的数据库连接，可能存在连接泄漏风险:', {
        threadId,
        heldMs,
        acquiredAt: new Date(metadata.acquiredAt).toISOString(),
        checkoutAt: metadata.checkoutAt ? new Date(metadata.checkoutAt).toISOString() : null,
        checkoutStack: metadata.checkoutStack || '未捕获调用栈'
      });
    }
  }, POOL_MONITOR_CONFIG.leakCheckIntervalMs);

  if (typeof poolStatsTimer.unref === 'function') {
    poolStatsTimer.unref();
  }

  if (typeof poolLeakCheckTimer.unref === 'function') {
    poolLeakCheckTimer.unref();
  }
}

function setupPoolInstrumentation() {
  if (!pool) {
    return;
  }

  const originalGetConnection = pool.getConnection.bind(pool);
  pool.getConnection = async function instrumentedGetConnection() {
    const checkoutStack = captureCheckoutStack();
    const connection = await originalGetConnection();
    return setupTrackedConnection(connection, checkoutStack);
  };

  pool.on('connection', (connection) => {
    log.debug(`数据库连接已创建 threadId=${connection.threadId}`);
  });

  pool.on('acquire', (connection) => {
    activeConnections.set(connection.threadId, {
      threadId: connection.threadId,
      acquiredAt: Date.now(),
      warned: false
    });
  });

  pool.on('release', (connection) => {
    const metadata = activeConnections.get(connection.threadId);
    if (metadata) {
      const heldMs = Date.now() - metadata.acquiredAt;
      if (heldMs >= POOL_MONITOR_CONFIG.leakThresholdMs) {
        log.warn('数据库连接已释放，但占用时间过长:', {
          threadId: connection.threadId,
          heldMs,
          checkoutStack: metadata.checkoutStack || '未捕获调用栈'
        });
      }
      activeConnections.delete(connection.threadId);
    }
  });

  pool.on('enqueue', () => {
    log.warn('数据库连接池已进入排队状态，请关注慢查询或连接释放情况');
    logPoolStats('warn', '连接池排队时的状态');
  });

  startPoolMonitoring();
}

function isIgnorableShutdownError(error) {
  const message = error?.message || '';
  return /server shutdown in progress|pool is closed|connection is closed|cannot enqueue|connection lost/i.test(message);
}

// 创建数据库连接池
async function createDatabasePool() {
  try {
    log.info('创建数据库连接池...');
    log.info(`数据库配置: ${config.db.host}:${config.db.port}/${config.db.database}`);
    log.info(`用户名: ${config.db.user}`);
    clearPoolMonitoringTimers();
    activeConnections.clear();

    const resolvedPoolConfig = getResolvedPoolConfig();

    // 创建具有正确字符集配置的连接池
    const poolConfig = {
      ...config.db,
      charset: 'utf8mb4',
      timezone: 'Z',  // 使用 UTC 时区，避免 '+08:00' 格式导致查询参数问题
      dateStrings: true,  // 返回日期字符串而不是Date对象，避免时区问题
      flags: '+FOUND_ROWS',
      // 连接池配置优化 - 针对远程数据库连接
      connectTimeout: resolvedPoolConfig.connectTimeout,
      connectionLimit: resolvedPoolConfig.connectionLimit,
      queueLimit: resolvedPoolConfig.queueLimit,
      idleTimeout: resolvedPoolConfig.idleTimeout,
      maxIdle: resolvedPoolConfig.maxIdle,
      // 连接保活机制
      enableKeepAlive: resolvedPoolConfig.enableKeepAlive,
      keepAliveInitialDelay: resolvedPoolConfig.keepAliveInitialDelay,
      // 禁用命名占位符，使用位置占位符
      namedPlaceholders: false,
      multipleStatements: false      // 禁用多语句查询，提高安全性
    };

    pool = mysql.createPool(poolConfig);
    setupPoolInstrumentation();

    log.info('数据库连接池配置已生效:', {
      connectionLimit: poolConfig.connectionLimit,
      maxIdle: poolConfig.maxIdle,
      idleTimeout: poolConfig.idleTimeout,
      queueLimit: poolConfig.queueLimit,
      connectTimeout: poolConfig.connectTimeout,
      keepAliveInitialDelay: poolConfig.keepAliveInitialDelay,
      leakThresholdMs: POOL_MONITOR_CONFIG.leakThresholdMs,
      statsIntervalMs: POOL_MONITOR_CONFIG.statsIntervalMs
    });

    // 测试连接并设置字符集
    const connection = await pool.getConnection();
    await connection.execute('SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci');
    await connection.execute('SET CHARACTER SET utf8mb4');
    await connection.execute('SET character_set_connection=utf8mb4');
    await connection.execute('SELECT 1');
    connection.release();

    dbConnected = true;
    log.success('数据库连接池创建成功，字符集设置为 utf8mb4_unicode_ci');
    logPoolStats('info', '数据库连接池初始化完成');
    return true;
  } catch (err) {
    log.error('数据库连接池创建失败:', err.code, err.message);
    dbConnected = false;
    clearPoolMonitoringTimers();
    activeConnections.clear();
    if (pool) {
      try {
        await pool.end();
      } catch (closeError) {
        log.warn('数据库连接池初始化失败后的清理未完全成功:', closeError.message);
      }
      pool = null;
    }
    return false;
  }
}

// 获取数据库连接池
function getDatabase() {
  if (!pool || !dbConnected) {
    throw new Error('数据库未连接，请确保应用启动时数据库连接已建立');
  }
  return pool;
}

// 兼容旧代码的连接函数
async function connectToDatabase(retries = 5, delay = 3000) {
  for (let i = 0; i < retries; i++) {
    const success = await createDatabasePool();
    if (success) {
      return true;
    }
    
    if (i < retries - 1) {
      log.info(`等待 ${delay/1000} 秒后重试...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  log.error('所有数据库连接尝试均已失败');
  return false;
}

// 获取连接状态
function isConnected() {
  return dbConnected;
}

// 设置连接状态（用于手动重连）
function setConnected(status) {
  dbConnected = status;
}

// 关闭数据库连接池
async function closeDatabase() {
  if (pool) {
    try {
      log.info('正在关闭数据库连接池...');
      clearPoolMonitoringTimers();
      activeConnections.clear();
      await pool.end();
      pool = null;
      dbConnected = false;
      log.success('数据库连接池已关闭');
    } catch (error) {
      if (isIgnorableShutdownError(error)) {
        log.info(`停服阶段数据库连接池已进入关闭流程: ${error.message}`);
      } else {
        log.fail('关闭数据库连接池失败:', error.message);
      }
      pool = null;
      dbConnected = false;
      clearPoolMonitoringTimers();
      activeConnections.clear();
    }
  }
}

module.exports = {
  pool,
  getDatabase,
  connectToDatabase,
  createDatabasePool,
  isConnected,
  setConnected,
  closeDatabase,
  getPoolStats
};
