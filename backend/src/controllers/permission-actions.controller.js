'use strict'

const log = require('../utils/log')
const { listPermissionActions } = require('../services/access-control.service')

class PermissionActionsController {
  constructor({ listActions = listPermissionActions, logger = log } = {}) {
    this.listActions = listActions
    this.logger = logger
  }

  async list(_req, res) {
    try {
      const actions = await this.listActions()
      return res.json({
        success: true,
        message: '获取权限动作成功',
        data: actions
      })
    } catch (error) {
      this.logger.error('获取权限动作失败:', error)
      return res.status(500).json({
        success: false,
        message: '获取权限动作失败: ' + error.message,
        data: []
      })
    }
  }
}

module.exports = PermissionActionsController
