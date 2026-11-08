'use strict'

const log = require('../utils/log')
const SubsidyUpdateService = require('../services/subsidy-update.service')

class SubsidyUpdateController {
  constructor({ service = new SubsidyUpdateService(), logger = log } = {}) {
    this.service = service
    this.logger = logger
  }

  async update(req, res) {
    try {
      const result = await this.service.update(req.params.id, req.body || {})
      return res.status(result.status).json(result.body)
    } catch (error) {
      this.logger.error('❌ 更新国补信息失败:', error)
      return res.status(500).json({
        success: false,
        message: '更新失败',
        error: error.message
      })
    }
  }
}

module.exports = SubsidyUpdateController
