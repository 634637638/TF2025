'use strict'

const { getDatabase } = require('../config/database')

class PermissionExportRepository {
  constructor({ database = getDatabase } = {}) {
    this.database = database
  }

  async getPermissions({ supportsRoleIsActive, supportsModuleIsActive }) {
    const activeFilters = [
      supportsRoleIsActive ? 'r.is_active = 1' : null,
      supportsModuleIsActive ? 'm.is_active = 1' : null
    ].filter(Boolean)
    const whereClause = activeFilters.length ? `WHERE ${activeFilters.join(' AND ')}` : ''
    const [rows] = await this.database().execute(`
      SELECT
        r.name as role_name,
        m.\`key\` as module_key,
        m.name as module_name,
        rp.permission_type
      FROM roles r
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN modules m ON rp.module_key = m.\`key\`
      ${whereClause}
      ORDER BY r.name, m.category, m.sort_order, rp.permission_type
    `)
    return rows
  }
}

module.exports = PermissionExportRepository
