'use strict'

const ReferenceManagementService = require('../services/reference-management.service')
const ApiResponse = require('../utils/response')
const { clearCache } = require('../middleware/cache')
const log = require('../utils/log')

class MemoryController {
  constructor({ service, repository, databaseConnected, invalidateCache = MemoryController.clearRouteCache } = {}) {
    this.service = service || new ReferenceManagementService({ domain: 'memories', repository, connected: databaseConnected })
    this.invalidateCache = invalidateCache
  }

  static clearRouteCache() {
    try {
      clearCache('/api/memories')
      clearCache('/api/public/memories')
    } catch (error) {
      log.warn('清理内存规格缓存失败:', error.message)
    }
  }

  handleError(res, error, message) {
    if (error.code === 'DATABASE_UNAVAILABLE') return ApiResponse.error(res, error.message, 500)
    if (error.statusCode === 400) return ApiResponse.badRequest(res, error.message)
    if (error.statusCode === 404) return ApiResponse.notFound(res, error.message)
    if (error.statusCode === 409) return ApiResponse.error(res, error.message, 409)
    if (message === '更新内存规格失败' && (error.code === 'ER_DUP_ENTRY' || error.code === 'DUPLICATE_ENTRY' || error.errno === 1062)) return ApiResponse.error(res, '已有存在该内存规格，请勿重复提交', 409)
    log.error(message, error)
    return ApiResponse.serverError(res, message, error)
  }

  async list(req, res) {
    try {
      const data = await this.service.list(req.query)
      return ApiResponse.success(res, data)
    } catch (error) {
      return this.handleError(res, error, '获取内存规格列表失败')
    }
  }

  async getById(req, res) {
    try {
      const data = await this.service.get(req.params.id)
      return ApiResponse.success(res, data)
    } catch (error) {
      return this.handleError(res, error, '获取内存规格详情失败')
    }
  }

  async create(req, res) {
    try {
      const data = await this.service.create(req.body)
      this.invalidateCache()
      return ApiResponse.created(res, '内存规格创建成功', data)
    } catch (error) {
      return this.handleError(res, error, '创建内存规格失败')
    }
  }

  async update(req, res) {
    try {
      const data = await this.service.update(req.params.id, req.body)
      this.invalidateCache()
      return ApiResponse.success(res, data, '内存规格更新成功')
    } catch (error) {
      return this.handleError(res, error, '更新内存规格失败')
    }
  }

  async remove(req, res) {
    try {
      const data = await this.service.remove(req.params.id)
      this.invalidateCache()
      return ApiResponse.success(res, data, '内存规格删除成功')
    } catch (error) {
      return this.handleError(res, error, '删除内存规格失败')
    }
  }

  async getStats(req, res) {
    try {
      const data = await this.service.stats(req.query)
      return ApiResponse.success(res, data)
    } catch (error) {
      return this.handleError(res, error, '获取内存规格统计失败')
    }
  }

  async toggle(req, res) {
    try {
      const result = await this.service.toggle(req.params.id)
      this.invalidateCache()
      return ApiResponse.success(res, result.data, `内存规格${result.status === 1 ? '启用' : '禁用'}成功`)
    } catch (error) {
      return this.handleError(res, error, '切换内存规格状态失败')
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

module.exports = MemoryController
