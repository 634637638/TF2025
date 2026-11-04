'use strict'

const path = require('node:path')
const dotenv = require('dotenv')
const mysql = require('mysql2/promise')

dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true })

const GENERATED_COLUMN = 'normalized_phone'
const UNIQUE_INDEX = 'uk_customers_normalized_phone'
const LEGACY_GENERATED_COLUMN = 'h5_login_phone'
const LEGACY_UNIQUE_INDEX = 'uk_customers_h5_login_phone'
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

async function inspectSchema(db) {
  const [columns] = await db.execute(
    `SELECT COLUMN_NAME, EXTRA, GENERATION_EXPRESSION
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME IN (?, ?)`,
    [GENERATED_COLUMN, LEGACY_GENERATED_COLUMN]
  )
  const [indexes] = await db.execute(
    `SELECT INDEX_NAME, NON_UNIQUE, COLUMN_NAME, SEQ_IN_INDEX
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND INDEX_NAME IN (?, ?)
     ORDER BY SEQ_IN_INDEX`,
    [UNIQUE_INDEX, LEGACY_UNIQUE_INDEX]
  )

  return {
    generatedColumn: columns.find(column => column.COLUMN_NAME === GENERATED_COLUMN) || null,
    uniqueIndex: indexes.filter(index => index.INDEX_NAME === UNIQUE_INDEX),
    legacyGeneratedColumn: columns.find(column => column.COLUMN_NAME === LEGACY_GENERATED_COLUMN) || null,
    legacyUniqueIndex: indexes.filter(index => index.INDEX_NAME === LEGACY_UNIQUE_INDEX)
  }
}

function validateSchema(schema) {
  if (schema.generatedColumn) {
    const expression = String(schema.generatedColumn.GENERATION_EXPRESSION || '')
    if (!/phone/i.test(expression) || /source/i.test(expression)) {
      throw new Error(`${GENERATED_COLUMN} 已存在，但不是全体客户规范化手机号生成列`)
    }
  }
  if (schema.uniqueIndex.length > 0) {
    if (schema.uniqueIndex.length !== 1 || Number(schema.uniqueIndex[0].NON_UNIQUE) !== 0 || schema.uniqueIndex[0].COLUMN_NAME !== GENERATED_COLUMN) {
      throw new Error(`${UNIQUE_INDEX} 已存在，但定义不符合 H5 登录手机号唯一约束`)
    }
  }
}

async function getDuplicateSummary(db) {
  const [rows] = await db.execute(
    `SELECT TRIM(phone) AS phone, COUNT(*) AS count
     FROM customers
     WHERE phone IS NOT NULL AND TRIM(phone) <> ''
     GROUP BY TRIM(phone)
     HAVING COUNT(*) > 1
     ORDER BY count DESC, phone`
  )
  return rows.map(row => ({ phone: row.phone, count: Number(row.count) }))
}

async function main() {
  const db = await createConnection()
  try {
    const [databaseRows] = await db.execute('SELECT DATABASE() AS database_name')
    const databaseName = databaseRows[0]?.database_name || process.env.DB_NAME
    const before = await inspectSchema(db)
    validateSchema(before)

    if (rollbackChanges) {
      if (before.uniqueIndex.length > 0) {
        await db.execute(`ALTER TABLE customers DROP INDEX ${UNIQUE_INDEX}`)
      }
      if (before.generatedColumn) {
        await db.execute(`ALTER TABLE customers DROP COLUMN ${GENERATED_COLUMN}`)
      }
      if (!before.legacyGeneratedColumn) {
        await db.execute(`
          ALTER TABLE customers
          ADD COLUMN ${LEGACY_GENERATED_COLUMN} VARCHAR(20)
          GENERATED ALWAYS AS (
            CASE
              WHEN source = 'H5用户' THEN NULLIF(TRIM(phone), '')
              ELSE NULL
            END
          ) STORED
        `)
      }
      if (before.legacyUniqueIndex.length === 0) {
        await db.execute(`ALTER TABLE customers ADD UNIQUE INDEX ${LEGACY_UNIQUE_INDEX} (${LEGACY_GENERATED_COLUMN})`)
      }
      const afterRollback = await inspectSchema(db)
      if (afterRollback.generatedColumn || afterRollback.uniqueIndex.length > 0 || !afterRollback.legacyGeneratedColumn || afterRollback.legacyUniqueIndex.length !== 1) {
        throw new Error('客户手机号唯一约束回滚后校验失败')
      }
      console.log(JSON.stringify({ status: 'rolled_back_to_h5_constraint_and_verified', database: databaseName }, null, 2))
      return
    }

    const duplicates = await getDuplicateSummary(db)
    const pending = [
      ...(!before.generatedColumn ? ['add_normalized_phone_column'] : []),
      ...(before.uniqueIndex.length === 0 ? ['add_customer_phone_unique_index'] : []),
      ...(before.legacyUniqueIndex.length > 0 ? ['drop_legacy_h5_phone_unique_index'] : []),
      ...(before.legacyGeneratedColumn ? ['drop_legacy_h5_login_phone_column'] : [])
    ]

    if (!applyChanges) {
      console.log(JSON.stringify({
        status: duplicates.length > 0 ? 'blocked_by_duplicates' : (pending.length > 0 ? 'dry_run' : 'already_ready'),
        database: databaseName,
        duplicate_groups: duplicates.length,
        duplicates,
        pending,
        instruction: duplicates.length > 0
          ? '先人工处理全部客户重复手机号，再使用 --apply 执行约束迁移'
          : (pending.length > 0 ? '确认预览后使用 --apply 执行迁移；使用 --rollback 可回滚' : null)
      }, null, 2))
      return
    }

    if (duplicates.length > 0) {
      throw new Error(`存在 ${duplicates.length} 组客户重复手机号，拒绝创建唯一约束`)
    }

    if (!before.generatedColumn) {
      await db.execute(`
        ALTER TABLE customers
        ADD COLUMN ${GENERATED_COLUMN} VARCHAR(20)
        GENERATED ALWAYS AS (NULLIF(TRIM(phone), '')) STORED
      `)
    }
    if (before.uniqueIndex.length === 0) {
      await db.execute(`ALTER TABLE customers ADD UNIQUE INDEX ${UNIQUE_INDEX} (${GENERATED_COLUMN})`)
    }

    const after = await inspectSchema(db)
    validateSchema(after)
    if (!after.generatedColumn || after.uniqueIndex.length !== 1) {
      throw new Error('客户手机号唯一约束迁移后校验失败')
    }
    if (after.legacyUniqueIndex.length > 0) {
      await db.execute(`ALTER TABLE customers DROP INDEX ${LEGACY_UNIQUE_INDEX}`)
    }
    if (after.legacyGeneratedColumn) {
      await db.execute(`ALTER TABLE customers DROP COLUMN ${LEGACY_GENERATED_COLUMN}`)
    }
    const verified = await inspectSchema(db)
    validateSchema(verified)
    if (!verified.generatedColumn || verified.uniqueIndex.length !== 1 || verified.legacyGeneratedColumn || verified.legacyUniqueIndex.length > 0) {
      throw new Error('客户手机号唯一约束清理旧约束后校验失败')
    }
    console.log(JSON.stringify({ status: 'migrated_and_verified', database: databaseName, applied: pending }, null, 2))
  } finally {
    await db.end()
  }
}

main().catch(error => {
  console.error(JSON.stringify({
    status: 'failed',
    code: error.code || 'CUSTOMER_PHONE_MIGRATION_ERROR',
    message: error.message
  }, null, 2))
  process.exitCode = 1
})
