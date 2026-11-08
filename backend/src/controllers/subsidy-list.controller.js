'use strict'

const log = require('../utils/log')
const SubsidyListService = require('../services/subsidy-list.service')

class SubsidyListController {
  constructor({ service = new SubsidyListService(), logger = log } = {}) {
    this.service = service
    this.logger = logger
  }

  async list(req, res) {
    const routeStart = process.hrtime.bigint()
    let lastMark = routeStart
    const mark = (label, extra = {}) => {
      const now = process.hrtime.bigint()
      this.logger.info(`⏱️ [GET /subsidy] ${label}`, {
        stepMs: (Number(now - lastMark) / 1e6).toFixed(2),
        totalMs: (Number(now - routeStart) / 1e6).toFixed(2),
        method: req.method,
        path: req.originalUrl,
        ...extra
      })
      lastMark = now
    }

    try {
      const result = await this.service.list({
        userId: req.user.id,
        query: req.query,
        onFiltersBuilt: details => mark('filters built', details)
      })
      mark('database queries completed', {
        listQueryMs: result.listQueryMs.toFixed(2),
        countQueryMs: result.countQueryMs.toFixed(2),
        rowCount: result.data.length
      })
      this.logger.info('✅ 国补列表查询完成:', {
        返回记录数: result.data.length,
        总记录数: result.pagination.total,
        当前页: result.pagination.page,
        每页数量: result.pagination.page_size
      })
      res.json({ success: true, message: '获取国补列表成功', data: result.data, pagination: result.pagination })
      mark('response sent')
    } catch (error) {
      mark('failed', { error: error.message })
      this.logger.error('❌ 获取国补列表失败:', error)
      res.status(500).json({
        success: false,
        message: '获取国补列表失败',
        error: error.message
      })
    }
  }
}

module.exports = SubsidyListController
