'use strict'

const StoreManagementService = require('../services/store-management.service')
const ApiResponse = require('../utils/response')
const { clearCache } = require('../middleware/cache')
const log = require('../utils/log')

class StoreController {
  constructor({ service, repository, databaseConnected, superAdminCheck, invalidateCache = () => clearCache('/stores') } = {}) {
    this.service = service || new StoreManagementService({ repository, databaseConnected, superAdminCheck })
    this.invalidateCache = invalidateCache
  }

  handleError(res, error, message) {
    if (error.code === 'DATABASE_UNAVAILABLE') return ApiResponse.error(res, error.message, 500)
    if (error.statusCode === 400) return ApiResponse.error(res, error.message, 400)
    if (error.statusCode === 404) return ApiResponse.notFound(res, error.message)
    if (error.statusCode === 409) return ApiResponse.error(res, error.message, 409)
    log.error(message, error)
    return ApiResponse.error(res, message, 500)
  }

  async list(req, res) {
    try {
      const data = await this.service.list(req.query, req.user)
      return ApiResponse.success(res, data)
    } catch (error) {
      return this.handleError(res, error, '获取店铺列表失败')
    }
  }

  async get(req, res) {
    try {
      const data = await this.service.get(req.params.id)
      return ApiResponse.success(res, data)
    } catch (error) {
      return this.handleError(res, error, '获取店铺详情失败')
    }
  }

  async create(req, res) {
    try {
      const data = await this.service.create(req.body)
      this.invalidateCache()
      return ApiResponse.created(res, '店铺创建成功', data)
    } catch (error) {
      return this.handleError(res, error, '创建店铺失败')
    }
  }

  async update(req, res) {
    try {
      const data = await this.service.update(req.params.id, req.body)
      this.invalidateCache()
      return ApiResponse.success(res, data, '店铺修改成功')
    } catch (error) {
      return this.handleError(res, error, '更新店铺失败')
    }
  }

  async remove(req, res) {
    try {
      await this.service.remove(req.params.id)
      this.invalidateCache()
      return ApiResponse.success(res, '店铺删除成功')
    } catch (error) {
      return this.handleError(res, error, '删除店铺失败')
    }
  }

  async stats(req, res) {
    try {
      const data = await this.service.stats(req.query)
      return ApiResponse.success(res, data)
    } catch (error) {
      return this.handleError(res, error, '获取店铺统计失败')
    }
  }

  async managers(_req, res) {
    try {
      return ApiResponse.success(res, await this.service.managers())
    } catch (error) {
      return this.handleError(res, error, '获取管理员列表失败')
    }
  }

  async export(req, res) {
    try {
      const file = await this.service.export(req.query)
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`)
      return res.send(file.buffer)
    } catch (error) {
      return this.handleError(res, error, '导出门店数据失败')
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

module.exports = StoreController
