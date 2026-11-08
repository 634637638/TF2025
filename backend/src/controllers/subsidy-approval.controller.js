'use strict'

const log = require('../utils/log')
const SubsidyApprovalService = require('../services/subsidy-approval.service')

class SubsidyApprovalController {
  constructor({ service = new SubsidyApprovalService(), logger = log } = {}) {
    this.service = service
    this.logger = logger
  }

  async approve(req, res) {
    const { approved } = req.body || {}
    if (typeof approved !== 'boolean') {
      return res.status(400).json({ success: false, message: '请提供审批结果' })
    }

    try {
      const updated = await this.service.approve(req.params.id, approved)
      if (!updated) return res.status(404).json({ success: false, message: '国补记录不存在' })
      return res.json({ success: true, message: approved ? '审批通过' : '审批拒绝' })
    } catch (error) {
      this.logger.error('❌ 审批失败:', error)
      return res.status(500).json({ success: false, message: '审批失败', error: error.message })
    }
  }
}

module.exports = SubsidyApprovalController
