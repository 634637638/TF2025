'use strict'

const ApiResponse = require('../utils/response')
const EmployeeStatisticsService = require('../services/employee-statistics.service')
const log = require('../utils/log')

class EmployeeStatisticsController {
  constructor({ service = new EmployeeStatisticsService(), logger = log } = {}) {
    this.service = service
    this.logger = logger
  }

  async overview(req, res) {
    try {
      const data = await this.service.getOverviewStats(req.query)
      return ApiResponse.success(res, data)
    } catch (error) {
      this.logger.error('获取员工统计失败:', error)
      return ApiResponse.serverError(res, '获取员工统计失败', error)
    }
  }
}

module.exports = EmployeeStatisticsController
