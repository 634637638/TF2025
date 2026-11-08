'use strict'

const { getDatabase } = require('../config/database')

class PermissionStatisticsRepository {
  constructor({ database = getDatabase } = {}) {
    this.database = database
  }

  async getStats({ supportsRoleIsActive, supportsModuleIsActive }) {
    const pool = this.database()
    const [[moduleStats], [roleStats], [typeStats]] = await Promise.all([
      pool.execute(`SELECT COUNT(*) as total FROM modules ${supportsModuleIsActive ? 'WHERE is_active = 1' : ''}`),
      pool.execute(`SELECT COUNT(*) as total FROM roles ${supportsRoleIsActive ? 'WHERE is_active = 1' : ''}`),
      pool.execute('SELECT COUNT(*) as total FROM role_permissions')
    ])
    return { moduleStats, roleStats, typeStats }
  }

  async getOverview({ supportsRoleIsActive, supportsRoleHierarchyLevel, supportsUserStatus, supportsModuleIsActive }) {
    const pool = this.database()
    const hierarchyExpression = supportsRoleHierarchyLevel ? 'COALESCE(hierarchy_level, 0)' : '0'
    const activeUserExpression = supportsUserStatus ? "(status = 'active' OR status = 1)" : '1 = 1'
    const unregisteredModuleExpression = supportsModuleIsActive ? 'is_active = 0' : '0 = 1'
    const [[roleStats], [userStats], [moduleStats], [permissionStats]] = await Promise.all([
      pool.execute(`
        SELECT
          COUNT(*) as total_roles,
          COUNT(CASE WHEN ${hierarchyExpression} >= 70 THEN 1 END) as system_roles,
          COUNT(CASE WHEN ${hierarchyExpression} < 70 THEN 1 END) as business_roles
        FROM roles ${supportsRoleIsActive ? 'WHERE is_active = 1' : ''}
      `),
      pool.execute(`
        SELECT
          COUNT(*) as total_users,
          COUNT(CASE WHEN ${activeUserExpression} THEN 1 END) as active_users,
          COUNT(CASE WHEN id IN (SELECT DISTINCT user_id FROM user_roles) THEN 1 END) as users_with_roles
        FROM users
      `),
      pool.execute(`
        SELECT
          COUNT(*) as total_modules,
          COUNT(CASE WHEN ${unregisteredModuleExpression} THEN 1 END) as unregistered_modules
        FROM modules
      `),
      pool.execute('SELECT COUNT(*) as total_permissions FROM role_permissions')
    ])
    return { roleStats, userStats, moduleStats, permissionStats }
  }
}

module.exports = PermissionStatisticsRepository
