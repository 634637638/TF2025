'use strict'

const log = require('../utils/log')
const UserMenuService = require('../services/user-menu.service')

class UserMenuController {
  constructor({ service = new UserMenuService(), logger = log } = {}) {
    this.service = service
    this.logger = logger
  }

  async getUserMenu(req, res) {
    const userId = req.user?.id || req.user?.userId
    if (!userId) {
      return res.status(401).json({ success: false, message: '用户未认证' })
    }

    try {
      const menuPermissions = await this.service.getUserMenu(userId)
      return res.json({
        success: true,
        message: '获取用户菜单权限成功',
        data: { menuPermissions }
      })
    } catch (error) {
      this.logger.error('获取用户菜单权限失败:', error)
      return res.status(500).json({
        success: false,
        message: '获取用户菜单权限失败: ' + error.message
      })
    }
  }
}

module.exports = UserMenuController
