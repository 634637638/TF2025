'use strict'

class RolePermissionsRepository {
  async findRole(database, roleId) {
    const [roles] = await database.execute(
      'SELECT id, name FROM roles WHERE id = ?',
      [roleId]
    )
    return roles[0] || null
  }

  async listModules(database, supportsModuleIsActive) {
    const [modules] = await database.execute(`
      SELECT DISTINCT
        m.\`key\` as module_key,
        m.name as module_name,
        m.description as module_description,
        m.category as module_category,
        'view' as permission_type
      FROM modules m
      ${supportsModuleIsActive ? 'WHERE m.is_active = 1' : ''}
      ORDER BY m.category, m.\`key\`
    `)
    return modules
  }

  async listPermissionModuleKeys(database, supportsModuleIsActive) {
    const [modules] = await database.execute(`
      SELECT DISTINCT \`key\` as module_key
      FROM modules
      ${supportsModuleIsActive ? 'WHERE is_active = 1' : ''}
    `)
    return modules.map(module => module.module_key)
  }

  async listRolePermissions(database, roleId) {
    const [permissions] = await database.execute(`
      SELECT rp.module_key, rp.permission_type
      FROM role_permissions rp
      WHERE rp.role_id = ?
    `, [roleId])
    return permissions
  }

  async listActionPermissions(database, roleId) {
    const [permissions] = await database.execute(`
      SELECT module_key, permission_type
      FROM role_permissions
      WHERE role_id = ? AND permission_type != ?
    `, [roleId, 'menu_view'])
    return permissions
  }

  async deleteActionPermissions(database, roleId) {
    const [result] = await database.execute(
      'DELETE FROM role_permissions WHERE role_id = ? AND permission_type != ?',
      [roleId, 'menu_view']
    )
    return result.affectedRows
  }

  async replaceActionPermissions(database, roleId, permissions) {
    if (permissions.length === 0) return
    const values = permissions.map(permission => [roleId, permission.module_key, permission.permission_type])
    const placeholders = values.map(() => '(?, ?, ?)').join(', ')
    await database.execute(
      `REPLACE INTO role_permissions (role_id, module_key, permission_type) VALUES ${placeholders}`,
      values.flat()
    )
  }

  async listUsersWithRole(database, roleId) {
    const [users] = await database.execute(
      'SELECT DISTINCT user_id FROM user_roles WHERE role_id = ?',
      [roleId]
    )
    return users
  }
}

module.exports = RolePermissionsRepository
