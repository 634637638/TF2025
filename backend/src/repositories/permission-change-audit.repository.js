'use strict'

class PermissionChangeAuditRepository {
  async getModuleNames(database, moduleKeys) {
    if (moduleKeys.length === 0) return []
    const placeholders = moduleKeys.map(() => '?').join(',')
    const [rows] = await database.execute(
      `SELECT \`key\`, name FROM modules WHERE \`key\` IN (${placeholders})`,
      moduleKeys
    )
    return rows
  }
}

module.exports = PermissionChangeAuditRepository
