'use strict'

const log = require('../utils/log')
const { PermissionCleanupService } = require('../services/permission-cleanup.service')

class PermissionCleanupController {
  constructor({ service = new PermissionCleanupService(), logger = log } = {}) {
    this.service = service
    this.logger = logger
  }

  async manualCleanup(req, res) {
    const { roleId, cleanupAll = false } = req.body
    try {
      let result
      if (cleanupAll) {
        result = await this.service.cleanupAllRolePermissions()
      } else if (roleId) {
        result = await this.service.cleanupRolePermissions(roleId)
      } else {
        return res.status(400).json({
          success: false,
          message: '请提供角色ID或设置cleanupAll为true'
        })
      }

      return res.json({ success: true, message: '权限清理完成', data: result })
    } catch (error) {
      this.logger.error('手动权限清理失败:', error)
      return res.status(500).json({
        success: false,
        message: '权限清理失败: ' + error.message
      })
    }
  }
}

module.exports = PermissionCleanupController
