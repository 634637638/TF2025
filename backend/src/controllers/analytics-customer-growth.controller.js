'use strict'

const ApiResponse = require('../utils/response')
const log = require('../utils/log')
const AnalyticsCustomerGrowthService = require('../services/analytics-customer-growth.service')
const { parseOptionalInt } = require('../utils/analytics-query')

class AnalyticsCustomerGrowthController {
  constructor({ service = new AnalyticsCustomerGrowthService(), response = ApiResponse, logger = log } = {}) {
    this.service = service
    this.response = response
    this.logger = logger
  }

  async getGrowth(req, res) {
    try {
      const data = await this.service.getGrowth({
        period: req.query.period,
        storeId: parseOptionalInt(req.query.store_id)
      })
      return this.response.success(res, data, '获取客户增长数据成功')
    } catch (error) {
      if (error.statusCode === 500 && error.message === '数据库连接失败') {
        return this.response.serverError(res, '数据库连接失败')
      }
      this.logger.error('获取客户增长数据失败:', error)
      return this.response.serverError(res, '获取客户增长数据失败', error)
    }
  }
}

module.exports = AnalyticsCustomerGrowthController
