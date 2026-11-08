'use strict'

const log = require('../utils/log')
const RolePermissionVisibilityService = require('../services/role-permission-visibility.service')

class RolePermissionVisibilityController {
  constructor({ service = new RolePermissionVisibilityService(), logger = log } = {}) {
    this.service = service
    this.logger = logger
  }

  async getVisibility(req, res) {
    const roleId = req.params.role_id
    try {
      const permissions = await this.service.getVisibility(roleId)
      if (permissions === null) {
        return res.json({
          success: true,
          message: '当前数据库结构不支持权限可见性配置',
          data: { roleId, permissions: [] }
        })
      }
      return res.json({
        success: true,
        message: '获取权限可见性状态成功',
        data: {
          role_id: roleId,
          permissions: permissions.map(permission => ({
            module_key: permission.module_key,
            permission_type: permission.permission_type,
            visible: Boolean(permission.menu_visible)
          }))
        }
      })
    } catch (error) {
      this.logger.error('获取权限可见性状态失败:', error)
      return res.status(500).json({
        success: false,
        message: '获取权限可见性状态失败: ' + error.message
      })
    }
  }

  async toggleVisibility(req, res) {
    const roleId = req.body?.role_id
    const moduleKey = req.body?.module_key
    const permissionType = req.body?.permission_type
    const { visible } = req.body || {}
    if (!roleId || !moduleKey || !permissionType || typeof visible !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: '参数不完整：需要role_id、module_key、permission_type和visible'
      })
    }

    try {
      const result = await this.service.toggleVisibility({
        roleId, moduleKey, permissionType, visible
      })
      if (!result.supported) {
        return res.status(400).json({
          success: false,
          message: '当前数据库结构不支持权限可见性配置'
        })
      }
      return res.json({
        success: true,
        message: `成功${visible ? '启用' : '禁用'}权限 ${moduleKey}:${permissionType} 的可见性`,
        data: { role_id: roleId, module_key: moduleKey, permission_type: permissionType, visible }
      })
    } catch (error) {
      this.logger.error('切换权限可见性失败:', error)
      return res.status(500).json({
        success: false,
        message: '切换权限可见性失败: ' + error.message
      })
    }
  }
}

module.exports = RolePermissionVisibilityController
