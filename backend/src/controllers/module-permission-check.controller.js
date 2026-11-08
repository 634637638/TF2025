'use strict'

const log = require('../utils/log')
const { hasUserPermission } = require('../services/access-control.service')

class ModulePermissionCheckController {
  constructor({ checkPermission = hasUserPermission, logger = log } = {}) {
    this.checkPermission = checkPermission
    this.logger = logger
  }

  async check(req, res) {
    const moduleKey = req.query.module_key
    const permissionType = req.query.permission_type
    if (!moduleKey || !permissionType) {
      return res.status(400).json({ success: false, message: '模块key和权限类型不能为空' })
    }

    const userId = req.user?.id || req.user?.userId
    if (!userId) {
      return res.status(401).json({ success: false, message: '用户未认证，请使用真实登录' })
    }

    try {
      const hasPermission = await this.checkPermission(userId, moduleKey, permissionType)
      this.logger.debug(`🔐 权限检查: 用户${userId} - ${moduleKey}:${permissionType} = ${hasPermission}`)
      return res.json({
        success: true,
        message: '权限检查完成',
        data: {
          has_permission: hasPermission,
          user_id: userId,
          module_key: moduleKey,
          permission_type: permissionType
        }
      })
    } catch (error) {
      this.logger.error('检查模块权限失败:', error)
      return res.status(500).json({
        success: false,
        message: '检查模块权限失败: ' + error.message,
        data: { has_permission: false }
      })
    }
  }
}

module.exports = ModulePermissionCheckController
