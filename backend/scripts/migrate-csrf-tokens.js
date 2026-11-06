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
const TABLE_NAME = 'csrf_tokens'
const USER_ID_COLUMN = 'user_id'

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
  const [tables] = await db.execute(
    `SELECT TABLE_NAME
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [TABLE_NAME]
  )
  if (tables.length === 0) return { exists: false, userIdType: null, indexes: [] }

  const [[columns], [indexes]] = await Promise.all([
    db.execute(
      `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [TABLE_NAME]
    ),
    db.execute(
      `SELECT INDEX_NAME
       FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [TABLE_NAME]
    )
  ])
  const columnNames = new Set(columns.map(column => column.COLUMN_NAME))
  const requiredColumns = ['token_id', USER_ID_COLUMN, 'token', 'created_at', 'expires_at']
  const missingColumns = requiredColumns.filter(column => !columnNames.has(column))
  if (missingColumns.length > 0) {
    throw new Error(`csrf_tokens 表结构不完整，缺少字段: ${missingColumns.join(', ')}`)
  }

  const userId = columns.find(column => column.COLUMN_NAME === USER_ID_COLUMN)
  return {
    exists: true,
    userIdType: String(userId.COLUMN_TYPE).toLowerCase(),
    userIdNullable: userId.IS_NULLABLE,
    indexes: [...new Set(indexes.map(index => index.INDEX_NAME))]
  }
}

async function main() {
  const db = await createConnection()
  try {
    const before = await inspect(db)
    const changes = []
    if (!before.exists) changes.push('create_csrf_tokens_table')
    else if (before.userIdType !== 'varchar(191)' || before.userIdNullable !== 'NO') {
      changes.push('change_user_id_to_varchar_191')
    }
    if (before.exists && !before.indexes.includes('idx_user_token_expiry')) {
      changes.push('add_idx_user_token_expiry')
    }

    if (!applyChanges) {
      console.log(JSON.stringify({
        status: changes.length === 0 ? 'already_ready' : 'dry_run',
        database: process.env.DB_NAME,
        pending: changes,
        apply_command: changes.length === 0 ? null : 'npm run migrate:csrf-tokens -- --apply'
      }, null, 2))
      return
    }

    if (!before.exists) {
      await db.execute(`
        CREATE TABLE ${TABLE_NAME} (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT,
          token_id VARCHAR(64) NOT NULL,
          user_id VARCHAR(191) NOT NULL,
          token VARCHAR(128) NOT NULL,
          created_at DATETIME NOT NULL,
          expires_at DATETIME NOT NULL,
          PRIMARY KEY (id),
          UNIQUE KEY uq_csrf_token_id (token_id),
          KEY idx_user_token_expiry (user_id(64), token(64), expires_at),
          KEY idx_expires_at (expires_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `)
    } else {
      if (before.userIdType !== 'varchar(191)' || before.userIdNullable !== 'NO') {
        await db.execute(`ALTER TABLE ${TABLE_NAME} MODIFY COLUMN user_id VARCHAR(191) NOT NULL`)
      }
      if (!before.indexes.includes('idx_user_token_expiry')) {
        await db.execute(`ALTER TABLE ${TABLE_NAME} ADD KEY idx_user_token_expiry (user_id(64), token(64), expires_at)`)
      }
    }

    const after = await inspect(db)
    if (!after.exists || after.userIdType !== 'varchar(191)' || after.userIdNullable !== 'NO' || !after.indexes.includes('idx_user_token_expiry')) {
      throw new Error('csrf_tokens 迁移后校验失败')
    }
    console.log(JSON.stringify({
      status: changes.length === 0 ? 'already_ready' : 'migrated_and_verified',
      database: process.env.DB_NAME,
      table: TABLE_NAME,
      user_id_type: after.userIdType,
      index: 'idx_user_token_expiry'
    }, null, 2))
  } finally {
    await db.end()
  }
}

main().catch(error => {
  console.error(JSON.stringify({
    status: 'failed',
    code: error.code || 'CSRF_TOKEN_MIGRATION_ERROR',
    message: error.message
  }, null, 2))
  process.exitCode = 1
})
