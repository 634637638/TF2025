'use strict'

const { getDatabase, isConnected } = require('../config/database')
const ApiResponse = require('../utils/response')
const log = require('../utils/log')
const InventoryService = require('../services/inventory.service')
const { validateImei: defaultValidateImei } = require('../utils/imei')
const { normalizeDateTime: defaultNormalizeDateTime } = require('../utils/time')
const { generateMemberNumber: defaultGenerateMemberNumber } = require('../utils/member-number')
const {
  prepareInvoiceNumberTransaction: defaultPrepareInvoiceNumberTransaction,
  generateInvoiceNumber: defaultGenerateInvoiceNumber
} = require('../utils/invoice-number')
const { reconcileCustomerPointsForSale: defaultReconcileCustomerPointsForSale } = require('../services/customer-points.service')

class InventoryController {
  constructor({
    service,
    database = getDatabase,
    connected = isConnected,
    logger = log,
    validateImei = defaultValidateImei,
    normalizeDateTime = defaultNormalizeDateTime,
    generateMemberNumber = defaultGenerateMemberNumber,
    prepareInvoiceNumberTransaction = defaultPrepareInvoiceNumberTransaction,
    generateInvoiceNumber = defaultGenerateInvoiceNumber,
    reconcileCustomerPointsForSale = defaultReconcileCustomerPointsForSale
  } = {}) {
    this.logger = logger
    this.service = service || new InventoryService({
      database,
      connected,
      logger,
      validateImei,
      normalizeDateTime,
      generateMemberNumber,
      prepareInvoiceNumberTransaction,
      generateInvoiceNumber,
      reconcileCustomerPointsForSale
    })
  }

  index(_req, res) {
    return res.redirect(301, '/list')
  }

  async list(req, res) {
    try {
      return ApiResponse.success(res, await this.service.list(req.query))
    } catch (error) {
      this.logger.error('获取库存列表失败:', error)
      return ApiResponse.serverError(res, '获取库存列表失败', error)
    }
  }

  async detail(req, res) {
    try {
      return ApiResponse.success(res, await this.service.detail(req.params.id))
    } catch (error) {
      if (error.statusCode === 400) return ApiResponse.badRequest(res, error.message)
      if (error.statusCode === 404) return ApiResponse.notFound(res, error.message)
      this.logger.error('获取商品详情失败:', error)
      return ApiResponse.serverError(res, '获取商品详情失败', error)
    }
  }

  async remove(req, res) {
    try {
      const result = await this.service.remove(req.params.id)
      return ApiResponse.success(res, result, '商品删除成功')
    } catch (error) {
      if (error.statusCode === 400) return ApiResponse.badRequest(res, error.message)
      if (error.statusCode === 404) return ApiResponse.notFound(res, error.message)
      this.logger.error('删除库存商品失败:', error)
      return ApiResponse.serverError(res, error.statusCode === 500 ? error.message : '删除商品失败', error)
    }
  }

  async update(req, res) {
    try {
      const result = await this.service.update(req.params.id, req.body)
      return ApiResponse.success(res, result, '商品信息更新成功')
    } catch (error) {
      if (error.statusCode === 400) return ApiResponse.badRequest(res, error.message)
      if (error.statusCode === 404) return ApiResponse.notFound(res, error.message)
      this.logger.error('更新库存商品失败:', error)
      return ApiResponse.serverError(res, error.statusCode === 500 ? error.message : '更新商品失败', error)
    }
  }

  async quickSale(req, res) {
    try {
      const result = await this.service.quickSale(req.body, req.user)
      return ApiResponse.success(res, '快速出库成功', result)
    } catch (error) {
      this.logger.error('快速出库失败:', { message: error?.message || '未知错误', stack: error?.stack })
      if (error.statusCode) return ApiResponse.error(res, error.message, error.statusCode)
      if (error instanceof Error && !error.code) return ApiResponse.badRequest(res, error.message || '快速出库失败')
      return ApiResponse.serverError(res, '快速出库失败', error)
    }
  }

  async overview(req, res) {
    try {
      return ApiResponse.success(res, await this.service.overview(req.query))
    } catch (error) {
      this.logger.error('获取库存统计失败:', error)
      return ApiResponse.serverError(res, '获取库存统计失败', error)
    }
  }

  async stats(_req, res) {
    try {
      return ApiResponse.success(res, await this.service.stats(), '获取统计数据成功')
    } catch (error) {
      this.logger.error('获取库存统计数据失败:', error)
      return ApiResponse.serverError(res, '获取统计数据失败', error)
    }
  }
}

module.exports = InventoryController
