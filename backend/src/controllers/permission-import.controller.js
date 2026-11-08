'use strict'

const log = require('../utils/log')
const PermissionImportService = require('../services/permission-import.service')

class PermissionImportController {
  constructor({ service = new PermissionImportService(), logger = log } = {}) {
    this.service = service
    this.logger = logger
  }

  async import(req, res) {
    try {
      const overwrite = req.body?.overwrite === undefined ? false : req.body.overwrite
      const result = await this.service.import(req.body?.config, overwrite)
      if (result.status === 400) {
        return res.status(400).json({ success: false, message: '权限配置格式错误' })
      }
      return res.json({
        success: true,
        message: `成功导入 ${result.importedCount} 个权限`,
        data: { importedCount: result.importedCount, overwrite: result.overwrite }
      })
    } catch (error) {
      this.logger.error('导入权限配置失败:', error)
      return res.status(500).json({ success: false, message: '导入权限配置失败: ' + error.message })
    }
  }
}

module.exports = PermissionImportController
