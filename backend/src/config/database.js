const mysql = require('mysql2/promise');
const config = require('./index');
const log = require('../utils/log');

// 数据库连接状态
let dbConnected = false;
let pool = null;

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

    // 创建具有正确字符集配置的连接池
    const poolConfig = {
      ...config.db,
      charset: 'utf8mb4',
      timezone: 'Z',  // 使用 UTC 时区，避免 '+08:00' 格式导致查询参数问题
      dateStrings: true,  // 返回日期字符串而不是Date对象，避免时区问题
      flags: '+FOUND_ROWS',
      // 连接池配置优化 - 针对远程数据库连接
      connectTimeout: 120000,        // 连接超时时间 (120秒)
      // 连接池大小配置 - 针对云端环境优化
      connectionLimit: 10,           // 减少连接池最大连接数，避免连接泄漏
      queueLimit: 0,                 // 等待队列限制 (0表示无限制)
      // 连接空闲管理 - 更激进的清理策略
      idleTimeout: 60000,            // 空闲连接超时时间 (60秒)
      // 连接保活机制
      enableKeepAlive: true,         // 启用TCP keep-alive
      keepAliveInitialDelay: 0,      // keep-alive立即开始
      maxIdle: 5,                    // 最大空闲连接数
      // 禁用命名占位符，使用位置占位符
      namedPlaceholders: false,
      multipleStatements: false      // 禁用多语句查询，提高安全性
    };

    pool = mysql.createPool(poolConfig);

    // 测试连接并设置字符集
    const connection = await pool.getConnection();
    await connection.execute('SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci');
    await connection.execute('SET CHARACTER SET utf8mb4');
    await connection.execute('SET character_set_connection=utf8mb4');
    await connection.execute('SELECT 1');
    connection.release();

    dbConnected = true;
    log.success('数据库连接池创建成功，字符集设置为 utf8mb4_unicode_ci');
    return true;
  } catch (err) {
    log.error('数据库连接池创建失败:', err.code, err.message);
    dbConnected = false;
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
  closeDatabase
};
