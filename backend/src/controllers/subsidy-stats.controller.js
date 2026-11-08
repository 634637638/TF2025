'use strict'

const log = require('../utils/log')
const SubsidyStatsService = require('../services/subsidy-stats.service')

class SubsidyStatsController {
  constructor({ service = new SubsidyStatsService(), logger = log } = {}) {
    this.service = service
    this.logger = logger
  }

  async getSummary(req, res) {
    const routeStart = process.hrtime.bigint()
    let lastMark = routeStart
    const mark = (label, extra = {}) => {
      const now = process.hrtime.bigint()
      this.logger.info(`⏱️ [GET /subsidy/stats/summary] ${label}`, {
        stepMs: (Number(now - lastMark) / 1e6).toFixed(2),
        totalMs: (Number(now - routeStart) / 1e6).toFixed(2),
        method: req.method,
        path: req.originalUrl,
        ...extra
      })
      lastMark = now
    }

    try {
      const result = await this.service.getSummary({
        userId: req.user.id,
        query: req.query,
        onFiltersBuilt: details => mark('filters built', details)
      })
      mark('database queries completed', {
        statsQueryMs: result.statsQueryMs.toFixed(2),
        storeStatsQueryMs: result.includeStoreStats ? result.storeStatsQueryMs.toFixed(2) : '0.00',
        storeCount: result.storeCount
      })
      res.json({ success: true, message: '获取统计数据成功', data: result.data })
      mark('response sent')
    } catch (error) {
      mark('failed', { error: error.message })
      this.logger.error('❌ 获取统计数据失败:', error)
      res.status(500).json({
        success: false,
        message: '获取统计数据失败',
        error: error.message
      })
    }
  }
}

module.exports = SubsidyStatsController
