'use strict'

const log = require('../utils/log')
const SubsidyDetailService = require('../services/subsidy-detail.service')

class SubsidyDetailController {
  constructor({ service = new SubsidyDetailService(), logger = log } = {}) {
    this.service = service
    this.logger = logger
  }

  async getById(req, res) {
    try {
      const subsidy = await this.service.getById(req.params.id, req.user.id)
      if (!subsidy) {
        return res.status(404).json({ success: false, message: '国补记录不存在' })
      }
      return res.json({ success: true, message: '获取国补详情成功', data: subsidy })
    } catch (error) {
      this.logger.error('❌ 获取国补详情失败:', error)
      return res.status(500).json({
        success: false,
        message: '获取国补详情失败',
        error: error.message
      })
    }
  }
}

module.exports = SubsidyDetailController
