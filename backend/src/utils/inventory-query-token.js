const crypto = require('crypto')
const { signJwt, verifyJwt } = require('./security-keyring')

const TOKEN_TYPE = 'inventory-query'
const TOKEN_ISSUER = 'tf2025-backend'
const TOKEN_AUDIENCE = 'tf2025-inventory-query'

function createInventoryQueryToken(user, options = {}) {
  return signJwt(
    'INVENTORY_QUERY',
    {
      sub: String(user.id),
      name: user.name,
      type: TOKEN_TYPE,
      jti: crypto.randomUUID()
    },
    {
      expiresIn: '10m',
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE
    },
    options.sourceKey
  )
}

function verifyInventoryQueryToken(token, options = {}) {
  const payload = verifyJwt('INVENTORY_QUERY', token, {
    issuer: TOKEN_ISSUER,
    audience: TOKEN_AUDIENCE
  }, {
    current: options.sourceKey,
    previous: options.previousSourceKey
  })

  if (payload.type !== TOKEN_TYPE) {
    throw new Error('Invalid inventory query token type')
  }

  return payload
}

function requireInventoryQueryToken(req, res, next) {
  const token = String(req.headers['x-inventory-query-token'] || '').trim()

  if (!token) {
    return res.status(401).json({
      success: false,
      message: '请先验证在库查询密码',
      code: 'INVENTORY_QUERY_TOKEN_MISSING'
    })
  }

  try {
    const payload = verifyInventoryQueryToken(token)

    req.inventoryQueryUser = payload
    next()
  } catch {
    return res.status(401).json({
      success: false,
      message: '在库查询验证已失效，请重新验证',
      code: 'INVENTORY_QUERY_TOKEN_INVALID'
    })
  }
}

module.exports = {
  createInventoryQueryToken,
  requireInventoryQueryToken,
  verifyInventoryQueryToken
}
