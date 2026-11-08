'use strict'

const ApiResponse = require('../utils/response')
const log = require('../utils/log')
const RentalDeviceService = require('../services/rental-device.service')

class RentalDeviceController {
  constructor({ service = new RentalDeviceService(), response = ApiResponse, logger = log } = {}) {
    this.service = service
    this.response = response
    this.logger = logger
  }

  async listAvailable(req, res) {
    try {
      const result = await this.service.listAvailable(req.query, req.user.id)
      if (result.forbidden) {
        return res.status(403).json({
          success: false,
          message: '没有可用的设备搜索字段',
          code: 'FIELD_PERMISSION_DENIED'
        })
      }
      if (result.pagination) {
        return this.response.success(res, result.rows, '获取可售在库设备成功', 200, {
          pagination: result.pagination
        })
      }
      return this.response.success(res, result.rows, '获取可售在库设备成功')
    } catch (error) {
      this.logger.error('可租设备检索失败:', error)
      return this.response.serverError(res, '可租设备检索失败', error)
    }
  }
}

module.exports = RentalDeviceController
