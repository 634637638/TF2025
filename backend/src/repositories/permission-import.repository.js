'use strict'

const { getDatabase } = require('../config/database')
const { withConnection } = require('../core/db/connection')

class PermissionImportRepository {
  constructor({ database = getDatabase } = {}) {
    this.database = database
  }

  async withConnection(operation) {
    return withConnection(this.database, operation)
  }

  async findRoleId(connection, roleName, supportsRoleIsActive) {
    const [rows] = await connection.execute(
      `SELECT id FROM roles WHERE name = ? ${supportsRoleIsActive ? 'AND is_active = 1' : ''}`,
      [roleName]
    )
    return rows[0]?.id ?? null
  }

  async deleteRolePermissions(connection, roleId) {
    await connection.execute('DELETE FROM role_permissions WHERE role_id = ?', [roleId])
  }

  async moduleExists(connection, moduleKey, supportsModuleIsActive) {
    const [rows] = await connection.execute(
      `SELECT \`key\` FROM modules WHERE \`key\` = ? ${supportsModuleIsActive ? 'AND is_active = 1' : ''}`,
      [moduleKey]
    )
    return rows.length > 0
  }

  async permissionExists(connection, roleId, moduleKey, permissionType) {
    const [rows] = await connection.execute(
      'SELECT id FROM role_permissions WHERE role_id = ? AND module_key = ? AND permission_type = ?',
      [roleId, moduleKey, permissionType]
    )
    return rows.length > 0
  }

  async insertPermission(connection, roleId, moduleKey, permissionType, supportsCreatedAt) {
    await connection.execute(`
      INSERT INTO role_permissions (role_id, module_key, permission_type${supportsCreatedAt ? ', created_at' : ''})
      VALUES (?, ?, ?${supportsCreatedAt ? ', NOW()' : ''})
    `, [roleId, moduleKey, permissionType])
  }
}

module.exports = PermissionImportRepository
