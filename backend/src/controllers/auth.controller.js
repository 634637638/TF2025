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
    this.database = database
    this.connected = connected
    this.buildUserPayload = buildUserPayload
    this.verifyRefreshToken = verifyRefreshToken
    this.revokeRefreshToken = revokeRefreshToken
    this.issueTokenPair = issueTokenPair
    this.readCookie = readCookie
    this.writeRefreshCookie = writeRefreshCookie
    this.initializationService = initializationService
    this.comparePassword = comparePassword
    this.issueTokens = issueTokens
    this.recordLoginSuccess = recordLoginSuccess
    this.recordLoginFailure = recordLoginFailure
    this.resolveClientIdentifier = resolveClientIdentifier
    this.response = response
    this.logger = logger
  }

  async getCurrentUser(req, res) {
    try {
      if (!this.connected()) {
        this.logger.error('数据库未连接，无法获取用户信息')
        return this.response.error(res, '服务暂时不可用，请稍后再试', 503)
      }

      const database = this.database()
      const [users] = await database.execute(
        'SELECT id, username, name, phone, email, status, last_login FROM users WHERE id = ?',
        [req.user.id]
      )
      if (users.length === 0) return this.response.error(res, '用户不存在', 404)

      const { userPayload } = await this.buildUserPayload(database, users[0])
      return this.response.success(res, {
        ...userPayload,
        last_login: users[0].last_login ? new Date(users[0].last_login).toISOString() : null
      })
    } catch (error) {
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
      const { username, password } = req.body
      if (!this.connected()) {
        this.logger.error('数据库未连接，无法进行用户验证')
        return this.response.error(res, '服务暂时不可用，请稍后再试', 503)
      }

      const database = this.database()
      const [users] = await database.execute(
        'SELECT id, username, password, name, status FROM users WHERE username = ?',
        [username]
      )
      if (users.length === 0) return this.handleLoginFailure(req, res, '用户名或密码错误')

      const user = users[0]
      if (user.status !== 1 && user.status !== 'active') {
        return this.handleLoginFailure(req, res, '账户已被禁用，请联系管理员启用账户', 'account_disabled')
      }
      if (!(await this.comparePassword(password, user.password))) {
        return this.handleLoginFailure(req, res, '用户名或密码错误')
      }

      await database.execute('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id])
      const clientIdentifier = req.ip || req.connection.remoteAddress || 'unknown'
      this.recordLoginSuccess(`${clientIdentifier}:${username}`)
      const { userPayload, accessProfile, tokenPayload } = await this.buildUserPayload(database, user)
      const { accessToken, refreshToken } = this.issueTokens(tokenPayload)
      this.writeRefreshCookie(res, refreshToken)
      return res.json({
        success: true,
        message: '登录成功',
        token: accessToken,
        user: userPayload,
        accessProfile
      })
    } catch (error) {
      this.logger.error('登录失败:', error)
      return this.response.error(res, '登录失败', 500)
    }
  }

  async refresh(req, res, verifyRefreshToken = this.verifyRefreshToken) {
    try {
      const refreshToken = this.readCookie(req, 'refreshToken') || req.body?.refreshToken
      if (!refreshToken) return this.response.error(res, '刷新令牌不能为空', 401)
      if (!this.connected()) {
        return this.response.error(res, '服务暂时不可用，请稍后再试', 503)
      }

      const database = this.database()
      const decoded = await verifyRefreshToken(refreshToken)
      const [users] = await database.execute(
        `SELECT id, username, name, status
         FROM users
         WHERE id = ?
           AND (status = 1 OR status = 'active')`,
        [decoded.sub]
      )
      if (users.length === 0) {
        return this.response.error(res, '用户不存在或已被禁用', 401)
      }

      const { userPayload, accessProfile, tokenPayload } = await this.buildUserPayload(database, users[0])
      await this.revokeRefreshToken(refreshToken)
      const { accessToken, refreshToken: newRefreshToken } = this.issueTokenPair(tokenPayload)
      this.writeRefreshCookie(res, newRefreshToken)

      return this.response.success(res, {
        token: accessToken,
        user: userPayload,
        accessProfile
      }, '令牌刷新成功')
    } catch (error) {
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
