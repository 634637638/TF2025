'use strict'

const ApiResponse = require('../utils/response')
const log = require('../utils/log')
const AnalyticsProductRankingService = require('../services/analytics-product-ranking.service')
const { parseOptionalInt } = require('../utils/analytics-query')

class AnalyticsProductRankingController {
  constructor({ service = new AnalyticsProductRankingService(), response = ApiResponse, logger = log } = {}) {
    this.service = service
    this.response = response
    this.logger = logger
  }

  async getBrandRanking(req, res) {
    return this.getRanking('brand', req, res)
  }

  async getModelRanking(req, res) {
    return this.getRanking('model', req, res)
  }

  async getRanking(type, req, res) {
    try {
      const data = await this.service.getRanking(type, {
        startDate: req.query.start_date,
        endDate: req.query.end_date,
        storeId: parseOptionalInt(req.query.store_id),
        supplierId: parseOptionalInt(req.query.supplier_id),
        pageSize: req.query.page_size,
        sortBy: req.query.sort_by
      })
      return this.response.success(res, data)
    } catch (error) {
      if (error.message === '数据库连接失败') return this.response.serverError(res, error.message)
      const label = type === 'brand' ? '品牌销量排行' : '型号销量排行'
      this.logger.error(`获取${label}失败:`, error)
      return this.response.serverError(res, `获取${label}失败`, error)
    }
  }
}

module.exports = AnalyticsProductRankingController
