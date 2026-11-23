#!/usr/bin/env node

'use strict'

const fs = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')
const dotenv = require('dotenv')
const mysql = require('mysql2/promise')
const { generateDailyDocumentNumber, prepareInvoiceNumberTransaction } = require('../src/utils/invoice-number')

dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true })

const apply = process.argv.includes('--apply')
const backupArg = process.argv.find(arg => arg.startsWith('--backup-file='))
const backupFile = backupArg ? path.resolve(backupArg.slice('--backup-file='.length)) : null

const SOURCE_QUERY = `
  SELECT a.id AS accessory_sale_id, a.sale_no, a.sale_type, a.accessory_id, a.store_id AS accessory_store_id,
    a.customer_id, a.customer_name, a.customer_phone, a.quantity AS accessory_quantity,
    a.unit_price AS accessory_unit_price, a.total_price AS accessory_total_price,
    a.purchase_cost AS accessory_purchase_cost, a.remarks AS accessory_remarks,
    a.operator_id AS accessory_operator_id, a.operator_name AS accessory_operator_name,
    a.sale_time AS accessory_sale_time, a.created_at AS accessory_created_at,
    COALESCE(template.name, accessory.name) AS accessory_name,
    COALESCE(template.category, category.name, accessory.category) AS accessory_category,
    COALESCE(template.product_model, accessory.product_model) AS accessory_product_model,
    COALESCE(template.barcode, accessory.barcode) AS accessory_barcode,
    accessory.template_id AS accessory_template_id, accessory.brand_id AS accessory_brand_id,
    accessory.model_id AS accessory_model_id, accessory.color_id AS accessory_color_id,
    brand.name AS accessory_brand_name, color.name AS accessory_color_name,
    unit.name AS accessory_unit, accessory.unit_id AS accessory_unit_id,
    s.id AS sale_id, s.sale_price, s.purchase_cost, s.sale_type AS phone_sale_type,
    s.operator_id AS sale_operator_id, s.store_id AS sale_store_id, s.status AS sale_status,
    s.payment_method, s.payment_channel, s.invoice_number, s.remarks AS sale_remarks,
    s.sale_time, s.created_at AS sale_created_at, s.points_awarded,
    phone.id AS phone_id, phone.imei, phone.serial_number, phone.brand_id AS phone_brand_id,
    phone.model_id AS phone_model_id, phone.color_id AS phone_color_id,
    phone.memory_id AS phone_memory_id, phone.is_new, phone.supplier_id,
    phone_brand.name AS phone_brand_name, model.name AS phone_model_name,
    phone_color.name AS phone_color_name, memory.size AS phone_memory_name,
    payment.amount AS payment_amount, payment.payment_status, payment.id AS payment_id,
    payment.transaction_no, payment.payment_time, payment.remarks AS payment_remarks
  FROM accessory_sales a
  JOIN accessories accessory ON accessory.id = a.accessory_id
  LEFT JOIN accessories template ON template.id = accessory.template_id
  LEFT JOIN accessory_categories category ON category.id = COALESCE(template.category_id, accessory.category_id)
  LEFT JOIN accessory_units unit ON unit.id = COALESCE(template.unit_id, accessory.unit_id)
  LEFT JOIN brands brand ON brand.id = accessory.brand_id
  LEFT JOIN colors color ON color.id = COALESCE(template.color_id, accessory.color_id)
  JOIN sales s ON s.customer_id = a.customer_id AND s.store_id = a.store_id AND s.operator_id = a.operator_id
    AND s.status = 'completed' AND s.sale_type = 'retail'
    AND ABS(TIMESTAMPDIFF(SECOND, a.created_at, s.created_at)) <= 5
  JOIN phones phone ON phone.id = s.phone_id
  LEFT JOIN brands phone_brand ON phone_brand.id = phone.brand_id
  LEFT JOIN models model ON model.id = phone.model_id
  LEFT JOIN colors phone_color ON phone_color.id = phone.color_id
  LEFT JOIN memories memory ON memory.id = phone.memory_id
  JOIN payment_records payment ON payment.order_id = s.id AND payment.payment_status = 'success'
  WHERE a.sale_type = 'gift'
    AND NOT EXISTS (SELECT 1 FROM sales_order_items accessory_item WHERE accessory_item.accessory_sale_id = a.id)
    AND NOT EXISTS (SELECT 1 FROM sales_order_items phone_item WHERE phone_item.sale_id = s.id)
  ORDER BY a.id, s.id, payment.id`

