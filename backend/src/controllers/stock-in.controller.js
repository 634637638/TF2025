'use strict'

const StockInService = require('../services/stock-in.service')
const ApiResponse = require('../utils/response')
const log = require('../utils/log')

class StockInController {
  constructor({ service, ...options } = {}) { this.service = service || new StockInService(options); this.logger = options.logger || log }
  static formatRecord(record) { return StockInService.formatRecord(record) }
  async list(req, res) {
    try {
      const result = await this.service.list(req.user, req.query)
      return ApiResponse.success(res, result)
    } catch (error) {
      if (error.statusCode) return ApiResponse.error(res, error.message, error.statusCode)
      this.logger.error('获取入库记录失败:', error)
      return ApiResponse.serverError(res, '获取入库记录失败', error)
    }
  }
  async detail(req, res) {
    try {
      const result = await this.service.detail(req.user, req.query, req.params.id)
      return ApiResponse.success(res, result)
    } catch (error) {
      if (error.statusCode) return ApiResponse.error(res, error.message, error.statusCode)
      this.logger.error('获取入库详情失败:', error)
      return ApiResponse.serverError(res, '获取入库详情失败', error)
    }
  }
  async create(req, res) {
    try {
      const result = await this.service.create(req.user, req.body)
      return ApiResponse.success(res, result.data, result.message)
    } catch (error) {
      if (error.statusCode) return ApiResponse.error(res, error.message, error.statusCode)
      this.logger.error('创建入库记录失败:', error)
      return ApiResponse.serverError(res, '创建入库记录失败', error)
    }
  }
  async update(req, res) {
    try {
      const result = await this.service.update(req.user, req.params.id, req.body)
      return ApiResponse.success(res, result, '入库记录更新成功')
    } catch (error) {
      if (error.statusCode) return ApiResponse.error(res, error.message, error.statusCode)
      this.logger.error('更新入库记录失败:', error)
      return ApiResponse.serverError(res, '更新入库记录失败', error)
    }
  }
  async remove(req, res) {
    try {
      const result = await this.service.remove(req.user, req.params.id, req.query)
      return ApiResponse.success(res, result, '入库记录删除成功')
    } catch (error) {
      if (error.statusCode) return ApiResponse.error(res, error.message, error.statusCode)
      this.logger.error('删除入库记录失败:', error)
      return ApiResponse.serverError(res, '删除入库记录失败', error)
    }
  }
  async overview(req, res) {
    try {
      const result = await this.service.overview(req.user, req.query)
      return ApiResponse.success(res, result)
    } catch (error) {
      if (error.statusCode) return ApiResponse.error(res, error.message, error.statusCode)
      this.logger.error('获取入库统计失败:', error)
      return ApiResponse.serverError(res, '获取入库统计失败', error)
    }
  }
}
module.exports = StockInController
