'use strict'

const log = require('../utils/log')
const PermissionMenuService = require('../services/permission-menu.service')

class PermissionMenuController {
  constructor({ service = new PermissionMenuService(), logger = log } = {}) {
    this.service = service
    this.logger = logger
  }

  async getByRole(req, res) {
    const roleId = req.params.role_id
    try {
      const menuPermissions = await this.service.getByRole(roleId)
      return res.json({
        success: true,
        message: '获取角色菜单权限成功',
        data: { role_id: roleId, menu_permissions: menuPermissions }
      })
    } catch (error) {
      this.logger.error('获取角色菜单权限失败:', error)
      return res.status(500).json({
        success: false,
        message: '获取角色菜单权限失败: ' + error.message,
        data: []
      })
    }
  }
}

module.exports = PermissionMenuController
