'use strict'

const RegionService = require('../services/region.service')
const ApiResponse = require('../utils/response')
const log = require('../utils/log')

class RegionController {
  constructor({ service = new RegionService() } = {}) { this.service = service }

  async children(req, res) {
    try {
      const data = await this.service.children(req.query.parent)
      return ApiResponse.success(res, data)
    } catch (error) {
      if ([400, 404].includes(error.statusCode)) return ApiResponse.error(res, error.message, error.statusCode)
      log.error('地区选项读取失败', error)
      return ApiResponse.serverError(res, '地区选项暂时不可用')
    }
  }
}

module.exports = RegionController
