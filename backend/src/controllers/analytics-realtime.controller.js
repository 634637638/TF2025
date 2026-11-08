'use strict'

const ApiResponse = require('../utils/response')
const log = require('../utils/log')
const AnalyticsRealtimeService = require('../services/analytics-realtime.service')
const { parseOptionalInt } = require('../utils/analytics-query')

class AnalyticsRealtimeController {
  constructor({ service = new AnalyticsRealtimeService(), response = ApiResponse, logger = log } = {}) {
    this.service = service
    this.response = response
    this.logger = logger
  }

  async getRealtime(req, res) {
    try {
      const data = await this.service.getRealtime(parseOptionalInt(req.query.store_id))
      return this.response.success(res, data)
    } catch (error) {
      if (error.statusCode === 500 && error.message === '数据库连接失败') {
        return this.response.serverError(res, '数据库连接失败')
      }
      this.logger.error('获取实时数据失败:', error)
      return this.response.serverError(res, '获取实时数据失败', error)
    }
  }
}

module.exports = AnalyticsRealtimeController
