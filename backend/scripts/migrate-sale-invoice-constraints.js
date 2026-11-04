'use strict'

const path = require('node:path')
const dotenv = require('dotenv')
const mysql = require('mysql2/promise')

dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true })

const CANONICAL_PATTERN = '^[0-9]{12}(XS|PF|HB)$'
const GENERATED_COLUMN = 'canonical_invoice_number'
const CANONICAL_UNIQUE_INDEX = 'uk_sales_canonical_invoice_number'
const FULL_UNIQUE_INDEX = 'uk_sales_invoice_number'
const applyChanges = process.argv.includes('--apply')

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

async function getDuplicateInvoiceNumbers(db) {
  const [rows] = await db.execute(
    `SELECT invoice_number, COUNT(*) AS count
     FROM sales
     WHERE invoice_number IS NOT NULL AND TRIM(invoice_number) <> ''
     GROUP BY invoice_number
     HAVING COUNT(*) > 1
     ORDER BY count DESC, invoice_number`
  )
  return rows.map(row => ({
    invoice_number: row.invoice_number,
    count: Number(row.count)
  }))
}

async function inspectSchema(db) {
  const [columns] = await db.execute(
    `SELECT COLUMN_NAME, EXTRA, GENERATION_EXPRESSION
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'sales' AND COLUMN_NAME = ?`,
    [process.env.DB_NAME, GENERATED_COLUMN]
  )
  const [indexes] = await db.execute(
    `SELECT INDEX_NAME, NON_UNIQUE, COLUMN_NAME
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'sales' AND INDEX_NAME IN (?, ?)`,
    [process.env.DB_NAME, CANONICAL_UNIQUE_INDEX, FULL_UNIQUE_INDEX]
  )
  const [sequenceTables] = await db.execute(
    `SELECT TABLE_NAME
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'invoice_sequences'`,
    [process.env.DB_NAME]
  )

  return {
    generatedColumn: columns[0] || null,
    canonicalUniqueIndex: indexes.find(index => index.INDEX_NAME === CANONICAL_UNIQUE_INDEX) || null,
    fullUniqueIndex: indexes.find(index => index.INDEX_NAME === FULL_UNIQUE_INDEX) || null,
    sequenceTableExists: sequenceTables.length > 0
  }
}

function validateExistingSchema(schema) {
  if (schema.generatedColumn) {
    const expression = String(schema.generatedColumn.GENERATION_EXPRESSION || '')
    if (!/invoice_number/i.test(expression) || !/XS\|PF\|HB/i.test(expression)) {
      throw new Error(`${GENERATED_COLUMN} 已存在，但不是规范单号条件生成列`)
    }
  }
  if (schema.canonicalUniqueIndex && (Number(schema.canonicalUniqueIndex.NON_UNIQUE) !== 0 || schema.canonicalUniqueIndex.COLUMN_NAME !== GENERATED_COLUMN)) {
    throw new Error(`${CANONICAL_UNIQUE_INDEX} 已存在，但定义不符合规范单号唯一约束`)
  }
  if (schema.fullUniqueIndex && (Number(schema.fullUniqueIndex.NON_UNIQUE) !== 0 || schema.fullUniqueIndex.COLUMN_NAME !== 'invoice_number')) {
    throw new Error(`${FULL_UNIQUE_INDEX} 已存在，但定义不符合全库单号唯一约束`)
  }
}

async function main() {
  const db = await createConnection()
  try {
    const duplicates = await getDuplicateInvoiceNumbers(db)
    const before = await inspectSchema(db)
    validateExistingSchema(before)

    const pending = [
      ...(!before.sequenceTableExists ? ['create_invoice_sequences'] : []),
      ...(!before.generatedColumn ? ['add_canonical_invoice_column'] : []),
      ...(!before.canonicalUniqueIndex ? ['add_canonical_invoice_unique_index'] : []),
      ...(!before.fullUniqueIndex ? ['add_full_invoice_unique_index'] : [])
    ]

    if (!applyChanges) {
      console.log(JSON.stringify({
        status: duplicates.length > 0 ? 'blocked_by_duplicates' : (pending.length > 0 ? 'dry_run' : 'already_ready'),
        database: process.env.DB_NAME,
        canonical_pattern: CANONICAL_PATTERN,
        duplicate_groups: duplicates.length,
        duplicates,
        pending,
        instruction: duplicates.length > 0
          ? '先人工处理上述非空单号重复记录，再使用 --apply 执行约束迁移'
          : (pending.length > 0 ? '确认预览后使用 --apply 执行迁移' : null)
      }, null, 2))
      return
    }

    if (duplicates.length > 0) {
      throw new Error(`存在 ${duplicates.length} 组单号重复，拒绝创建唯一约束`)
    }

    if (!before.sequenceTableExists) {
      await db.execute(`
        CREATE TABLE invoice_sequences (
          sequence_date CHAR(8) NOT NULL,
          type_suffix VARCHAR(4) NOT NULL,
          current_sequence INT UNSIGNED NOT NULL DEFAULT 0,
          PRIMARY KEY (sequence_date, type_suffix)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `)
    }
    if (!before.generatedColumn) {
      await db.execute(`
        ALTER TABLE sales
        ADD COLUMN canonical_invoice_number VARCHAR(50)
        GENERATED ALWAYS AS (
          CASE
            WHEN invoice_number REGEXP '${CANONICAL_PATTERN}' THEN invoice_number
            ELSE NULL
          END
        ) STORED
      `)
    }
    if (!before.canonicalUniqueIndex) {
      await db.execute(`
        ALTER TABLE sales
        ADD UNIQUE INDEX ${CANONICAL_UNIQUE_INDEX} (${GENERATED_COLUMN})
      `)
    }
    if (!before.fullUniqueIndex) {
      await db.execute(`
        ALTER TABLE sales
        ADD UNIQUE INDEX ${FULL_UNIQUE_INDEX} (invoice_number)
      `)
    }

    const after = await inspectSchema(db)
    validateExistingSchema(after)
    if (!after.sequenceTableExists || !after.generatedColumn || !after.canonicalUniqueIndex || !after.fullUniqueIndex) {
      throw new Error('单号约束迁移后校验失败')
    }

    console.log(JSON.stringify({
      status: 'migrated_and_verified',
      database: process.env.DB_NAME,
      canonical_pattern: CANONICAL_PATTERN,
      applied: pending
    }, null, 2))
  } finally {
    await db.end()
  }
}

main().catch(error => {
  console.error(JSON.stringify({
    status: 'failed',
    code: error.code || 'SALE_INVOICE_CONSTRAINT_MIGRATION_ERROR',
    message: error.message
  }, null, 2))
  process.exitCode = 1
})
