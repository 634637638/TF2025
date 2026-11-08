'use strict'

const ApiResponse = require('../utils/response')
const log = require('../utils/log')
const AnalyticsProfitTrendService = require('../services/analytics-profit-trend.service')
const { parseOptionalInt } = require('../utils/analytics-query')

class AnalyticsProfitTrendController {
  constructor({ service = new AnalyticsProfitTrendService(), response = ApiResponse, logger = log } = {}) {
    this.service = service
    this.response = response
    this.logger = logger
  }

  async getProfitTrend(req, res) {
    try {
      const data = await this.service.getProfitTrend({
        granularity: req.query.granularity,
        endDate: req.query.end_date,
        storeId: parseOptionalInt(req.query.store_id)
      })
      return this.response.success(res, data)
    } catch (error) {
      if (error.message === '数据库连接失败') return this.response.serverError(res, error.message)
      this.logger.error('获取盈利趋势数据失败:', error)
      return this.response.serverError(res, '获取盈利趋势数据失败', error)
    }
  }
}

module.exports = AnalyticsProfitTrendController
