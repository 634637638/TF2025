const config = require('../config');
const { getDatabase } = require('../config/database');

const tableCache = new Map();
const columnCache = new Map();

async function hasTable(tableName, executor = null) {
  const cacheKey = `${config.db.database}:${tableName}`;
  if (tableCache.has(cacheKey)) {
    return tableCache.get(cacheKey);
  }

  const db = executor || getDatabase();
  const [rows] = await db.execute(
    `SELECT 1
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME = ?
     LIMIT 1`,
    [config.db.database, tableName]
  );

  const exists = rows.length > 0;
  tableCache.set(cacheKey, exists);
  return exists;
}

async function hasColumn(tableName, columnName, executor = null) {
  const cacheKey = `${config.db.database}:${tableName}:${columnName}`;
  if (columnCache.has(cacheKey)) {
    return columnCache.get(cacheKey);
  }

  const db = executor || getDatabase();
  const [rows] = await db.execute(
    `SELECT 1
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?
     LIMIT 1`,
    [config.db.database, tableName, columnName]
  );

  const exists = rows.length > 0;
  columnCache.set(cacheKey, exists);
  return exists;
}

function clearSchemaInspectorCache() {
  tableCache.clear();
  columnCache.clear();
}

module.exports = {
  hasTable,
  hasColumn,
  clearSchemaInspectorCache
};
