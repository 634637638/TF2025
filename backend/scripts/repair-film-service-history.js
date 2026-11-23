#!/usr/bin/env node

'use strict'

const fs = require('node:fs/promises')
const path = require('node:path')
const { createHash } = require('node:crypto')
const { db } = require('../src/config')
const mysql = require('mysql2/promise')

const backupArg = process.argv.find(arg => arg.startsWith('--backup-file='))
const backupFile = backupArg ? path.resolve(backupArg.slice('--backup-file='.length)) : null
const apply = process.argv.includes('--apply')
const signature = rows => createHash('sha256').update(JSON.stringify(rows)).digest('hex')

const SOURCE_QUERY = `
  SELECT o.id AS order_id, o.customer_id, o.store_id, o.operator_id, o.created_by,
    o.completed_date AS business_time, i.id AS item_id, i.accessory_sale_id,
    i.linked_phone_sale_id AS sale_id, i.quantity, s.phone_id, p.model_id,
    JSON_UNQUOTE(JSON_EXTRACT(i.snapshot, '$.model_name')) AS snapshot_model_name,
    COALESCE(JSON_UNQUOTE(JSON_EXTRACT(i.snapshot, '$.sale_type')), '') AS sale_type,
    COALESCE(t.name, a.name) AS product_name, m.name AS model_name,
    s.customer_id AS sale_customer_id, s.store_id AS sale_store_id,
    s.operator_id AS sale_operator_id, sale_record.customer_id AS accessory_customer_id,
    sale_record.store_id AS accessory_store_id, sale_record.operator_id AS accessory_operator_id,
    sale_record.quantity AS accessory_quantity, sale_record.unit_price, sale_record.total_price, sale_record.sale_type AS accessory_sale_type,
    sale_record.created_at AS accessory_created_at, p.imei, p.serial_number
  FROM sales_order_items i
  JOIN sales_orders o ON o.id = i.order_id AND o.order_status = 'completed'
  JOIN sales s ON s.id = i.linked_phone_sale_id AND s.customer_id = o.customer_id AND s.sale_type = 'retail'
  JOIN phones p ON p.id = s.phone_id
  JOIN accessory_sales sale_record ON sale_record.id = i.accessory_sale_id
  JOIN accessories a ON a.id = i.accessory_id
  LEFT JOIN accessories t ON t.id = a.template_id
  LEFT JOIN accessory_categories c ON c.id = COALESCE(t.category_id, a.category_id)
  LEFT JOIN models m ON m.id = p.model_id
  LEFT JOIN customer_film_services f ON f.order_id = o.id AND f.phone_id = p.id
  WHERE i.item_type = 'accessory' AND f.id IS NULL
    AND COALESCE(c.name, JSON_UNQUOTE(JSON_EXTRACT(i.snapshot, '$.category')), '') LIKE '%膜%'
    AND COALESCE(t.free_film, a.free_film) = 1
    AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(i.snapshot, '$.sale_type')), '') = 'gift'
    AND i.unit_price = 0 AND i.total_amount = 0
  ORDER BY o.id, p.id, i.id`

