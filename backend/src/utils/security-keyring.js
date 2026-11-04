'use strict'

const crypto = require('node:crypto')
const jwt = require('jsonwebtoken')

const MIN_SECRET_LENGTH = 32

const KEY_SCOPES = Object.freeze({
  JWT_ACCESS: Object.freeze({
    current: 'JWT_SECRET',
    previous: 'JWT_PREVIOUS_SECRET',
    label: '访问令牌'
  }),
  JWT_REFRESH: Object.freeze({
    current: 'JWT_REFRESH_SECRET',
    previous: 'JWT_REFRESH_PREVIOUS_SECRET',
    label: '刷新令牌'
  }),
  FILE_ACCESS: Object.freeze({
    current: 'FILE_ACCESS_SIGNING_KEY',
    previous: 'FILE_ACCESS_PREVIOUS_SIGNING_KEY',
    label: '文件访问签名'
  }),
  ORDER_ACCESS: Object.freeze({
    current: 'ORDER_ACCESS_SIGNING_KEY',
    previous: 'ORDER_ACCESS_PREVIOUS_SIGNING_KEY',
    label: '订单访问签名'
  }),
  INVENTORY_QUERY: Object.freeze({
    current: 'INVENTORY_QUERY_SIGNING_KEY',
    previous: 'INVENTORY_QUERY_PREVIOUS_SIGNING_KEY',
    label: '库存查询令牌'
  })
})

function getScope(scopeName) {
  const scope = KEY_SCOPES[scopeName]
  if (!scope) throw new Error(`未知密钥用途: ${scopeName}`)
  return scope
}

function normalizeSecret(value) {
  return String(value || '').trim()
}

function assertSecret(value, envName, { required = true } = {}) {
  const normalized = normalizeSecret(value)
  if (!normalized && !required) return ''
  if (normalized.length < MIN_SECRET_LENGTH) {
    throw new Error(`${envName} 必须至少 ${MIN_SECRET_LENGTH} 个字符`)
  }
  return normalized
}

function getCurrentSecret(scopeName, override) {
  const scope = getScope(scopeName)
  return assertSecret(override ?? process.env[scope.current], scope.current)
}

function getVerificationSecrets(scopeName, overrides = {}) {
  const scope = getScope(scopeName)
  const current = getCurrentSecret(scopeName, overrides.current)
  const previous = assertSecret(
    overrides.previous ?? process.env[scope.previous],
    scope.previous,
    { required: false }
  )
  return [...new Set([current, previous].filter(Boolean))]
}

function signJwt(scopeName, payload, options = {}, keyOverride) {
  return jwt.sign(payload, getCurrentSecret(scopeName, keyOverride), {
    ...options,
    algorithm: 'HS256'
  })
}

function verifyJwt(scopeName, token, options = {}, keyOverrides = {}) {
  const secrets = getVerificationSecrets(scopeName, keyOverrides)
  let lastError

  for (const secret of secrets) {
    try {
      return jwt.verify(token, secret, {
        ...options,
        algorithms: ['HS256']
      })
    } catch (error) {
      lastError = error
      if (error.name === 'TokenExpiredError' || error.name === 'NotBeforeError') throw error
    }
  }

  throw lastError || new jwt.JsonWebTokenError('invalid signature')
}

function createHmacSignature(scopeName, payload, encoding = 'hex', keyOverride) {
  return crypto
    .createHmac('sha256', getCurrentSecret(scopeName, keyOverride))
    .update(String(payload), 'utf8')
    .digest(encoding)
}

function verifyHmacSignature(scopeName, payload, signature, encoding = 'hex', keyOverrides = {}) {
  let received
  try {
    received = Buffer.from(String(signature || ''), encoding)
  } catch {
    return false
  }

  if (received.length === 0) return false

  return getVerificationSecrets(scopeName, keyOverrides).some(secret => {
    const expected = crypto
      .createHmac('sha256', secret)
      .update(String(payload), 'utf8')
      .digest()
    return expected.length === received.length && crypto.timingSafeEqual(expected, received)
  })
}

function validateSecurityKeyring({ production = process.env.NODE_ENV === 'production' } = {}) {
  const errors = []

  for (const scope of Object.values(KEY_SCOPES)) {
    try {
      assertSecret(process.env[scope.current], scope.current, { required: production })
      assertSecret(process.env[scope.previous], scope.previous, { required: false })
    } catch (error) {
      errors.push(error.message)
    }
  }

  if (errors.length > 0) throw new Error(errors.join('；'))
}

module.exports = {
  KEY_SCOPES,
  MIN_SECRET_LENGTH,
  assertSecret,
  createHmacSignature,
  getCurrentSecret,
  getVerificationSecrets,
  signJwt,
  validateSecurityKeyring,
  verifyHmacSignature,
  verifyJwt
}
