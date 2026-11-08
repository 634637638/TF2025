'use strict'

const ApiResponse = require('../utils/response')
const log = require('../utils/log')

class RepairUpdateController {
  constructor({ service, normalizeRepairRow, maskRepairItem, response = ApiResponse, logger = log } = {}) {
    if (!service) throw new TypeError('RepairUpdateController requires service')
    if (typeof normalizeRepairRow !== 'function') throw new TypeError('RepairUpdateController requires normalizeRepairRow')
    if (typeof maskRepairItem !== 'function') throw new TypeError('RepairUpdateController requires maskRepairItem')
    this.service = service
    this.normalizeRepairRow = normalizeRepairRow
    this.maskRepairItem = maskRepairItem
    this.response = response
    this.logger = logger
  }

  async update(req, res) {
    try {
      const repair = await this.service.update(req.params.id, req.body, req.user)
      const normalized = this.normalizeRepairRow(repair, req.user.id)
      const masked = await this.maskRepairItem(normalized, req)
      return this.response.success(res, masked, '维修单更新成功')
    } catch (error) {
      if (error.code === 'BAD_REQUEST' || error.statusCode === 400) return this.response.badRequest(res, error.message)
      if (error.code === 'NOT_FOUND' || error.statusCode === 404) return this.response.notFound(res, error.message)
      if (error.rollbackError) this.logger.error('更新维修单事务回滚失败:', error.rollbackError)
      if (error.mediaRollbackError) this.logger.error('更新维修单媒体回滚失败:', error.mediaRollbackError)
      this.logger.error('更新维修单失败:', error)
      return this.response.serverError(res, '更新维修单失败', error)
    }
  }
}

module.exports = RepairUpdateController
