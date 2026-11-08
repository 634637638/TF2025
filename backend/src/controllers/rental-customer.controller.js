'use strict'

const RentalCustomerService = require('../services/rental-customer.service')
const ApiResponse = require('../utils/response')
const log = require('../utils/log')

class RentalCustomerController {
  constructor({ service = new RentalCustomerService(), logger = log } = {}) {
    if (!service || typeof service.search !== 'function'
      || typeof service.getSalesOptions !== 'function'
      || typeof service.create !== 'function'
      || typeof service.update !== 'function') {
      throw new TypeError('RentalCustomerController requires a rental customer service')
    }
    this.service = service
    this.logger = logger
  }

  async search(req, res) {
    try {
      const result = await this.service.search(req.query, req.user.id)
      if (result.forbidden) {
        return res.status(403).json({ success: false, message: '没有可用的客户搜索字段', code: 'FIELD_PERMISSION_DENIED' })
      }
      return ApiResponse.success(res, result.rows, '获取客户成功')
    } catch (error) {
      this.logger.error('租赁客户检索失败:', error)
      return ApiResponse.serverError(res, '客户检索失败', error)
    }
  }

  async getSalesOptions(req, res) {
    try {
      const result = await this.service.getSalesOptions({ user: req.user, query: req.query })
      return ApiResponse.success(res, { operators: result.operators, stores: result.stores }, '获取销售选项成功', 200,
        result.pagination ? { pagination: result.pagination } : {})
    } catch (error) {
      this.logger.error('获取租赁销售选项失败:', error)
      return ApiResponse.serverError(res, '获取销售选项失败', error)
    }
  }

  async create(req, res) {
    try {
      const result = await this.service.create(req.body)
      if (result.existing) {
        return ApiResponse.success(res, result.customer, '客户已存在，实名信息已更新')
      }
      return ApiResponse.created(res, '客户创建成功', result.customer)
    } catch (error) {
      if (error?.statusCode === 400) return ApiResponse.badRequest(res, error.message)
      if (error?.code === 'ER_DUP_ENTRY') return ApiResponse.badRequest(res, '手机号已存在')
      this.logger.error('租赁客户创建失败:', error)
      return ApiResponse.serverError(res, '客户创建失败', error)
    }
  }

  async update(req, res) {
    try {
      const customer = await this.service.update(req.params.id, req.body)
      if (!customer) return ApiResponse.notFound(res, '客户不存在或已停用')
      return ApiResponse.success(res, customer, '客户资料已更新')
    } catch (error) {
      if (error?.statusCode === 400) return ApiResponse.badRequest(res, error.message)
      if (error?.code === 'ER_DUP_ENTRY') return ApiResponse.badRequest(res, '手机号已存在')
      this.logger.error('租赁客户资料更新失败:', error)
      return ApiResponse.serverError(res, '客户资料更新失败', error)
    }
  }
}

module.exports = RentalCustomerController
