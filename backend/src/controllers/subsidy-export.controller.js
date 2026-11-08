'use strict'

const log = require('../utils/log')
const SubsidyExportService = require('../services/subsidy-export.service')

class SubsidyExportController {
  constructor({ service = new SubsidyExportService(), logger = log } = {}) {
    this.service = service
    this.logger = logger
  }

  async exportExcel(req, res) {
    try {
      const exportFile = await this.service.export({ userId: req.user.id, query: req.query })
      res.setHeader('Content-Type', exportFile.mimeType)
      res.setHeader(
        'Content-Disposition',
        `attachment; filename*=UTF-8''${encodeURIComponent(exportFile.filename)}`
      )
      res.setHeader('X-Export-Total', String(exportFile.total))
      return res.send(exportFile.buffer)
    } catch (error) {
      this.logger.error('❌ 导出国补数据失败:', error)
      return res.status(500).json({
        success: false,
        message: '导出国补数据失败',
        error: error.message
      })
    }
  }
}

module.exports = SubsidyExportController
