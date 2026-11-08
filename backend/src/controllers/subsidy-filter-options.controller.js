'use strict'

const log = require('../utils/log')
const SubsidyFilterOptionsService = require('../services/subsidy-filter-options.service')

class SubsidyFilterOptionsController {
  constructor({ service = new SubsidyFilterOptionsService(), logger = log } = {}) {
    this.service = service
    this.logger = logger
  }

  async getFilterOptions(req, res) {
    try {
      const data = await this.service.getFilterOptions(req.user.id)
      return res.json({ success: true, message: '获取筛选选项成功', data })
    } catch (error) {
      this.logger.error('❌ 获取筛选选项失败:', error)
      return res.status(500).json({
        success: false,
        message: '获取筛选选项失败',
        error: error.message
      })
    }
  }
}

module.exports = SubsidyFilterOptionsController
