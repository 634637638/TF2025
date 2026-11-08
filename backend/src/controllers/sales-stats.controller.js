'use strict'

const SalesStatsService = require('../services/sales-stats.service')
const log = require('../utils/log')

class SalesStatsController {
  constructor({ service = new SalesStatsService(), logger = log } = {}) {
    if (!service || typeof service.getStats !== 'function') throw new TypeError('SalesStatsController requires a sales stats service')
    this.service = service
    this.logger = logger
  }

  async getStats(_req, res) {
    try {
      const data = await this.service.getStats()
      return res.json({ success: true, message: '获取销售统计成功', data })
    } catch (error) {
      this.logger.error('❌ 获取销售统计失败:', error)
      return res.status(500).json({
        success: false,
        message: '获取销售统计失败',
        error: error.message
      })
    }
  }
}

module.exports = SalesStatsController
