'use strict'

const ApiResponse = require('../utils/response')
const log = require('../utils/log')
const AnalyticsCustomerRetentionService = require('../services/analytics-customer-retention.service')
const { parseOptionalInt } = require('../utils/analytics-query')

class AnalyticsCustomerRetentionController {
  constructor({ service = new AnalyticsCustomerRetentionService(), response = ApiResponse, logger = log } = {}) {
    this.service = service
    this.response = response
    this.logger = logger
  }

  async getRetention(req, res) {
    try {
      const data = await this.service.getRetention({
        cohort: req.query.cohort || 'monthly',
        storeId: parseOptionalInt(req.query.store_id)
      })
      return this.response.success(res, data, '获取客户留存率成功')
    } catch (error) {
      if (error.statusCode === 400) return this.response.badRequest(res, error.message)
      if (error.statusCode === 500 && error.message === '数据库连接失败') {
        return this.response.serverError(res, '数据库连接失败')
      }
      this.logger.error('获取客户留存率失败:', error)
      return this.response.serverError(res, '获取客户留存率失败', error)
    }
  }
}

module.exports = AnalyticsCustomerRetentionController
