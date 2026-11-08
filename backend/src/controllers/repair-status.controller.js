'use strict'

const ApiResponse = require('../utils/response')
const log = require('../utils/log')

class RepairStatusController {
  constructor({ service, normalizeRepairRow, maskRepairItem, response = ApiResponse, logger = log } = {}) {
    if (!service) throw new TypeError('RepairStatusController requires service')
    if (typeof normalizeRepairRow !== 'function') throw new TypeError('RepairStatusController requires normalizeRepairRow')
    if (typeof maskRepairItem !== 'function') throw new TypeError('RepairStatusController requires maskRepairItem')
    this.service = service
    this.normalizeRepairRow = normalizeRepairRow
    this.maskRepairItem = maskRepairItem
    this.response = response
    this.logger = logger
  }

  async update(req, res) {
    try {
      const repair = await this.service.update(req.params.id, req.body?.status)
      if (!repair) return this.response.notFound(res, '维修单不存在')
      const normalized = this.normalizeRepairRow(repair, req.user.id)
      const masked = await this.maskRepairItem(normalized, req)
      return this.response.success(res, masked, '维修状态更新成功')
    } catch (error) {
      if (error.code === 'BAD_REQUEST') return this.response.badRequest(res, error.message)
      this.logger.error('更新维修状态失败:', error)
      return this.response.serverError(res, '更新维修状态失败', error)
    }
  }

  async cancel(req, res) {
    try {
      const cancelled = await this.service.cancel(req.params.id)
      if (!cancelled) return this.response.notFound(res, '维修单不存在或已完成')
      return this.response.success(res, null, '维修单已取消')
    } catch (error) {
      if (error.code === 'BAD_REQUEST') return this.response.badRequest(res, error.message)
      this.logger.error('取消维修单失败:', error)
      return this.response.serverError(res, '取消维修单失败', error)
    }
  }
}

module.exports = RepairStatusController
