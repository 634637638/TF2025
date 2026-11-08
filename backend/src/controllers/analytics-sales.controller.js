'use strict'

const ApiResponse = require('../utils/response')
const log = require('../utils/log')
const AnalyticsSalesService = require('../services/analytics-sales.service')
const { hasValidQueryValue, parseOptionalDate, parseOptionalInt } = require('../utils/analytics-query')

class AnalyticsSalesController {
  constructor({ service = new AnalyticsSalesService(), response = ApiResponse, logger = log } = {}) {
    this.service = service
    this.response = response
    this.logger = logger
  }

  async getSales(req, res) {
    const parsedStart = parseOptionalDate(req.query.start_date)
    const parsedEnd = parseOptionalDate(req.query.end_date)
    if (hasValidQueryValue(req.query.start_date) && !parsedStart) {
      return this.response.badRequest(res, '开始日期格式无效')
    }
    if (hasValidQueryValue(req.query.end_date) && !parsedEnd) {
      return this.response.badRequest(res, '结束日期格式无效')
    }

    try {
      const data = await this.service.getSales({
        startDate: parsedStart,
        endDate: parsedEnd,
        storeId: parseOptionalInt(req.query.store_id),
        supplierId: parseOptionalInt(req.query.supplier_id)
      })
      return this.response.success(res, data)
    } catch (error) {
      if (error.message === '数据库连接失败') return this.response.serverError(res, error.message)
      this.logger.error('获取销售分析失败:', error)
      return this.response.serverError(res, '获取销售分析失败', error)
    }
  }
}

module.exports = AnalyticsSalesController
