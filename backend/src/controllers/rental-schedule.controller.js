'use strict'

const ApiResponse = require('../utils/response')
const log = require('../utils/log')
const RentalScheduleService = require('../services/rental-schedule.service')
const { parseRentalId } = require('../utils/rental-input')

class RentalScheduleController {
  constructor({ service = new RentalScheduleService(), response = ApiResponse, logger = log } = {}) {
    this.service = service
    this.response = response
    this.logger = logger
  }

  async getPaymentSchedule(req, res) {
    try {
      const schedule = await this.service.getPaymentSchedule(Number(req.params.id), req.user.id, req.user)
      if (schedule === null) return this.response.notFound(res, '租赁合同不存在')
      return this.response.success(res, { schedule }, '获取还款明细成功')
    } catch (error) {
      if ([400, 403].includes(error.statusCode)) return res.status(error.statusCode).json({ success: false, message: error.message })
      return this.response.serverError(res, '获取还款明细失败', error)
    }
  }

  async recordPayment(req, res) {
    try {
      const result = await this.service.recordPayment(parseRentalId(req.params.id), req.body, req.user.id, req.user)
      return this.response.created(res, result.message, result.inserted)
    } catch (error) {
      if ([400, 403].includes(error.statusCode)) return res.status(error.statusCode).json({ success: false, message: error.message })
      this.logger.error('租金还款登记失败:', error)
      const status = error.statusCode === 400 || /不存在|请选择|已经还款|正确|已经结束/.test(error.message || '') ? 400 : 500
      return this.response.error(res, error.message || '租金还款登记失败', status)
    }
  }

}

module.exports = RentalScheduleController
