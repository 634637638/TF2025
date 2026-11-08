'use strict'

const ApiResponse = require('../utils/response')
const log = require('../utils/log')
const AnalyticsCustomerDetailService = require('../services/analytics-customer-detail.service')
const { parseOptionalInt } = require('../utils/analytics-query')

class AnalyticsCustomerDetailController {
  constructor({ service = new AnalyticsCustomerDetailService(), response = ApiResponse, logger = log } = {}) {
    this.service = service
    this.response = response
    this.logger = logger
  }

  async getDetail(req, res) {
    const customerId = Number.parseInt(String(req.params.id), 10)
    if (!Number.isSafeInteger(customerId) || customerId <= 0) {
      return this.response.badRequest(res, '客户编号无效')
    }

    try {
      const data = await this.service.getDetail({
        customerId,
        storeId: parseOptionalInt(req.query.store_id)
      })
      return this.response.success(res, data, '获取客户详情成功')
    } catch (error) {
      if (error.statusCode === 500 && error.message === '数据库连接失败') {
        return this.response.serverError(res, '数据库连接失败')
      }
      this.logger.error('获取客户详情失败:', error)
      return this.response.serverError(res, '获取客户详情失败', error)
    }
  }
}

module.exports = AnalyticsCustomerDetailController