const connectionConfig = () => ({
  host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || process.env.DB_PASS, database: process.env.DB_NAME,
  charset: 'utf8mb4', timezone: 'Z', dateStrings: true, connectTimeout: 30000
})

const cents = value => Math.round(Number(value) * 100)
const required = (value, label) => {
  if (value === null || value === undefined || value === '') throw new Error(`${label}缺少可重建资料`)
  return value
}

function groupPlan(rows) {
  const groups = new Map()
  for (const row of rows) {
    const key = `${row.accessory_sale_id}:${row.sale_id}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }
  const plans = []
  for (const rowsForPair of groups.values()) {
    if (rowsForPair.length !== 1) throw new Error(`赠膜与手机销售关联不唯一：${rowsForPair[0].accessory_sale_id}`)
    const row = rowsForPair[0]
    if (row.accessory_quantity !== 1 || cents(row.accessory_total_price) !== 0 || cents(row.accessory_unit_price) !== 0 ||
      row.phone_sale_type !== 'retail' || cents(row.payment_amount) !== cents(row.sale_price) ||
      row.payment_status !== 'success' || Number(row.payment_id) < 1) {
      throw new Error(`赠膜或手机收款事实异常：配件${row.accessory_sale_id} / 手机销售${row.sale_id}`)
    }
    plans.push(row)
  }
  return plans
}

function phoneSnapshot(row) {
  return {
    brand_id: row.phone_brand_id, brand_name: row.phone_brand_name, model_id: row.phone_model_id,
    model_name: row.phone_model_name, color_id: row.phone_color_id, color_name: row.phone_color_name,
    memory_id: row.phone_memory_id, memory_name: row.phone_memory_name, imei: row.imei,
    serial_number: row.serial_number, is_new: Number(row.is_new), supplier_id: row.supplier_id,
    invoice_number: row.invoice_number, remarks: row.sale_remarks
  }
}

function accessorySnapshot(row) {
  return {
    name: required(row.accessory_name, '赠膜名称'), category: row.accessory_category,
    product_model: row.accessory_product_model, barcode: row.accessory_barcode,
    template_id: row.accessory_template_id, accessory_id: row.accessory_id,
    brand_id: row.accessory_brand_id, brand_name: row.accessory_brand_name,
    model_id: row.accessory_model_id, color_id: row.accessory_color_id,
    color_name: row.accessory_color_name, unit: row.accessory_unit, unit_id: row.accessory_unit_id,
    sale_type: 'gift', sale_no: row.sale_no, serial_numbers: [], points_used: 0,
    deduction_cents: 0, gross_cents: 0, gift_return_unit_price: null, remarks: row.accessory_remarks
  }
}

async function inspect(connection) {
  const [rows] = await connection.query(SOURCE_QUERY)
  const plans = groupPlan(rows)
  const sourceIds = plans.map(row => ({ accessory_sale_id: Number(row.accessory_sale_id), sale_id: Number(row.sale_id), payment_id: Number(row.payment_id) }))
  return { plans, sourceIds }
}

async function saveBackup(connection, plans) {
  if (!backupFile) throw new Error('执行回填必须提供 --backup-file')
  const ids = plans.flatMap(row => [Number(row.sale_id), Number(row.accessory_sale_id), Number(row.payment_id)])
  const [sales] = await connection.query(`SELECT * FROM sales WHERE id IN (${plans.map(() => '?').join(',')})`, plans.map(row => row.sale_id))
  const [accessories] = await connection.query(`SELECT * FROM accessory_sales WHERE id IN (${plans.map(() => '?').join(',')})`, plans.map(row => row.accessory_sale_id))
  const [payments] = await connection.query(`SELECT * FROM payment_records WHERE id IN (${plans.map(() => '?').join(',')})`, plans.map(row => row.payment_id))
  await fs.mkdir(path.dirname(backupFile), { recursive: true, mode: 0o700 })
  await fs.writeFile(backupFile, JSON.stringify({
    purpose: 'repair-sales-checkout-relations', created_at: new Date().toISOString(), source_ids: ids,
    sales, accessories, payments
  }, null, 2), { flag: 'wx', mode: 0o600 })
}

async function applyPlan(connection, plans) {
  await prepareInvoiceNumberTransaction(connection)
  await connection.beginTransaction()
  try {
    const created = []
    for (const row of plans) {
      const orderNo = await generateDailyDocumentNumber('SO', connection, row.sale_created_at, 8)
      const requestKey = crypto.randomUUID()
      const requestHash = crypto.createHash('sha256').update(JSON.stringify({
        repair: true, sale_id: Number(row.sale_id), accessory_sale_id: Number(row.accessory_sale_id)
      })).digest('hex')
      const totalAmount = Number(row.sale_price)
      const totalCost = row.purchase_cost === null || row.accessory_purchase_cost === null
        ? null : Number(row.purchase_cost) + Number(row.accessory_purchase_cost)
      const [orderResult] = await connection.execute(`INSERT INTO sales_orders
        (order_no, request_key, request_hash, customer_id, customer_name, customer_phone, store_id, operator_id,
         created_by, total_amount, total_cost, total_profit, final_amount, payment_method, payment_channel,
         payment_status, paid_amount, order_status, order_date, completed_date, remarks, points_awarded, checkout_result)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', ?, 'completed', ?, ?, ?, ?, ?)`, [
        orderNo, requestKey, requestHash, row.customer_id, row.customer_name, row.customer_phone, row.sale_store_id,
        row.sale_operator_id, row.sale_operator_id, totalAmount, totalCost,
        totalCost === null ? null : totalAmount - totalCost, totalAmount, row.payment_method, row.payment_channel,
        totalAmount, row.sale_time, row.sale_created_at, row.sale_remarks,
        Number(row.points_awarded || 0), JSON.stringify({ repaired: true, sale_id: Number(row.sale_id), accessory_sale_id: Number(row.accessory_sale_id) })
      ])
      const orderId = Number(orderResult.insertId)
      await connection.execute('UPDATE payment_records SET sales_order_id = ? WHERE id = ? AND sales_order_id IS NULL', [orderId, row.payment_id])
      const [paymentUpdate] = await connection.execute('SELECT sales_order_id FROM payment_records WHERE id = ?', [row.payment_id])
      if (Number(paymentUpdate[0]?.sales_order_id) !== orderId) throw new Error(`收款关联失败：${row.payment_id}`)
      await connection.execute(`INSERT INTO sales_order_items
        (order_id, line_key, item_type, sale_id, phone_id, quantity, unit_price, total_amount, purchase_cost, points_awarded, snapshot, created_at)
        VALUES (?, ?, 'phone', ?, ?, 1, ?, ?, ?, ?, ?, ?)`, [
        orderId, `phone:${row.phone_id}`, row.sale_id, row.phone_id, row.sale_price, row.sale_price,
        row.purchase_cost, Number(row.points_awarded || 0), JSON.stringify(phoneSnapshot(row)), row.sale_created_at
      ])
      await connection.execute(`INSERT INTO sales_order_items
        (order_id, line_key, item_type, accessory_sale_id, accessory_id, linked_phone_sale_id, quantity, unit_price, total_amount, purchase_cost, points_awarded, snapshot, created_at)
        VALUES (?, ?, 'accessory', ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`, [
        orderId, `goods:auto-film:${row.accessory_sale_id}`, row.accessory_sale_id, row.accessory_id, row.sale_id,
        row.accessory_quantity, row.accessory_unit_price, row.accessory_total_price, row.accessory_purchase_cost,
        JSON.stringify(accessorySnapshot(row)), row.accessory_created_at
      ])
      created.push({ order_id: orderId, order_no: orderNo, sale_id: Number(row.sale_id), accessory_sale_id: Number(row.accessory_sale_id), payment_id: Number(row.payment_id) })
    }
    await connection.commit()
    return created
  } catch (error) {
    await connection.rollback()
    throw error
  }
}

async function main() {
  const connection = await mysql.createConnection(connectionConfig())
  try {
    const { plans, sourceIds } = await inspect(connection)
    console.log(JSON.stringify({ status: apply ? 'apply_requested' : 'dry_run', candidate_count: plans.length, source_ids: sourceIds }))
    if (!apply) return
    await saveBackup(connection, plans)
    const created = await applyPlan(connection, plans)
    console.log(JSON.stringify({ status: 'applied', repaired_count: created.length, repaired: created }))
  } finally {
    await connection.end()
  }
}

if (require.main === module) main().catch(error => {
  console.error(JSON.stringify({ status: 'failed', code: error.code || 'SALES_CHECKOUT_REPAIR_FAILED', message: error.message }))
  process.exitCode = 1
})

module.exports = { groupPlan, phoneSnapshot, accessorySnapshot }
