'use strict'

const fs = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')
const definitions = {
  id: 'bigint unsigned', stock_in_id: 'bigint', supplier_id: 'bigint',
  action: "enum('pay','cancel')", amount: 'decimal(12,2)', reference_event_id: 'bigint unsigned',
  request_key: 'char(32)', request_hash: 'char(64)', payment_method: 'varchar(32)',
  payment_time: 'datetime', remarks: 'varchar(1000)', operator_id: 'bigint',
  operator_name: 'varchar(100)', created_at: 'datetime'
}
const DDL = `CREATE TABLE accessory_purchase_payments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  stock_in_id BIGINT NOT NULL, supplier_id BIGINT NOT NULL,
  action ENUM('pay','cancel') NOT NULL, amount DECIMAL(12,2) NOT NULL,
  reference_event_id BIGINT UNSIGNED NULL,
  request_key CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  request_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  payment_method VARCHAR(32) NOT NULL, payment_time DATETIME NOT NULL,
  remarks VARCHAR(1000) NOT NULL, operator_id BIGINT NOT NULL,
  operator_name VARCHAR(100) NOT NULL, created_at DATETIME NOT NULL,
  UNIQUE KEY uq_accessory_purchase_payment_request (request_key),
  KEY idx_accessory_purchase_payment_order (stock_in_id, id),
  KEY idx_accessory_purchase_payment_supplier (supplier_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
const originals = ['accessories', 'accessory_stock', 'accessory_stock_in', 'accessory_sales', 'accessory_serials', 'accessory_serial_events', 'accessory_transfers']
const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')
async function inspect(db) {
  const [tables] = await db.query("SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'accessory_purchase_payments'")
  if (!tables.length) return false
  if (tables[0].ENGINE !== 'InnoDB') throw new Error('采购打款表引擎冲突，拒绝覆盖')
  const [columns] = await db.query("SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'accessory_purchase_payments'")
  for (const [name, type] of Object.entries(definitions)) {
    const field = columns.find(column => column.COLUMN_NAME === name)
    if (!field || field.COLUMN_TYPE.replace(/bigint\(\d+\)/, 'bigint') !== type || field.IS_NULLABLE !== (name === 'reference_event_id' ? 'YES' : 'NO')) throw new Error(`采购打款字段结构冲突：${name}`)
  }
  const [indexes] = await db.query("SELECT INDEX_NAME, COLUMN_NAME, NON_UNIQUE, SEQ_IN_INDEX FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'accessory_purchase_payments' ORDER BY INDEX_NAME, SEQ_IN_INDEX")
  for (const [name, columns, unique] of [['PRIMARY', ['id'], true], ['uq_accessory_purchase_payment_request', ['request_key'], true], ['idx_accessory_purchase_payment_order', ['stock_in_id', 'id'], false], ['idx_accessory_purchase_payment_supplier', ['supplier_id', 'id'], false]]) {
    const entries = indexes.filter(index => index.INDEX_NAME === name)
    if (entries.length !== columns.length || entries.some((index, offset) => index.COLUMN_NAME !== columns[offset] || Number(index.NON_UNIQUE) !== Number(!unique))) throw new Error('采购打款索引结构冲突')
  }
  return true
}
async function migrate(db, { apply = false, rollback = false, backupFile } = {}) {
  const exists = await inspect(db)
  if (exists === !rollback) return { status: 'already_ready', writes: false }
  if (rollback) {
    const [[row]] = await db.query('SELECT COUNT(*) AS count FROM accessory_purchase_payments')
    if (Number(row.count)) throw new Error('已有采购打款历史，拒绝删除')
  }
  const sql = rollback ? 'DROP TABLE accessory_purchase_payments' : DDL
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
  if (await inspect(db) !== !rollback) throw new Error('采购打款迁移结构核验失败')
  for (const table of originals) {
    const [rows] = await db.query(`SELECT * FROM ${table} ORDER BY id`)
    if (digest(rows) !== backup[table].digest) throw new Error('原业务数据摘要变化，请保留备份并核对并发写入')
  }
  return { status: 'migrated_and_verified', writes: true, originalDataUnchanged: true, rollback }
}
async function main() {
  const { db: config } = require('../src/config')
  const db = await require('mysql2/promise').createConnection({ ...config, connectTimeout: 15000 })
  try { console.log(JSON.stringify(await migrate(db, { apply: process.argv.includes('--apply'), rollback: process.argv.includes('--rollback'), backupFile: process.argv.find(arg => arg.startsWith('--backup-file='))?.slice(14) }))) }
  finally { await db.end() }
}
if (require.main === module) main().catch(error => { console.error({ status: 'failed', code: error.code || 'ACCESSORY_PURCHASE_PAYMENT_MIGRATION_ERROR', message: error.code ? '数据库或备份操作失败' : error.message }); process.exitCode = 1 })
module.exports = { migrate, inspect, definitions }
