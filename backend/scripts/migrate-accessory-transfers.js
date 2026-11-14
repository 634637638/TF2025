'use strict'
const fs = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')
const DDL = `CREATE TABLE accessory_transfers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  request_key CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  request_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  accessory_id BIGINT NOT NULL, from_store_id BIGINT NOT NULL, to_store_id BIGINT NOT NULL,
  quantity INT UNSIGNED NOT NULL, serial_numbers JSON NOT NULL,
  operator_id BIGINT NOT NULL, operator_name VARCHAR(100) NULL,
  remarks VARCHAR(500) NULL, created_at DATETIME NOT NULL,
  UNIQUE KEY uq_accessory_transfer_request (request_key),
  KEY idx_accessory_transfer_product (accessory_id, id),
  KEY idx_accessory_transfer_from (from_store_id, id),
  KEY idx_accessory_transfer_to (to_store_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
const originals = ['accessories', 'accessory_stock', 'accessory_stock_in', 'accessory_sales', 'accessory_serials', 'accessory_serial_events']
async function inspect(db) {
  const [tables] = await db.query("SELECT TABLE_NAME, ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'accessory_transfers'")
  if (!tables.length) return false
  if (tables[0].ENGINE !== 'InnoDB') throw new Error('划拨表引擎冲突，拒绝覆盖')
  const [columns] = await db.query("SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'accessory_transfers'")
  const expected = ['id','request_key','request_hash','accessory_id','from_store_id','to_store_id','quantity','serial_numbers','operator_id','operator_name','remarks','created_at']
  if (expected.some(name => !columns.some(column => column.COLUMN_NAME === name))) throw new Error('划拨表结构不完整，拒绝覆盖')
  const json = columns.find(column => column.COLUMN_NAME === 'serial_numbers')
  if (json.COLUMN_TYPE !== 'json' || json.IS_NULLABLE !== 'NO') throw new Error('划拨SN字段结构冲突')
  const [indexes] = await db.query("SELECT COLUMN_NAME, NON_UNIQUE FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'accessory_transfers' AND INDEX_NAME = 'uq_accessory_transfer_request'")
  if (indexes.length !== 1 || indexes[0].COLUMN_NAME !== 'request_key' || Number(indexes[0].NON_UNIQUE) !== 0) throw new Error('划拨幂等索引冲突')
  return true
}
async function migrate(db, { apply = false, rollback = false, backupFile } = {}) {
  const exists = await inspect(db)
  if (exists === !rollback) return { status: 'already_ready', writes: false }
  if (rollback) {
    const [[row]] = await db.query('SELECT COUNT(*) AS count FROM accessory_transfers')
    if (Number(row.count)) throw new Error('已有划拨记录，拒绝删除历史')
  }
  const sql = rollback ? 'DROP TABLE accessory_transfers' : DDL
  if (!apply) return { status: 'dry_run', writes: false, sql }
  if (!backupFile) throw new Error('执行必须提供 --backup-file')
  const backup = {}
  for (const table of originals) {
    const [[schema]] = await db.query(`SHOW CREATE TABLE ${table}`)
    const [rows] = await db.query(`SELECT * FROM ${table} ORDER BY id`)
    backup[table] = { schema, count: rows.length, digest: crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex') }
  }
  const filename = path.resolve(backupFile)
  await fs.mkdir(path.dirname(filename), { recursive: true, mode: 0o700 })
  await fs.writeFile(filename, JSON.stringify(backup, null, 2), { flag: 'wx', mode: 0o600 })
  await db.query(sql)
  if (await inspect(db) !== !rollback) throw new Error('划拨迁移结构核验失败')
  for (const table of originals) {
    const [rows] = await db.query(`SELECT * FROM ${table} ORDER BY id`)
    if (crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex') !== backup[table].digest) throw new Error('原业务数据发生变化，请保留备份核对并发写入')
  }
  return { status: 'migrated_and_verified', writes: true, originalDataUnchanged: true, rollback }
}
async function main() {
  const { db: config } = require('../src/config')
  const db = await require('mysql2/promise').createConnection({ ...config, connectTimeout: 15000 })
  try { console.log(JSON.stringify(await migrate(db, { apply: process.argv.includes('--apply'), rollback: process.argv.includes('--rollback'), backupFile: process.argv.find(arg => arg.startsWith('--backup-file='))?.slice(14) }))) }
  finally { await db.end() }
}
if (require.main === module) main().catch(error => { console.error({ status: 'failed', code: error.code || 'ACCESSORY_TRANSFER_MIGRATION_ERROR', message: error.code ? '数据库或备份操作失败' : error.message }); process.exitCode = 1 })
module.exports = { migrate, inspect }
