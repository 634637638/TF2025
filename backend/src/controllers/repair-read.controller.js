'use strict'

const ApiResponse = require('../utils/response')
const log = require('../utils/log')

class RepairReadController {
  constructor({ service, response = ApiResponse, logger = log } = {}) {
    if (!service) throw new TypeError('RepairReadController requires service')
    this.service = service
    this.response = response
    this.logger = logger
  }

  async list(req, res) {
    try {
      const result = await this.service.getList(req)
      return this.response.success(res, result.records, '获取维修记录成功', 200, {
        pagination: result.pagination
      })
    } catch (error) {
      if (error.statusCode === 403) {
        return res.status(403).json({ success: false, message: error.message, code: error.code })
      }
      if (error.code === 'BAD_REQUEST') return this.response.badRequest(res, error.message)
      this.logger.error('获取维修记录失败:', error)
      return this.response.serverError(res, '获取维修记录失败', error)
    }
  }

  async stats(req, res) {
    try {
      return this.response.success(res, await this.service.getStats(req), '获取维修统计成功')
    } catch (error) {
      if (error.statusCode === 403) {
        return res.status(403).json({ success: false, message: error.message, code: error.code })
      }
      if (error.code === 'BAD_REQUEST') return this.response.badRequest(res, error.message)
      this.logger.error('获取维修统计失败:', error)
      return this.response.serverError(res, '获取维修统计失败', error)
    }
  }

  async detail(req, res) {
    try {
      const repair = await this.service.getDetail(req.params.id, req)
      if (!repair) return this.response.notFound(res, '维修单不存在')
      return this.response.success(res, repair, '获取维修单详情成功')
    } catch (error) {
      if (error.code === 'BAD_REQUEST') return this.response.badRequest(res, error.message)
      this.logger.error('获取维修单详情失败:', error)
      return this.response.serverError(res, '获取维修单详情失败', error)
    }
  }
}

module.exports = RepairReadController
