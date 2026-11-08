'use strict'

const log = require('../utils/log')
const PermissionExportService = require('../services/permission-export.service')

class PermissionExportController {
  constructor({ service = new PermissionExportService(), logger = log, clock = Date.now } = {}) {
    this.service = service
    this.logger = logger
    this.clock = clock
  }

  async export(req, res) {
    try {
      const result = await this.service.export(req.query?.format || 'json')
      if (result.format === 'csv') {
        res.setHeader('Content-Type', 'text/csv')
        res.setHeader('Content-Disposition', `attachment; filename="permissions_export_${this.clock()}.csv"`)
        return res.send(result.body)
      }
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Content-Disposition', `attachment; filename="permissions_export_${this.clock()}.json"`)
      return res.json(result.body)
    } catch (error) {
      this.logger.error('导出权限配置失败:', error)
      return res.status(500).json({ success: false, message: '导出权限配置失败: ' + error.message })
    }
  }
}

module.exports = PermissionExportController
