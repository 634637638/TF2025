'use strict'

const ApiResponse = require('../utils/response')
const PhoneStockWarningService = require('../services/phone-stock-warning.service')
const log = require('../utils/log')

class PhoneStockWarningController {
  constructor({ service = new PhoneStockWarningService(), logger = log } = {}) {
    this.service = service
    this.logger = logger
  }

  async getAllConfigs(req, res) {
    return this.sendResult(res, await this.service.getAllConfigs())
  }

  async getThreshold(req, res) {
    try {
      const { brand_id: brandId, model_id: modelId } = req.query
      if (!brandId) return ApiResponse.error(res, '品牌ID不能为空', 400)
      const result = await this.service.getWarningThreshold(
        parseInt(brandId, 10) || null,
        modelId ? parseInt(modelId, 10) : null
      )
      return this.sendResult(res, result)
    } catch (error) {
      this.logger.error('获取预警阈值失败:', error)
      return ApiResponse.error(res, '获取预警阈值失败', 500)
    }
  }

  async createConfig(req, res) {
    return this.sendResult(res, await this.service.createConfig(req.user.id, req.body))
  }

  async updateConfig(req, res) {
    const configId = parseInt(req.params.id, 10)
    if (Number.isNaN(configId)) return ApiResponse.error(res, '配置ID无效', 400)
    return this.sendResult(res, await this.service.updateConfig(req.user.id, configId, req.body))
  }

  async removeConfig(req, res) {
    const configId = parseInt(req.params.id, 10)
    if (Number.isNaN(configId)) return ApiResponse.error(res, '配置ID无效', 400)
    return this.sendResult(res, await this.service.deleteConfig(req.user.id, configId))
  }

  async toggle(req, res) {
    const configId = parseInt(req.params.id, 10)
    const { enabled } = req.body
    if (Number.isNaN(configId)) return ApiResponse.error(res, '配置ID无效', 400)
    if (typeof enabled !== 'boolean') return ApiResponse.error(res, 'enabled 必须是布尔值', 400)
    return this.sendResult(res, await this.service.toggleWarning(req.user.id, configId, enabled))
  }

  async getBrands(req, res) {
    return this.sendResult(res, await this.service.getBrands())
  }

  async getModels(req, res) {
    const { brand_id: brandId } = req.query
    if (!brandId) return ApiResponse.error(res, '品牌ID不能为空', 400)
    return this.sendResult(res, await this.service.getModelsByBrand(parseInt(brandId, 10)))
  }

  async getColors(req, res) {
    return this.sendResult(res, await this.service.getColors())
  }

  async getMemories(req, res) {
    return this.sendResult(res, await this.service.getMemories())
  }

  sendResult(res, result) {
    if (result.success) return ApiResponse.success(res, result.data, result.message)
    return ApiResponse.error(res, result.message, result.statusCode || 500)
  }
}

module.exports = PhoneStockWarningController
