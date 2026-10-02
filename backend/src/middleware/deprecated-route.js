'use strict'

const log = require('../utils/log')

const resolveReplacement = (replacement, req) => {
  const resolved = typeof replacement === 'function' ? replacement(req) : replacement
  if (!resolved) return null
  const params = { ...req.query, ...req.params }
  return resolved.replace(/:([A-Za-z][A-Za-z0-9_]*)/g, (match, key) => (
    params[key] === undefined ? match : encodeURIComponent(String(params[key]))
  ))
}

/**
 * 标记仍需保留的历史兼容入口。
 * 兼容路由继续执行原权限和业务处理，但通过标准响应头和日志提示调用方迁移。
 */
const deprecatedRoute = ({ replacement, migrationId }) => (req, res, next) => {
  const resolvedReplacement = resolveReplacement(replacement, req)
  res.setHeader('Deprecation', 'true')
  res.setHeader('X-Deprecated-Endpoint', 'true')
  if (resolvedReplacement) {
    res.setHeader('Link', `<${resolvedReplacement}>; rel="successor-version"`)
  }
  log.warn('兼容接口仍被调用', {
    migration_id: migrationId || 'unspecified',
    method: req.method,
    path: req.originalUrl,
    replacement: resolvedReplacement,
    user_id: req.user?.id || null
  })
  next()
}

module.exports = deprecatedRoute
