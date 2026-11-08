'use strict'

const ModelManagementService = require('../services/model-management.service')
const ApiResponse = require('../utils/response')
const { clearCache } = require('../middleware/cache')
const log = require('../utils/log')

class ModelController {
  constructor({ service, repository, databaseConnected, modelsByBrand, invalidateCache = ModelController.clearRouteCache } = {}) {
    this.service = service || new ModelManagementService({ repository, databaseConnected, modelsByBrand })
    this.invalidateCache = invalidateCache
  }

  static clearRouteCache() {
    try {
      clearCache('/api/models')
    } catch (error) {
      log.warn('清理型号缓存失败:', error.message)
    }
  }

  handleError(res, error, message) {
    if (error.code === 'DATABASE_UNAVAILABLE') return ApiResponse.error(res, error.message, 500)
    if (error.statusCode === 400) return ApiResponse.badRequest(res, error.message)
    if (error.statusCode === 404) return ApiResponse.notFound(res, error.message)
    if (error.statusCode === 409) return ApiResponse.error(res, error.message, 409)
    log.error(message, error)
    return ApiResponse.serverError(res, message, error)
  }

  async list(req, res) {
    try {
      const data = await this.service.list(req.query)
      return ApiResponse.success(res, data)
    } catch (error) {
      return this.handleError(res, error, '获取型号列表失败')
    }
  }

  async listByBrand(req, res) {
    try {
      return ApiResponse.success(res, await this.service.listByBrand(req.params.brandId, req.query))
    } catch (error) {
      return this.handleError(res, error, '获取型号列表失败')
    }
  }

  async get(req, res) {
    try {
      const data = await this.service.get(req.params.id)
      return ApiResponse.success(res, data)
    } catch (error) {
      return this.handleError(res, error, '获取型号详情失败')
    }
  }

  async create(req, res) {
    try {
      const data = await this.service.create(req.body)
      this.invalidateCache()
      return ApiResponse.created(res, '型号创建成功', data)
    } catch (error) {
      return this.handleError(res, error, '创建型号失败')
    }
  }

  async update(req, res) {
    try {
      const data = await this.service.update(req.params.id, req.body)
      this.invalidateCache()
      return ApiResponse.success(res, data, '型号更新成功')
    } catch (error) {
      return this.handleError(res, error, '更新型号失败')
    }
  }

  async remove(req, res) {
    try {
      const data = await this.service.remove(req.params.id)
      this.invalidateCache()
      return ApiResponse.success(res, data, '型号删除成功')
    } catch (error) {
      return this.handleError(res, error, '删除型号失败')
    }
  }

  async stats(req, res) {
    try {
      const data = await this.service.stats(req.query)
      return ApiResponse.success(res, data)
    } catch (error) {
      return this.handleError(res, error, '获取型号统计失败')
    }
  }

  async toggle(req, res) {
    try {
      const result = await this.service.toggle(req.params.id)
      this.invalidateCache()
      return ApiResponse.success(res, result.data, `型号${result.status === 1 ? '启用' : '禁用'}成功`)
    } catch (error) {
      return this.handleError(res, error, '切换型号状态失败')
    }
  }

  async reorder(req, res) {
    try {
      await this.service.reorder(req.body.items)
      this.invalidateCache()
      return ApiResponse.success(res, null, '排序更新成功')
    } catch (error) {
      log.error('批量更新排序失败:', error)
      return ApiResponse.error(res, error.message, error.statusCode || 500)
    }
  }
}

module.exports = ModelController
