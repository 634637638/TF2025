'use strict'

const UserFieldPermissionsService = require('../services/user-field-permissions.service')
const log = require('../utils/log')

class UserFieldPermissionsController {
  constructor({ service = new UserFieldPermissionsService(), logger = log } = {}) {
    this.service = service
    this.logger = logger
  }

  async getCurrent(req, res) {
    const userId = req.user?.id || req.user?.userId
    if (!userId) {
      return res.status(401).json({ success: false, message: '用户未认证，请使用真实登录' })
    }

    const moduleKey = req.query.module_key
    this.logger.debug(`👤 获取用户字段权限: userId=${userId}, module_key=${moduleKey}`)
    try {
      const data = await this.service.getForUser(userId, moduleKey)
      return res.json({ success: true, message: '获取用户字段权限成功', data })
    } catch (error) {
      this.logger.error('获取用户字段权限失败:', error)
      return res.status(500).json({
        success: false,
        message: '获取用户字段权限失败: ' + error.message,
        data: { user_id: userId, roles: [], field_permissions: {} }
      })
    }
  }
}

module.exports = UserFieldPermissionsController
