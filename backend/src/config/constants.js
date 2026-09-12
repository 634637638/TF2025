'use strict'

const ONE_SECOND_MS = 1000

const parseCsvEnv = (value, fallback = []) => {
  if (!value) {
    return fallback
  }

  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}

const PAGINATION = Object.freeze({
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10000,
  MAX_LIMIT: 10000
})

const CACHE_TTL = Object.freeze({
  DISABLED: 0,
  NEAR_REALTIME: ONE_SECOND_MS,
  AUTH_PROFILE: 3 * ONE_SECOND_MS,
  SHORT: 10 * ONE_SECOND_MS,
  MEDIUM: 30 * ONE_SECOND_MS,
  LONG: 5 * 60 * ONE_SECOND_MS
})

const TIMEOUTS = Object.freeze({
  HTTP_REQUEST: 30 * ONE_SECOND_MS,
  EXTERNAL_API: 30 * ONE_SECOND_MS,
  LONG_RUNNING_TASK: 5 * 60 * ONE_SECOND_MS,
  ICON_FETCH: 10 * ONE_SECOND_MS
})

const FEATURE_FLAGS = Object.freeze({
  // 模拟接口必须显式开启，开发环境也不能把演示数据混入业务页面。
  MOCK_ROUTES_ENABLED: process.env.ENABLE_MOCK_ROUTES === 'true'
})

const DEFAULT_BROWSER_USER_AGENT = process.env.DEFAULT_BROWSER_USER_AGENT ||
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const EXTERNAL_PRICE_BASE_URL = (process.env.EXTERNAL_PRICE_BASE_URL || 'https://81119.byb2b.cn').replace(/\/$/, '')

const EXTERNAL_PRICE = Object.freeze({
  BASE_URL: EXTERNAL_PRICE_BASE_URL,
  CAPTCHA_URL: process.env.EXTERNAL_PRICE_CAPTCHA_URL || `${EXTERNAL_PRICE_BASE_URL}/image.jsp?t=`,
  REFERER_URL: process.env.EXTERNAL_PRICE_REFERER_URL || `${EXTERNAL_PRICE_BASE_URL}/index.htm?ykflag=Y`
})

// ALLOWED_ORIGINS 是规范名称；兼容历史部署使用的 CORS_ORIGIN，避免配置存在但未生效。
const DEFAULT_CORS_ORIGINS = Object.freeze(parseCsvEnv(
  process.env.ALLOWED_ORIGINS || process.env.CORS_ORIGIN,
  [
    'http://localhost:5173',
    'http://localhost:5176',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5176',
    'http://127.0.0.1:3000'
  ]
))

const DEFAULT_CSP_CONNECT_SRC = Object.freeze(parseCsvEnv(process.env.CSP_CONNECT_SRC, [
  "'self'",
  'http://localhost:3000',
  'https://v4.cn9527.cn'
]))

module.exports = Object.freeze({
  CACHE_TTL,
  DEFAULT_BROWSER_USER_AGENT,
  DEFAULT_CORS_ORIGINS,
  DEFAULT_CSP_CONNECT_SRC,
  EXTERNAL_PRICE,
  FEATURE_FLAGS,
  PAGINATION,
  TIMEOUTS
})
