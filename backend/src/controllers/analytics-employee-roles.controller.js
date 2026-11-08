'use strict'

const ApiResponse = require('../utils/response')
const log = require('../utils/log')
const AnalyticsEmployeeRolesService = require('../services/analytics-employee-roles.service')
const { parseOptionalInt } = require('../utils/analytics-query')

class AnalyticsEmployeeRolesController {
  constructor({ service = new AnalyticsEmployeeRolesService(), response = ApiResponse, logger = log } = {}) {
    this.service = service
    this.response = response
    this.logger = logger
  }

  async getEmployeeRoles(req, res) {
    try {
      const data = await this.service.getEmployeeRoles(parseOptionalInt(req.query.store_id))
      return this.response.success(res, data, '获取员工角色分布成功')
    } catch (error) {
      if (error.statusCode === 500 && error.message === '数据库连接失败') {
        return this.response.serverError(res, '数据库连接失败')
      }
      this.logger.error('获取员工角色分布失败:', error)
      return this.response.serverError(res, '获取员工角色分布失败', error)
    }
  }
}

module.exports = AnalyticsEmployeeRolesController
