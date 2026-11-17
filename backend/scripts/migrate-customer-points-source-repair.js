'use strict'

const fs = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')

const candidatesSql = `SELECT e.id AS opening_entry_id, e.customer_id, e.points AS opening_points,
  COALESCE(SUM(CASE WHEN s.status = 'completed' AND s.sale_type = 'retail' AND s.points_awarded > 0
    AND s.points_accounted_at IS NOT NULL THEN s.points_awarded ELSE 0 END), 0) AS sale_points,
  COUNT(CASE WHEN s.status = 'completed' AND s.sale_type = 'retail' AND s.points_awarded > 0
    AND s.points_accounted_at IS NOT NULL THEN 1 END) AS sale_count,
  COUNT(a.id) AS allocation_count
  FROM customer_points_entries e
  LEFT JOIN sales s ON s.customer_id = e.customer_id
  LEFT JOIN customer_points_allocations a ON a.credit_entry_id = e.id
  WHERE e.entry_type = 'award' AND e.source_type = 'opening_balance'
  GROUP BY e.id, e.customer_id, e.points
  HAVING sale_points = opening_points AND sale_points > 0 AND allocation_count = 0
  ORDER BY e.customer_id`

const salesSql = `SELECT id, points_awarded, sale_time, sale_type, points_accounted_at
  FROM sales WHERE customer_id = ? AND status = 'completed' AND sale_type = 'retail'
  AND points_awarded > 0 AND points_accounted_at IS NOT NULL ORDER BY id`

const digest = rows => crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex')

async function inspect (db) {
  const [rows] = await db.query(candidatesSql)
  return rows.map(row => ({ opening_entry_id: Number(row.opening_entry_id), customer_id: Number(row.customer_id),
    opening_points: Number(row.opening_points), sale_points: Number(row.sale_points), sale_count: Number(row.sale_count), allocation_count: Number(row.allocation_count) }))
}

async function migrate (db, { apply = false, backupFile } = {}) {
  const candidates = await inspect(db)
  if (!apply) return { status: candidates.length ? 'dry_run' : 'already_verified', writes: false,
    customers: candidates.length, sales: candidates.reduce((sum, row) => sum + row.sale_count, 0), points: candidates.reduce((sum, row) => sum + row.sale_points, 0), digest: digest(candidates) }
  if (!backupFile) throw new Error('来源修复必须提供完整备份文件，并暂停积分/销售写入')
  const filename = path.resolve(backupFile)
  await fs.mkdir(path.dirname(filename), { recursive: true, mode: 0o700 })
  await fs.writeFile(filename, JSON.stringify({ candidates, digest: digest(candidates) }, null, 2), { flag: 'wx', mode: 0o600 })
  await db.beginTransaction()
  try {
    for (const candidate of candidates) {
      const [[opening]] = await db.query("SELECT id, customer_id, points, balance_after FROM customer_points_entries WHERE id = ? AND source_type = 'opening_balance' FOR UPDATE", [candidate.opening_entry_id])
      if (!opening) throw new Error(`期初来源已变化：${candidate.opening_entry_id}`)
      const [sales] = await db.query(salesSql, [candidate.customer_id])
      if (sales.reduce((sum, row) => sum + Number(row.points_awarded), 0) !== Number(opening.points)) throw new Error(`销售积分与期初不一致：${candidate.customer_id}`)
      let cumulativePoints = 0
      for (const sale of sales) {
        const [[existing]] = await db.query("SELECT id FROM customer_points_entries WHERE customer_id = ? AND source_type = 'phone_sale' AND source_id = ? LIMIT 1", [candidate.customer_id, sale.id])
        cumulativePoints += Number(sale.points_awarded)
        if (!existing) await db.query(`INSERT INTO customer_points_entries
          (customer_id, entry_type, source_type, source_id, points, balance_after, source_snapshot, created_at)
          VALUES (?, 'award', 'phone_sale', ?, ?, ?, ?, ?)`, [candidate.customer_id, sale.id, Number(sale.points_awarded), cumulativePoints,
          JSON.stringify({ reason: '真实手机销售积分', sale_time: sale.sale_time, points_accounted_at: sale.points_accounted_at }), sale.points_accounted_at])
      }
      await db.query('DELETE FROM customer_points_entries WHERE id = ? AND source_type = \'opening_balance\'', [candidate.opening_entry_id])
    }
    await db.commit()
  } catch (error) { await db.rollback(); throw error }
  return { status: 'repaired', writes: true, customers: candidates.length, sales: candidates.reduce((sum, row) => sum + row.sale_count, 0), points: candidates.reduce((sum, row) => sum + row.sale_points, 0) }
}

if (require.main === module) {
  const { db: config } = require('../src/config')
  require('mysql2/promise').createConnection({ ...config, connectTimeout: 15000 }).then(async db => {
    try { console.log(JSON.stringify(await migrate(db, { apply: process.argv.includes('--apply'), backupFile: process.argv.find(arg => arg.startsWith('--backup-file='))?.slice(14) }))) } finally { await db.end() }
  }).catch(error => { console.error({ status: 'failed', message: error.message }); process.exitCode = 1 })
}

module.exports = { migrate, inspect, candidatesSql }
