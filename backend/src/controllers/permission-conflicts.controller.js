'use strict'

const log = require('../utils/log')
const PermissionConflictsService = require('../services/permission-conflicts.service')

class PermissionConflictsController {
  constructor({ service = new PermissionConflictsService(), logger = log } = {}) {
    this.service = service
    this.logger = logger
  }

  async check(_req, res) {
    try {
      const data = await this.service.check()
      return res.json({ success: true, message: '权限冲突检测完成', data })
    } catch (error) {
      this.logger.error('权限冲突检测失败:', error)
      return res.status(500).json({
        success: false,
        message: '权限冲突检测失败: ' + error.message
      })
    }
  }

  async cleanup(_req, res) {
    try {
      const data = await this.service.cleanup()
      return res.json({ success: true, message: '权限冲突清理完成', data })
    } catch (error) {
      this.logger.error('清理权限冲突失败:', error)
      return res.status(500).json({
        success: false,
        message: '清理权限冲突失败: ' + error.message
      })
    }
  }
}

module.exports = PermissionConflictsController
