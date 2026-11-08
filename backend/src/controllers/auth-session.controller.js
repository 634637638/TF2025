'use strict'

const crypto = require('crypto')
const { getDatabase } = require('../config/database')
const { addToBlacklist } = require('../middleware/jwt-blacklist')
const { clearRefreshCookie, getCookie } = require('../utils/http-cookie')
const ApiResponse = require('../utils/response')
const log = require('../utils/log')

class AuthSessionController {
  constructor({
    database = getDatabase,
    blacklistToken = addToBlacklist,
    clearCookie = clearRefreshCookie,
    readCookie = getCookie,
    response = ApiResponse,
    logger = log,
    randomBytes = crypto.randomBytes
  } = {}) {
    this.database = database
    this.blacklistToken = blacklistToken
    this.clearCookie = clearCookie
    this.readCookie = readCookie
    this.response = response
    this.logger = logger
    this.randomBytes = randomBytes
  }

  async logout(req, res) {
    try {
      const authHeader = req.headers['authorization']
      const token = authHeader && authHeader.split(' ')[1]
      const refreshToken = this.readCookie(req, 'refreshToken')

      if (token) await this.blacklistToken(token, 'logout')
      if (refreshToken) await this.blacklistToken(refreshToken, 'logout')

      this.clearCookie(res)
      return this.response.success(res, null, '退出成功')
    } catch (error) {
      this.logger.error('退出处理失败:', error)
      return this.response.error(res, '退出失败', 500)
    }
  }

  async logoutAll(req, res) {
    try {
      const database = this.database()
      const userId = req.user.id

      await database.execute(
        `INSERT INTO jwt_blacklist
         (jti, user_id, token_type, reason, created_at, expires_at)
         VALUES (?, ?, 'access', 'logout_all', NOW(), DATE_ADD(NOW(), INTERVAL 31 DAY))`,
        [`jti_logout_all_${this.randomBytes(16).toString('hex')}`, userId]
      )

      this.clearCookie(res)
      return this.response.success(res, null, '已退出所有设备')
    } catch (error) {
      this.logger.error('退出所有设备失败:', error)
      return this.response.error(res, '退出所有设备失败', 500)
    }
  }
}

module.exports = AuthSessionController
