'use strict'

const BrandManagementService = require('../services/brand-management.service')
const ApiResponse = require('../utils/response')
const log = require('../utils/log')

class BrandController {
  constructor({ service = new BrandManagementService(), clearCache = () => {} } = {}) {
    this.service = service
    this.clearCache = clearCache
  }

  clearBrandCache() {
    try {
      this.clearCache()
    } catch (error) {
      log.warn('清理品牌缓存失败:', error.message)
    }
  }

  unavailable(res) {
    return ApiResponse.error(res, '数据库未连接', 500)
  }

  async getStats(req, res) {
    try {
      const result = await this.service.getStats(req.query)
      if (result.type === 'unavailable') return this.unavailable(res)
      return ApiResponse.success(res, result.data)
    } catch (error) {
      log.error('获取品牌统计失败:', error)
      return ApiResponse.serverError(res, '获取品牌统计失败', error)
    }
  }

  async list(req, res) {
    try {
      const result = await this.service.list(req.query)
      if (result.type === 'unavailable') return this.unavailable(res)
      return ApiResponse.success(res, result.data)
    } catch (error) {
      log.error('获取品牌列表失败:', error)
      return ApiResponse.error(res, '获取品牌列表失败', 500)
    }
  }

  async create(req, res) {
    try {
      const result = await this.service.create(req.body)
      if (result.type === 'unavailable') return this.unavailable(res)
      if (result.type === 'duplicate') return ApiResponse.error(res, '品牌名称已存在', 400)
      ApiResponse.success(res, result.data, '品牌创建成功')
      this.clearBrandCache()
    } catch (error) {
      log.error('创建品牌失败:', error)
      ApiResponse.error(res, '创建品牌失败', 500)
    }
  }

  async update(req, res) {
    try {
      const result = await this.service.update(req.params.id, req.body)
      if (result.type === 'unavailable') return this.unavailable(res)
      if (result.type === 'empty-name') return ApiResponse.error(res, '品牌名称不能为空', 400)
      if (result.type === 'duplicate') return ApiResponse.error(res, '品牌名称已存在', 400)
      if (result.type === 'missing') return ApiResponse.error(res, '品牌不存在', 404)
      ApiResponse.success(res, result.data, '品牌更新成功')
      this.clearBrandCache()
    } catch (error) {
      log.error('更新品牌失败:', error)
      ApiResponse.error(res, `更新品牌失败: ${error.message}`, 500)
    }
  }

  async reorder(req, res) {
    try {
      const result = await this.service.reorder(req.body.items)
      if (result.type === 'unavailable') return this.unavailable(res)
      if (result.type === 'invalid-items') return ApiResponse.error(res, '请提供有效的排序数据', 400)
      this.clearBrandCache()
      return ApiResponse.success(res, null, '排序更新成功')
    } catch (error) {
      log.error('批量更新排序失败:', error)
      return ApiResponse.error(res, '批量更新排序失败', 500)
    }
  }

  async remove(req, res) {
    try {
      const result = await this.service.remove(req.params.id)
      if (result.type === 'unavailable') return this.unavailable(res)
      if (result.type === 'has-models') return ApiResponse.error(res, '该品牌下还有关联的型号，无法删除', 400)
      if (result.type === 'missing') return ApiResponse.error(res, '品牌不存在', 404)
      this.clearBrandCache()
      return ApiResponse.success(res, null, '品牌删除成功')
    } catch (error) {
      log.error('删除品牌失败:', error)
      return ApiResponse.error(res, '删除品牌失败', 500)
    }
  }

  async suggest(req, res) {
    try {
      const result = await this.service.suggest(req.query)
      if (result.type === 'unavailable') return this.unavailable(res)
      return ApiResponse.success(res, result.data)
    } catch (error) {
      log.error('获取品牌搜索建议失败:', error)
      return ApiResponse.error(res, '获取品牌搜索建议失败', 500)
    }
  }
}

module.exports = BrandController
