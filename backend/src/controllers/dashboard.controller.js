'use strict'

const DashboardService = require('../services/dashboard.service')
const ApiResponse = require('../utils/response')
const log = require('../utils/log')
const { getDatabase, isConnected } = require('../config/database')
const DashboardReadService = require('../services/dashboard-read.service')

class DashboardController {
  constructor({
    dashboardService = new DashboardService(),
    database = getDatabase,
    connected = isConnected
  } = {}) {
    this.readService = new DashboardReadService({ database, connected })
    this.dashboardService = dashboardService
  }

  async getDashboardData(req, res) {
    try {
      return ApiResponse.success(res, await this.readService.getDashboardData(req.user))
    } catch (error) {
      log.error('获取仪表盘数据失败:', error)
      return ApiResponse.error(res, '获取仪表盘数据失败', 500)
    }
  }

  async getActivities(_req, res) {
    try {
      return ApiResponse.success(res, await this.readService.getActivities(), '获取最近活动成功')
    } catch (error) {
      log.error('获取最近活动失败:', error)
      return ApiResponse.serverError(res, '获取最近活动失败', error)
    }
  }

  async respondToWarning(res, operation, fallback) {
    try {
      const result = await operation()
      if (result.success) return ApiResponse.success(res, result.data)
      return ApiResponse.error(res, result.message, 400)
    } catch (error) {
      log.error(`${fallback}:`, error)
      return ApiResponse.error(res, fallback, 500)
    }
  }

  getComprehensiveWarnings(req, res) {
    const { phone_threshold, page_size } = req.query
    return this.respondToWarning(
      res,
      () => this.dashboardService.getComprehensiveWarnings({ phone_threshold, page_size }),
      '获取综合预警失败'
    )
  }

  getPhoneStockWarnings(req, res) {
    const { threshold, page_size } = req.query
    return this.respondToWarning(
      res,
      () => this.dashboardService.getPhoneStockWarnings({ threshold, page_size }),
      '获取手机库存预警失败'
    )
  }

  getModelStockWarnings(req, res) {
    const { threshold, page_size } = req.query
    return this.respondToWarning(
      res,
      () => this.dashboardService.getModelStockWarnings({ threshold, page_size }),
      '获取机型库存预警失败'
    )
  }

  getSalesWarnings(_req, res) {
    return this.respondToWarning(
      res,
      () => this.dashboardService.getSalesWarnings(),
      '获取销售预警失败'
    )
  }

  getPurchaseWarnings(_req, res) {
    return this.respondToWarning(
      res,
      () => this.dashboardService.getPurchaseWarnings(),
      '获取入库预警失败'
    )
  }
}

module.exports = DashboardController
