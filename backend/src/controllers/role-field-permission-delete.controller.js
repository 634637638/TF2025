'use strict'

const log = require('../utils/log')
const RoleFieldPermissionDeleteService = require('../services/role-field-permission-delete.service')

class RoleFieldPermissionDeleteController {
  constructor({ service = new RoleFieldPermissionDeleteService(), logger = log } = {}) {
    this.service = service
    this.logger = logger
  }

  async remove(req, res) {
    const { role_id: roleId, module_key: moduleKey } = req.params
    if (!roleId || !moduleKey) {
      return res.status(400).json({ success: false, message: '角色ID和模块Key不能为空' })
    }

    try {
      const deletedCount = await this.service.remove(roleId, moduleKey)
      if (deletedCount === 0) {
        return res.status(404).json({ success: false, message: '字段权限配置不存在' })
      }
      return res.json({
        success: true,
        message: '删除字段权限配置成功',
        data: { role_id: parseInt(roleId, 10), module_key: moduleKey, deleted_count: deletedCount }
      })
    } catch (error) {
      this.logger.error('删除角色字段权限失败:', error)
      return res.status(500).json({ success: false, message: '删除角色字段权限失败: ' + error.message })
    }
  }
}

module.exports = RoleFieldPermissionDeleteController
