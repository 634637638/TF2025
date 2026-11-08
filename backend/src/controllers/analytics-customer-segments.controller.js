'use strict'

const ApiResponse = require('../utils/response')
const log = require('../utils/log')
const AnalyticsCustomerSegmentsService = require('../services/analytics-customer-segments.service')
const { parseOptionalInt } = require('../utils/analytics-query')

class AnalyticsCustomerSegmentsController {
  constructor({ service = new AnalyticsCustomerSegmentsService(), response = ApiResponse, logger = log } = {}) {
    this.service = service
    this.response = response
    this.logger = logger
  }

  async getSegments(req, res) {
    try {
      const data = await this.service.getSegments({ storeId: parseOptionalInt(req.query.store_id) })
      return this.response.success(res, data, '获取客户细分成功')
    } catch (error) {
      if (error.statusCode === 500 && error.message === '数据库连接失败') {
        return this.response.serverError(res, '数据库连接失败')
      }
      this.logger.error('获取客户细分数据失败:', error)
      return this.response.serverError(res, '获取客户细分数据失败', error)
    }
  }
}

module.exports = AnalyticsCustomerSegmentsController
