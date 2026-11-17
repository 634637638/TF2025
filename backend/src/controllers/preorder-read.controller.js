'use strict'

const ApiResponse = require('../utils/response')
const log = require('../utils/log')
const PreorderReadService = require('../services/preorder-read.service')

class PreorderReadController {
  constructor({ service = new PreorderReadService(), maskStats = async stats => stats, maskList = async rows => rows } = {}) {
    this.service = service
    this.maskStats = maskStats
    this.maskList = maskList
  }

  async getById(req, res) {
    try {
      const preorder = await this.service.getById(req.params.id, req.user)
      if (!preorder) return ApiResponse.notFound(res, '预定单不存在')
      const [visiblePreorder] = await this.maskList([preorder], req)
      return ApiResponse.success(res, visiblePreorder)
    } catch (error) {
      if ([400, 403].includes(error.statusCode)) return ApiResponse.error(res, error.message, error.statusCode)
      log.error('获取预定单详情失败:', error)
      return ApiResponse.serverError(res, '获取预定单详情失败', error)
    }
  }

  async list(req, res) {
    try {
      const result = await this.service.list(req.query, req.user)
      if (result.error) return ApiResponse.badRequest(res, result.error)
      const records = await this.maskList(result.records, req)
      return ApiResponse.success(res, { ...result, records })
    } catch (error) {
      if ([400, 403].includes(error.statusCode)) return ApiResponse.error(res, error.message, error.statusCode)
      log.error('获取预定单列表失败:', error)
      return ApiResponse.serverError(res, '获取预定单列表失败', error)
    }
  }

  async stats(req, res) {
    try {
      const stats = await this.service.getStats(req.user)
      const visibleStats = await this.maskStats(stats, req)
      return ApiResponse.success(res, visibleStats)
    } catch (error) {
      if ([400, 403].includes(error.statusCode)) return ApiResponse.error(res, error.message, error.statusCode)
      log.error('获取预定统计失败:', error)
      return ApiResponse.serverError(res, '获取预定统计失败', error)
    }
  }

  async options(req, res) {
    try {
      const options = await this.service.getOptions(req.user)
      return ApiResponse.success(res, options)
    } catch (error) {
      if ([400, 403].includes(error.statusCode)) return ApiResponse.error(res, error.message, error.statusCode)
      log.error('获取预订单基础选项失败:', error)
      return ApiResponse.serverError(res, '获取预订单基础选项失败', error)
    }
  }

  async matchable(req, res) {
    try {
      const { brand_id, model_id, color_id, memory_id, store_id } = req.query
      if (!(brand_id && model_id && color_id && memory_id)) {
        return ApiResponse.badRequest(res, '请提供完整商品ID')
      }

      const preorders = await this.service.getMatchablePreorders({ brand_id, model_id, color_id, memory_id, store_id }, req.user)
      return ApiResponse.success(res, await this.maskList(preorders, req))
    } catch (error) {
      if ([400, 403].includes(error.statusCode)) return ApiResponse.error(res, error.message, error.statusCode)
      log.error('查找可匹配预定单失败:', error)
      return ApiResponse.serverError(res, '查找可匹配预定单失败', error)
    }
  }

  async matchablePhones(req, res) {
    try {
      const result = await this.service.getMatchablePhones(req.params.id, req.user)
      if (result.error === 'not_found') return ApiResponse.notFound(res, '预定单不存在')
      if (result.error === 'invalid_status') {
        return ApiResponse.badRequest(res, '只有待匹配或已匹配且未交付的预定单可以选择设备')
      }

      return ApiResponse.success(res, await this.maskList(result.phones, req))
    } catch (error) {
      if ([400, 403].includes(error.statusCode)) return ApiResponse.error(res, error.message, error.statusCode)
      log.error('获取可匹配库存失败:', error)
      return ApiResponse.serverError(res, '获取可匹配库存失败', error)
    }
  }
}

module.exports = PreorderReadController
