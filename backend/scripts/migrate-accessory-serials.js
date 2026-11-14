'use strict'

const fs = require('node:fs/promises')
const path = require('node:path')

const TABLE_SQL = {
  accessory_serials: `CREATE TABLE accessory_serials (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    accessory_id BIGINT NOT NULL, serial_number VARCHAR(100) NOT NULL,
    store_id BIGINT NOT NULL, stock_in_id BIGINT NOT NULL, sale_id BIGINT NULL,
    purchase_cost DECIMAL(10,2) NOT NULL, status VARCHAR(16) NOT NULL DEFAULT 'in_stock',
    created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL,
    UNIQUE KEY uq_accessory_serial_number (serial_number),
    KEY idx_accessory_serial_stock (accessory_id, store_id, status, id),
    KEY idx_accessory_serial_entry (stock_in_id), KEY idx_accessory_serial_sale (sale_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`,
  accessory_serial_events: `CREATE TABLE accessory_serial_events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    serial_id BIGINT UNSIGNED NOT NULL, event_type VARCHAR(16) NOT NULL,
    stock_in_id BIGINT NULL, sale_id BIGINT NULL, store_id BIGINT NOT NULL,
    operator_id BIGINT NOT NULL, operator_name VARCHAR(100) NULL, created_at DATETIME NOT NULL,
    KEY idx_accessory_serial_event (serial_id, id),
    UNIQUE KEY uq_accessory_serial_event (serial_id, event_type, stock_in_id, sale_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`
}

async function inspect(db) {
  const [columns] = await db.query(`SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
    FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME IN ('accessories', 'accessory_sales', 'accessory_serials', 'accessory_serial_events')`)
  for (const table of ['accessories', 'accessory_sales']) {
    if (!columns.some(column => column.TABLE_NAME === table && column.COLUMN_NAME === 'id')) throw new Error(`缺少 ${table} 表，拒绝迁移`)
  }
  const tracking = columns.find(column => column.TABLE_NAME === 'accessories' && column.COLUMN_NAME === 'serial_tracking')
  if (tracking && (!/^tinyint(?:\(1\))?$/.test(tracking.COLUMN_TYPE) || tracking.IS_NULLABLE !== 'NO' || String(tracking.COLUMN_DEFAULT) !== '0')) throw new Error('SN 管理字段结构冲突')
  const saleType = columns.find(column => column.TABLE_NAME === 'accessory_sales' && column.COLUMN_NAME === 'sale_type')
  if (saleType && (saleType.COLUMN_TYPE !== 'varchar(10)' || saleType.IS_NULLABLE !== 'NO' || saleType.COLUMN_DEFAULT !== 'sale')) throw new Error('出库类型字段结构冲突')
  const tables = {}
  for (const table of Object.keys(TABLE_SQL)) {
    const present = columns.filter(column => column.TABLE_NAME === table)
    tables[table] = present.length > 0
    if (present.length) {
      const required = table === 'accessory_serials'
        ? ['id', 'accessory_id', 'serial_number', 'store_id', 'stock_in_id', 'sale_id', 'purchase_cost', 'status', 'created_at', 'updated_at']
        : ['id', 'serial_id', 'event_type', 'stock_in_id', 'sale_id', 'store_id', 'operator_id', 'operator_name', 'created_at']
      if (required.some(name => !present.some(column => column.COLUMN_NAME === name))) throw new Error(`${table} 结构不完整，拒绝覆盖`)
    }
  }
  if (tables.accessory_serials) {
    const [indexes] = await db.query(`SELECT COLUMN_NAME, NON_UNIQUE FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'accessory_serials' AND INDEX_NAME = 'uq_accessory_serial_number'`)
    if (indexes.length !== 1 || indexes[0].COLUMN_NAME !== 'serial_number' || Number(indexes[0].NON_UNIQUE) !== 0) throw new Error('SN 唯一索引结构冲突')
  }
  return { tracking: Boolean(tracking), saleType: Boolean(saleType), tables }
}

