const { createHmacSignature, verifyHmacSignature } = require('./security-keyring')

const TOKEN_TTL_SECONDS = 24 * 60 * 60

const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')

const sign = (payload, sourceKey) => createHmacSignature('ORDER_ACCESS', payload, 'base64url', sourceKey)

function createOrderAccessToken(order, ttlSeconds = TOKEN_TTL_SECONDS, options = {}) {
  const now = Math.floor(Date.now() / 1000)
  const payload = encode({
    orderId: Number(order.id || order.orderId),
    orderNumber: String(order.order_number || order.orderNumber || ''),
    phone: String(order.customer_phone || order.customerPhone || ''),
    iat: now,
    exp: now + ttlSeconds
  })

  return `${payload}.${sign(payload, options.sourceKey)}`
}

function verifyOrderAccessToken(token, order, options = {}) {
  if (!token || typeof token !== 'string') return false

  const [payload, signature, extra] = token.split('.')
  if (!payload || !signature || extra) return false

  if (!verifyHmacSignature(
    'ORDER_ACCESS',
    payload,
    signature,
    'base64url',
    {
      current: options.sourceKey,
      previous: options.previousSourceKey
    }
  )) {
    return false
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    const now = Math.floor(Date.now() / 1000)
    return Number(decoded.exp) > now
      && Number(decoded.orderId) === Number(order.id)
      && String(decoded.orderNumber) === String(order.order_number)
      && String(decoded.phone) === String(order.customer_phone)
  } catch {
    return false
  }
}

module.exports = {
  TOKEN_TTL_SECONDS,
  createOrderAccessToken,
  verifyOrderAccessToken
}
