'use strict'
const fs = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')
const definitions = {
  id: 'bigint unsigned', accessory_id: 'bigint', store_id: 'bigint', stock_in_id: 'bigint', purchase_cost: 'decimal(10,2)',
  usage_type: "enum('sale','gift','unclassified')", serial_tracking: 'tinyint unsigned',
  event_type: "enum('stock_in','legacy_opening','transfer_out','transfer_in','sale','gift')", quantity_delta: 'int',
  transfer_id: 'bigint unsigned', sale_id: 'bigint', operator_id: 'bigint', operator_name: 'varchar(100)', remarks: 'varchar(1000)', created_at: 'datetime'
}
const returnEventType = `${definitions.event_type.slice(0, -1)},'sale_return','gift_return')`
const correctionEventTypes = [definitions.event_type, returnEventType].map(type => `${type.slice(0, -1)},'stock_correct')`)
const nullable = new Set(['stock_in_id', 'purchase_cost', 'transfer_id', 'sale_id', 'operator_name', 'remarks'])
const indexes = { PRIMARY: ['id'], idx_accessory_event_stock: ['accessory_id', 'store_id', 'id'], idx_accessory_event_purchase: ['stock_in_id', 'id'], idx_accessory_event_sale: ['sale_id', 'id'], idx_accessory_event_transfer: ['transfer_id', 'id'] }
const DDL = `CREATE TABLE accessory_inventory_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  accessory_id BIGINT NOT NULL, store_id BIGINT NOT NULL, stock_in_id BIGINT NULL, purchase_cost DECIMAL(10,2) NULL,
  usage_type ENUM('sale','gift','unclassified') NOT NULL, serial_tracking TINYINT UNSIGNED NOT NULL,
  event_type ENUM('stock_in','legacy_opening','transfer_out','transfer_in','sale','gift') NOT NULL,
  quantity_delta INT NOT NULL, transfer_id BIGINT UNSIGNED NULL, sale_id BIGINT NULL,
  operator_id BIGINT NOT NULL, operator_name VARCHAR(100) NULL, remarks VARCHAR(1000) NULL, created_at DATETIME NOT NULL,
  KEY idx_accessory_event_stock (accessory_id, store_id, id), KEY idx_accessory_event_purchase (stock_in_id, id),
  KEY idx_accessory_event_sale (sale_id, id), KEY idx_accessory_event_transfer (transfer_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
const originals = ['accessories', 'accessory_stock', 'accessory_stock_in', 'accessory_sales', 'accessory_serials', 'accessory_serial_events', 'accessory_transfers', 'accessory_purchase_payments']
const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')
async function inspect(db) {
  const [tables] = await db.query("SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'accessory_inventory_events'")
  if (!tables.length) return false
  if (tables[0].ENGINE !== 'InnoDB') throw new Error('库存流水表引擎冲突，拒绝覆盖')
  const [columns] = await db.query("SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'accessory_inventory_events'")
  for (const [name, type] of Object.entries(definitions)) {
    const field = columns.find(row => row.COLUMN_NAME === name)
    const actual = field?.COLUMN_TYPE.replace(/(?:bigint|tinyint|int)\(\d+\)/g, value => value.slice(0, value.indexOf('(')))
    if (!field || actual !== type && !(name === 'event_type' && [returnEventType, ...correctionEventTypes].includes(actual)) || field.IS_NULLABLE !== (nullable.has(name) ? 'YES' : 'NO')) throw new Error(`库存流水字段结构冲突：${name}`)
  }
  const [entries] = await db.query("SELECT INDEX_NAME, COLUMN_NAME, NON_UNIQUE, SEQ_IN_INDEX FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'accessory_inventory_events' ORDER BY INDEX_NAME, SEQ_IN_INDEX")
  for (const [name, names] of Object.entries(indexes)) {
    const rows = entries.filter(row => row.INDEX_NAME === name)
    if (rows.length !== names.length || rows.some((row, index) => row.COLUMN_NAME !== names[index] || Number(row.NON_UNIQUE) !== (name === 'PRIMARY' ? 0 : 1))) throw new Error('库存流水索引结构冲突')
  }
  return true
}
async function migrate(db, { apply = false, rollback = false, backupFile } = {}) {
  const exists = await inspect(db)
  if (exists === !rollback) return { status: 'already_ready', writes: false }
  if (rollback) {
    const [[row]] = await db.query('SELECT COUNT(*) AS count FROM accessory_inventory_events')
    if (Number(row.count)) throw new Error('已有库存流水，拒绝删除采购及成本追溯事实')
  }
  const sql = rollback ? 'DROP TABLE accessory_inventory_events' : DDL
  if (!apply) return { status: 'dry_run', writes: false, sql }
  if (!backupFile) throw new Error('执行必须提供 --backup-file')
  const backup = {}
  for (const table of originals) {
    const [[schema]] = await db.query(`SHOW CREATE TABLE ${table}`)
    const [rows] = await db.query(`SELECT * FROM ${table} ORDER BY id`)
    backup[table] = { schema, count: rows.length, digest: digest(rows) }
  }
  const filename = path.resolve(backupFile)
  await fs.mkdir(path.dirname(filename), { recursive: true, mode: 0o700 })
  await fs.writeFile(filename, JSON.stringify(backup, null, 2), { flag: 'wx', mode: 0o600 })
  await db.query(sql)
  if (await inspect(db) !== !rollback) throw new Error('库存流水迁移结构核验失败')
  for (const table of originals) {
    const [rows] = await db.query(`SELECT * FROM ${table} ORDER BY id`)
    if (digest(rows) !== backup[table].digest) throw new Error('原业务数据变化，请保留备份核对并发写入')
  }
  return { status: 'migrated_and_verified', writes: true, originalDataUnchanged: true, rollback }
}
async function main() {
  const { db: config } = require('../src/config')
  const db = await require('mysql2/promise').createConnection({ ...config, connectTimeout: 15000 })
  try { console.log(JSON.stringify(await migrate(db, { apply: process.argv.includes('--apply'), rollback: process.argv.includes('--rollback'), backupFile: process.argv.find(arg => arg.startsWith('--backup-file='))?.slice(14) }))) }
  finally { await db.end() }
}
if (require.main === module) main().catch(error => { console.error({ status: 'failed', code: error.code || 'ACCESSORY_INVENTORY_MIGRATION_ERROR', message: error.code ? '数据库或备份操作失败' : error.message }); process.exitCode = 1 })
module.exports = { migrate, inspect, definitions, nullable, indexes, returnEventType, correctionEventTypes }
