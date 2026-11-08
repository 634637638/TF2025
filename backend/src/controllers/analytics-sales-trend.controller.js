'use strict'

const ApiResponse = require('../utils/response')
const log = require('../utils/log')
const AnalyticsSalesTrendService = require('../services/analytics-sales-trend.service')
const { parseOptionalInt } = require('../utils/analytics-query')

class AnalyticsSalesTrendController {
  constructor({ service = new AnalyticsSalesTrendService(), response = ApiResponse, logger = log } = {}) {
    this.service = service
    this.response = response
    this.logger = logger
  }

  async getSalesTrends(req, res) {
    try {
      const result = await this.service.getSalesTrends({
        period: req.query.period,
        storeId: parseOptionalInt(req.query.store_id),
        startDate: req.query.start_date,
        endDate: req.query.end_date
      })
      return this.response.success(res, result, '获取销量趋势成功')
    } catch (error) {
      if (error.statusCode === 400) return this.response.badRequest(res, error.message)
      if (error.statusCode === 500) return this.response.serverError(res, error.message)
      this.logger.error('获取销量趋势失败:', error)
      return this.response.serverError(res, '获取销量趋势失败', error)
    }
  }
}

module.exports = AnalyticsSalesTrendController
