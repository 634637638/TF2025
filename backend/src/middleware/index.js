const express = require('express')
const { unifiedAuth, optionalAuth, requireRole } = require('./unified-auth')
const log = require('../utils/log')

// 导入安全中间件
const { corsMiddleware, corsLogger } = require('./cors')
const { securityMiddleware, customSecurityHeaders, securityLogger } = require('./security')
const { loginAttemptsMiddleware, loginFailureHandler } = require('./login-attempts')
const { validateGlobalCSRFToken } = require('../routes/csrf')
const { baseRateLimit, rateLimitLogger } = require('./rate-limit')

/**
 * 设置安全中间件
 * @param {Express} app Express应用实例
 */
function setupSecurityMiddleware(app) {
  // 旧路由仍可能直接 res.json({ error: error.message })；统一剥离 5xx 响应中的内部错误细节。
  app.use((req, res, next) => {
    const sendJson = res.json.bind(res)
    res.json = body => {
      if (body && body.success === false && res.statusCode >= 500) {
        const safeBody = { ...body }
        delete safeBody.error
        delete safeBody.stack
        delete safeBody.details
        safeBody.message = '服务器内部错误，请稍后重试'
        safeBody.code = safeBody.code || 'INTERNAL_ERROR'
        return sendJson(safeBody)
      }
      return sendJson(body)
    }
    next()
  })

  // 1. 安全日志记录（最优先）
  app.use(securityLogger)
  app.use(corsLogger)

  // 2. 安全HTTP头
  app.use(securityMiddleware)
  app.use(customSecurityHeaders)

  // 3. CORS配置
  app.use(corsMiddleware)

  // API 全局宽松限流；高风险公开接口在各自路由中另有限制。
  // 放在请求体解析前，避免大请求先消耗解析资源。
  app.use('/api', rateLimitLogger, baseRateLimit)

  log.info('🔒 安全中间件配置完成')
}

/**
 * 设置依赖请求体的登录失败限制。
 * 请求体解析完成后再读取用户名/手机号，且不影响全局限流的前置保护。
 */
function setupBodyDependentSecurityMiddleware(app) {
  app.use(loginAttemptsMiddleware)
  app.use(loginFailureHandler)
}

/**
 * 设置基础中间件
 * @param {Express} app Express应用实例
 */
function setupBasicMiddleware(app) {
  // 1. JSON解析中间件
  app.use(express.json({
    limit: '10mb',
    type: ['application/json', 'text/plain']
  }))

  // 2. URL编码中间件
  app.use(express.urlencoded({
    extended: true,
    limit: '10mb'
  }))

  // 3. 信任代理（如果使用反向代理）
  app.set('trust proxy', 1)

  log.info('⚙️ 基础中间件配置完成')
}

/**
 * 设置路由
 * @param {Express} app Express应用实例
 * @param {Router} routes 路由模块
 */
function setupRoutes(app, routes) {
  // 健康检查端点
  app.get('/health', (req, res) => {
    res.json({
      success: true,
      status: 'success',
      message: '服务运行正常',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    })
  })

  // API路由
  app.use('/api', validateGlobalCSRFToken, routes)

  // 404处理
  app.use('*', (req, res) => {
    res.status(404).json({
      success: false,
      message: '接口不存在',
      path: req.originalUrl,
      method: req.method
    })
  })

  log.info('🛣️ 路由配置完成')
}

/**
 * 身份认证中间件
 */
const auth = {
  // 统一认证
  authenticate: unifiedAuth,

  // 角色验证
  requireRole,

  // 可选认证（不强制要求登录）
  optionalAuth
}

module.exports = {
  setupSecurityMiddleware,
  setupBodyDependentSecurityMiddleware,
  setupBasicMiddleware,
  setupRoutes,
  auth
}
