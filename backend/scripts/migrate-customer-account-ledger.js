'use strict'

const fs = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')

const create = `CREATE TABLE customer_account_entries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  kind ENUM('balance','points') NOT NULL,
  delta DECIMAL(14,2) NOT NULL,
  balance_after DECIMAL(14,2) NOT NULL,
  points_after INT UNSIGNED NOT NULL,
  source_type VARCHAR(40) NOT NULL,
  source_id BIGINT UNSIGNED NULL,
  note VARCHAR(500) NOT NULL,
  actor_user_id INT NULL,
  created_at DATETIME NOT NULL,
  KEY idx_customer_account_entries_customer (customer_id, id),
  KEY idx_customer_account_entries_kind (customer_id, kind, id),
  UNIQUE KEY uq_customer_account_source (customer_id, kind, source_type, source_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`

async function migrate (db, { apply = false, backupFile } = {}) {
  const [tables] = await db.query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer_account_entries'")
  const [balances] = await db.query(`SELECT c.id, c.balance FROM customers c
    WHERE c.balance > 0${tables.length ? " AND NOT EXISTS (SELECT 1 FROM customer_account_entries e WHERE e.customer_id = c.id AND e.kind = 'balance' AND e.source_type = 'opening_balance')" : ''} ORDER BY c.id`)
  if (!apply) return { status: tables.length ? 'preview_backfill' : 'dry_run', writes: false,
    sql: tables.length ? [] : [create], customers: balances.length,
    balanceTotalCents: balances.reduce((sum, row) => sum + Math.round(Number(row.balance) * 100), 0) }
  if (!backupFile) throw new Error('执行账户流水迁移必须提供完整数据库备份文件，并暂停账户写入')
  const filename = path.resolve(backupFile)
  const digest = crypto.createHash('sha256').update(JSON.stringify(balances)).digest('hex')
  await fs.mkdir(path.dirname(filename), { recursive: true, mode: 0o700 })
  await fs.writeFile(filename, JSON.stringify({ balances, digest }, null, 2), { flag: 'wx', mode: 0o600 })
  if (!tables.length) await db.query(create)
  await db.beginTransaction()
  try {
    for (const row of balances) await db.query(`INSERT INTO customer_account_entries
      (customer_id, kind, delta, balance_after, points_after, source_type, source_id, note, actor_user_id, created_at)
      VALUES (?, 'balance', ?, ?, 0, 'opening_balance', ?, '历史余额期初，原始充值来源未留存', NULL, NOW())`,
    [row.id, row.balance, row.balance, row.id])
    await db.commit()
  } catch (error) { await db.rollback(); throw error }
  return { status: 'migrated', writes: true, customers: balances.length,
    balanceTotalCents: balances.reduce((sum, row) => sum + Math.round(Number(row.balance) * 100), 0) }
}

if (require.main === module) {
  const { db: config } = require('../src/config')
  require('mysql2/promise').createConnection({ ...config, connectTimeout: 15000 }).then(async db => {
    try { console.log(JSON.stringify(await migrate(db, { apply: process.argv.includes('--apply'), backupFile: process.argv.find(arg => arg.startsWith('--backup-file='))?.slice(14) }))) } finally { await db.end() }
  }).catch(error => { console.error({ status: 'failed', message: error.message }); process.exitCode = 1 })
}

module.exports = { migrate, create }
