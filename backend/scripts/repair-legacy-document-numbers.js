'use strict'

const path = require('node:path')
const fs = require('node:fs')
const dotenv = require('dotenv')
const mysql = require('mysql2/promise')
const {
  prepareInvoiceNumberTransaction,
  generateDailyDocumentNumber,
  generatePurchaseNumber
} = require('../src/utils/invoice-number')
const { formatBeijingDateTime } = require('../src/utils/time')

dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true })

const applyChanges = process.argv.includes('--apply')
const DATE_TIME_PATTERN = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})(?::\d{2})?$/

async function createConnection() {
  const { db } = require('../src/config')
  return mysql.createConnection({ ...db, dateStrings: true, connectTimeout: 30000 })
}

function normalizeDateTime(value) {
  const matched = String(value || '').trim().match(DATE_TIME_PATTERN)
  if (!matched) return null
  const [, date, hour, minute] = matched
  const dateValue = new Date(`${date}T00:00:00Z`)
  const validDate = Number.isFinite(dateValue.getTime()) &&
    dateValue.toISOString().slice(0, 10) === date && Number(hour) < 24 && Number(minute) < 60
  return validDate ? `${date} ${hour}:${minute}:00` : null
}

function hasValidBusinessDate(value) {
  const input = String(value || '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return normalizeDateTime(`${input} 00:00:00`) !== null
  return normalizeDateTime(input) !== null
}

function parseJson(value) {
  if (typeof value === 'string') return JSON.parse(value)
  return value
}

function stringifyJson(value) {
  return JSON.stringify(value)
}

function replaceSnapshotNumber(snapshot, property, number) {
  const value = parseJson(snapshot)
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  if (value[property] === number) return null
  value[property] = number
  return JSON.stringify(value)
}

function summarize(rows) {
  return rows.map(row => ({ id: Number(row.id), old_number: row.old_number, new_number: row.new_number }))
}

async function loadRows(db) {
  const [[phones], [stockIns], [accessorySales], [sales], [orders], [items]] = await Promise.all([
    db.execute(`SELECT id, purchase_number, inventory_time FROM phones
      WHERE purchase_number IS NOT NULL AND TRIM(purchase_number) <> '' ORDER BY inventory_time, id`),
    db.execute(`SELECT id, batch_no, inventory_time FROM accessory_stock_in
      WHERE batch_no IS NOT NULL AND TRIM(batch_no) <> '' ORDER BY inventory_time, id`),
    db.execute(`SELECT id, sale_no, sale_time FROM accessory_sales
      WHERE sale_no IS NOT NULL AND TRIM(sale_no) <> '' ORDER BY sale_time, id`),
    db.execute(`SELECT id, invoice_number, sale_type, sale_time FROM sales
      WHERE invoice_number IS NOT NULL AND TRIM(invoice_number) <> '' ORDER BY sale_time, id`),
    db.execute(`SELECT id, order_no, order_date, checkout_result FROM sales_orders
      WHERE order_no IS NOT NULL AND TRIM(order_no) <> '' ORDER BY order_date, id`),
    db.execute(`SELECT id, order_id, item_type, sale_id, accessory_sale_id, snapshot FROM sales_order_items
      ORDER BY order_id, id`)
  ])
  return { phones, stockIns, accessorySales, sales, orders, items }
}

function groupPurchaseNumbers(phones) {
  const groups = new Map()
  const blocked = []
  for (const phone of phones) {
    const number = String(phone.purchase_number)
    const time = normalizeDateTime(phone.inventory_time)
    if (!time) {
      blocked.push({ id: Number(phone.id), old_number: number, reason: 'inventory_time 无法确认北京时间分钟' })
      continue
    }
    const key = `${number}:${time}`
    const group = groups.get(key) || { old_number: number, time, ids: [] }
    group.ids.push(Number(phone.id))
    groups.set(key, group)
  }
  return { groups: [...groups.values()].sort((a, b) => a.time.localeCompare(b.time) || a.old_number.localeCompare(b.old_number)), blocked }
}

function compactDate(time) {
  return time.slice(2, 10).replace(/-/g, '')
}

function planRows(rows, field, prefix, timeField) {
  const canonical = new Set()
  const planned = rows.map(row => {
    const time = normalizeDateTime(row[timeField])
    const oldNumber = String(row[field] || '').trim()
    const pattern = prefix === 'SO' ? /^SO\d{14}$/ : new RegExp(`^${prefix}\\d{12}$`)
    const aligned = pattern.test(oldNumber) && time && oldNumber.slice(2, 8) === compactDate(time).slice(0, 6)
    const duplicate = aligned && canonical.has(oldNumber)
    if (aligned && !duplicate) canonical.add(oldNumber)
    return { id: Number(row.id), old_number: oldNumber || null, time: row[timeField], dateKey: time ? time.slice(0, 10).replace(/-/g, '') : null,
      new_number: aligned && !duplicate ? oldNumber : null }
  })
  return planned
}

function planPurchaseGroups(phones) {
  const purchase = groupPurchaseNumbers(phones)
  const canonical = /^PO\d{14}$/
  const retainedNumbers = new Set()
  return {
    blocked: purchase.blocked,
    groups: purchase.groups.map(group => {
      const candidate = `PO${compactDate(group.time)}${group.time.slice(11, 16).replace(':', '')}`
      const oldNumber = group.old_number.trim()
      const keep = canonical.test(oldNumber) && oldNumber.slice(2, 12) === candidate.slice(2, 12) && !retainedNumbers.has(oldNumber)
      if (keep) retainedNumbers.add(oldNumber)
      const sequenceKey = `${group.time.slice(0, 10).replace(/-/g, '')}${group.time.slice(11, 16).replace(':', '')}`
      return { ...group, new_number: keep ? oldNumber : null, sequenceKey }
    })
  }
}

async function seedSequence(db, sequenceDate, type, values) {
  const max = Math.max(0, ...values.filter(Number.isSafeInteger))
  await db.execute(`INSERT INTO invoice_sequences (sequence_date, type_suffix, current_sequence)
    VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE current_sequence = GREATEST(current_sequence, VALUES(current_sequence))`, [sequenceDate, type, max])
}

async function createPlan(db, rows) {
  const purchase = planPurchaseGroups(rows.phones)
  const blocked = [...purchase.blocked]
  const changes = { purchases: [], batches: [], accessory_sales: [], orders: [] }
  for (const group of purchase.groups) changes.purchases.push({
    old_number: group.old_number,
    time: group.time,
    phone_ids: group.ids,
    new_number: group.new_number,
    sequenceKey: group.sequenceKey
  })
  for (const row of planRows(rows.stockIns, 'batch_no', 'RK', 'inventory_time')) {
    if (!hasValidBusinessDate(row.time)) blocked.push({ id: row.id, old_number: row.old_number, reason: '商品入库时间无效' })
    changes.batches.push(row)
  }
  for (const row of planRows(rows.accessorySales, 'sale_no', 'PS', 'sale_time')) {
    if (!hasValidBusinessDate(row.time)) blocked.push({ id: row.id, old_number: row.old_number, reason: '商品销售时间无效' })
    changes.accessory_sales.push(row)
  }
  for (const row of planRows(rows.orders, 'order_no', 'SO', 'order_date')) {
    if (!hasValidBusinessDate(row.time)) blocked.push({ id: row.id, old_number: row.old_number, reason: '共同单日期无效' })
    changes.orders.push(row)
  }

  if (blocked.length || !applyChanges) return { blocked, changes }
  const purchaseValues = new Map()
  for (const row of changes.purchases) if (row.new_number) purchaseValues.set(row.sequenceKey, [...(purchaseValues.get(row.sequenceKey) || []), Number(row.new_number.slice(12))])
  for (const row of changes.purchases) if (!row.new_number) {
    await seedSequence(db, row.sequenceKey, 'PO', purchaseValues.get(row.sequenceKey) || [])
    row.new_number = await generatePurchaseNumber(db, row.time)
  }
  for (const [prefix, type, digits, key] of [['RK', 'RK', 6, 'batches'], ['PS', 'PS', 6, 'accessory_sales'], ['SO', 'SO', 8, 'orders']]) {
    const target = changes[key]
    const values = new Map()
    for (const row of target) if (row.new_number) values.set(row.dateKey, [...(values.get(row.dateKey) || []), Number(row.new_number.slice(8))])
    for (const row of target) if (!row.new_number) {
      await seedSequence(db, row.dateKey, type, values.get(row.dateKey) || [])
      row.new_number = await generateDailyDocumentNumber(prefix, db, row.time, digits)
    }
  }
  return { blocked, changes }
}

async function applyPlan(db, rows, plan) {
  const mappings = {
    purchases: new Map(plan.changes.purchases.flatMap(row => row.phone_ids.map(id => [id, { old_number: row.old_number, new_number: row.new_number }]))),
    batches: new Map(plan.changes.batches.map(row => [row.id, row.new_number])),
    accessory_sales: new Map(plan.changes.accessory_sales.map(row => [row.id, row.new_number])),
    orders: new Map(plan.changes.orders.map(row => [row.id, row.new_number]))
  }
  const updateNumber = async (table, column, id, oldNumber, newNumber) => {
    if (oldNumber === newNumber) return
    const [result] = await db.execute(`UPDATE ${table} SET ${column} = ? WHERE id = ? AND ${column} <=> ?`, [newNumber, id, oldNumber])
    if (result.affectedRows !== 1) throw new Error(`${table} ${id} 编号已变化或更新未生效，整批修复已回滚`)
  }
  for (const [id, numbers] of mappings.purchases) await updateNumber('phones', 'purchase_number', id, numbers.old_number, numbers.new_number)
  for (const row of plan.changes.batches) await updateNumber('accessory_stock_in', 'batch_no', row.id, row.old_number, row.new_number)
  for (const row of plan.changes.accessory_sales) await updateNumber('accessory_sales', 'sale_no', row.id, row.old_number, row.new_number)
  for (const row of plan.changes.orders) await updateNumber('sales_orders', 'order_no', row.id, row.old_number, row.new_number)

  for (const item of rows.items) {
    const mapping = item.item_type === 'accessory' && mappings.accessory_sales.get(Number(item.accessory_sale_id))
    const property = 'sale_no'
    if (mapping) {
      const snapshot = replaceSnapshotNumber(item.snapshot, property, mapping)
      if (snapshot) {
        const oldSnapshot = parseJson(item.snapshot)
        const oldNumber = oldSnapshot[property]
        const [updated] = await db.execute(`UPDATE sales_order_items
          SET snapshot = JSON_SET(snapshot, '$.${property}', ?)
          WHERE id = ? AND JSON_UNQUOTE(JSON_EXTRACT(snapshot, '$.${property}')) <=> ?`, [mapping, item.id, oldNumber])
        if (updated.affectedRows !== 1) throw new Error(`销售明细 ${item.id} 快照已变化，整批修复已回滚`)
      }
    }
  }

  for (const order of rows.orders) {
    if (!order.checkout_result) continue
    const originalResult = typeof order.checkout_result === 'string' ? order.checkout_result : stringifyJson(order.checkout_result)
    const result = parseJson(order.checkout_result)
    const number = mappings.orders.get(Number(order.id))
    let changed = false
    if (number && result.order_no !== number) {
      result.order_no = number
      changed = true
    }
    for (const item of result.items || []) {
      const saleNumber = item.type === 'accessory' && mappings.accessory_sales.get(Number(item.accessory_sale_id))
      if (saleNumber && item.sale_no !== saleNumber) {
        item.sale_no = saleNumber
        changed = true
      }
    }
    if (changed) {
      const [updated] = await db.execute(`UPDATE sales_orders SET checkout_result = ?
        WHERE id = ? AND checkout_result <=> ?`, [stringifyJson(result), order.id, originalResult])
      if (updated.affectedRows !== 1) throw new Error(`共同订单 ${order.id} 幂等回执已变化，整批修复已回滚`)
    }
  }
}

function writeNumberMapping(plan) {
  const timestamp = formatBeijingDateTime(new Date()).replace(/[-: ]/g, '').slice(0, 14)
  const directory = path.resolve(__dirname, '../backups/.migrations', `document-number-repair-${timestamp}`)
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 })
  fs.chmodSync(directory, 0o700)
  const filename = path.join(directory, 'number-mapping.json')
  const mapping = {
    created_at: formatBeijingDateTime(new Date()),
    rules: { purchase: 'PO + YYMMDD + HHmm + 4位分钟序号', accessory_sale: 'PS + YYMMDD + 6位日序号',
      stock_in_batch: 'RK + YYMMDD + 6位日序号', sales_order: 'SO + YYMMDD + 8位日序号' },
    purchases: plan.changes.purchases.filter(row => row.old_number !== row.new_number)
      .map(row => ({ old_number: row.old_number, new_number: row.new_number, phone_ids: row.phone_ids })),
    batches: plan.changes.batches.filter(row => row.old_number !== row.new_number).map(row => ({ id: row.id, old_number: row.old_number, new_number: row.new_number })),
    accessory_sales: plan.changes.accessory_sales.filter(row => row.old_number !== row.new_number).map(row => ({ id: row.id, old_number: row.old_number, new_number: row.new_number })),
    sales_orders: plan.changes.orders.filter(row => row.old_number !== row.new_number).map(row => ({ id: row.id, old_number: row.old_number, new_number: row.new_number }))
  }
  fs.writeFileSync(filename, `${JSON.stringify(mapping, null, 2)}\n`, { mode: 0o600, flag: 'wx' })
  fs.chmodSync(filename, 0o600)
  return filename
}

