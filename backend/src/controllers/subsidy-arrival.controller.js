'use strict'

const log = require('../utils/log')
const SubsidyArrivalService = require('../services/subsidy-arrival.service')

class SubsidyArrivalController {
  constructor({ service = new SubsidyArrivalService(), logger = log } = {}) {
    this.service = service
    this.logger = logger
  }

  async confirmArrival(req, res) {
    try {
      const confirmed = await this.service.confirmArrival(req.params.id)
      if (!confirmed) {
        return res.status(400).json({ success: false, message: '国补记录不存在' })
      }
      return res.json({ success: true, message: '确认到账成功' })
    } catch (error) {
      this.logger.error('❌ 确认到账失败:', error)
      return res.status(500).json({
        success: false,
        message: '确认到账失败',
        error: error.message
      })
    }
  }
}

module.exports = SubsidyArrivalController
