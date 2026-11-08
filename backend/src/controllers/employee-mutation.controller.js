'use strict'

const ApiResponse = require('../utils/response')
const log = require('../utils/log')
const EmployeeMutationService = require('../services/employee-mutation.service')

class EmployeeMutationController {
  constructor({ service = new EmployeeMutationService(), response = ApiResponse, logger = log, blacklistToken } = {}) {
    this.service = service
    this.response = response
    this.logger = logger
    this.blacklistToken = blacklistToken || ((token, reason) => {
      const { addToBlacklist } = require('../middleware/jwt-blacklist')
      return addToBlacklist(token, reason)
    })
  }

  respondWithError(res, error, action) {
    if (error.code === 'VALIDATION') return this.response.badRequest(res, error.message)
    if (error.code === 'NOT_FOUND') return this.response.notFound(res, error.message)
    this.logger.error(`${action}:`, error)
    return this.response.serverError(res, action, error)
  }

  async create(req, res) {
    try {
      const employee = await this.service.createEmployee(req.body)
      return this.response.created(res, '员工创建成功', employee)
    } catch (error) {
      return this.respondWithError(res, error, '创建员工失败')
    }
  }

  async update(req, res) {
    try {
      const { employee, passwordUpdated } = await this.service.updateEmployee(req.params.id, req.body)
      if (passwordUpdated && parseInt(req.params.id) === req.user.id) {
        const authHeader = req.headers['authorization']
        const currentToken = authHeader && authHeader.split(' ')[1]
        if (currentToken) {
          this.blacklistToken(currentToken, 'password_changed')
          this.logger.debug(`用户 ${req.params.id} 修改密码后，当前 token 已加入黑名单`)
        }
        return res.status(200).json({
          success: true,
          message: '员工更新成功，密码已修改，请重新登录',
          data: employee,
          require_relogin: true,
          code: 'PASSWORD_CHANGED'
        })
      }
      return this.response.success(res, employee, '员工更新成功')
    } catch (error) {
      return this.respondWithError(res, error, '更新员工失败')
    }
  }

  async delete(req, res) {
    try {
      const result = await this.service.deleteEmployee(req.params.id, req.user.id)
      return this.response.success(res, result, '员工删除成功')
    } catch (error) {
      return this.respondWithError(res, error, '删除员工失败')
    }
  }

  async updateStatus(req, res) {
    try {
      const result = await this.service.updateEmployeeStatus(req.params.id, req.body.status, req.user.id)
      return this.response.success(res, { id: result.id, status: result.status }, `员工${result.statusText}成功`)
    } catch (error) {
      return this.respondWithError(res, error, '更新员工状态失败')
    }
  }
}

module.exports = EmployeeMutationController
