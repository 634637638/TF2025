'use strict'

const { hasColumn } = require('../utils/schema-inspector')

const SINGLE_FIELD_COLUMNS = ['field_key', 'can_view', 'can_edit', 'is_hidden', 'permission_level']

class UserFieldPermissionsRepository {
  constructor({ columnExists = hasColumn } = {}) {
    this.columnExists = columnExists
  }

  async getFieldConfigProjection(database) {
    const available = await Promise.all(SINGLE_FIELD_COLUMNS.map(async column =>
      await this.columnExists('role_field_permissions', column, database) ? column : null))
    return ['role_id', 'module_key', 'field_config', 'field_config IS NULL AS field_config_is_null', ...available.filter(Boolean)].join(', ')
  }

  async listRoleFieldPermissions(database, roleIds, moduleKey) {
    if (roleIds.length === 0) return []
    const placeholders = roleIds.map(() => '?').join(',')
    const projection = await this.getFieldConfigProjection(database)
    const [rows] = await database.execute(`
      SELECT ${projection}
      FROM role_field_permissions
      WHERE role_id IN (${placeholders})
      ${moduleKey ? 'AND module_key = ?' : ''}
      ORDER BY module_key
    `, moduleKey ? [...roleIds, moduleKey] : roleIds)
    return rows
  }
}

module.exports = UserFieldPermissionsRepository