async function main() {
  const db = await createConnection()
  try {
    if (!applyChanges) {
      const rows = await loadRows(db)
      const plan = await createPlan(db, rows)
      const purchase = plan.changes.purchases
      const pending = Object.fromEntries(Object.entries(plan.changes).map(([key, value]) => [key,
        value.filter(row => row.old_number !== row.new_number).length]))
      console.log(JSON.stringify({
        status: plan.blocked.length ? 'blocked' : Object.values(pending).some(Boolean) ? 'dry_run' : 'already_clean',
        database: process.env.DB_NAME,
        counts: { phone_purchase_batches: purchase.length, accessory_batches: rows.stockIns.length,
          accessory_sales: rows.accessorySales.length, phone_sales_unchanged: rows.sales.length, sales_orders: rows.orders.length,
          order_items: rows.items.length },
        blocked_count: plan.blocked.length,
        blocked_sample: plan.blocked.slice(0, 30),
        pending_changes: pending,
        purchase_sample: purchase.slice(0, 10).map(({ old_number, time, phone_ids }) => ({ old_number, time, phone_count: phone_ids.length })),
        instruction: plan.blocked.length ? '先处理阻塞记录，再重新预览' : Object.values(pending).some(Boolean) ? '核对记录数后使用 --apply 执行历史单号修复' : null
      }, null, 2))
      return
    }

    await prepareInvoiceNumberTransaction(db)
    await db.beginTransaction()
    try {
      const rows = await loadRows(db)
      const plan = await createPlan(db, rows)
      if (plan.blocked.length) throw new Error(`存在 ${plan.blocked.length} 条无法可靠生成采购时分的记录，未执行修复`)
      await applyPlan(db, rows, plan)
      await db.commit()
      const mappingFile = writeNumberMapping(plan)
      console.log(JSON.stringify({ status: 'repaired', database: process.env.DB_NAME,
        counts: Object.fromEntries(Object.entries(plan.changes).map(([key, value]) => [key, value.length])),
        mapping_file: path.relative(path.resolve(__dirname, '..'), mappingFile),
        samples: Object.fromEntries(Object.entries(plan.changes).map(([key, value]) => [key, summarize(value.slice(0, 10))]))
      }, null, 2))
    } catch (error) {
      await db.rollback()
      throw error
    }
  } catch (error) {
    try { await db.rollback() } catch {}
    throw error
  } finally {
    await db.end()
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(JSON.stringify({ status: 'failed', code: error.code || 'DOCUMENT_NUMBER_REPAIR_ERROR', message: error.message }, null, 2))
    process.exitCode = 1
  })
}

module.exports = { normalizeDateTime, hasValidBusinessDate, groupPurchaseNumbers, planPurchaseGroups, replaceSnapshotNumber }
