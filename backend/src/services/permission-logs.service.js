'use strict'

const PermissionLogsRepository = require('../repositories/permission-logs.repository')
const log = require('../utils/log')

class PermissionLogsService {
  constructor({ repository = new PermissionLogsRepository(), logger = log } = {}) {
    this.repository = repository
    this.logger = logger
  }

  async logPermissionOperation(req, action, targetType, targetId, targetName, description, details = null, status = 'success') {
    try {
      await this.repository.insertOperation({
        userId: req.user?.id || null,
        username: req.user?.username || 'system',
        action,
        targetType,
        targetId,
        targetName,
        description,
        details: details ? JSON.stringify(details) : null,
        ipAddress: req.ip || req.connection.remoteAddress,
        status
      })
    } catch (error) {
      this.logger.error('记录权限操作日志失败:', error)
    }
  }

  async logRoleOperation(req, action, roleId, roleName, extraDetails = {}) {
    await this.logPermissionOperation(
      req,
      action,
      'role',
      roleId,
      roleName,
      `${action === 'create' ? '创建' : action === 'edit' ? '修改' : action === 'delete' ? '删除' : '操作'}角色: ${roleName}`,
      extraDetails
    )
  }

  async logUserRoleOperation(req, userId, username, roleIds, extraDetails = {}) {
    const normalizedRoleIds = Array.isArray(roleIds)
      ? roleIds.map(Number).filter(Number.isInteger)
      : []

    const roles = normalizedRoleIds.length > 0
      ? await this.repository.getRolesByIds(normalizedRoleIds)
      : []
    const previousRoleIds = Array.isArray(extraDetails.previous_role_ids)
      ? extraDetails.previous_role_ids.map(Number).filter(Number.isInteger)
      : []
    const previousRoleNames = Array.isArray(extraDetails.previous_role_names)
      ? extraDetails.previous_role_names
      : []
    const addedRoles = roles.filter(role => !previousRoleIds.includes(Number(role.id)))
    const removedRoles = previousRoleIds
      .map((roleId, index) => ({ id: roleId, name: previousRoleNames[index] || String(roleId) }))
      .filter(role => !normalizedRoleIds.includes(role.id))

    if (addedRoles.length === 0 && removedRoles.length === 0) return

    await this.logPermissionOperation(
      req,
      'assign',
      'user',
      userId,
      username,
      `调整用户 ${username} 的角色：新增 ${addedRoles.length} 个，移除 ${removedRoles.length} 个`,
      {
        ...extraDetails,
        audit_type: 'user_role_assignment',
        role_ids: normalizedRoleIds,
        role_names: roles.map(role => role.name),
        added_roles: addedRoles,
        removed_roles: removedRoles
      }
    )
  }

  async logPermissionModification(req, roleId, roleName, permissions, extraDetails = {}) {
    const permissionDetails = Array.isArray(permissions)
      ? permissions.map(permission => ({
        module_key: permission.module_key,
        permission_type: permission.permission_type
      }))
      : []
    const addedCount = Number(extraDetails.added_count) || 0
    const removedCount = Number(extraDetails.removed_count) || 0
    const affectedModulesCount = Number(extraDetails.affected_modules_count) || 0
    const isMenuPermission = extraDetails.audit_type === 'role_menu_permissions'
    const actionSummary = isMenuPermission
      ? `显示 ${addedCount} 项，隐藏 ${removedCount} 项`
      : `开启 ${addedCount} 项，关闭 ${removedCount} 项`
    const description = addedCount > 0 || removedCount > 0
      ? `修改角色 ${roleName} 的${isMenuPermission ? '菜单显示' : '操作'}权限：${actionSummary}，涉及 ${affectedModulesCount} 个模块`
      : `检查角色 ${roleName} 的${isMenuPermission ? '菜单显示' : '操作'}权限，配置未发生变化`

    await this.logPermissionOperation(
      req,
      'permission',
      'role',
      roleId,
      roleName,
      description,
      {
        ...extraDetails,
        permissions_count: permissionDetails.length,
        permissions: permissionDetails
      }
    )
  }

  async listLogs({ action, username, startDate, endDate, pageSize, offset }) {
    const whereConditions = []
    const params = []
    if (action) {
      whereConditions.push('action = ?')
      params.push(action)
    }
    if (username) {
      whereConditions.push('username LIKE ?')
      params.push(`%${username}%`)
    }
    if (startDate) {
      whereConditions.push('created_at >= ?')
      params.push(startDate)
    }
    if (endDate) {
      whereConditions.push('created_at <= ?')
      params.push(endDate)
    }
    const whereClause = whereConditions.length ? `WHERE ${whereConditions.join(' AND ')}` : ''
    return this.repository.listLogs({ whereClause, params, pageSize, offset })
  }

  async getStats() {
    return this.repository.getStats()
  }

  async deleteLog(id) {
    return this.repository.deleteLog(id)
  }
}

module.exports = PermissionLogsService
