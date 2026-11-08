'use strict'

const SupplierManagementService = require('../services/supplier-management.service')
const ApiResponse = require('../utils/response')
const log = require('../utils/log')

class SupplierController {
  constructor({ logger = log, service, ...options } = {}) {
    this.service = service || new SupplierManagementService(options)
    this.logger = logger
  }

  async list(req, res) {
    try {
      const result = await this.service.list(req.query)
      return result.all ? ApiResponse.success(res, result.rows) : ApiResponse.success(res, result.rows, '获取供应商列表成功', 200, { pagination: result.pagination })
    } catch (error) {
      if (error.statusCode) return ApiResponse.error(res, error.message, error.statusCode)

      this.logger.error('获取供应商列表失败:', error)
      return ApiResponse.error(res, '获取供应商列表失败', 500)
    }
  }

  async stats(req, res) {
    try {
      const result = await this.service.stats(req.query)
      return ApiResponse.success(res, result, '获取供应商统计成功')
    } catch (error) {
      if (error.statusCode) return ApiResponse.error(res, error.message, error.statusCode)

      this.logger.error('获取供应商统计失败:', error)
      return ApiResponse.error(res, '获取供应商统计失败', 500)
    }
  }

  async export(req, res) {
    try {
      const result = await this.service.export(req.query)
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`)
      return res.status(200).send(result.content)
    } catch (error) {
      if (error.statusCode) return ApiResponse.error(res, error.message, error.statusCode)

      this.logger.error('导出供应商失败:', error)
      return ApiResponse.error(res, '导出供应商失败', 500)
    }
  }

  async reorder(req, res) {
    try {
      const result = await this.service.reorder(req.body)
      return ApiResponse.success(res, result, '排序更新成功')
    } catch (error) {
      if (error.statusCode) return ApiResponse.error(res, error.message, error.statusCode)

      this.logger.error('批量更新排序失败:', error)
      return ApiResponse.error(res, '批量更新排序失败', 500)
    }
  }

  async create(req, res) {
    try {
      const result = await this.service.create(req.body)
      return ApiResponse.created(res, '供应商创建成功', result)
    } catch (error) {
      if (error.statusCode) return ApiResponse.error(res, error.message, error.statusCode)

      this.logger.error('创建供应商失败:', error)
      return ApiResponse.error(res, '创建供应商失败', 500)
    }
  }

  async update(req, res) {
    try {
      const result = await this.service.update(req.params.id, req.body)
      return ApiResponse.success(res, result, '供应商更新成功')
    } catch (error) {
      if (error.statusCode) return ApiResponse.error(res, error.message, error.statusCode)

      this.logger.error('更新供应商失败:', error)
      return ApiResponse.error(res, '更新供应商失败', 500)
    }
  }

  async remove(req, res) {
    try {
      const result = await this.service.remove(req.params.id)
      return ApiResponse.success(res, result, '供应商删除成功')
    } catch (error) {
      if (error.statusCode) return ApiResponse.error(res, error.message, error.statusCode)

      this.logger.error('删除供应商失败:', error)
      return ApiResponse.error(res, '删除供应商失败', 500)
    }
  }

  async detail(req, res) {
    try {
      const result = await this.service.detail(req.params.id)
      return ApiResponse.success(res, result)
    } catch (error) {
      if (error.statusCode) return ApiResponse.error(res, error.message, error.statusCode)

      this.logger.error('获取供应商详情失败:', error)
      return ApiResponse.error(res, '获取供应商详情失败', 500)
    }
  }
}

module.exports = SupplierController
