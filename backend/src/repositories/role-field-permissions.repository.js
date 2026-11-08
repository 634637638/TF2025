'use strict'

class RoleFieldPermissionsRepository {
  async findRoleForWrite(connection, roleId, supportsRoleIsActive, includeName = false) {
    const nameColumn = includeName ? ', name' : ''
    const [rows] = await connection.execute(
      `SELECT id${nameColumn} FROM roles WHERE id = ? ${supportsRoleIsActive ? 'AND is_active = 1' : ''}`,
      [roleId]
    )
    return rows[0] || null
  }

  async findModuleForWrite(connection, moduleKey, supportsModuleIsActive, includeName = false) {
    const nameColumn = includeName ? ', name' : ''
    const [rows] = await connection.execute(
      `SELECT \`key\`${nameColumn} FROM modules WHERE \`key\` = ? ${supportsModuleIsActive ? 'AND is_active = 1' : ''}`,
      [moduleKey]
    )
    return rows[0] || null
  }

  async findExistingFieldPermission(connection, roleId, moduleKey, includeConfig = false) {
    const configColumn = includeConfig ? ', field_config' : ''
    const [rows] = await connection.execute(
      `SELECT id${configColumn} FROM role_field_permissions WHERE role_id = ? AND module_key = ?`,
      [roleId, moduleKey]
    )
    return rows[0] || null
  }

  async updateFieldPermission(connection, roleId, moduleKey, fieldConfig) {
    await connection.execute(`
      UPDATE role_field_permissions
      SET field_config = ?, updated_at = NOW()
      WHERE role_id = ? AND module_key = ?
    `, [fieldConfig, roleId, moduleKey])
  }

  async insertFieldPermission(connection, roleId, moduleKey, fieldConfig) {
    await connection.execute(`
      INSERT INTO role_field_permissions (role_id, module_key, field_config, created_at, updated_at)
      VALUES (?, ?, ?, NOW(), NOW())
    `, [roleId, moduleKey, fieldConfig])
  }

  async findRole(database, roleId, supportsRoleIsActive) {
    const [roles] = await database.execute(
      `SELECT id, name FROM roles WHERE id = ? ${supportsRoleIsActive ? 'AND is_active = 1' : ''}`,
      [roleId]
    )
    return roles[0] || null
  }

  async listFieldPermissions(database, roleId, moduleKey) {
    const [rows] = await database.execute(`
      SELECT
        rfp.module_key,
        rfp.field_config,
        rfp.created_at,
        rfp.updated_at
      FROM role_field_permissions rfp
      WHERE rfp.role_id = ?
      ${moduleKey ? 'AND rfp.module_key = ?' : ''}
      ORDER BY rfp.module_key
    `, moduleKey ? [roleId, moduleKey] : [roleId])
    return rows
  }
}

module.exports = RoleFieldPermissionsRepository
