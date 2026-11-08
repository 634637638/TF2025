'use strict'

const CustomerManagementService = require('../services/customer-management.service')
const ApiResponse = require('../utils/response')
const log = require('../utils/log')

class CustomerController {
  constructor({ service, response = ApiResponse, logger = log, ...options } = {}) {
    this.service = service || new CustomerManagementService(options)
    this.response = response
    this.logger = logger
  }

  async search(req, res) {
    try {
      const result = await this.service.search(req.query)
      return this.response.success(res, result.data, result.message, 200, result.extra)
    } catch (error) {
      if (error.statusCode === 400) return this.response.badRequest(res, error.message)
      if (error.statusCode === 404) return this.response.notFound(res, error.message)

      this.logger.error('搜索客户失败:', error)
      return this.response.serverError(res, '搜索客户失败', error)
    }
  }

  async list(req, res) {
    try {
      const result = await this.service.list(req.query)
      return this.response.success(res, result.data, result.message, 200, result.extra)
    } catch (error) {
      if (error.statusCode === 400) return this.response.badRequest(res, error.message)
      if (error.statusCode === 404) return this.response.notFound(res, error.message)

      this.logger.error('获取客户列表失败:', error)
      return this.response.serverError(res, '获取客户列表失败', error)
    }
  }

  async getPointsConfig(req, res) {
    try {
      const result = await this.service.getPointsConfig()
      return this.response.success(res, result.data, result.message, 200, result.extra)
    } catch (error) {
      if (error.statusCode === 400) return this.response.badRequest(res, error.message)
      if (error.statusCode === 404) return this.response.notFound(res, error.message)

      this.logger.error('获取客户积分设置失败:', error)
      return this.response.serverError(res, '获取客户积分设置失败', error)
    }
  }

  async savePointsConfig(req, res) {
    try {
      const result = await this.service.savePointsConfig(req.body)
      return this.response.success(res, result.data, result.message, 200, result.extra)
    } catch (error) {
      if (error.statusCode === 400) return this.response.badRequest(res, error.message)
      if (error.statusCode === 404) return this.response.notFound(res, error.message)

      this.logger.error('保存客户积分设置失败:', error)
      return this.response.serverError(res, '保存客户积分设置失败', error)
    }
  }

  async getById(req, res) {
    try {
      const result = await this.service.getById(req.params)
      return this.response.success(res, result.data, result.message, 200, result.extra)
    } catch (error) {
      if (error.statusCode === 400) return this.response.badRequest(res, error.message)
      if (error.statusCode === 404) return this.response.notFound(res, error.message)

      this.logger.error('获取客户详情失败:', error)
      return this.response.serverError(res, '获取客户详情失败', error)
    }
  }

  async create(req, res) {
    try {
      const result = await this.service.create(req.body)
      return this.response.created(res, result.message, result.data)
    } catch (error) {
      if (error.statusCode === 400) return this.response.badRequest(res, error.message)
      if (error.statusCode === 404) return this.response.notFound(res, error.message)

      this.logger.error('创建客户失败:', error)
      return this.response.serverError(res, '创建客户失败', error)
    }
  }

  async update(req, res) {
    try {
      const result = await this.service.update(req.params, req.body)
      return this.response.success(res, result.data, result.message, 200, result.extra)
    } catch (error) {
      if (error.statusCode === 400) return this.response.badRequest(res, error.message)
      if (error.statusCode === 404) return this.response.notFound(res, error.message)

      if (error && (error.code === 'ER_DUP_ENTRY' || error.errno === 1062)) {
        return this.response.badRequest(res, '手机号已存在')
      }
      this.logger.error('更新客户信息失败:', error)
      return this.response.serverError(res, '更新客户信息失败', error)
    }
  }

  async getPurchases(req, res) {
    try {
      const result = await this.service.getPurchases(req.params, req.query)
      return this.response.success(res, result.data, result.message, 200, result.extra)
    } catch (error) {
      if (error.statusCode === 400) return this.response.badRequest(res, error.message)
      if (error.statusCode === 404) return this.response.notFound(res, error.message)

      this.logger.error('获取客户消费记录失败:', error)
      return this.response.serverError(res, '获取客户消费记录失败', error)
    }
  }

  async remove(req, res) {
    try {
      const result = await this.service.remove(req.params)
      return this.response.success(res, result.data, result.message, 200, result.extra)
    } catch (error) {
      if (error.statusCode === 400) return this.response.badRequest(res, error.message)
      if (error.statusCode === 404) return this.response.notFound(res, error.message)

      this.logger.error('删除客户失败:', error)
      return this.response.serverError(res, '删除客户失败', error)
    }
  }

  rejectPurchaseCreation(_req, res) {
    return this.response.error(res, '消费记录请通过销售交易接口创建', 501)
  }

  async updateVipLevel(req, res) {
    try {
      const result = await this.service.updateVipLevel(req.params, req.body)
      return this.response.success(res, result.data, result.message, 200, result.extra)
    } catch (error) {
      if (error.statusCode === 400) return this.response.badRequest(res, error.message)
      if (error.statusCode === 404) return this.response.notFound(res, error.message)

      this.logger.error('更新VIP等级失败:', error)
      return this.response.serverError(res, '更新VIP等级失败', error)
    }
  }

  async getStatistics(req, res) {
    try {
      const result = await this.service.getStatistics(req.query)
      return this.response.success(res, result.data, result.message, 200, result.extra)
    } catch (error) {
      if (error.statusCode === 400) return this.response.badRequest(res, error.message)
      if (error.statusCode === 404) return this.response.notFound(res, error.message)

      this.logger.error('获取客户统计失败:', error)
      return this.response.serverError(res, '获取客户统计失败', error)
    }
  }

  async getStatisticsOverview(req, res) {
    try {
      const result = await this.service.getStatisticsOverview(req.query)
      return this.response.success(res, result.data, result.message, 200, result.extra)
    } catch (error) {
      if (error.statusCode === 400) return this.response.badRequest(res, error.message)
      if (error.statusCode === 404) return this.response.notFound(res, error.message)

      this.logger.error('获取客户统计失败:', error)
      return this.response.serverError(res, '获取客户统计失败', error)
    }
  }
}

module.exports = CustomerController