async function migrate(db, { apply = false, rollback = false, backupFile } = {}) {
  const state = await inspect(db)
  const changes = rollback
    ? [...Object.keys(TABLE_SQL).reverse().filter(table => state.tables[table]).map(table => `DROP TABLE ${table}`),
      ...(state.saleType ? ['ALTER TABLE accessory_sales DROP COLUMN sale_type'] : []),
      ...(state.tracking ? ['ALTER TABLE accessories DROP COLUMN serial_tracking'] : [])]
    : [...(!state.tracking ? ['ALTER TABLE accessories ADD COLUMN serial_tracking TINYINT(1) NOT NULL DEFAULT 0'] : []),
      ...(!state.saleType ? ["ALTER TABLE accessory_sales ADD COLUMN sale_type VARCHAR(10) NOT NULL DEFAULT 'sale'"] : []),
      ...Object.entries(TABLE_SQL).filter(([table]) => !state.tables[table]).map(([, sql]) => sql)]
  if (!changes.length) return { status: 'already_ready', writes: false }
  if (rollback) {
    for (const table of Object.keys(TABLE_SQL).filter(table => state.tables[table])) {
      const [[row]] = await db.query(`SELECT COUNT(*) AS count FROM ${table}`)
      if (Number(row.count)) throw new Error('已存在 SN 或追踪记录，拒绝删除；保留结构回退应用')
    }
    if (state.tracking) {
      const [[row]] = await db.query('SELECT COUNT(*) AS count FROM accessories WHERE serial_tracking <> 0')
      if (Number(row.count)) throw new Error('已有启用 SN 的模板，拒绝回退字段')
    }
    if (state.saleType) {
      const [[row]] = await db.query("SELECT COUNT(*) AS count FROM accessory_sales WHERE sale_type <> 'sale'")
      if (Number(row.count)) throw new Error('已有赠送单，拒绝回退出库类型')
    }
  }
  if (!apply) return { status: 'dry_run', writes: false, rollback, changes }
  if (!backupFile) throw new Error('执行需要 --backup-file，迁移前自动保存结构及原数据')
  const backup = {}
  for (const table of ['accessories', 'accessory_stock', 'accessory_stock_in', 'accessory_sales']) {
    const [schema] = await db.query(`SHOW CREATE TABLE ${table}`)
    const [rows] = await db.query(`SELECT * FROM ${table} ORDER BY id`)
    backup[table] = { schema, rows }
  }
  const filename = path.resolve(backupFile)
  await fs.mkdir(path.dirname(filename), { recursive: true, mode: 0o700 })
  await fs.writeFile(filename, JSON.stringify(backup, null, 2), { flag: 'wx', mode: 0o600 })
  for (const sql of changes) await db.query(sql)
  const after = await inspect(db)
  if (after.tracking === rollback || after.saleType === rollback || Object.values(after.tables).some(exists => exists === rollback)) throw new Error('迁移后结构核验失败')
  for (const [table, snapshot] of Object.entries(backup)) {
    const [rows] = await db.query(`SELECT * FROM ${table} ORDER BY id`)
    const originalRows = new Map(snapshot.rows.map(row => [String(row.id), row]))
    const comparable = rows.map(row => Object.fromEntries(Object.entries(row).filter(([key]) =>
      Object.hasOwn(originalRows.get(String(row.id)) || {}, key) && key !== 'serial_tracking' && key !== 'sale_type')))
    const original = snapshot.rows.map(({ serial_tracking: _tracking, sale_type: _saleType, ...row }) => row)
    if (JSON.stringify(comparable) !== JSON.stringify(original)) throw new Error('历史业务数据核验失败，请保留备份排查并发变更')
  }
  return { status: 'migrated_and_verified', writes: true, rollback, backupFile: filename, originalDataUnchanged: true }
}

async function main() {
  const { db: config } = require('../src/config')
  const db = await require('mysql2/promise').createConnection({ ...config, connectTimeout: 15000 })
  try {
    console.log(JSON.stringify(await migrate(db, { apply: process.argv.includes('--apply'), rollback: process.argv.includes('--rollback'),
      backupFile: process.argv.find(value => value.startsWith('--backup-file='))?.slice('--backup-file='.length) }), null, 2))
  } finally { await db.end() }
}
if (require.main === module) main().catch(error => {
  console.error(JSON.stringify({ status: 'failed', code: error.code || 'ACCESSORY_SERIAL_MIGRATION_ERROR', message: error.code ? '数据库或备份操作失败' : error.message }))
  process.exitCode = 1
})
module.exports = { inspect, migrate }
