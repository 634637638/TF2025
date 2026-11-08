'use strict'

const ApiResponse = require('../utils/response')
const EmployeeSalaryService = require('../services/employee-salary.service')
const log = require('../utils/log')

class EmployeeSalaryController {
  constructor({ service = new EmployeeSalaryService(), logger = log } = {}) {
    this.service = service
    this.logger = logger
  }

  getUserId(req) {
    return req.user.id || req.user.userId
  }

  async list(req, res) {
    try {
      const result = await this.service.getSalaryList(this.getUserId(req))
      return ApiResponse.success(res, result)
    } catch (error) {
      this.logger.error('获取员工列表失败:', error)
      return ApiResponse.serverError(res, '获取员工列表失败', error)
    }
  }

  async current(req, res) {
    try {
      const employees = await this.service.getCurrentSalaries(this.getUserId(req), req.query.date)
      return ApiResponse.success(res, { employees })
    } catch (error) {
      this.logger.error('获取员工当前底薪失败:', error)
      return ApiResponse.serverError(res, '获取员工当前底薪失败', error)
    }
  }
}

module.exports = EmployeeSalaryController
