'use strict'

const path = require('node:path')
const dotenv = require('dotenv')
const mysql = require('mysql2/promise')

const envFileArg = process.argv.find(argument => argument.startsWith('--env-file='))
const envFile = path.resolve(
  process.cwd(),
  envFileArg?.slice('--env-file='.length) || process.env.ENV_FILE || (
    process.env.NODE_ENV === 'production' ? '.env.production' : '.env'
  )
)
dotenv.config({ path: envFile, quiet: true })

const applyChanges = process.argv.includes('--apply')
const TABLE_NAME = 'invoice_sequences'

function createConnection() {
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
  const [[tables], [columns], [indexes]] = await Promise.all([
    db.execute(
      `SELECT TABLE_NAME
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [TABLE_NAME]
    ),
    db.execute(
      `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [TABLE_NAME]
    ),
    db.execute(
      `SELECT INDEX_NAME, NON_UNIQUE, COLUMN_NAME, SEQ_IN_INDEX
       FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = 'PRIMARY'
       ORDER BY SEQ_IN_INDEX`,
      [TABLE_NAME]
    )
  ])

  if (tables.length === 0) return { exists: false }

  const expectedColumns = [
    ['sequence_date', 'char(8)', 'NO'],
    ['type_suffix', 'varchar(4)', 'NO'],
    ['current_sequence', 'int unsigned', 'NO']
  ]
  for (const [name, type, nullable] of expectedColumns) {
    const column = columns.find(item => item.COLUMN_NAME === name)
    if (!column || String(column.COLUMN_TYPE).toLowerCase() !== type || column.IS_NULLABLE !== nullable) {
      throw new Error(`${TABLE_NAME}.${name} 不符合预期结构`)
    }
  }

  const primaryColumns = indexes.map(index => index.COLUMN_NAME)
  if (primaryColumns.join(',') !== 'sequence_date,type_suffix') {
    throw new Error(`${TABLE_NAME} 主键必须为 (sequence_date, type_suffix)`)
  }

  return { exists: true }
}

async function main() {
  const db = await createConnection()
  try {
    const before = await inspect(db)
    if (!before.exists && !applyChanges) {
      console.log(JSON.stringify({
        status: 'dry_run',
        pending: ['create_invoice_sequences'],
        apply_command: 'npm run migrate:invoice-sequences -- --apply'
      }, null, 2))
      return
    }

    if (!before.exists) {
      await db.execute(`
        CREATE TABLE ${TABLE_NAME} (
          sequence_date CHAR(8) NOT NULL,
          type_suffix VARCHAR(4) NOT NULL,
          current_sequence INT UNSIGNED NOT NULL DEFAULT 0,
          PRIMARY KEY (sequence_date, type_suffix)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `)
    }

    const after = await inspect(db)
    if (!after.exists) throw new Error(`${TABLE_NAME} 迁移后校验失败`)
    console.log(JSON.stringify({
      status: before.exists ? 'already_ready' : 'migrated_and_verified',
      table: TABLE_NAME
    }, null, 2))
  } finally {
    await db.end()
  }
}

main().catch(error => {
  console.error(JSON.stringify({
    status: 'failed',
    code: error.code || 'INVOICE_SEQUENCE_MIGRATION_ERROR',
    message: error.message
  }, null, 2))
  process.exitCode = 1
})
