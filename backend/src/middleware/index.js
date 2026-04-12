const express = require('express');
const { unifiedAuth, optionalAuth, requireRole } = require('./unified-auth');
const log = require('../utils/log');

// 导入安全中间件
const { corsMiddleware, corsLogger } = require('./cors');
const { securityMiddleware, customSecurityHeaders, securityLogger } = require('./security');
const { loginAttemptsMiddleware, loginFailureHandler } = require('./login-attempts');

/**
 * 设置安全中间件
 * @param {Express} app Express应用实例
 */
function setupSecurityMiddleware(app) {
  // 1. 安全日志记录（最优先）
  app.use(securityLogger);
  app.use(corsLogger);

  // 2. 安全HTTP头
  app.use(securityMiddleware);
  app.use(customSecurityHeaders);

  // 3. CORS配置
  app.use(corsMiddleware);

  // 4. 登录失败限制
  app.use(loginAttemptsMiddleware);
  app.use(loginFailureHandler);

  log.info('🔒 安全中间件配置完成');
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
  }));

  // 2. URL编码中间件
  app.use(express.urlencoded({
    extended: true,
    limit: '10mb'
  }));

  // 3. 信任代理（如果使用反向代理）
  app.set('trust proxy', 1);

  log.info('⚙️ 基础中间件配置完成');
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
    });
  });

  // API路由
  app.use('/api', routes);

  // 404处理
  app.use('*', (req, res) => {
    res.status(404).json({
      success: false,
      message: '接口不存在',
      path: req.originalUrl,
      method: req.method
    });
  });

  log.info('🛣️ 路由配置完成');
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
};

module.exports = {
  setupSecurityMiddleware,
  setupBasicMiddleware,
  setupRoutes,
  auth
};
