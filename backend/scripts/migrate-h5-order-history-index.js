'use strict'

const path = require('node:path')
const dotenv = require('dotenv')
const mysql = require('mysql2/promise')

dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true })

const INDEX_NAME = 'idx_h5_orders_phone_created'
const applyChanges = process.argv.includes('--apply')
const rollbackChanges = process.argv.includes('--rollback')

if (applyChanges && rollbackChanges) {
  throw new Error('--apply 与 --rollback 不能同时使用')
}

async function createConnection() {
  return mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || process.env.DB_PASS,
    database: process.env.DB_NAME,
    charset: 'utf8mb4',
    timezone: 'Z',
    dateStrings: true,
    connectTimeout: 30000
  })
}

async function inspectIndex(db) {
  const [rows] = await db.execute(
    `SELECT INDEX_NAME, NON_UNIQUE, COLUMN_NAME, SEQ_IN_INDEX, COLLATION
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'H5_orders' AND INDEX_NAME = ?
     ORDER BY SEQ_IN_INDEX`,
    [INDEX_NAME]
  )
  return rows
}

function validateIndex(rows) {
  if (rows.length === 0) return
  const expected = [
    { column: 'customer_phone', collation: 'A' },
    { column: 'created_at', collation: 'D' },
    { column: 'id', collation: 'D' }
  ]
  if (Number(rows[0].NON_UNIQUE) !== 1 || rows.length !== expected.length) {
    throw new Error(`${INDEX_NAME} 已存在，但不是预期的非唯一复合索引`)
  }
  rows.forEach((row, index) => {
    if (row.COLUMN_NAME !== expected[index].column || row.COLLATION !== expected[index].collation) {
      throw new Error(`${INDEX_NAME} 已存在，但列顺序或排序方向不符合规范`)
    }
  })
}

async function main() {
  const db = await createConnection()
  try {
    const [databaseRows] = await db.execute('SELECT DATABASE() AS database_name')
    const databaseName = databaseRows[0]?.database_name || process.env.DB_NAME
    const before = await inspectIndex(db)
    validateIndex(before)

    if (rollbackChanges) {
      if (before.length > 0) {
        await db.execute(`ALTER TABLE H5_orders DROP INDEX ${INDEX_NAME}`)
      }
      const afterRollback = await inspectIndex(db)
      if (afterRollback.length > 0) throw new Error('H5 订单历史索引回滚后校验失败')
      console.log(JSON.stringify({ status: 'rolled_back_and_verified', database: databaseName }, null, 2))
      return
    }

    if (!applyChanges) {
      console.log(JSON.stringify({
        status: before.length > 0 ? 'already_ready' : 'dry_run',
        database: databaseName,
        pending: before.length > 0 ? [] : ['add_h5_order_history_index'],
        instruction: before.length > 0 ? null : '确认预览后使用 --apply 执行迁移；使用 --rollback 可回滚'
      }, null, 2))
      return
    }

    if (before.length === 0) {
      await db.execute(`
        ALTER TABLE H5_orders
        ADD INDEX ${INDEX_NAME} (customer_phone, created_at DESC, id DESC)
      `)
    }
    const after = await inspectIndex(db)
    validateIndex(after)
    if (after.length !== 3) throw new Error('H5 订单历史索引迁移后校验失败')
    console.log(JSON.stringify({ status: 'migrated_and_verified', database: databaseName }, null, 2))
  } finally {
    await db.end()
  }
}

main().catch(error => {
  console.error(JSON.stringify({
    status: 'failed',
    code: error.code || 'H5_ORDER_HISTORY_INDEX_MIGRATION_ERROR',
    message: error.message
  }, null, 2))
  process.exitCode = 1
})
