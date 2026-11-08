'use strict'

const ApiResponse = require('../utils/response')
const log = require('../utils/log')
const AnalyticsCustomerActivityService = require('../services/analytics-customer-activity.service')
const { parseOptionalInt } = require('../utils/analytics-query')

class AnalyticsCustomerActivityController {
  constructor({ service = new AnalyticsCustomerActivityService(), response = ApiResponse, logger = log } = {}) {
    this.service = service
    this.response = response
    this.logger = logger
  }

  async getActivity(req, res) {
    try {
      const data = await this.service.getActivity({ storeId: parseOptionalInt(req.query.store_id) })
      return this.response.success(res, data, '获取客户活跃度成功')
    } catch (error) {
      if (error.statusCode === 500 && error.message === '数据库连接失败') {
        return this.response.serverError(res, '数据库连接失败')
      }
      this.logger.error('获取客户活跃度失败:', error)
      return this.response.serverError(res, '获取客户活跃度失败', error)
    }
  }
}

module.exports = AnalyticsCustomerActivityController
