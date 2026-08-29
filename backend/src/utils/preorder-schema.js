'use strict'

const { getDatabase } = require('../config/database')

let schemaPromise = null

const REQUIRED_PREORDER_COLUMNS = [
  'id', 'preorder_number', 'customer_id', 'store_id',
  'brand_id', 'model_id', 'color_id', 'memory_id', 'is_new',
  'deposit_amount', 'deposit_paid', 'total_price', 'expected_arrival',
  'actual_model', 'imei', 'arrival_date', 'actual_price', 'status',
  'matched_phone_id', 'matched_time', 'delivered_time', 'sale_id',
  'operator_id', 'created_by', 'remarks', 'cancelled_at', 'cancel_reason',
  'created_at', 'updated_at'
]

/**
 * 请求阶段只校验结构。物理迁移必须通过独立、可审计的迁移脚本执行。
 */
async function ensurePreorderSchema() {
  if (schemaPromise) return schemaPromise

  schemaPromise = (async () => {
    const db = getDatabase()
    const [columns] = await db.query('SHOW COLUMNS FROM preorders')
    const existing = new Set(columns.map(column => column.Field))

    const missingColumns = REQUIRED_PREORDER_COLUMNS.filter(column => !existing.has(column))
    if (missingColumns.length > 0) {
      throw new Error(`preorders 表缺少规范字段: ${missingColumns.join(', ')}`)
    }
  })().catch(error => {
    schemaPromise = null
    throw error
  })

  return schemaPromise
}

module.exports = { ensurePreorderSchema }
