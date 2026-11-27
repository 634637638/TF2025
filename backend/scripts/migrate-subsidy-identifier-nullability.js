'use strict'

const path = require('node:path')
const dotenv = require('dotenv')
const mysql = require('mysql2/promise')

dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true })

const TABLE_NAME = 'national_subsidies'
const COLUMN_NAME = 'imei1'
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
  const [rows] = await db.execute(
    `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [TABLE_NAME, COLUMN_NAME]
  )
  const column = rows[0] || null
  if (!column) throw new Error(`${TABLE_NAME}.${COLUMN_NAME} 字段不存在`)

  const [[countRow]] = await db.execute(
    `SELECT COUNT(*) AS null_count FROM ${TABLE_NAME} WHERE ${COLUMN_NAME} IS NULL`
  )
  return {
    column,
    nullCount: Number(countRow?.null_count || 0)
  }
}

function validateColumn(column, nullable) {
  if (String(column.COLUMN_TYPE).toLowerCase() !== 'varchar(50)') {
    throw new Error(`${TABLE_NAME}.${COLUMN_NAME} 类型为 ${column.COLUMN_TYPE}，拒绝覆盖`)
  }
  const expectedNullable = nullable ? 'YES' : 'NO'
  if (column.IS_NULLABLE !== expectedNullable || column.COLUMN_DEFAULT !== null) {
    throw new Error(`${TABLE_NAME}.${COLUMN_NAME} 当前约束与迁移预期不一致，拒绝覆盖`)
  }
}

function validateMode() {
  if (applyChanges && rollbackChanges) throw new Error('--apply 与 --rollback 不能同时使用')
}

async function migrate(db, { apply = false, rollback = false } = {}) {
  const before = await inspect(db)
  const currentlyNullable = before.column.IS_NULLABLE === 'YES'

  if (rollback) {
    if (!currentlyNullable) return { status: 'already_rolled_back', writes: false, before }
    if (before.nullCount > 0) throw new Error('已有空 IMEI1 记录，拒绝回退为 NOT NULL')
    validateColumn(before.column, true)
    if (!apply) return { status: 'dry_run_rollback', writes: false, before }
    await db.execute(`ALTER TABLE ${TABLE_NAME} MODIFY COLUMN ${COLUMN_NAME} VARCHAR(50) NOT NULL`)
    const after = await inspect(db)
    validateColumn(after.column, false)
    return { status: 'rolled_back_and_verified', writes: true, before, after }
  }

  if (currentlyNullable) {
    validateColumn(before.column, true)
    return { status: 'already_ready', writes: false, before }
  }

  validateColumn(before.column, false)
  if (!apply) {
    return {
      status: 'dry_run',
      writes: false,
      before,
      sql: `ALTER TABLE ${TABLE_NAME} MODIFY COLUMN ${COLUMN_NAME} VARCHAR(50) NULL`
    }
  }

  await db.execute(`ALTER TABLE ${TABLE_NAME} MODIFY COLUMN ${COLUMN_NAME} VARCHAR(50) NULL`)
  const after = await inspect(db)
  validateColumn(after.column, true)
  return { status: 'migrated_and_verified', writes: true, before, after }
}

async function main() {
  validateMode()
  const db = await createConnection()
  try {
    const result = await migrate(db, { apply: applyChanges, rollback: rollbackChanges })
    console.log(JSON.stringify({ database: process.env.DB_NAME, ...result }, null, 2))
  } finally {
    await db.end()
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(JSON.stringify({
      status: 'failed',
      code: error.code || 'SUBSIDY_IDENTIFIER_MIGRATION_ERROR',
      message: error.message
    }, null, 2))
    process.exitCode = 1
  })
}

module.exports = { migrate, inspect, validateColumn, TABLE_NAME, COLUMN_NAME }
