'use strict'

const ApiResponse = require('../utils/response')
const EmployeeDirectoryService = require('../services/employee-directory.service')
const log = require('../utils/log')

class EmployeeDirectoryController {
  constructor({ service = new EmployeeDirectoryService(), logger = log } = {}) {
    this.service = service
    this.logger = logger
  }

  async list(req, res) {
    try {
      return ApiResponse.success(res, await this.service.listEmployees(req.query))
    } catch (error) {
      this.logger.error('获取员工列表失败:', error)
      return ApiResponse.serverError(res, '获取员工列表失败', error)
    }
  }

  async detail(req, res) {
    try {
      const employee = await this.service.getEmployeeById(req.params.id)
      if (!employee) return ApiResponse.notFound(res, '员工不存在')
      return ApiResponse.success(res, employee)
    } catch (error) {
      this.logger.error('获取员工详情失败:', error)
      return ApiResponse.serverError(res, '获取员工详情失败', error)
    }
  }
}

module.exports = EmployeeDirectoryController
