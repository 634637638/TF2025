const { getDatabase } = require('../config/database')

const FIELD_PERMISSION_TABLES = Object.freeze([
  'field_definitions',
  'module_field_mappings',
  'role_field_permissions',
  'field_scan_logs',
  'field_config_snapshots'
])

class DatabaseStatusRepository {
  constructor(database = null) {
    this.database = database
  }

  async getStatus() {
    const database = this.database || getDatabase()
    await database.execute('SELECT 1')

    const [tables] = await database.execute('SHOW TABLES')
    const tableStatus = {}

    for (const tableName of FIELD_PERMISSION_TABLES) {
      try {
        const [count] = await database.execute(`SELECT COUNT(*) as count FROM ${tableName}`)
        tableStatus[tableName] = {
          exists: true,
          count: count[0].count
        }
      } catch (error) {
        tableStatus[tableName] = {
          exists: false,
          count: 0,
          error: error.message
        }
      }
    }

    return {
      connected: true,
      totalTables: tables.map(row => Object.values(row)[0]).length,
      fieldTables: tableStatus
    }
  }
}

module.exports = DatabaseStatusRepository
