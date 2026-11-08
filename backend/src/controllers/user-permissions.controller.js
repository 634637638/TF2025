'use strict'

const log = require('../utils/log')
const { getUserAccessProfile } = require('../services/access-control.service')

class UserPermissionsController {
  constructor({ getAccessProfile = getUserAccessProfile, logger = log } = {}) {
    this.getAccessProfile = getAccessProfile
    this.logger = logger
  }

  async getUserPermissions(req, res) {
    const userId = req.user?.id || req.user?.userId
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: '用户未认证，请使用真实登录'
      })
    }

    try {
      const permissionData = await this.getAccessProfile(userId)
      return res.json({
        success: true,
        message: '获取用户权限成功',
        data: permissionData
      })
    } catch (error) {
      this.logger.error('获取用户权限失败:', error)
      return res.status(500).json({
        success: false,
        message: '获取用户权限失败: ' + error.message,
        data: {}
      })
    }
  }
}

module.exports = UserPermissionsController
