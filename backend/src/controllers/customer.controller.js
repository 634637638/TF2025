'use strict'

const CustomerManagementService = require('../services/customer-management.service')
const ApiResponse = require('../utils/response')
const log = require('../utils/log')
const CustomerExportService = require('../services/customer-export.service')

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
      if (error.code === 'ER_NO_SUCH_TABLE') return this.response.error(res, '账户流水结构尚未迁移，请先完成账户流水迁移', 409)

      this.logger.error('搜索客户失败:', error)
      return this.response.serverError(res, '搜索客户失败', error)
    }
  }

  async list(req, res) {
    try {
      const result = await this.service.list(req.query, req.fieldPermissions)
      return this.response.success(res, result.data, result.message, 200, result.extra)
    } catch (error) {
      if (error.statusCode === 400) return this.response.badRequest(res, error.message)
      if (error.statusCode === 404) return this.response.notFound(res, error.message)

      if (error.statusCode === 403) return this.response.error(res, error.message, 403)
      this.logger.error('获取客户列表失败:', error)
      return this.response.serverError(res, '获取客户列表失败', error)
    }
  }

  async export(req, res) {
    try {
      const result = await new CustomerExportService({ customers: this.service }).export(req.query, req.fieldPermissions)
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', 'attachment; filename="customers.xlsx"')
      res.setHeader('Cache-Control', 'no-store')
      return res.send(result)
    } catch (error) {
      if ([400, 403].includes(error.statusCode)) return this.response.error(res, error.message, error.statusCode)
      this.logger.error('导出客户失败:', error)
      return this.response.serverError(res, '导出客户失败')
    }
  }

  async getPointsConfig(req, res) {
    try {
      const result = await this.service.getPointsConfig(req.query || {})
      return this.response.success(res, result.data, result.message, 200, result.extra)
    } catch (error) {
      if (error.statusCode === 400) return this.response.badRequest(res, error.message)
      if (error.statusCode === 404) return this.response.notFound(res, error.message)

      this.logger.error('获取客户积分设置失败:', error)
      return this.response.serverError(res, '获取客户积分设置失败', error)
    }
  }

  async getPointsProducts(req, res) {
    try {
      const result = await this.service.getPointsProducts(req.query || {})
      return this.response.success(res, result.data, result.message, 200, result.extra)
    } catch (error) {
      if (error.statusCode === 400) return this.response.badRequest(res, error.message)
      this.logger.error('获取积分商品失败:', error)
      return this.response.serverError(res, '获取积分商品失败', error)
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

  async getAddressCapabilities(req, res) {
    try {
      const result = await this.service.getAddressCapabilities()
      return this.response.success(res, result.data)
    } catch (error) {
      this.logger.error('读取客户地址能力失败:', error)
      return this.response.serverError(res, '地区服务暂时不可用')
    }
  }

  async create(req, res) {
    try {
      const result = await this.service.create(req.body)
      return this.response.created(res, result.message, result.data)
    } catch (error) {
      if (error.statusCode === 400) return this.response.badRequest(res, error.message)
      if (error.statusCode === 404) return this.response.notFound(res, error.message)
      if (error.statusCode === 409) return this.response.error(res, error.message, 409)

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
      if (error.statusCode === 409) return this.response.error(res, error.message, 409)

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

  async getAccountLedger(req, res) {
    try {
      const result = await this.service.getAccountLedger(req.params, req.query)
      return this.response.success(res, result.data, result.message)
    } catch (error) {
      if (error.statusCode === 400) return this.response.badRequest(res, error.message)
      if (error.statusCode === 404) return this.response.notFound(res, error.message)
      if (error.statusCode === 409) return this.response.error(res, error.message, 409)
      this.logger.error('获取客户账户明细失败:', error)
      return this.response.serverError(res, '获取客户账户明细失败', error)
    }
  }

  async adjustAccount(req, res) {
    try {
      const result = await this.service.adjustAccount(req.params, req.body, req.user)
      return this.response.success(res, result.data, result.message)
    } catch (error) {
      if (error.statusCode === 400) return this.response.badRequest(res, error.message)
      if (error.statusCode === 404) return this.response.notFound(res, error.message)
      if (error.statusCode === 409) return this.response.error(res, error.message, 409)
      this.logger.error('调整客户账户失败:', error)
      return this.response.serverError(res, '调整客户账户失败', error)
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
