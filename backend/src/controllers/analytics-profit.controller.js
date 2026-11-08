'use strict'

const ApiResponse = require('../utils/response')
const log = require('../utils/log')
const AnalyticsProfitService = require('../services/analytics-profit.service')

class AnalyticsProfitController {
  constructor({ service = new AnalyticsProfitService(), response = ApiResponse, logger = log } = {}) {
    this.service = service
    this.response = response
    this.logger = logger
  }

  async getProfit(req, res) {
    try {
      const data = await this.service.getProfit({
        startDate: req.query.start_date,
        endDate: req.query.end_date,
        storeId: req.query.store_id
      })
      return this.response.success(res, data)
    } catch (error) {
      if (error.message === '数据库连接失败') return this.response.serverError(res, error.message)
      this.logger.error('获取盈利分析失败:', error)
      this.logger.error('错误堆栈:', error.stack)
      return this.response.serverError(res, '获取盈利分析失败', error)
    }
  }
}

module.exports = AnalyticsProfitController
