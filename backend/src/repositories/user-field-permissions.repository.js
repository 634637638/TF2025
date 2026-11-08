'use strict'

class UserFieldPermissionsRepository {
  async listUserRoles(database, userId, supportsRoleIsActive) {
    const [rows] = await database.execute(`
      SELECT DISTINCT ur.role_id, r.name AS role_name
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = ? ${supportsRoleIsActive ? 'AND r.is_active = 1' : ''}
    `, [userId])
    return rows
  }

  async listRoleFieldPermissions(database, roleIds, moduleKey) {
    if (roleIds.length === 0) return []
    const placeholders = roleIds.map(() => '?').join(',')
    const [rows] = await database.execute(`
      SELECT role_id, module_key, field_config
      FROM role_field_permissions
      WHERE role_id IN (${placeholders})
      ${moduleKey ? 'AND module_key = ?' : ''}
      ORDER BY module_key
    `, moduleKey ? [...roleIds, moduleKey] : roleIds)
    return rows
  }
}

module.exports = UserFieldPermissionsRepository
