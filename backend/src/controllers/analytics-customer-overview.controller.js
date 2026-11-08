'use strict'

const ApiResponse = require('../utils/response')
const log = require('../utils/log')
const { parseOptionalDate, parseOptionalInt, hasValidQueryValue } = require('../utils/analytics-query')
const AnalyticsCustomerOverviewService = require('../services/analytics-customer-overview.service')

class AnalyticsCustomerOverviewController {
  constructor({ service = new AnalyticsCustomerOverviewService(), response = ApiResponse, logger = log } = {}) {
    this.service = service
    this.response = response
    this.logger = logger
  }

  async getOverview(req, res) {
    const requestedStartDate = req.query.start_date
    const requestedEndDate = req.query.end_date
    const requestedStoreId = req.query.store_id
    const startDate = parseOptionalDate(requestedStartDate)
    const endDate = parseOptionalDate(requestedEndDate)
    const storeId = parseOptionalInt(requestedStoreId)
    this.logger.debug('客户分析查询参数:', { start_date: startDate, end_date: endDate, store_id: storeId })

    if (hasValidQueryValue(requestedStartDate) && !startDate) return this.response.badRequest(res, '开始日期格式无效')
    if (hasValidQueryValue(requestedEndDate) && !endDate) return this.response.badRequest(res, '结束日期格式无效')
    if (hasValidQueryValue(requestedStoreId) && (!storeId || storeId <= 0)) return this.response.badRequest(res, '门店编号无效')
    if (startDate && endDate && startDate > endDate) return this.response.badRequest(res, '开始日期不能晚于结束日期')

    try {
      const data = await this.service.getOverview({ startDate, endDate, storeId })
      return this.response.success(res, data, '获取客户分析成功')
    } catch (error) {
      if (error.message === '数据库连接失败') {
        this.logger.error(error.message)
        return this.response.serverError(res, error.message)
      }
      this.logger.error('获取客户分析失败:', error)
      return this.response.serverError(res, '获取客户分析失败', error)
    }
  }
}

module.exports = AnalyticsCustomerOverviewController
