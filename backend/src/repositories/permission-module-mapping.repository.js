'use strict'

const { getDatabase } = require('../config/database')

class PermissionModuleMappingRepository {
  constructor({ database = getDatabase } = {}) {
    this.database = database
  }

  async list({ supportsModuleIsActive }) {
    const activeModuleClause = supportsModuleIsActive ? 'WHERE m.is_active = 1' : ''
    const [rows] = await this.database().execute(`
      SELECT DISTINCT
        m.\`key\` as module_key,
        m.\`key\` as \`key\`,
        m.name as name,
        m.category,
        m.icon,
        0 as field_count
      FROM modules m
      ${activeModuleClause}
      ORDER BY m.category, m.sort_order, m.name
    `)
    return rows
  }
}

module.exports = PermissionModuleMappingRepository
