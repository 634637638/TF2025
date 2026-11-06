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
const TABLE_NAME = 'site_announcements'
const EXPECTED_COLUMNS = [
  ['id', 'int unsigned', 'NO'],
  ['title', 'varchar(150)', 'NO'],
  ['content', 'mediumtext', 'NO'],
  ['is_published', 'tinyint unsigned', 'NO'],
  ['is_pinned', 'tinyint unsigned', 'NO'],
  ['published_at', 'datetime', 'YES'],
  ['expires_at', 'datetime', 'YES'],
  ['created_at', 'datetime', 'NO'],
  ['updated_at', 'datetime', 'NO']
]

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
    `SELECT TABLE_NAME FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [TABLE_NAME]
  )
  if (tables.length === 0) return { exists: false }

  const [columns] = await db.execute(
    `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [TABLE_NAME]
  )
  const [indexes] = await db.execute(
    `SELECT INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
     ORDER BY INDEX_NAME, SEQ_IN_INDEX`,
    [TABLE_NAME]
  )
  const pending = []
  for (const [name, type, nullable] of EXPECTED_COLUMNS) {
    const column = columns.find(item => item.COLUMN_NAME === name)
    if (!column) pending.push(`add_${name}`)
    else if (name === 'content' && String(column.COLUMN_TYPE).toLowerCase() === 'text') pending.push('expand_content_to_mediumtext')
    else if (String(column.COLUMN_TYPE).toLowerCase() !== type || column.IS_NULLABLE !== nullable) throw new Error(`${TABLE_NAME}.${name} 不符合预期结构`)
  }
  const publishedIndexColumns = indexes
    .filter(item => item.INDEX_NAME === 'idx_site_announcements_published')
    .map(item => item.COLUMN_NAME)
  if (publishedIndexColumns.join(',') !== 'is_published,published_at') {
    throw new Error(`${TABLE_NAME} 缺少公告发布状态索引`)
  }
  return { exists: true, pending }
}

async function main() {
  const db = await createConnection()
  try {
    const before = await inspect(db)
    if ((!before.exists || before.pending.length) && !applyChanges) {
      console.log(JSON.stringify({
        status: 'dry_run',
        database: process.env.DB_NAME,
        pending: before.exists ? before.pending : ['create_site_announcements'],
        apply_command: 'npm run migrate:site-announcements -- --apply'
      }, null, 2))
      return
    }

    if (!before.exists) {
      await db.execute(`
        CREATE TABLE ${TABLE_NAME} (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT,
          title VARCHAR(150) NOT NULL,
          content MEDIUMTEXT NOT NULL,
          is_published TINYINT UNSIGNED NOT NULL DEFAULT 0,
          is_pinned TINYINT UNSIGNED NOT NULL DEFAULT 0,
          published_at DATETIME NULL,
          expires_at DATETIME NULL,
          created_at DATETIME NOT NULL,
          updated_at DATETIME NOT NULL,
          PRIMARY KEY (id),
          KEY idx_site_announcements_published (is_published, published_at),
          KEY idx_site_announcements_expires (expires_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `)
    } else if (before.exists) {
      if (before.pending.includes('add_is_pinned')) {
        await db.execute('ALTER TABLE site_announcements ADD COLUMN is_pinned TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER is_published')
      }
      if (before.pending.includes('expand_content_to_mediumtext')) {
        await db.execute('ALTER TABLE site_announcements MODIFY content MEDIUMTEXT NOT NULL')
      }
    }

    const after = await inspect(db)
    if (!after.exists) throw new Error('公告表迁移后校验失败')
    console.log(JSON.stringify({
      status: before.exists && before.pending.length === 0 ? 'already_ready' : 'migrated_and_verified',
      database: process.env.DB_NAME,
      table: TABLE_NAME
    }, null, 2))
  } finally {
    await db.end()
  }
}

main().catch(error => {
  console.error(JSON.stringify({
    status: 'failed',
    code: error.code || 'SITE_ANNOUNCEMENT_MIGRATION_ERROR',
    message: error.message
  }, null, 2))
  process.exitCode = 1
})
