'use strict'

const fs = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')

// 将未追溯的历史积分承接为唯一 opening_balance 来源；默认只预览，不改客户余额。
const alter = "ALTER TABLE customer_points_entries MODIFY source_type ENUM('phone_sale','checkout_item','opening_balance','manual_adjustment') NOT NULL"
const select = `SELECT c.id AS customer_id, c.points,
  COALESCE((SELECT SUM(e.points) FROM customer_points_entries e WHERE e.customer_id = c.id AND e.entry_type = 'award'), 0) AS awarded,
  COALESCE((SELECT SUM(a.points) FROM customer_points_allocations a JOIN customer_points_entries e ON e.id = a.credit_entry_id WHERE e.customer_id = c.id), 0) AS allocated
  FROM customers c WHERE c.points > 0 ORDER BY c.id`

const digest = rows => crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex')

async function inspect (db) {
  const [columns] = await db.query("SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer_points_entries' AND COLUMN_NAME = 'source_type'")
  if (!columns.length) throw new Error('请先完成积分来源账迁移')
  const [rows] = await db.query(select)
  const candidates = rows.map(row => ({ customer_id: Number(row.customer_id), points: Number(row.points), opening_points: Math.max(0, Number(row.points) - Math.max(0, Number(row.awarded) - Number(row.allocated))) })).filter(row => row.opening_points)
  return { ready: String(columns[0].COLUMN_TYPE).includes('opening_balance') && String(columns[0].COLUMN_TYPE).includes('manual_adjustment'), candidates }
}

async function migrate (db, { apply = false, backupFile } = {}) {
  const state = await inspect(db)
  if (!state.candidates.length && state.ready) return { status: 'already_ready', writes: false, customers: 0, points: 0 }
  if (!apply) return { status: 'dry_run', writes: false, sql: state.ready ? [] : [alter], customers: state.candidates.length, points: state.candidates.reduce((sum, row) => sum + row.opening_points, 0), digest: digest(state.candidates) }
  if (!backupFile) throw new Error('执行历史积分承接必须提供完整备份文件，并暂停积分写入')
  const filename = path.resolve(backupFile)
  await fs.mkdir(path.dirname(filename), { recursive: true, mode: 0o700 })
  await fs.writeFile(filename, JSON.stringify({ source: 'customer_points_entries', candidates: state.candidates, digest: digest(state.candidates) }, null, 2), { flag: 'wx', mode: 0o600 })
  await db.beginTransaction()
  try {
    if (!state.ready) await db.query(alter)
    for (const row of state.candidates) {
      const [[existing]] = await db.query("SELECT id FROM customer_points_entries WHERE customer_id = ? AND source_type = 'opening_balance' AND source_id = ? LIMIT 1", [row.customer_id, row.customer_id])
      if (existing) continue
      const [[customer]] = await db.query('SELECT points FROM customers WHERE id = ? FOR UPDATE', [row.customer_id])
      await db.query(`INSERT INTO customer_points_entries
        (customer_id, entry_type, source_type, source_id, points, balance_after, source_snapshot, created_at)
        VALUES (?, 'award', 'opening_balance', ?, ?, ?, ?, NOW())`, [row.customer_id, row.customer_id, row.opening_points, customer.points, JSON.stringify({ reason: '历史积分期初承接', source: 'legacy_balance' })])
    }
    await db.commit()
  } catch (error) { await db.rollback(); throw error }
  return { status: 'migrated', writes: true, customers: state.candidates.length, points: state.candidates.reduce((sum, row) => sum + row.opening_points, 0) }
}

if (require.main === module) {
  const { db: config } = require('../src/config')
  require('mysql2/promise').createConnection({ ...config, connectTimeout: 15000 }).then(async db => {
    try { console.log(JSON.stringify(await migrate(db, { apply: process.argv.includes('--apply'), backupFile: process.argv.find(arg => arg.startsWith('--backup-file='))?.slice(14) }))) } finally { await db.end() }
  }).catch(error => { console.error({ status: 'failed', message: error.message }); process.exitCode = 1 })
}

module.exports = { migrate, inspect, alter }
