'use strict'

const { normalizeDatabaseIdentifier } = require('../utils/database-identifier')

class DatabaseSyncManagementRepository {
  listTables(connection) {
    return connection.query('SHOW TABLES')
  }

  columns(connection, tableName) {
    return connection.query(`
          SELECT
            COLUMN_NAME as field,
            DATA_TYPE as type,
            IS_NULLABLE as nullable,
            COLUMN_KEY as column_key,
            COLUMN_DEFAULT as default,
            EXTRA as extra,
            COLUMN_COMMENT as comment
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
          ORDER BY ORDINAL_POSITION
        `, [tableName])
  }

  comment(connection, tableName) {
    return connection.query(`
          SELECT TABLE_COMMENT as comment
          FROM INFORMATION_SCHEMA.TABLES
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
        `, [tableName])
  }

  countTable(connection, tableName) {
    tableName = normalizeDatabaseIdentifier(tableName, '表名')
    return connection.query(`SELECT COUNT(*) as total FROM \`${tableName}\``)
  }

  phones(connection) {
    return connection.query(`
          SELECT p.*,
            b.name as brand_name,
            mo.name as model_name,
            c.name as color_name,
            me.size as memory_size
          FROM phones p
          LEFT JOIN brands b ON p.brand_id = b.id
          LEFT JOIN models mo ON p.model_id = mo.id
          LEFT JOIN colors c ON p.color_id = c.id
          LEFT JOIN memories me ON p.memory_id = me.id
        `)
  }

  activeBrands(connection) {
    return connection.query('SELECT COUNT(*) as total FROM brands WHERE status = 1')
  }

  activeModels(connection) {
    return connection.query('SELECT COUNT(*) as total FROM models WHERE status = 1')
  }

  activeColors(connection) {
    return connection.query('SELECT COUNT(*) as total FROM colors WHERE status = 1')
  }

  activeMemories(connection) {
    return connection.query('SELECT COUNT(*) as total FROM memories WHERE status = 1')
  }

  activeCustomers(connection) {
    return connection.query('SELECT COUNT(*) as total FROM customers WHERE status = 1')
  }
}

module.exports = DatabaseSyncManagementRepository
