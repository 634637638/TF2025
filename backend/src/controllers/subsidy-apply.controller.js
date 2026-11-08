'use strict'

const log = require('../utils/log')
const SubsidyApplyService = require('../services/subsidy-apply.service')

class SubsidyApplyController {
  constructor({ service = new SubsidyApplyService(), logger = log } = {}) {
    this.service = service
    this.logger = logger
  }

  async create(req, res) {
    try {
      const result = await this.service.create(req.body || {}, req.user.id)
      return res.status(result.status).json(result.body)
    } catch (error) {
      this.logger.error('❌ 创建国补申请失败:', error)
      const statusCode = error.statusCode || 500
      return res.status(statusCode).json({
        success: false,
        message: statusCode === 400 ? error.message : '创建国补申请失败'
      })
    }
  }
}

module.exports = SubsidyApplyController
