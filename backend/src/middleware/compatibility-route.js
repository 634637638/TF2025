'use strict'

const log = require('../utils/log')

/**
 * 标记仍被内部或外部调用、暂不能弃用的兼容入口。
 * 与 deprecated-route 不同，这里不发送弃用通知，只提供审计标识和访问日志。
 */
const compatibilityRoute = ({ compatibilityId, replacement = null, reason = null } = {}) => (req, res, next) => {
  res.setHeader('X-Compatibility-Endpoint', 'true')
  res.setHeader('X-Reference-Route', 'compatibility')
  if (compatibilityId) res.setHeader('X-Compatibility-Id', compatibilityId)
  if (replacement) res.setHeader('X-Compatibility-Replacement', replacement)

  log.debug('兼容接口访问', {
    compatibility_id: compatibilityId || 'unspecified',
    method: req.method,
    path: req.originalUrl,
    replacement,
    reason,
    user_id: req.user?.id || null
  })
  next()
}

module.exports = compatibilityRoute
