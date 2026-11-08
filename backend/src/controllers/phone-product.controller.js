'use strict'

const ShopService = require('../services/shop.service')
const ApiResponse = require('../utils/response')
const log = require('../utils/log')

class PhoneProductController {
  constructor({ service = new ShopService(), response = ApiResponse, logger = log } = {}) {
    this.service = service
    this.response = response
    this.logger = logger
  }

  async getH5Product(req, res) {
    try {
      const product = await this.service.getPhoneH5Product(req.params.id)
      if (!product) {
        return this.response.success(res, { is_published: 1 }, '未找到上架信息，默认上架')
      }

      return this.response.success(res, product, '获取成功')
    } catch (error) {
      this.logger.error('获取H5商品信息失败:', error)
      return this.response.error(res, error.message || '获取失败', 500)
    }
  }

  async updateH5Product(req, res) {
    try {
      const { is_published } = req.body
      if (is_published !== 0 && is_published !== 1) {
        return this.response.badRequest(res, 'is_published 必须是 0 或 1')
      }

      await this.service.updatePhoneH5Product(req.params.id, { is_published })
      return this.response.success(res, null, is_published === 1 ? '已上架' : '已下架')
    } catch (error) {
      this.logger.error('更新H5上架状态失败:', error)
      return this.response.error(res, error.message || '更新失败', 500)
    }
  }

  async saveInspection(req, res) {
    try {
      const inspectionData = {
        condition_grade: req.body.condition_grade || null,
        battery_status: req.body.battery_status || '',
        screen_condition: req.body.screen_condition || 'original',
        system_version: req.body.system_version || '',
        model_version: req.body.model_version || '',
        warranty_date: req.body.warranty_date || null,
        is_warranty_expired: req.body.is_warranty_expired || false,
        sale_price: req.body.sale_price || null
      }

      await this.service.saveProductInspection(req.params.id, inspectionData)
      return this.response.success(res, null, '验机信息保存成功')
    } catch (error) {
      this.logger.error('保存验机信息失败:', error)
      return this.response.error(res, error.message || '保存失败', 500)
    }
  }

  async getInspection(req, res) {
    try {
      const inspection = await this.service.getProductInspection(req.params.id)
      if (!inspection) return this.response.success(res, null, '暂无验机信息')

      return this.response.success(res, inspection, '获取验机信息成功')
    } catch (error) {
      this.logger.error('获取验机信息失败:', error)
      return this.response.error(res, error.message || '获取失败', 500)
    }
  }
}

module.exports = PhoneProductController
