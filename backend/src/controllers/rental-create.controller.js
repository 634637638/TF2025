'use strict'

const ApiResponse = require('../utils/response')
const log = require('../utils/log')
const RentalCreateService = require('../services/rental-create.service')

class RentalCreateController {
  constructor({ service = new RentalCreateService(), maskRentalItem, logger = log } = {}) {
    this.service = service
    this.maskRentalItem = maskRentalItem || (async item => item)
    this.logger = logger
  }

  async create(req, res) {
    try {
      const result = await this.service.create({ body: req.body || {}, operatorId: req.user.id })
      return ApiResponse.created(
        res,
        result.billing_mode === 'buyout' ? '买断合同已创建，销售订单已生成' : '按天租赁合同已创建',
        await this.maskRentalItem({ id: result.id, contract_number: result.contract_number }, req)
      )
    } catch (error) {
      this.logger.error('创建租赁合同失败:', error)
      const status = error.statusCode === 400 || /不存在|停用|不在库|请选择|不正确|成本/.test(error.message || '') ? 400 : 500
      return ApiResponse.error(res, error.message || '创建租赁合同失败', status)
    }
  }
}

module.exports = RentalCreateController
