'use strict'

const log = require('../utils/log')
const { normalizeFieldConfig } = require('../utils/field-permission-normalizer')
const { clearCache } = require('../middleware/cache')
const RoleFieldPermissionsService = require('../services/role-field-permissions.service')

class RoleFieldPermissionsController {
  constructor({ service = new RoleFieldPermissionsService(), logger = log, clearPermissionCache = clearCache } = {}) {
    this.service = service
    this.logger = logger
    this.clearPermissionCache = clearPermissionCache
  }

  async getByRole(req, res) {
    const roleId = req.params.role_id
    if (!roleId) {
      return res.status(400).json({ success: false, message: '角色ID不能为空' })
    }

    try {
      const data = await this.service.getByRole(roleId, req.query.module_key)
      if (!data) return res.status(404).json({ success: false, message: '角色不存在' })
      return res.json({ success: true, message: '获取角色字段权限成功', data })
    } catch (error) {
      this.logger.error('获取角色字段权限失败:', error)
      return res.status(500).json({
        success: false,
        message: '获取角色字段权限失败: ' + error.message,
        data: { role_id: roleId, field_permissions: {} }
      })
    }
  }

  async save(req, res) {
    const roleId = req.params.role_id
    const moduleKey = req.body?.module_key
    const fieldConfig = normalizeFieldConfig(req.body?.field_config)
    this.logger.debug('💾 保存角色字段权限配置:', { roleId, moduleKey, fieldConfig })
    if (!roleId || !moduleKey) return res.status(400).json({ success: false, message: '角色ID和模块Key不能为空' })
    if (!fieldConfig || typeof fieldConfig !== 'object') return res.status(400).json({ success: false, message: '字段配置格式错误' })

    try {
      const data = await this.service.saveForRole(roleId, moduleKey, fieldConfig)
      this.clearPermissionCache()
      return res.json({ success: true, message: '字段权限配置保存成功', data })
    } catch (error) {
      this.logger.error('保存角色字段权限失败:', error)
      return res.status(error.statusCode || 500).json({ success: false, message: '保存角色字段权限失败: ' + error.message })
    }
  }

  async update(req, res) {
    const roleId = req.params.role_id
    const moduleKey = req.body?.module_key
    const fieldConfig = normalizeFieldConfig(req.body?.field_config)
    if (!roleId || !moduleKey) return res.status(400).json({ success: false, message: '角色ID和模块Key不能为空' })
    if (!fieldConfig || typeof fieldConfig !== 'object') return res.status(400).json({ success: false, message: '字段配置格式错误' })

    try {
      const data = await this.service.saveForRole(roleId, moduleKey, fieldConfig, req)
      return res.json({ success: true, message: '字段权限配置更新成功', data })
    } catch (error) {
      this.logger.error('更新角色字段权限失败:', error)
      if (error.statusCode === 404) return res.status(404).json({ success: false, message: '角色不存在' })
      if (error.statusCode === 400) return res.status(400).json({ success: false, message: '模块不存在或已停用' })
      return res.status(500).json({ success: false, message: '更新角色字段权限失败: ' + error.message })
    }
  }

  async saveBatch(req, res) {
    const roleId = req.params.role_id
    const modulePermissions = req.body?.module_permissions
    this.logger.debug('📦 批量保存角色字段权限配置:', {
      roleId,
      moduleCount: modulePermissions && typeof modulePermissions === 'object' ? Object.keys(modulePermissions).length : 0
    })
    if (!roleId) return res.status(400).json({ success: false, message: '角色ID不能为空' })
    if (!modulePermissions || typeof modulePermissions !== 'object') {
      return res.status(400).json({ success: false, message: '模块权限配置格式错误' })
    }

    try {
      const data = await this.service.saveBatchForRole(roleId, modulePermissions)
      this.clearPermissionCache()
      this.logger.debug(`✅ 批量保存完成: 更新 ${data.updated_count} 个，创建 ${data.created_count} 个`)
      return res.json({
        success: true,
        message: `批量保存字段权限配置成功，更新 ${data.updated_count} 个，创建 ${data.created_count} 个`,
        data
      })
    } catch (error) {
      this.logger.error('批量保存角色字段权限失败:', error)
      return res.status(error.statusCode || 500).json({ success: false, message: '批量保存角色字段权限失败: ' + error.message })
    }
  }
}

module.exports = RoleFieldPermissionsController
