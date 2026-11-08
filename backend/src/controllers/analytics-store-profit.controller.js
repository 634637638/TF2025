'use strict'

const ApiResponse = require('../utils/response')
const log = require('../utils/log')
const AnalyticsStoreProfitService = require('../services/analytics-store-profit.service')
const { parseOptionalInt } = require('../utils/analytics-query')

class AnalyticsStoreProfitController {
  constructor({ service = new AnalyticsStoreProfitService(), response = ApiResponse, logger = log } = {}) {
    this.service = service
    this.response = response
    this.logger = logger
  }

  async getStoreProfit(req, res) {
    try {
      const data = await this.service.getStoreProfit({
        startDate: req.query.start_date,
        endDate: req.query.end_date,
        storeId: parseOptionalInt(req.query.store_id),
        supplierId: parseOptionalInt(req.query.supplier_id)
      })
      return this.response.success(res, data)
    } catch (error) {
      if (error.message === '数据库连接失败') return this.response.serverError(res, error.message)
      this.logger.error('获取门店利润失败:', error)
      return this.response.serverError(res, '获取门店利润失败', error)
    }
  }
}

module.exports = AnalyticsStoreProfitController
