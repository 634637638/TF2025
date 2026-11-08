'use strict'

const { getDatabase } = require('../config/database')
const { withConnection } = require('../core/db/connection')

class SystemManagementRepository {
  constructor(database = getDatabase) { this.database = database }

  withConnection(operation) { return withConnection(this.database, operation) }

  async verifyTables() {
    return this.withConnection(async connection => {
      const [tables] = await connection.execute(`
        SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN ('modules', 'role_permissions', 'roles', 'module_sync_log')
      `)
      const [moduleCount] = await connection.execute('SELECT COUNT(*) as count FROM modules WHERE is_active = 1')
      const [permissionCount] = await connection.execute('SELECT COUNT(*) as count FROM role_permissions')
      return { tables: tables.map(table => table.TABLE_NAME), moduleCount: moduleCount[0].count, permissionCount: permissionCount[0].count }
    })
  }

  executeInitialization(connection, statement) { return connection.execute(statement) }
}

module.exports = SystemManagementRepository
