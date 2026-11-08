'use strict'

const ApiResponse = require('../utils/response')
const log = require('../utils/log')
const AnalyticsEmployeePerformanceService = require('../services/analytics-employee-performance.service')
const { parseOptionalInt } = require('../utils/analytics-query')

class AnalyticsEmployeePerformanceController {
  constructor({ service = new AnalyticsEmployeePerformanceService(), response = ApiResponse, logger = log } = {}) {
    this.service = service
    this.response = response
    this.logger = logger
  }

  async getPerformance(req, res) {
    try {
      const data = await this.service.getPerformance({
        startDate: req.query.start_date,
        endDate: req.query.end_date,
        storeId: parseOptionalInt(req.query.store_id)
      })
      return this.response.success(res, data)
    } catch (error) {
      if (error.message === '数据库连接失败') return this.response.serverError(res, error.message)
      this.logger.error('获取员工业绩统计失败:', error)
      return this.response.serverError(res, '获取员工业绩统计失败', error)
    }
  }
}

module.exports = AnalyticsEmployeePerformanceController
