'use strict'

const { getDatabase } = require('../config/database')
const { schemaChangesAllowed } = require('./schema-change-policy')

const ensureDataCheckBackupSchema = async (database = getDatabase()) => {
  if (!schemaChangesAllowed()) return

  await database.query(`
    CREATE TABLE IF NOT EXISTS data_check_backups (
      id INT AUTO_INCREMENT PRIMARY KEY,
      table_name VARCHAR(50) NOT NULL,
      operation_type ENUM('merge', 'delete') NOT NULL,
      backup_data JSON NOT NULL,
      created_by VARCHAR(100),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_table (table_name),
      INDEX idx_date (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
}

const assertDataCheckBackupSchema = async (database = getDatabase()) => {
  try {
    await database.query('SELECT 1 FROM data_check_backups LIMIT 0')
  } catch (error) {
    if (error?.code === 'ER_NO_SUCH_TABLE') {
      throw new Error('data_check_backups 表未迁移，请先运行 npm run migrate:schema')
    }
    throw error
  }
}

const prepareDataCheckBackupSchema = async (database = getDatabase()) => {
  await ensureDataCheckBackupSchema(database)
  await assertDataCheckBackupSchema(database)
}

module.exports = {
  assertDataCheckBackupSchema,
  ensureDataCheckBackupSchema,
  prepareDataCheckBackupSchema
}
