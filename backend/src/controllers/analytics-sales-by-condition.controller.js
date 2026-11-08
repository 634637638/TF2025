'use strict'

const ApiResponse = require('../utils/response')
const log = require('../utils/log')
const AnalyticsSalesByConditionService = require('../services/analytics-sales-by-condition.service')
const { parseOptionalInt } = require('../utils/analytics-query')

class AnalyticsSalesByConditionController {
  constructor({ service = new AnalyticsSalesByConditionService(), response = ApiResponse, logger = log } = {}) {
    this.service = service
    this.response = response
    this.logger = logger
  }

  async getSalesByCondition(req, res) {
    try {
      const data = await this.service.getSalesByCondition({
        startDate: req.query.start_date,
        endDate: req.query.end_date,
        storeId: parseOptionalInt(req.query.store_id),
        supplierId: parseOptionalInt(req.query.supplier_id)
      })
      return this.response.success(res, data)
    } catch (error) {
      if (error.message === '数据库连接失败') return this.response.serverError(res, error.message)
      this.logger.error('获取全新/二手销售数据失败:', error)
      return this.response.serverError(res, '获取全新/二手销售数据失败', error)
    }
  }
}

module.exports = AnalyticsSalesByConditionController
