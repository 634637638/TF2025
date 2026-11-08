const express = require('express')
const router = express.Router()
const CsrfController = require('../controllers/csrf.controller')
const csrfTokenService = require('../services/csrf-token.service')
const log = require('../utils/log')
const csrfController = new CsrfController(csrfTokenService)

const CSRF_CONFIG = csrfTokenService.CSRF_CONFIG
const resolveCSRFUserId = req => csrfTokenService.resolveCSRFUserId(req)
const verifyCSRFToken = (userId, token) => csrfTokenService.verifyCSRFToken(userId, token)
const generateSecureCSRFToken = () => csrfTokenService.generateSecureCSRFToken()

function isCSRFExemptRequest(req) {
  const method = String(req.method || 'GET').toUpperCase()
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return true
  }

  const path = req.path || req.originalUrl || ''
  const exactExemptPaths = new Set([
    '/csrf/token',
    '/csrf/verify',
    '/csrf/csrf-token',
    '/auth/login',
    '/auth/refresh',
    '/auth/init-admin',
    '/screen-lock/verify-inventory-query'
  ])

  if (exactExemptPaths.has(path)) {
    return true
  }

  const exemptPatterns = [
    /^\/public\/cart(?:\/|$)/,
    /^\/public\/orders\/create$/,
    /^\/public\/orders\/[^/]+\/confirm-payment$/,
    /^\/public\/orders\/[^/]+\/cancel$/,
    // 公开营销文案生成：只接收生成上下文，不写入业务数据，也不要求登录/CSRF
    /^\/public\/marketing\/generate$/,
    /^\/public\/guide\/categories\/\d+\/unlock$/,
    /^\/public\/auth\/(?:register|login|profile|logout)$/
  ]

  return exemptPatterns.some(pattern => pattern.test(path))
}

/**
 * 生成CSRF Token
 * 前端可以通过 GET /api/csrf/token 获取Token
 * 注意：此端点允许未登录用户获取临时 Token（用于初始会话）
 */
router.get('/token', csrfController.generateToken.bind(csrfController))

/**
 * 验证CSRF Token
 * 前端通过 POST /api/csrf/verify 验证Token
 * 注意：未登录用户也可以验证临时 Token
 */
router.post('/verify', csrfController.verifyToken.bind(csrfController))

/**
 * 🔒 验证 CSRF Token 的中间件（增强版）
 */
function validateCSRFToken(req, res, next) {
  return (async () => {
    // 对于安全的方法（GET、HEAD、OPTIONS），跳过 CSRF 验证
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next()
    }

    const userId = await resolveCSRFUserId(req)
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: '需要先登录',
        code: 'AUTHENTICATION_REQUIRED'
      })
    }

    // 获取 Token
    const token = req.headers['x-csrf-token'] || req.body._csrf || req.body.csrfToken

    if (!token) {
      return res.status(403).json({
        success: false,
        message: '缺少 CSRF Token',
        code: 'CSRF_TOKEN_MISSING'
      })
    }

    // 验证 Token
    const isValid = await verifyCSRFToken(userId, token)

    if (!isValid) {
      return res.status(403).json({
        success: false,
        message: 'CSRF Token 无效或已过期',
        code: 'CSRF_TOKEN_INVALID'
      })
    }

    // 验证通过，继续处理请求
    next()
  })().catch(error => {
    log.error('CSRF 验证中间件错误:', error)
    res.status(500).json({
      success: false,
      message: '安全校验暂时不可用，请稍后重试',
      code: 'CSRF_VALIDATION_ERROR',
      request_id: req.requestId || null
    })
  })
}

function validateGlobalCSRFToken(req, res, next) {
  if (isCSRFExemptRequest(req)) {
    return next()
  }

  return validateCSRFToken(req, res, next)
}

/**
 * 🔒 可选的 CSRF 验证中间件
 * 仅在提供了 Token 时进行验证
 */
function optionalCSRFValidation(req, res, next) {
  return (async () => {
    // 对于安全的方法，跳过
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next()
    }

    const userId = await resolveCSRFUserId(req)
    if (!userId) {
      return next() // 未认证用户跳过
    }

    // 获取 Token
    const token = req.headers['x-csrf-token'] || req.body._csrf || req.body.csrfToken

    if (!token) {
      return next() // 没有提供 Token，跳过验证
    }

    // 验证 Token
    const isValid = await verifyCSRFToken(userId, token)

    if (!isValid) {
      return res.status(403).json({
        success: false,
        message: 'CSRF Token 无效或已过期',
        code: 'CSRF_TOKEN_INVALID'
      })
    }

    next()
  })().catch(error => {
    log.error('可选 CSRF 验证中间件错误:', error)
    next() // 出错时不阻止请求
  })
}

/**
 * 🔒 全局清理过期的 CSRF Token
 * 清理数据库中的所有过期 Token
 */
async function cleanupAllExpiredTokens() {
  return csrfTokenService.cleanupAllExpiredTokens()
}

// 启动定期清理任务（每30分钟清理一次）
const csrfCleanupTimer = setInterval(cleanupAllExpiredTokens, CSRF_CONFIG.CLEANUP_INTERVAL)
csrfCleanupTimer.unref?.()

// 启动时立即执行一次清理
setTimeout(() => {
  log.debug('🔄 CSRF Token 定期清理任务已启动，每30分钟清理一次过期数据')
  cleanupAllExpiredTokens()
}, 5000)

module.exports = {
  router,
  validateCSRFToken,
  validateGlobalCSRFToken,
  optionalCSRFValidation,
  CSRF_CONFIG,
  generateSecureCSRFToken,
  verifyCSRFToken
}
