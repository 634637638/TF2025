'use strict'

const log = require('../utils/log')
const PermissionBatchService = require('../services/permission-batch.service')

class PermissionBatchController {
  constructor({ service = new PermissionBatchService(), logger = log } = {}) {
    this.service = service
    this.logger = logger
  }

  async revoke(req, res) {
    const roleId = req.body?.role_id
    const { permissions } = req.body || {}
    if (!roleId || !Array.isArray(permissions) || permissions.length === 0) {
      return res.status(400).json({ success: false, message: '角色ID和权限列表不能为空' })
    }

    try {
      await this.service.revoke(roleId, permissions)
      return res.json({ success: true, message: `成功回收 ${permissions.length} 个权限` })
    } catch (error) {
      this.logger.error('批量回收权限失败:', error)
      return res.status(500).json({ success: false, message: '批量回收权限失败: ' + error.message })
    }
  }

  async assign(req, res) {
    const roleId = req.body?.role_id
    const { permissions } = req.body || {}
    if (!roleId || !Array.isArray(permissions) || permissions.length === 0) {
      return res.status(400).json({ success: false, message: '角色ID和权限列表不能为空' })
    }

    try {
      await this.service.assign(roleId, permissions)
      return res.json({ success: true, message: `成功为角色分配 ${permissions.length} 个权限` })
    } catch (error) {
      this.logger.error('批量分配权限失败:', error)
      return res.status(500).json({ success: false, message: '批量分配权限失败: ' + error.message })
    }
  }

  async copy(req, res) {
    const fromRoleId = req.body?.from_role_id
    const toRoleId = req.body?.to_role_id
    if (!fromRoleId || !toRoleId) {
      return res.status(400).json({ success: false, message: '源角色ID和目标角色ID不能为空' })
    }
    if (fromRoleId === toRoleId) {
      return res.status(400).json({ success: false, message: '源角色和目标角色不能相同' })
    }

    try {
      const result = await this.service.copy(fromRoleId, toRoleId)
      if (result.sourceEmpty) {
        return res.json({ success: true, message: '源角色没有任何权限，操作完成', copied_count: 0 })
      }
      return res.json({ success: true, message: `成功复制 ${result.copiedCount} 个权限`, copied_count: result.copiedCount })
    } catch (error) {
      this.logger.error('复制角色权限失败:', error)
      return res.status(500).json({ success: false, message: '复制角色权限失败: ' + error.message })
    }
  }
}

module.exports = PermissionBatchController
