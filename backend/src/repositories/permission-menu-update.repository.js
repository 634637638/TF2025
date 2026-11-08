'use strict'

const { withConnection } = require('../core/db/connection')

class PermissionMenuUpdateRepository {
  async withConnection(database, operation) {
    return withConnection(database, operation)
  }

  async findRole(connection, roleId) {
    const [rows] = await connection.execute('SELECT id, name FROM roles WHERE id = ?', [roleId])
    return rows[0] || null
  }

  async listModuleIds(connection, supportsModuleIsActive) {
    const [rows] = await connection.execute(
      `SELECT id, \`key\` FROM modules ${supportsModuleIsActive ? 'WHERE is_active = 1' : ''}`
    )
    return rows
  }

  async replaceRoleMenuPermissions(connection, roleId, permissions, moduleIdMap, schema) {
    await connection.execute(
      'DELETE FROM role_permissions WHERE role_id = ? AND permission_type = ?',
      [roleId, 'menu_view']
    )
    if (permissions.length === 0) return

    const columns = ['role_id', 'module_key']
    if (schema.rolePermissionModuleId) columns.push('module_id')
    columns.push('permission_type')
    if (schema.rolePermissionMenuVisible) columns.push('menu_visible')
    const placeholders = permissions.map(() => `(${columns.map(() => '?').join(', ')}${schema.rolePermissionCreatedAt ? ', NOW()' : ''})`).join(', ')
    const values = permissions.flatMap(permission => {
      const row = [roleId, permission.module_key]
      if (schema.rolePermissionModuleId) row.push(moduleIdMap.get(permission.module_key) || null)
      row.push('menu_view')
      if (schema.rolePermissionMenuVisible) row.push(permission.menu_visible)
      return row
    })
    await connection.execute(
      `INSERT INTO role_permissions (${columns.join(', ')}${schema.rolePermissionCreatedAt ? ', created_at' : ''}) VALUES ${placeholders}`,
      values
    )
  }

  async replaceMenuVisibility(connection, roleId, permissions, schema) {
    await connection.execute('DELETE FROM role_menu_visibility WHERE role_id = ?', [roleId])
    if (permissions.length === 0) return
    const placeholders = permissions.map(() => ` (?, ?, ?${schema.visibilityCreatedAt ? ', NOW()' : ''}${schema.visibilityUpdatedAt ? ', NOW()' : ''})`).join(',')
    const values = permissions.flatMap(permission => [roleId, permission.module_key, permission.menu_visible])
    await connection.execute(
      `INSERT INTO role_menu_visibility (role_id, module_key, visible${schema.visibilityCreatedAt ? ', created_at' : ''}${schema.visibilityUpdatedAt ? ', updated_at' : ''}) VALUES${placeholders}`,
      values
    )
  }
}

module.exports = PermissionMenuUpdateRepository
