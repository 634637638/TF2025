const { getDatabase } = require('../config/database')

class DebugPermissionsRepository {
  constructor(database = null) {
    this.database = database
  }

  async getUserPermissionDetails(userId) {
    const database = this.database || getDatabase()
    const [userInfos] = await database.execute(`
      SELECT id, username, name, status
      FROM users
      WHERE id = ?
    `, [userId])
    const [userRoles] = await database.execute(`
      SELECT
        r.id as role_id,
        r.name as role_name,
        COALESCE(r.code, CONCAT('role_', r.id)) AS role_code,
        ur.status,
        ur.expires_at
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = ?
      ORDER BY ur.assigned_at DESC
    `, [userId])
    const [allRolePermissions] = await database.execute(`
      SELECT
        r.name as role_name,
        rp.module_key,
        rp.permission_type,
        rp.menu_visible
      FROM role_permissions rp
      JOIN user_roles ur ON rp.role_id = ur.role_id
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = ?
      ORDER BY r.name, rp.module_key, rp.permission_type
    `, [userId])
    const [activePermissions] = await database.execute(`
      SELECT DISTINCT
        rp.module_key,
        rp.permission_type
      FROM role_permissions rp
      JOIN user_roles ur ON rp.role_id = ur.role_id
      WHERE ur.user_id = ?
        AND ur.status = 'active'
        AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
      ORDER BY rp.module_key, rp.permission_type
    `, [userId])

    return { user: userInfos[0], roles: userRoles, allRolePermissions, activePermissions }
  }

  async getRolePermissionDetails(roleId) {
    const database = this.database || getDatabase()
    const [roleInfos] = await database.execute(`
      SELECT id, name, COALESCE(code, CONCAT('role_', id)) AS role_code, is_active
      FROM roles
      WHERE id = ?
    `, [roleId])

    if (roleInfos.length === 0) {
      return { role: null, permissions: [] }
    }

    const [permissions] = await database.execute(`
      SELECT module_key, permission_type, menu_visible
      FROM role_permissions
      WHERE role_id = ?
      ORDER BY module_key, permission_type
    `, [roleId])

    return { role: roleInfos[0], permissions }
  }
}

module.exports = DebugPermissionsRepository
