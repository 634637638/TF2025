'use strict'

const ApiResponse = require('../utils/response')
const log = require('../utils/log')
const AnalyticsTransfersService = require('../services/analytics-transfers.service')

class AnalyticsTransfersController {
  constructor({ service = new AnalyticsTransfersService(), logger = log } = {}) {
    this.service = service
    this.logger = logger
  }

  async getTransfersAndAllocations(req, res) {
    try {
      const result = await this.service.getAnalytics(req.query)
      return ApiResponse.success(res, result, '获取划拨批发分析数据成功')
    } catch (error) {
      this.logger.error('获取划拨批发分析数据失败:', error)
      if (error.code === 'INVALID_DATE') return ApiResponse.badRequest(res, error.message)
      if (error.code === 'DATABASE_UNAVAILABLE') return ApiResponse.serverError(res, error.message)
      return ApiResponse.serverError(res, '获取划拨批发分析数据失败', error)
    }
  }
}

module.exports = AnalyticsTransfersController
