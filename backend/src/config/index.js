const path = require('path');
const fs = require('fs');
const log = require('../utils/log');

const env = process.env.NODE_ENV || 'development';
const explicitEnvFile = process.env.ENV_FILE;
const candidateEnvFiles = explicitEnvFile
  ? [explicitEnvFile]
  : env === 'production'
    ? ['.env.production', '.env']
    : ['.env', '.env.production'];

const envPath = candidateEnvFiles
  .map((file) => path.resolve(process.cwd(), file))
  .find((filePath) => fs.existsSync(filePath));

if (envPath) {
  require('dotenv').config({ path: envPath });
  log.info(`环境配置加载: NODE_ENV=${env}, envFile=${envPath}`);
} else {
  log.warn(`未找到可用的环境配置文件: ${candidateEnvFiles.join(', ')}`);
}

// 验证必需的环境变量
const requiredEnvVars = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'JWT_SECRET'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`缺少必需的环境变量: ${missingVars.join(', ')}`);
  } else {
    log.warn(`缺少环境变量 ${missingVars.join(', ')}，请创建 .env 文件`);
  }
}

// 验证JWT密钥长度
if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
  log.warn('JWT_SECRET 长度应至少为32个字符');
}

function parseEnvInt(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const dbConnectionLimit = parseEnvInt(process.env.DB_CONNECTION_LIMIT || '20', 20);
const dbMaxIdle = parseEnvInt(process.env.DB_MAX_IDLE || String(Math.min(dbConnectionLimit, 10)), Math.min(dbConnectionLimit, 10));

const config = {
  db: {
    host: process.env.DB_HOST,
    port: parseEnvInt(process.env.DB_PORT || '3306', 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: dbConnectionLimit,
    queueLimit: parseEnvInt(process.env.DB_QUEUE_LIMIT || '50', 50),
    connectTimeout: parseEnvInt(process.env.DB_CONNECT_TIMEOUT || '30000', 30000),
    idleTimeout: parseEnvInt(process.env.DB_IDLE_TIMEOUT || '300000', 300000),
    maxIdle: Math.min(dbConnectionLimit, dbMaxIdle),
    enableKeepAlive: process.env.DB_ENABLE_KEEP_ALIVE !== 'false',
    keepAliveInitialDelay: parseEnvInt(process.env.DB_KEEP_ALIVE_INITIAL_DELAY || '10000', 10000),
    dateStrings: true,  // 返回日期字符串而不是Date对象，避免时区问题
    supportBigNumbers: true,
    bigNumberStrings: true,
    charset: 'utf8mb4',
    timezone: 'Z',  // UTC 时区 (避免 '+08:00' 格式导致查询参数问题)
    flags: '+FOUND_ROWS',
    typeCast: function (field, next) {
      if (field.type === 'VAR_STRING' || field.type === 'STRING') {
        return field.string();
      }
      return next();
    }
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  },
  server: {
    port: parseEnvInt(process.env.PORT || '3000', 3000), // 默认端口3000，可通过环境变量覆盖
    env: process.env.NODE_ENV || 'development',
    // TF2025专用配置 - 确保端口固定
    strictPort: process.env.NODE_ENV === 'production' // 生产环境严格使用指定端口
  },
  security: {
    bcryptRounds: parseEnvInt(process.env.BCRYPT_ROUNDS || '12', 12),
    sessionSecret: process.env.SESSION_SECRET || 'TF2025_SESSION_SECRET_CHANGE_IN_PRODUCTION',
    initAdminPassword: process.env.INIT_ADMIN_PASSWORD || ''
  },
  api: {
    rateLimit: parseEnvInt(process.env.API_RATE_LIMIT || '100', 100),
    rateWindowMs: parseEnvInt(process.env.API_RATE_WINDOW_MS || '900000', 900000)
  },
  cache: {
    ttl: parseEnvInt(process.env.CACHE_TTL || '600', 600),
    maxKeys: parseEnvInt(process.env.CACHE_MAX_KEYS || '1000', 1000)
  }
};

module.exports = config;
