'use strict'

const ApiResponse = require('../utils/response')
const log = require('../utils/log')

class RepairCustomerController {
  constructor({ service, response = ApiResponse, logger = log } = {}) {
    if (!service) throw new TypeError('RepairCustomerController requires service')
    this.service = service
    this.response = response
    this.logger = logger
  }

  async create(req, res) {
    try {
      const customer = await this.service.createCustomer(req)
      return this.response.created(res, customer, '客户创建成功')
    } catch (error) {
      if (error.statusCode === 403) {
        return res.status(403).json({ success: false, message: error.message, code: error.code })
      }
      if (error.code === 'BAD_REQUEST') return this.response.badRequest(res, error.message)
      this.logger.error('维修新建客户失败:', error)
      return this.response.serverError(res, '客户创建失败', error)
    }
  }
}

module.exports = RepairCustomerController
