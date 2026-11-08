'use strict'

class PermissionBatchRepository {
  async listRolePermissions(connection, roleId) {
    const [rows] = await connection.execute(
      'SELECT module_key, permission_type FROM role_permissions WHERE role_id = ?',
      [roleId]
    )
    return rows
  }

  async deleteRolePermissions(connection, roleId) {
    await connection.execute(
      'DELETE FROM role_permissions WHERE role_id = ?',
      [roleId]
    )
  }

  async copyRolePermissions(connection, roleId, permissions, supportsCreatedAt) {
    const values = permissions.map(permission => [roleId, permission.module_key, permission.permission_type])
    await this.insertRolePermissions(connection, values, supportsCreatedAt)
  }

  async insertRolePermissions(connection, values, supportsCreatedAt) {
    const placeholders = values.map(() => `(?, ?, ?${supportsCreatedAt ? ', NOW()' : ''})`).join(', ')
    const flatValues = values.flat()
    await connection.execute(`
      INSERT INTO role_permissions (role_id, module_key, permission_type${supportsCreatedAt ? ', created_at' : ''})
      VALUES ${placeholders}
    `, flatValues)
  }

  async revokePermission(connection, roleId, permission) {
    await connection.execute(`
      DELETE FROM role_permissions
      WHERE role_id = ? AND module_key = ? AND permission_type = ?
    `, [roleId, permission.module_key, permission.permission_type])
  }
}

module.exports = PermissionBatchRepository
