'use strict'

const { getDatabase } = require('../config/database')

class PermissionListRepository {
  constructor({ database = getDatabase } = {}) {
    this.database = database
  }

  async list({ supportsModuleIsActive, supportsRolePermissionCreatedAt }) {
    const createdAtColumn = supportsRolePermissionCreatedAt ? 'rp.created_at,' : 'NULL as created_at,'
    const activeModuleClause = supportsModuleIsActive ? 'WHERE m.is_active = 1' : ''
    const [rows] = await this.database().execute(`
      SELECT DISTINCT
        rp.permission_type,
        rp.module_key,
        m.name as module_name,
        m.description as module_description,
        m.category as module_category,
        m.icon as module_icon,
        ${createdAtColumn}
        rp.permission_type as description
      FROM role_permissions rp
      JOIN modules m ON rp.module_key = m.\`key\` COLLATE utf8mb4_unicode_ci
      ${activeModuleClause}
      ORDER BY m.category, m.sort_order, rp.module_key, rp.permission_type
    `)
    return rows
  }
}

module.exports = PermissionListRepository
