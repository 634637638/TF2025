'use strict'

const BaseService = require('../core/base/base.service')
const AuthUserRepository = require('../repositories/auth-user.repository')
const { getDatabase, isConnected } = require('../config/database')
const bcrypt = require('bcryptjs')
const { generateTokens, addToBlacklist, verifyToken } = require('../middleware/jwt-blacklist')

class AuthUserService extends BaseService {
  constructor({ database = getDatabase, connected = isConnected, repository = new AuthUserRepository(), buildUserPayload,
    comparePassword = bcrypt.compare, issueTokens = generateTokens, issueTokenPair = generateTokens,
    verifyRefreshToken = token => verifyToken(token, 'refresh'), revokeRefreshToken = token => addToBlacklist(token, 'refresh_used') } = {}) {
    super()
    Object.assign(this, { database, connected, repository, buildUserPayload, comparePassword, issueTokens, issueTokenPair, verifyRefreshToken, revokeRefreshToken })
  }

  requireDatabase() {
    if (!this.connected()) throw this.createError('服务暂时不可用，请稍后再试', 503)
    return this.database()
  }

  async getCurrentUser(actor) {
    const database = this.requireDatabase()
    const [users] = await this.repository.findCurrentUser(database, this.getActorId(actor))
    if (users.length === 0) throw this.createError('用户不存在', 404)
    const { userPayload } = await this.buildUserPayload(database, users[0])
    return { ...userPayload, last_login: users[0].last_login ? new Date(users[0].last_login).toISOString() : null }
  }

  async login({ username, password }, onAuthenticated) {
    const database = this.requireDatabase()
    const [users] = await this.repository.findLoginUser(database, username)
    if (users.length === 0) return { failure: { message: '用户名或密码错误', reason: 'invalid_credentials' } }
    const user = users[0]
    if (user.status !== 1 && user.status !== 'active') {
      return { failure: { message: '账户已被禁用，请联系管理员启用账户', reason: 'account_disabled' } }
    }
    if (!(await this.comparePassword(password, user.password))) {
      return { failure: { message: '用户名或密码错误', reason: 'invalid_credentials' } }
    }
    await this.repository.recordLogin(database, user.id)
    onAuthenticated()
    const { userPayload, accessProfile, tokenPayload } = await this.buildUserPayload(database, user)
    return { userPayload, accessProfile, ...this.issueTokens(tokenPayload) }
  }

  async refresh(refreshToken, verifyRefreshToken = this.verifyRefreshToken) {
    if (!refreshToken) throw this.createError('刷新令牌不能为空', 401)
    const database = this.requireDatabase()
    const decoded = await verifyRefreshToken(refreshToken)
    const [users] = await this.repository.findRefreshUser(database, decoded.sub)
    if (users.length === 0) throw this.createError('用户不存在或已被禁用', 401)
    const { userPayload, accessProfile, tokenPayload } = await this.buildUserPayload(database, users[0])
    await this.revokeRefreshToken(refreshToken)
    const { accessToken, refreshToken: newRefreshToken } = this.issueTokenPair(tokenPayload)
    return { token: accessToken, user: userPayload, accessProfile, refreshToken: newRefreshToken }
  }
}

module.exports = AuthUserService
