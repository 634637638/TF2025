'use strict'

const ApiResponse = require('../utils/response')
const log = require('../utils/log')

class RepairCreateController {
  constructor({ service, normalizeRepairRow, maskRepairItem, response = ApiResponse, logger = log } = {}) {
    if (!service) throw new TypeError('RepairCreateController requires service')
    if (typeof normalizeRepairRow !== 'function') throw new TypeError('RepairCreateController requires normalizeRepairRow')
    if (typeof maskRepairItem !== 'function') throw new TypeError('RepairCreateController requires maskRepairItem')
    this.service = service
    this.normalizeRepairRow = normalizeRepairRow
    this.maskRepairItem = maskRepairItem
    this.response = response
    this.logger = logger
  }

  async create(req, res) {
    try {
      const created = await this.service.create(req.body, req.user)
      const normalized = this.normalizeRepairRow(created, req.user.id)
      const masked = await this.maskRepairItem(normalized, req)
      return this.response.created(res, masked, '维修单创建成功')
    } catch (error) {
      if (error.statusCode === 400) return this.response.badRequest(res, error.message)
      if (error.rollbackError) this.logger.error('创建维修单事务回滚失败:', error.rollbackError)
      if (error.mediaRollbackError) this.logger.error('创建维修单媒体回滚失败:', error.mediaRollbackError)
      this.logger.error('创建维修单失败:', error)
      return this.response.serverError(res, '创建维修单失败', error)
    }
  }
}

module.exports = RepairCreateController
