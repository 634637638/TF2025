'use strict'

const ApiResponse = require('../utils/response')
const RentalFinishService = require('../services/rental-finish.service')

class RentalFinishController {
  constructor({ service = new RentalFinishService(), response = ApiResponse } = {}) {
    this.service = service
    this.response = response
  }

  async finish(req, res) {
    try {
      const rentalId = await this.service.finish(Number(req.params.id))
      return this.response.success(res, { id: rentalId }, '租赁已结束，设备已恢复在库')
    } catch (error) {
      const status = /不存在|已经结束|不能执行归还/.test(error.message || '') ? 400 : 500
      return this.response.error(res, error.message || '结束租赁失败', status)
    }
  }
}

module.exports = RentalFinishController
