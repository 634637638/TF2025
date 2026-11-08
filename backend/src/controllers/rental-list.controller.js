'use strict'

const ApiResponse = require('../utils/response')
const log = require('../utils/log')
const RentalListService = require('../services/rental-list.service')

class RentalListController {
  constructor({ service = new RentalListService(), response = ApiResponse, logger = log } = {}) {
    this.service = service
    this.response = response
    this.logger = logger
  }

  async list(req, res) {
    try {
      const result = await this.service.list(req.query, req.user.id)
      if (result.forbidden) {
        return res.status(403).json({
          success: false,
          message: result.forbidden,
          code: 'FIELD_PERMISSION_DENIED'
        })
      }
      return this.response.success(res, result.rows, '获取租赁合同成功', 200, {
        pagination: result.pagination,
        summary: result.summary
      })
    } catch (error) {
      this.logger.error('获取租赁合同失败:', error)
      return this.response.serverError(res, '获取租赁合同失败', error)
    }
  }
}

module.exports = RentalListController
