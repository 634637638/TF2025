'use strict'

const ApiResponse = require('../utils/response')
const log = require('../utils/log')
const RentalUpdateService = require('../services/rental-update.service')

class RentalUpdateController {
  constructor({ service = new RentalUpdateService(), logger = log } = {}) {
    this.service = service
    this.logger = logger
  }

  async update(req, res) {
    try {
      const result = await this.service.update({
        id: req.params.id,
        body: req.body || {},
        isAdministrator: (req.user?.role_codes || []).some(code => ['super_admin', 'webadmin', 'admin'].includes(String(code).toLowerCase()))
      })
      return ApiResponse.success(res, { id: result.id }, '租赁合同保存成功')
    } catch (error) {
      if (error.code === 'RENTAL_NOT_FOUND') return ApiResponse.notFound(res, '租赁合同不存在')
      if (error.statusCode === 400) return ApiResponse.badRequest(res, error.message)
      this.logger.error('保存租赁合同失败:', error)
      return ApiResponse.serverError(res, '保存租赁合同失败', error)
    }
  }
}

module.exports = RentalUpdateController
