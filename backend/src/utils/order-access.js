const crypto = require('crypto')
const config = require('../config')

const TOKEN_TTL_SECONDS = 24 * 60 * 60
// 生产环境由 config 强制要求 JWT_SECRET；开发环境无 .env 时使用进程级随机密钥，重启后旧访客凭证自然失效。
const ACCESS_SECRET = config.jwt.secret || crypto.randomBytes(32).toString('hex')

const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')

const sign = (payload) => crypto
  .createHmac('sha256', ACCESS_SECRET)
  .update(payload)
  .digest('base64url')

function createOrderAccessToken(order, ttlSeconds = TOKEN_TTL_SECONDS) {
  const now = Math.floor(Date.now() / 1000)
  const payload = encode({
    orderId: Number(order.id || order.orderId),
    orderNumber: String(order.order_number || order.orderNumber || ''),
    phone: String(order.customer_phone || order.customerPhone || ''),
    iat: now,
    exp: now + ttlSeconds
  })

  return `${payload}.${sign(payload)}`
}

function verifyOrderAccessToken(token, order) {
  if (!token || typeof token !== 'string') return false

  const [payload, signature, extra] = token.split('.')
  if (!payload || !signature || extra) return false

  const expectedSignature = sign(payload)
  const providedBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expectedSignature)
  if (providedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
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
