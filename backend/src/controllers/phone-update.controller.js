'use strict'

const ApiResponse = require('../utils/response')
const log = require('../utils/log')
const PhoneUpdateService = require('../services/phone-update.service')

class PhoneUpdateController {
  constructor({ service = new PhoneUpdateService(), response = ApiResponse, logger = log } = {}) {
    this.service = service
    this.response = response
    this.logger = logger
  }

  async update(req, res) {
    try {
      const updatedPhone = await this.service.update(req)
      return this.response.success(res, updatedPhone, '手机更新成功')
    } catch (error) {
      if (error.status === 404) return this.response.notFound(res, error.message)
      if (error.status === 403) {
        return res.status(403).json({
          success: false,
          message: error.message,
          code: error.code || 'INSUFFICIENT_PERMISSIONS'
        })
      }
      if (error.status === 400 || (error instanceof Error && !error.code)) {
        return this.response.badRequest(res, error.message || '更新手机失败')
      }
      this.logger.error('更新手机失败:', error)
      return this.response.serverError(res, '更新手机失败', error)
    }
  }
}

module.exports = PhoneUpdateController
