'use strict'

const { getDatabase } = require('../config/database')

class RolePermissionVisibilityRepository {
  constructor({ database = getDatabase } = {}) {
    this.database = database
  }

  async getVisibility(roleId) {
    const [permissions] = await this.database().execute(`
      SELECT module_key, permission_type, menu_visible
      FROM role_permissions
      WHERE role_id = ? AND menu_visible IS NOT NULL
      ORDER BY module_key, permission_type
    `, [roleId])
    return permissions
  }

  async findPermission(connection, { roleId, moduleKey, permissionType }) {
    const [rows] = await connection.execute(
      'SELECT id FROM role_permissions WHERE role_id = ? AND module_key = ? AND permission_type = ?',
      [roleId, moduleKey, permissionType]
    )
    return rows.length > 0
  }

  async insertPermission(connection, { roleId, moduleKey, permissionType, visible, supportsCreatedAt }) {
    await connection.execute(
      `INSERT INTO role_permissions (role_id, module_key, permission_type, menu_visible${supportsCreatedAt ? ', created_at' : ''}) VALUES (?, ?, ?, ?${supportsCreatedAt ? ', NOW()' : ''})`,
      [roleId, moduleKey, permissionType, visible ? 1 : 0]
    )
  }

  async updatePermissionVisibility(connection, { roleId, moduleKey, permissionType, visible }) {
    await connection.execute(
      'UPDATE role_permissions SET menu_visible = ? WHERE role_id = ? AND module_key = ? AND permission_type = ?',
      [visible ? 1 : 0, roleId, moduleKey, permissionType]
    )
  }
}

module.exports = RolePermissionVisibilityRepository
