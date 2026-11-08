'use strict'

const { getDatabase, isConnected } = require('../config/database')
const bcrypt = require('bcryptjs')
const { generateTokens, addToBlacklist, verifyToken } = require('../middleware/jwt-blacklist')
const {
  recordSuccessfulLogin,
  recordFailedLogin,
  getClientIdentifier
} = require('../middleware/login-attempts')
const { getCookie, setRefreshCookie } = require('../utils/http-cookie')
const AuthUserService = require('../services/auth-user.service')
const AuthInitializationService = require('../services/auth-initialization.service')
const ApiResponse = require('../utils/response')
const log = require('../utils/log')

class AuthController {
  constructor({
    database = getDatabase,
    connected = isConnected,
    buildUserPayload,
    verifyRefreshToken = token => verifyToken(token, 'refresh'),
    revokeRefreshToken = token => addToBlacklist(token, 'refresh_used'),
    issueTokenPair = generateTokens,
    readCookie = getCookie,
    writeRefreshCookie = setRefreshCookie,
    initializationService = new AuthInitializationService(),
    comparePassword = bcrypt.compare,
    issueTokens = generateTokens,
    recordLoginSuccess = recordSuccessfulLogin,
    recordLoginFailure = recordFailedLogin,
    resolveClientIdentifier = getClientIdentifier,
    response = ApiResponse,
    logger = log
  } = {}) {
    this.service = new AuthUserService({ database, connected, buildUserPayload, comparePassword, issueTokens, issueTokenPair, verifyRefreshToken, revokeRefreshToken })
    this.verifyRefreshToken = verifyRefreshToken
    this.readCookie = readCookie
    this.writeRefreshCookie = writeRefreshCookie
    this.initializationService = initializationService
    this.recordLoginSuccess = recordLoginSuccess
    this.recordLoginFailure = recordLoginFailure
    this.resolveClientIdentifier = resolveClientIdentifier
    this.response = response
    this.logger = logger
  }

  async getCurrentUser(req, res) {
    try {
      return this.response.success(res, await this.service.getCurrentUser(req.user))
    } catch (error) {
      if (error.statusCode) return this.response.error(res, error.message, error.statusCode)
      this.logger.error('获取用户信息失败:', error)
      return this.response.error(res, '获取用户信息失败', 500)
    }
  }

  handleLoginFailure(req, res, message, reason = 'invalid_credentials') {
    const identifier = this.resolveClientIdentifier(req)
    req.loginFailureReason = reason

    if (reason !== 'invalid_credentials') {
      req.loginAttemptHandled = true
      return res.status(403).json({ success: false, message, code: 'ACCOUNT_DISABLED' })
    }

    const result = this.recordLoginFailure(identifier)
    req.loginAttemptHandled = true
    if (result.attempts >= 3 || result.blocked) {
      this.logger.warn(`登录失败记录 - 标识符: ${identifier}, 尝试次数: ${result.attempts}`)
    }
    res.setHeader('X-Login-Attempts-Remaining', result.remainingAttempts)

    if (result.blocked) {
      const remainingMinutes = Math.ceil((result.lockUntil - Date.now()) / 60000)
      this.logger.warn(`账户已被锁定 - 标识符: ${identifier}, 锁定时长: ${remainingMinutes} 分钟`)
      return res.status(429).json({
        success: false,
        message: '登录尝试次数过多，账户已被临时锁定',
        code: 'LOGIN_RATE_LIMITED',
        details: { lockDuration: remainingMinutes }
      })
    }
    return res.status(401).json({ success: false, message })
  }

  async login(req, res) {
    try {
      const { username } = req.body
      const result = await this.service.login(req.body, () => {
        const clientIdentifier = req.ip || req.connection.remoteAddress || 'unknown'
        this.recordLoginSuccess(`${clientIdentifier}:${username}`)
      })
      if (result.failure) return this.handleLoginFailure(req, res, result.failure.message, result.failure.reason)
      this.writeRefreshCookie(res, result.refreshToken)
      return res.json({ success: true, message: '登录成功', token: result.accessToken, user: result.userPayload, accessProfile: result.accessProfile })
    } catch (error) {
      if (error.statusCode) return this.response.error(res, error.message, error.statusCode)
      this.logger.error('登录失败:', error)
      return this.response.error(res, '登录失败', 500)
    }
  }

  async refresh(req, res, verifyRefreshToken = this.verifyRefreshToken) {
    try {
      const refreshToken = this.readCookie(req, 'refreshToken') || req.body?.refreshToken
      const result = await this.service.refresh(refreshToken, verifyRefreshToken)
      this.writeRefreshCookie(res, result.refreshToken)
      const { token, user, accessProfile } = result
      return this.response.success(res, { token, user, accessProfile }, '令牌刷新成功')
    } catch (error) {
      if (error.statusCode) return this.response.error(res, error.message, error.statusCode)
      this.logger.error('令牌刷新失败:', error)
      if (error.message === '令牌已过期') {
        return this.response.error(res, '刷新令牌已过期，请重新登录', 401)
      }
      if (error.message === '无效的令牌' || error.message === 'Token已被吊销') {
        return this.response.error(res, '无效的刷新令牌', 401)
      }
      return this.response.error(res, '令牌刷新失败', 500)
    }
  }

  getRefreshHandler(verifyRefreshToken = this.verifyRefreshToken) {
    return (req, res) => this.refresh(req, res, verifyRefreshToken)
  }

  async initializeAdmin(_req, res, nodeEnv = process.env.NODE_ENV, enabled = process.env.ENABLE_DEV_INIT_ADMIN) {
    if (nodeEnv !== 'development' || enabled !== 'true') {
      return this.response.error(res, '管理员初始化接口未启用', 403)
    }

    try {
      const result = await this.initializationService.initializeAdmin()
      if (result.exists) return this.response.error(res, '管理员用户已存在', 400)
      return this.response.success(res, {
        id: result.id,
        username: 'admin',
        password: result.password,
        password_source: result.passwordSource,
        role_id: result.roleId,
        message: '请保存此密码并在登录后立即修改'
      }, '管理员用户初始化成功')
    } catch (error) {
      this.logger.error('初始化管理员失败:', error)
      return this.response.error(res, '初始化管理员失败', 500)
    }
  }

  getAdminInitializationHandler(nodeEnv, enabled) {
    return (req, res) => this.initializeAdmin(req, res, nodeEnv, enabled)
  }
}

module.exports = AuthController
