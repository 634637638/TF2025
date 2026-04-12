// 根据环境加载对应的 .env 文件
const path = require('path');
const log = require('../utils/log');

const env = process.env.NODE_ENV || 'development';
const envFile = env === 'production' ? '.env.production' : '.env';

// 使用绝对路径加载 .env 文件（从 cwd 解析）
const envPath = path.resolve(process.cwd(), envFile);
require('dotenv').config({ path: envPath });

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

const config = {
  db: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10'),
    queueLimit: 0,
    connectTimeout: parseInt(process.env.DB_CONNECT_TIMEOUT || '10000'),
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
    port: parseInt(process.env.PORT || '3000'), // 默认端口3000，可通过环境变量覆盖
    env: process.env.NODE_ENV || 'development',
    // TF2025专用配置 - 确保端口固定
    strictPort: process.env.NODE_ENV === 'production' // 生产环境严格使用指定端口
  },
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12'),
    sessionSecret: process.env.SESSION_SECRET || 'TF2025_SESSION_SECRET_CHANGE_IN_PRODUCTION'
  },
  api: {
    rateLimit: parseInt(process.env.API_RATE_LIMIT || '100'),
    rateWindowMs: parseInt(process.env.API_RATE_WINDOW_MS || '900000')
  },
  cache: {
    ttl: parseInt(process.env.CACHE_TTL || '600'),
    maxKeys: parseInt(process.env.CACHE_MAX_KEYS || '1000')
  }
};

module.exports = config;

