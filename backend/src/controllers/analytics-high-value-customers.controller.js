'use strict'

const ApiResponse = require('../utils/response')
const log = require('../utils/log')
const AnalyticsHighValueCustomersService = require('../services/analytics-high-value-customers.service')
const { parseOptionalInt } = require('../utils/analytics-query')

class AnalyticsHighValueCustomersController {
  constructor({ service = new AnalyticsHighValueCustomersService(), response = ApiResponse, logger = log } = {}) {
    this.service = service
    this.response = response
    this.logger = logger
  }

  async list(req, res) {
    const page = Number.parseInt(String(req.query.page || 1), 10)
    const pageSize = Number.parseInt(String(req.query.page_size || 20), 10)
    try {
      const result = await this.service.list({
        page,
        pageSize,
        search: req.query.search_term,
        startDate: req.query.start_date,
        endDate: req.query.end_date,
        requestedStoreId: req.query.store_id,
        storeId: parseOptionalInt(req.query.store_id)
      })
      return this.response.success(res, result.customers, '获取成功', 200, { pagination: result.pagination })
    } catch (error) {
      if (error.statusCode === 400) return this.response.badRequest(res, error.message)
      if (error.statusCode === 500 && error.message === '数据库连接失败') {
        return this.response.serverError(res, '数据库连接失败')
      }
      this.logger.error('获取高价值客户失败:', error)
      return this.response.serverError(res, '获取高价值客户失败', error)
    }
  }
}

module.exports = AnalyticsHighValueCustomersController
