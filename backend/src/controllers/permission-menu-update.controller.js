'use strict'

const log = require('../utils/log')
const PermissionMenuUpdateService = require('../services/permission-menu-update.service')

class PermissionMenuUpdateController {
  constructor({ service = new PermissionMenuUpdateService(), logger = log } = {}) {
    this.service = service
    this.logger = logger
  }

  async update(req, res) {
    const roleId = req.params.role_id
    const menuPermissions = req.body?.menu_permissions
    if (!Array.isArray(menuPermissions)) {
      return res.status(400).json({ success: false, message: '菜单权限格式错误' })
    }

    try {
      const result = await this.service.update(roleId, menuPermissions, req)
      return res.json({
        success: true,
        message: '更新菜单权限成功',
        data: { role_id: Number(roleId), received_count: result.receivedCount }
      })
    } catch (error) {
      this.logger.error('更新菜单权限失败:', error)
      return res.status(500).json({ success: false, message: '更新菜单权限失败: ' + error.message })
    }
  }
}

module.exports = PermissionMenuUpdateController
