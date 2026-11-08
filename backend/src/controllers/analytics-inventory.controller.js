'use strict'

const ApiResponse = require('../utils/response')
const log = require('../utils/log')
const AnalyticsInventoryService = require('../services/analytics-inventory.service')
const { parseOptionalInt } = require('../utils/analytics-query')

class AnalyticsInventoryController {
  constructor({ service = new AnalyticsInventoryService(), response = ApiResponse, logger = log } = {}) {
    this.service = service
    this.response = response
    this.logger = logger
  }

  async getOverview(req, res) {
    try {
      const result = await this.service.getOverview({
        storeId: parseOptionalInt(req.query.store_id),
        supplierId: parseOptionalInt(req.query.supplier_id)
      })
      return this.response.success(res, result)
    } catch (error) {
      if (error.statusCode === 500 && error.message === '数据库连接失败') {
        return this.response.serverError(res, '数据库连接失败')
      }
      this.logger.error('获取库存分析失败:', error)
      return this.response.serverError(res, '获取库存分析失败', error)
    }
  }

  async getLowStock(req, res) {
    const requestedLimit = Number.parseInt(String(req.query.page_size ?? 100), 10)
    const limit = Math.min(500, Math.max(1, Number.isFinite(requestedLimit) ? requestedLimit : 100))
    try {
      const result = await this.service.getLowStock({
        limit,
        storeId: parseOptionalInt(req.query.store_id),
        supplierId: parseOptionalInt(req.query.supplier_id)
      })
      return this.response.success(res, result, '获取低库存预警成功')
    } catch (error) {
      if (error.statusCode === 500 && error.message === '数据库连接失败') {
        return this.response.serverError(res, '数据库连接失败')
      }
      this.logger.error('获取低库存预警失败:', error)
      return this.response.serverError(res, '获取低库存预警失败', error)
    }
  }

  async getTurnover(req, res) {
    try {
      const result = await this.service.getTurnover({
        period: String(req.query.period || '30d'),
        storeId: parseOptionalInt(req.query.store_id),
        supplierId: parseOptionalInt(req.query.supplier_id)
      })
      return this.response.success(res, result)
    } catch (error) {
      if (error.statusCode === 500 && error.message === '数据库连接失败') {
        return this.response.serverError(res, '数据库连接失败')
      }
      this.logger.error('获取库存周转趋势失败:', error)
      return this.response.serverError(res, '获取库存周转趋势失败', error)
    }
  }

  async getSupplierStats(req, res) {
    try {
      const result = await this.service.getSupplierStats({
        storeId: parseOptionalInt(req.query.store_id),
        supplierId: parseOptionalInt(req.query.supplier_id)
      })
      return this.response.success(res, result)
    } catch (error) {
      if (error.statusCode === 500 && error.message === '数据库连接失败') {
        return this.response.serverError(res, '数据库连接失败')
      }
      this.logger.error('获取供应商统计失败:', error)
      return this.response.serverError(res, '获取供应商统计失败', error)
    }
  }

  async getValue(req, res) {
    try {
      const result = await this.service.getValue({ storeId: parseOptionalInt(req.query.store_id) })
      return this.response.success(res, result)
    } catch (error) {
      if (error.statusCode === 500 && error.message === '数据库连接失败') {
        return this.response.serverError(res, '数据库连接失败')
      }
      this.logger.error('获取库存价值失败:', error)
      return this.response.serverError(res, '获取库存价值失败', error)
    }
  }

  async getRecentSold(req, res) {
    const requestedLimit = Number.parseInt(String(req.query.page_size || 10), 10)
    const limit = Math.min(100, Math.max(1, Number.isFinite(requestedLimit) ? requestedLimit : 10))
    try {
      const result = await this.service.getRecentSold({
        limit,
        storeId: parseOptionalInt(req.query.store_id),
        supplierId: parseOptionalInt(req.query.supplier_id)
      })
      return this.response.success(res, result)
    } catch (error) {
      if (error.statusCode === 500 && error.message === '数据库连接失败') {
        return this.response.serverError(res, '数据库连接失败')
      }
      this.logger.error('获取最近销售型号失败:', error)
      return this.response.serverError(res, '获取最近销售型号失败', error)
    }
  }
}

module.exports = AnalyticsInventoryController
