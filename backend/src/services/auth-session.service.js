'use strict'

const crypto = require('crypto')
const BaseService = require('../core/base/base.service')
const AuthUserRepository = require('../repositories/auth-user.repository')
const { getDatabase } = require('../config/database')
const { addToBlacklist } = require('../middleware/jwt-blacklist')

class AuthSessionService extends BaseService {
  constructor({ database = getDatabase, blacklistToken = addToBlacklist, randomBytes = crypto.randomBytes, repository = new AuthUserRepository() } = {}) {
    super()
    Object.assign(this, { database, blacklistToken, randomBytes, repository })
  }

  async logout(token, refreshToken) {
    if (token) await this.blacklistToken(token, 'logout')
    if (refreshToken) await this.blacklistToken(refreshToken, 'logout')
  }

  async logoutAll(actor) {
    await this.repository.revokeAll(this.database(), `jti_logout_all_${this.randomBytes(16).toString('hex')}`, this.getActorId(actor))
  }
}

module.exports = AuthSessionService
