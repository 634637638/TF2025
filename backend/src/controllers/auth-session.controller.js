'use strict'

const crypto = require('crypto')
const AuthSessionService = require('../services/auth-session.service')
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
    this.service = new AuthSessionService({ database, blacklistToken, randomBytes })
    this.clearCookie = clearCookie
    this.readCookie = readCookie
    this.response = response
    this.logger = logger
  }

  async logout(req, res) {
    try {
      const authHeader = req.headers['authorization']
      const token = authHeader && authHeader.split(' ')[1]
      const refreshToken = this.readCookie(req, 'refreshToken')

      await this.service.logout(token, refreshToken)

      this.clearCookie(res)
      return this.response.success(res, null, '退出成功')
    } catch (error) {
      this.logger.error('退出处理失败:', error)
      return this.response.error(res, '退出失败', 500)
    }
  }

  async logoutAll(req, res) {
    try {
      await this.service.logoutAll(req.user)

      this.clearCookie(res)
      return this.response.success(res, null, '已退出所有设备')
    } catch (error) {
      this.logger.error('退出所有设备失败:', error)
      return this.response.error(res, '退出所有设备失败', 500)
    }
  }
}

module.exports = AuthSessionController
