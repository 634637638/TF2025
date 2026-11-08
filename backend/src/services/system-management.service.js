'use strict'

const fs = require('fs')
const path = require('path')
const log = require('../utils/log')
const SystemManagementRepository = require('../repositories/system-management.repository')

class SystemManagementService {
  constructor({ database, repository = new SystemManagementRepository(database), logger = log } = {}) {
    this.repository = repository
    this.logger = logger
  }

  async verifyTables() {
    try {
      const result = await this.repository.verifyTables()
      return { ...result, allTablesExist: result.tables.length >= 4 }
    } catch (error) {
      this.logger.error('验证失败:', error)
      return { tables: [], moduleCount: 0, permissionCount: 0, allTablesExist: false, error: error.message }
    }
  }

  async initialize() {
    const sqlFile = path.join(__dirname, '../migrations/create_module_management_tables.sql')
    if (!fs.existsSync(sqlFile)) return null
    const statements = fs.readFileSync(sqlFile, 'utf8').split(';')
      .map(statement => statement.trim())
      .filter(statement => statement.length > 0 && !statement.startsWith('--') && !statement.startsWith('CREATE'))
    let successCount = 0
    let errorCount = 0
    const errors = []
    await this.repository.withConnection(async connection => {
      for (let i = 0; i < statements.length; i++) {
        try {
          await this.repository.executeInitialization(connection, statements[i])
          successCount++
        } catch (error) {
          this.logger.error(`语句 ${i + 1} 执行失败:`, error.message)
          errorCount++
          errors.push({ statement: i + 1, error: error.message, sql: statements[i].substring(0, 100) + '...' })
        }
      }
    })
    return { successCount, errorCount, errors, verification: await this.verifyTables() }
  }
}

module.exports = SystemManagementService
