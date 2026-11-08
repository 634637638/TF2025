'use strict'

const DebugPermissionsRepository = require('../repositories/debug-permissions.repository')

class DebugPermissionsService {
  constructor({ repository = new DebugPermissionsRepository() } = {}) {
    this.repository = repository
  }

  async getCurrentUser(userId) {
    const { user, roles, allRolePermissions, activePermissions } =
      await this.repository.getUserPermissionDetails(userId)
    const usersEditPermissions = activePermissions.filter(permission =>
      permission.module_key.includes('users') && permission.permission_type === 'edit'
    )

    return {
      user,
      roles,
      all_role_permissions: allRolePermissions,
      active_permissions: activePermissions,
      users_edit_permissions: usersEditPermissions,
      permissions_summary: {
        total_roles: roles.length,
        active_roles: roles.filter(role => role.status === 'active').length,
        total_permissions: allRolePermissions.length,
        active_permissions: activePermissions.length,
        has_users_edit: usersEditPermissions.length > 0
      }
    }
  }

  async getRolePermissions(roleId) {
    const { role, permissions } = await this.repository.getRolePermissionDetails(roleId)
    if (!role) return { role: null }

    const usersPermissions = permissions.filter(permission => permission.module_key.includes('users'))
    return {
      role,
      permissions,
      users_permissions: usersPermissions,
      summary: {
        total_permissions: permissions.length,
        users_permissions_count: usersPermissions.length
      }
    }
  }
}

module.exports = DebugPermissionsService
