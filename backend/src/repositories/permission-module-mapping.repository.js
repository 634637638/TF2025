'use strict'

const { getDatabase } = require('../config/database')

const PermissionMenuRepository = require('./permission-menu.repository')

class PermissionModuleMappingRepository extends PermissionMenuRepository {
  constructor({ database = getDatabase } = {}) {
    super()
    this.database = database
  }

  async listMenuOrder(database = this.database()) {
    return super.listMenuOrder(database)
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
