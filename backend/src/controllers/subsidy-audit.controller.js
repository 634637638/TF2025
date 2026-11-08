'use strict'

const log = require('../utils/log')
const SubsidyAuditService = require('../services/subsidy-audit.service')

class SubsidyAuditController {
  constructor({ service = new SubsidyAuditService(), logger = log } = {}) {
    this.service = service
    this.logger = logger
  }

  async audit(req, res) {
    try {
      const updated = await this.service.audit(req.params.id)
      if (!updated) return res.status(404).json({ success: false, message: '国补记录不存在' })
      return res.json({ success: true, message: '审批成功' })
    } catch (error) {
      this.logger.error('❌ 审批失败:', error)
      return res.status(500).json({ success: false, message: '审批失败', error: error.message })
    }
  }
}

module.exports = SubsidyAuditController
