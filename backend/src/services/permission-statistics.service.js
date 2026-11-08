'use strict'

const { hasColumn } = require('./schema-inspector.service')
const PermissionStatisticsRepository = require('../repositories/permission-statistics.repository')

class PermissionStatisticsService {
  constructor({ repository = new PermissionStatisticsRepository(), columnExists = hasColumn } = {}) {
    this.repository = repository
    this.columnExists = columnExists
  }

  async getStats() {
    const [supportsRoleIsActive, supportsModuleIsActive] = await Promise.all([
      this.columnExists('roles', 'is_active'),
      this.columnExists('modules', 'is_active')
    ])
    const result = await this.repository.getStats({ supportsRoleIsActive, supportsModuleIsActive })
    return { module_stats: result.moduleStats, role_stats: result.roleStats, type_stats: result.typeStats }
  }

  async getOverview() {
    const [supportsRoleIsActive, supportsRoleHierarchyLevel, supportsUserStatus, supportsModuleIsActive] = await Promise.all([
      this.columnExists('roles', 'is_active'),
      this.columnExists('roles', 'hierarchy_level'),
      this.columnExists('users', 'status'),
      this.columnExists('modules', 'is_active')
    ])
    const result = await this.repository.getOverview({
      supportsRoleIsActive,
      supportsRoleHierarchyLevel,
      supportsUserStatus,
      supportsModuleIsActive
    })
    const roleStats = result.roleStats[0]
    const userStats = result.userStats[0]
    const moduleStats = result.moduleStats[0]
    const permissionStats = result.permissionStats[0]

    return {
      total_roles: roleStats.total_roles || 0,
      total_users: userStats.total_users || 0,
      active_users: userStats.active_users || 0,
      users_with_roles: userStats.users_with_roles || 0,
      system_roles: roleStats.system_roles || 0,
      business_roles: roleStats.business_roles || 0,
      total_modules: moduleStats.total_modules || 0,
      registered_modules: (moduleStats.total_modules || 0) - (moduleStats.unregistered_modules || 0),
      unregistered_modules: moduleStats.unregistered_modules || 0,
      total_permissions: permissionStats.total_permissions || 0
    }
  }
}

module.exports = PermissionStatisticsService
