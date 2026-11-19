'use strict'

const fs = require('node:fs/promises')
const path = require('node:path')

const DDL = [
  `CREATE TABLE supplier_payment_batches (
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
    request_key CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    request_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    supplier_id BIGINT NOT NULL, expected_amount DECIMAL(12,2) NOT NULL, actual_amount DECIMAL(12,2) NOT NULL,
    payment_method VARCHAR(32) NOT NULL, payment_time DATETIME NOT NULL, external_reference VARCHAR(100) NOT NULL, remarks VARCHAR(1000) NOT NULL,
    operator_id BIGINT NOT NULL, operator_name VARCHAR(100) NOT NULL, status VARCHAR(20) NOT NULL,
    created_at DATETIME NOT NULL, UNIQUE KEY uq_supplier_payment_batch_request (request_key), KEY idx_supplier_payment_batch_supplier (supplier_id, payment_time)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE supplier_payment_batch_lines (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, batch_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    source_type ENUM('phone','accessory') NOT NULL, source_id BIGINT NOT NULL, amount DECIMAL(12,2) NOT NULL,
    UNIQUE KEY uq_supplier_payment_batch_line (batch_id, source_type, source_id), KEY idx_supplier_payment_batch_line_source (source_type, source_id),
    CONSTRAINT fk_supplier_payment_batch_line_batch FOREIGN KEY (batch_id) REFERENCES supplier_payment_batches(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  'ALTER TABLE accessory_purchase_payments ADD COLUMN payment_batch_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER created_at',
  'ALTER TABLE accessory_purchase_payments ADD KEY idx_accessory_purchase_payment_batch (payment_batch_id)',
  'ALTER TABLE accessory_purchase_payments ADD CONSTRAINT fk_accessory_purchase_payment_batch FOREIGN KEY (payment_batch_id) REFERENCES supplier_payment_batches(id)'
]

async function inspect(db) {
  const [tables] = await db.query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('supplier_payment_batches','supplier_payment_batch_lines')")
  const [columns] = await db.query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='accessory_purchase_payments' AND COLUMN_NAME='payment_batch_id'")
  const state = { batches: tables.some(row => row.TABLE_NAME === 'supplier_payment_batches'), lines: tables.some(row => row.TABLE_NAME === 'supplier_payment_batch_lines'), paymentBatchColumn: columns.length > 0 }
  for (const [table, exists, required] of [
    ['supplier_payment_batches', state.batches, ['id', 'request_key', 'request_hash', 'supplier_id', 'expected_amount', 'actual_amount', 'payment_method', 'payment_time', 'external_reference', 'remarks', 'operator_id', 'operator_name', 'status', 'created_at']],
    ['supplier_payment_batch_lines', state.lines, ['id', 'batch_id', 'source_type', 'source_id', 'amount']]
  ]) {
    if (!exists) continue
    const [fields] = await db.query('SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?', [table])
    if (required.some(name => !fields.some(row => row.COLUMN_NAME === name))) throw new Error(`合并打款表结构冲突：${table}`)
  }
  return state
}

async function migrate(db, { apply = false, rollback = false, backupFile } = {}) {
  const state = await inspect(db)
  if (!rollback && state.batches && state.lines && state.paymentBatchColumn) return { status: 'already_ready', writes: false }
  if (rollback && !state.batches && !state.lines && !state.paymentBatchColumn) return { status: 'already_ready', writes: false, rollback: true }
  const rollbackSql = [
    'DROP TABLE IF EXISTS supplier_payment_batch_lines',
    'ALTER TABLE accessory_purchase_payments DROP FOREIGN KEY fk_accessory_purchase_payment_batch',
    'ALTER TABLE accessory_purchase_payments DROP INDEX idx_accessory_purchase_payment_batch',
    'ALTER TABLE accessory_purchase_payments DROP COLUMN payment_batch_id',
    'DROP TABLE IF EXISTS supplier_payment_batches'
  ]
  if (!apply) return { status: 'dry_run', writes: false, rollback, sql: rollback ? rollbackSql : DDL }
  if (!backupFile) throw new Error('执行迁移或回退必须提供 --backup-file')
  const filename = path.resolve(backupFile); await fs.mkdir(path.dirname(filename), { recursive: true, mode: 0o700 }); await fs.writeFile(filename, JSON.stringify({ inspected: state, rollback, created_at: new Date().toISOString() }, null, 2), { flag: 'wx', mode: 0o600 })
  if (rollback) {
    if (state.batches) {
      const [[batchCount]] = await db.query('SELECT COUNT(*) AS count FROM supplier_payment_batches')
      if (Number(batchCount.count)) throw new Error('已有供应商合并打款批次，拒绝回退')
    }
    if (state.lines) {
      const [[lineCount]] = await db.query('SELECT COUNT(*) AS count FROM supplier_payment_batch_lines')
      if (Number(lineCount.count)) throw new Error('已有供应商合并打款明细，拒绝回退')
    }
    if (state.paymentBatchColumn) {
      const [[eventCount]] = await db.query('SELECT COUNT(*) AS count FROM accessory_purchase_payments WHERE payment_batch_id IS NOT NULL')
      if (Number(eventCount.count)) throw new Error('已有商品付款批次引用，拒绝回退')
    }
  }
  for (const sql of rollback ? rollbackSql : DDL) {
    try { await db.query(sql) } catch (error) { if (!/already exists|Duplicate column name|Duplicate key name|Duplicate foreign key|check that column\/key exists/i.test(error.message)) throw error }
  }
  const verified = await inspect(db)
  if (rollback ? (verified.batches || verified.lines || verified.paymentBatchColumn) : (!verified.batches || !verified.lines || !verified.paymentBatchColumn)) throw new Error('供应商合并打款迁移结构核验失败')
  return { status: 'migrated_and_verified', writes: true, rollback }
}

async function main() {
  const { db: config } = require('../src/config'); const mysql = require('mysql2/promise'); const db = await mysql.createConnection({ ...config, connectTimeout: 15000 })
  try { console.log(JSON.stringify(await migrate(db, { apply: process.argv.includes('--apply'), rollback: process.argv.includes('--rollback'), backupFile: process.argv.find(arg => arg.startsWith('--backup-file='))?.slice(14) }))) } finally { await db.end() }
}
if (require.main === module) main().catch(error => { console.error({ status: 'failed', code: error.code || 'SUPPLIER_PAYMENT_BATCH_MIGRATION_ERROR', message: error.code ? '数据库或迁移操作失败' : error.message }); process.exitCode = 1 })
module.exports = { migrate, inspect, DDL }
