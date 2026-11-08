'use strict'

const log = require('../utils/log')
const RolePermissionsService = require('../services/role-permissions.service')

class RolePermissionsController {
  constructor({ service = new RolePermissionsService(), logger = log } = {}) {
    this.service = service
    this.logger = logger
  }

  async getByRole(req, res) {
    try {
      const result = await this.service.getByRole(req.params.id)
      if (!result) return res.status(404).json({ success: false, message: '角色不存在' })
      return res.json({
        success: true,
        message: result.message,
        data: result.modules,
        meta: result.meta
      })
    } catch (error) {
      this.logger.error('获取角色权限失败:', error)
      return res.status(500).json({
        success: false,
        message: '获取角色权限失败: ' + error.message
      })
    }
  }

  async clearAllActionPermissions(req, res) {
    try {
      const result = await this.service.clearAllActionPermissions(req.params.id, req)
      if (!result) return res.status(404).json({ success: false, message: '角色不存在' })

      return res.json({
        success: true,
        message: '已清除角色的所有功能权限（保留菜单权限）',
        deletedCount: result.deletedCount
      })
    } catch (error) {
      this.logger.error('清除权限失败:', error)
      return res.status(500).json({ success: false, message: '清除权限失败: ' + error.message })
    }
  }

  async updateActionPermissions(req, res) {
    try {
      const { permissions } = req.body
      const result = await this.service.updateActionPermissions(req.params.id, permissions, req)
      if (!result) return res.status(404).json({ success: false, message: '角色不存在' })
      return res.json({ success: true, message: '角色权限更新成功' })
    } catch (error) {
      this.logger.error('更新角色权限失败:', error)
      return res.status(500).json({
        success: false,
        message: '更新角色权限失败: ' + error.message
      })
    }
  }

  async selectAllActionPermissions(req, res) {
    try {
      const result = await this.service.selectAllActionPermissions(req.params.id, req)
      if (!result) return res.status(404).json({ success: false, message: '角色不存在' })
      return res.json({
        success: true,
        message: `已为角色分配所有 ${result.permissionsCount} 个权限`,
        data: {
          modulesCount: result.modulesCount,
          permissionsCount: result.permissionsCount
        }
      })
    } catch (error) {
      if (error.code === 'PERMISSION_MODULE_SCAN_FAILED') {
        return res.status(500).json({ success: false, message: error.message })
      }
      this.logger.error('分配所有权限失败:', error)
      return res.status(500).json({
        success: false,
        message: '分配所有权限失败: ' + error.message
      })
    }
  }
}

module.exports = RolePermissionsController
