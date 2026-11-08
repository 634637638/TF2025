'use strict'

const ApiResponse = require('../utils/response')
const log = require('../utils/log')
const AnalyticsSalesForecastService = require('../services/analytics-sales-forecast.service')

class AnalyticsSalesForecastController {
  constructor({ service = new AnalyticsSalesForecastService(), response = ApiResponse, logger = log } = {}) {
    this.service = service
    this.response = response
    this.logger = logger
  }

  async getForecast(req, res) {
    try {
      const result = await this.service.getForecast(req.query)
      return this.response.success(res, result)
    } catch (error) {
      if (error.code === 'DATABASE_UNAVAILABLE') {
        return this.response.serverError(res, error.message)
      }
      this.logger.error('获取销售预测失败:', error)
      return this.response.serverError(res, '获取销售预测失败', error)
    }
  }
}

module.exports = AnalyticsSalesForecastController