function createPlan(rows) {
  const groups = new Map()
  for (const row of rows) {
    const key = `${row.order_id}:${row.phone_id}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }
  return [...groups.values()].map(group => {
    if (group.length !== 1) throw new Error(`订单 ${group[0].order_id} 的手机 ${group[0].phone_id} 存在多条赠膜明细，需人工核对`)
    const row = group[0]
    if (Number(row.customer_id) !== Number(row.sale_customer_id) || Number(row.store_id) !== Number(row.sale_store_id) ||
      Number(row.store_id) !== Number(row.accessory_store_id) || Number(row.operator_id) !== Number(row.sale_operator_id) ||
      Number(row.operator_id) !== Number(row.accessory_operator_id) || Number(row.quantity) !== Number(row.accessory_quantity) ||
      Number(row.quantity) < 1 || !row.model_id || !row.model_name || row.accessory_sale_type !== 'gift' ||
      Number(row.unit_price) !== 0 || Number(row.total_price) !== 0) {
      throw new Error(`订单 ${row.order_id} 的赠膜、手机或客户关联不一致`)
    }
    return row
  })
}

async function readPlan(connection, lock = false) {
  const [rows] = await connection.query(`${SOURCE_QUERY}${lock ? ' FOR UPDATE' : ''}`)
  const plans = createPlan(rows)
  const orderCounts = new Map()
  for (const row of plans) orderCounts.set(Number(row.order_id), (orderCounts.get(Number(row.order_id)) || 0) + 1)
  if ([...orderCounts.values()].some(count => count > 1)) {
    const [indexes] = await connection.query(`SELECT INDEX_NAME, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS columns_in_index
      FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer_film_services'
      GROUP BY INDEX_NAME`)
    const orderOnlyUnique = indexes.some(index => index.columns_in_index === 'order_id' && index.INDEX_NAME !== 'PRIMARY')
    if (orderOnlyUnique) throw new Error('当前贴膜历史唯一索引不支持同单多手机回填，请先完成 film-order-phone-index 迁移')
  }
  return plans
}

async function writeBackup(plans) {
  if (!backupFile) throw new Error('执行回填必须提供唯一的 --backup-file')
  await fs.mkdir(path.dirname(backupFile), { recursive: true, mode: 0o700 })
  await fs.writeFile(backupFile, JSON.stringify({
    purpose: 'repair-film-service-history', created_at: new Date().toISOString(),
    plan_digest: signature(plans), source: plans
  }, null, 2), { flag: 'wx', mode: 0o600 })
}

async function applyPlan(connection, plans) {
  await connection.beginTransaction()
  try {
    const lockedPlans = await readPlan(connection, true)
    if (signature(lockedPlans) !== signature(plans)) throw new Error('回填候选在备份后发生变化，请保留备份并重新预览')
    const inserted = []
    for (const row of lockedPlans) {
      const phoneSnapshot = { model_name: row.snapshot_model_name || row.model_name,
        sale_id: Number(row.sale_id), automatic: true, historical_backfill: true }
      const [result] = await connection.execute(`INSERT INTO customer_film_services
        (order_id, customer_id, qualification_sale_id, store_id, operator_id, created_by,
         quantity, business_time, created_at, phone_id, model_id, phone_snapshot)
        VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        row.order_id, row.customer_id, row.store_id, row.operator_id, row.created_by,
        row.quantity, row.business_time, row.accessory_created_at, row.phone_id, row.model_id,
        JSON.stringify(phoneSnapshot)
      ])
      inserted.push({ service_id: Number(result.insertId), order_id: Number(row.order_id),
        item_id: Number(row.item_id), phone_id: Number(row.phone_id) })
    }
    const ids = inserted.map(row => row.service_id)
    const [saved] = ids.length ? await connection.query(
      `SELECT id, order_id, customer_id, phone_id, quantity, model_id FROM customer_film_services WHERE id IN (${ids.map(() => '?').join(',')})`, ids
    ) : [[]]
    if (saved.length !== inserted.length) throw new Error('貼膜歷史回讀數量不符，已回滾')
    const savedById = new Map(saved.map(row => [Number(row.id), row]))
    for (const row of lockedPlans) {
      const result = inserted.find(item => item.order_id === Number(row.order_id) && item.phone_id === Number(row.phone_id))
      const actual = result && savedById.get(result.service_id)
      if (!actual || Number(actual.order_id) !== Number(row.order_id) || Number(actual.customer_id) !== Number(row.customer_id) ||
        Number(actual.phone_id) !== Number(row.phone_id) || Number(actual.model_id) !== Number(row.model_id) ||
        Number(actual.quantity) !== Number(row.quantity)) throw new Error('贴膜历史回读内容不一致，已回滚')
    }
    await connection.commit()
    return inserted
  } catch (error) {
    await connection.rollback()
    throw error
  }
}

async function main() {
  const args = process.argv.slice(2)
  if (args.some(arg => !['--apply'].includes(arg) && !arg.startsWith('--backup-file=')) ||
    args.filter(arg => arg.startsWith('--backup-file=')).length > 1 || new Set(args).size !== args.length) {
    throw new Error('參數無效；只接受 --apply 與一個 --backup-file')
  }
  const connection = await mysql.createConnection({ ...db, multipleStatements: false, connectTimeout: 15000 })
  try {
    const plans = await readPlan(connection)
    console.log(JSON.stringify({ status: apply ? 'apply_requested' : 'dry_run', candidate_count: plans.length,
      candidates: plans.map(row => ({ order_id: Number(row.order_id), item_id: Number(row.item_id),
        phone_id: Number(row.phone_id), quantity: Number(row.quantity) })) }))
    if (!apply || plans.length === 0) return
    await writeBackup(plans)
    const inserted = await applyPlan(connection, plans)
    console.log(JSON.stringify({ status: 'applied_and_verified', repaired_count: inserted.length, inserted }))
  } finally {
    await connection.end()
  }
}

if (require.main === module) main().catch(error => {
  console.error(JSON.stringify({ status: 'failed', code: error.code || 'FILM_HISTORY_REPAIR_FAILED', message: error.message }))
  process.exitCode = 1
})

module.exports = { createPlan }
