'use strict'

const path = require('node:path')
const dotenv = require('dotenv')
const mysql = require('mysql2/promise')

dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true })

const COLUMN_NAME = 'points_awarded'
const ACCOUNTED_AT_COLUMN = 'points_accounted_at'
const applyChanges = process.argv.includes('--apply')
const rollbackChanges = process.argv.includes('--rollback')

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

async function inspect(db) {
  const [[columnRows], [salesRows], [customerRows]] = await Promise.all([
    db.execute(
      `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'sales' AND COLUMN_NAME IN (?, ?)`,
      [process.env.DB_NAME, COLUMN_NAME, ACCOUNTED_AT_COLUMN]
    ),
    db.execute('SELECT COUNT(*) AS total_sales FROM sales'),
    db.execute('SELECT COUNT(*) AS customers_with_points, COALESCE(SUM(points), 0) AS total_points FROM customers WHERE COALESCE(points, 0) > 0')
  ])

  return {
    pointsColumn: columnRows.find(column => column.COLUMN_NAME === COLUMN_NAME) || null,
    accountedAtColumn: columnRows.find(column => column.COLUMN_NAME === ACCOUNTED_AT_COLUMN) || null,
    totalSales: Number(salesRows[0]?.total_sales || 0),
    customersWithPoints: Number(customerRows[0]?.customers_with_points || 0),
    totalCustomerPoints: Number(customerRows[0]?.total_points || 0)
  }
}

function validateColumns(pointsColumn, accountedAtColumn) {
  if (pointsColumn) {
    const type = String(pointsColumn.COLUMN_TYPE || '').toLowerCase()
    if (type !== 'int unsigned' || pointsColumn.IS_NULLABLE !== 'NO' || Number(pointsColumn.COLUMN_DEFAULT) !== 0) {
      throw new Error(`${COLUMN_NAME} 已存在，但定义不是 INT UNSIGNED NOT NULL DEFAULT 0`)
    }
  }
  if (accountedAtColumn) {
    const type = String(accountedAtColumn.COLUMN_TYPE || '').toLowerCase()
    if (type !== 'datetime' || accountedAtColumn.IS_NULLABLE !== 'YES') {
      throw new Error(`${ACCOUNTED_AT_COLUMN} 已存在，但定义不是 DATETIME NULL`)
    }
  }
  if (Boolean(pointsColumn) !== Boolean(accountedAtColumn)) {
    throw new Error('销售积分凭据字段只迁移了一部分，请先人工核对数据库结构')
  }
}

function hasPointsColumns(state) {
  return Boolean(state.pointsColumn && state.accountedAtColumn)
}

function validateMode() {
  if (applyChanges && rollbackChanges) {
    throw new Error('--apply 与 --rollback 不能同时使用')
  }
}

async function main() {
  validateMode()
  const db = await createConnection()
  try {
    const before = await inspect(db)
    validateColumns(before.pointsColumn, before.accountedAtColumn)
    const columnsReady = hasPointsColumns(before)

    if (!applyChanges && !rollbackChanges) {
      console.log(JSON.stringify({
        status: columnsReady ? 'already_ready' : 'dry_run',
        database: process.env.DB_NAME,
        pending: columnsReady ? [] : [`add_sales_${COLUMN_NAME}`, `add_sales_${ACCOUNTED_AT_COLUMN}`],
        historical_sales_without_verifiable_points_receipt: columnsReady ? 0 : before.totalSales,
        customers_with_existing_points: before.customersWithPoints,
        total_existing_customer_points: before.totalCustomerPoints,
        note: columnsReady
          ? '积分凭据字段已存在'
          : '历史销售没有逐单积分凭据，本迁移只新增默认0积分和空核算时间，不按当前规则反算或改写历史客户积分',
        apply_command: columnsReady ? null : 'npm run migrate:customer-sale-points -- --apply'
      }, null, 2))
      return
    }

    if (rollbackChanges) {
      if (!columnsReady) {
        console.log(JSON.stringify({ status: 'already_rolled_back', database: process.env.DB_NAME }, null, 2))
        return
      }
      const [nonZeroRows] = await db.execute(
        `SELECT COUNT(*) AS count FROM sales WHERE ${COLUMN_NAME} <> 0`
      )
      if (Number(nonZeroRows[0]?.count || 0) > 0) {
        throw new Error('已有销售积分凭据，拒绝删除积分字段；请先完成业务冲正和人工复核')
      }
      await db.execute(`ALTER TABLE sales DROP COLUMN ${ACCOUNTED_AT_COLUMN}, DROP COLUMN ${COLUMN_NAME}`)
      console.log(JSON.stringify({ status: 'rolled_back', database: process.env.DB_NAME }, null, 2))
      return
    }

    if (!columnsReady) {
      await db.execute(
        `ALTER TABLE sales
         ADD COLUMN ${COLUMN_NAME} INT UNSIGNED NOT NULL DEFAULT 0
           COMMENT '该销售记录实际发放的客户积分；历史无凭据记录保持0',
         ADD COLUMN ${ACCOUNTED_AT_COLUMN} DATETIME NULL
           COMMENT '该销售记录积分首次纳入统一核算的时间'`
      )
    }

    const after = await inspect(db)
    validateColumns(after.pointsColumn, after.accountedAtColumn)
    if (!hasPointsColumns(after)) throw new Error('客户销售积分迁移后校验失败')

    console.log(JSON.stringify({
      status: columnsReady ? 'already_ready' : 'migrated_and_verified',
      database: process.env.DB_NAME,
      columns: [after.pointsColumn, after.accountedAtColumn],
      historical_sales_preserved_without_recalculation: columnsReady ? 0 : before.totalSales,
      restart_required: !columnsReady,
      next_step: columnsReady
        ? '积分凭据字段已就绪'
        : '请重启后端服务，清除运行进程中的数据库结构检查缓存'
    }, null, 2))
  } finally {
    await db.end()
  }
}

main().catch(error => {
  console.error(JSON.stringify({
    status: 'failed',
    code: error.code || 'CUSTOMER_SALE_POINTS_MIGRATION_ERROR',
    message: error.message
  }, null, 2))
  process.exitCode = 1
})
