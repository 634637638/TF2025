'use strict'

const ApiResponse = require('../utils/response')
const log = require('../utils/log')
const RentalScheduleService = require('../services/rental-schedule.service')

class RentalScheduleController {
  constructor({ service = new RentalScheduleService(), response = ApiResponse, logger = log } = {}) {
    this.service = service
    this.response = response
    this.logger = logger
  }

  async getPaymentSchedule(req, res) {
    try {
      const schedule = await this.service.getPaymentSchedule(Number(req.params.id), req.user.id)
      if (schedule === null) return this.response.notFound(res, '租赁合同不存在')
      return this.response.success(res, { schedule }, '获取还款明细成功')
    } catch (error) {
      return this.response.serverError(res, '获取还款明细失败', error)
    }
  }

  async recordPayment(req, res) {
    try {
      const result = await this.service.recordPayment(Number(req.params.id), req.body, req.user.id)
      return this.response.created(res, result.message, result.inserted)
    } catch (error) {
      this.logger.error('租金还款登记失败:', error)
      const status = /不存在|请选择|已经还款|正确|已经结束/.test(error.message || '') ? 400 : 500
      return this.response.error(res, error.message || '租金还款登记失败', status)
    }
  }

}

module.exports = RentalScheduleController
