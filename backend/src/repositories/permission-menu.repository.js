'use strict'

class PermissionMenuRepository {
  async listModules(database, supportsModuleIsActive) {
    const activeModuleClause = supportsModuleIsActive ? 'WHERE m.is_active = 1' : ''
    const [modules] = await database.execute(`
      SELECT
        m.\`key\` AS module_key,
        m.name AS module_name,
        m.category,
        m.icon,
        m.description AS module_description
      FROM modules m
      ${activeModuleClause}
      ORDER BY m.category, m.sort_order, m.name
    `)
    return modules
  }
}

module.exports = PermissionMenuRepository
