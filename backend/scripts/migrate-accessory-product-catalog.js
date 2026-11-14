'use strict'

const TABLES = ['accessory_categories', 'accessory_units', 'accessory_compatible_models']
const COLUMNS = ['category_id', 'unit_id']
const DEFAULT_UNITS = ['个', '套', '盒', '张', '条']

async function inspect(db) {
  const [tables] = await db.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (?, ?, ?)`, TABLES
  )
  const [columns] = await db.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'accessories' AND COLUMN_NAME IN (?, ?)`, COLUMNS
  )
  const tableNames = new Set(tables.map(row => row.TABLE_NAME))
  const columnNames = new Set(columns.map(row => row.COLUMN_NAME))
  const hasAccessoryTable = (await db.query(
    'SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1', ['accessories']
  ))[0].length > 0
  if (!hasAccessoryTable) throw new Error('缺少 accessories 表，拒绝执行迁移')
  return {
    tables: Object.fromEntries(TABLES.map(name => [name, tableNames.has(name)])),
    columns: Object.fromEntries(COLUMNS.map(name => [name, columnNames.has(name)]))
  }
}

async function migrate(db, { apply = false, backupConfirmed = false } = {}) {
  const before = await inspect(db)
  const changes = [
    'CREATE TABLE accessory_categories (id, name, status, sort_order, description, created_at, updated_at)',
    'CREATE TABLE accessory_units (id, name, status, sort_order, created_at, updated_at)',
    'CREATE TABLE accessory_compatible_models (accessory_id, model_id)',
    'ALTER TABLE accessories ADD COLUMN category_id INT NULL, unit_id INT NULL',
    'Seed existing exact category/unit values and model_id compatibility links'
  ]
  const complete = TABLES.every(name => before.tables[name]) && COLUMNS.every(name => before.columns[name])
  if (complete) return { status: 'already_ready', writes: false }
  if (!apply) return { status: 'dry_run', changes, writes: false, existing: before }
  if (!backupConfirmed) throw new Error('执行前须确认目标环境、现有备份并传入 --backup-confirmed')

  await db.query(`CREATE TABLE IF NOT EXISTS accessory_categories (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    status TINYINT NOT NULL DEFAULT 1,
    sort_order INT NOT NULL DEFAULT 0,
    description VARCHAR(500) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_accessory_categories_name (name),
    KEY idx_accessory_categories_status_order (status, sort_order, id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`)
  await db.query(`CREATE TABLE IF NOT EXISTS accessory_units (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(32) NOT NULL,
    status TINYINT NOT NULL DEFAULT 1,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_accessory_units_name (name),
    KEY idx_accessory_units_status_order (status, sort_order, id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`)
  await db.query(`CREATE TABLE IF NOT EXISTS accessory_compatible_models (
    accessory_id INT NOT NULL,
    model_id INT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (accessory_id, model_id),
    KEY idx_accessory_compatible_models_model (model_id, accessory_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)

  const afterTables = await inspect(db)
  if (!afterTables.columns.category_id) await db.query('ALTER TABLE accessories ADD COLUMN category_id INT NULL')
  if (!afterTables.columns.unit_id) await db.query('ALTER TABLE accessories ADD COLUMN unit_id INT NULL')

  for (const unit of DEFAULT_UNITS) {
    await db.query('INSERT IGNORE INTO accessory_units (name, sort_order) VALUES (?, ?)', [unit, DEFAULT_UNITS.indexOf(unit) * 10])
  }
  await db.query(`INSERT IGNORE INTO accessory_categories (name, sort_order)
    SELECT DISTINCT category, 100 FROM accessories
    WHERE category IS NOT NULL AND category <> ''`)
  await db.query(`INSERT IGNORE INTO accessory_units (name, sort_order)
    SELECT DISTINCT unit, 200 FROM accessories WHERE unit IS NOT NULL AND unit <> ''`)
  await db.query(`UPDATE accessories a JOIN accessory_categories c ON BINARY c.name = BINARY a.category
    SET a.category_id = c.id, a.updated_at = a.updated_at WHERE a.category_id IS NULL`)
  await db.query(`UPDATE accessories a JOIN accessory_units u ON BINARY u.name = BINARY a.unit
    SET a.unit_id = u.id, a.updated_at = a.updated_at WHERE a.unit_id IS NULL`)
  await db.query(`INSERT IGNORE INTO accessory_compatible_models (accessory_id, model_id)
    SELECT id, model_id FROM accessories WHERE model_id IS NOT NULL`)

  const after = await inspect(db)
  if (!TABLES.every(name => after.tables[name]) || !COLUMNS.every(name => after.columns[name])) {
    throw new Error('迁移后结构核验失败')
  }
  const [[unlinked]] = await db.query(`SELECT COUNT(*) AS count FROM accessories
    WHERE (category IS NOT NULL AND category <> '' AND category_id IS NULL)
       OR (unit IS NOT NULL AND unit <> '' AND unit_id IS NULL)`)
  if (Number(unlinked.count) > 0) throw new Error('存在未关联的历史分类或单位，迁移未通过核验')
  return { status: 'migrated_and_verified', changes, writes: true }
}

async function main() {
  const envArg = process.argv.find(argument => argument.startsWith('--env-file='))
  if (envArg) process.env.ENV_FILE = envArg.slice('--env-file='.length)
  const { db: dbConfig } = require('../src/config')
  const db = await require('mysql2/promise').createConnection({ ...dbConfig, connectTimeout: 15000 })
  try {
    const result = await migrate(db, {
      apply: process.argv.includes('--apply'),
      backupConfirmed: process.argv.includes('--backup-confirmed')
    })
    console.log(JSON.stringify(result, null, 2))
  } finally {
    await db.end()
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(JSON.stringify({ status: 'failed', code: error.code || 'ACCESSORY_CATALOG_MIGRATION_ERROR', message: error.code ? '数据库操作失败' : error.message }))
    process.exitCode = 1
  })
}

module.exports = { inspect, migrate }
