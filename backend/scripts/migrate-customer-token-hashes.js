'use strict'

const path = require('node:path')
const dotenv = require('dotenv')
const mysql = require('mysql2/promise')

dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true })

const HASH_COLUMN = 'token_hash'
const HASH_INDEX = 'uk_customer_tokens_token_hash'
const applyChanges = process.argv.includes('--apply')
const finalizeChanges = process.argv.includes('--finalize')
const rollbackChanges = process.argv.includes('--rollback')

if ([applyChanges, finalizeChanges, rollbackChanges].filter(Boolean).length > 1) {
  throw new Error('--apply、--finalize 与 --rollback 不能同时使用')
}

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

async function inspectSchema(db) {
  const [columns] = await db.execute(
    `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'customer_tokens'
       AND COLUMN_NAME IN ('token', ?)` ,
    [HASH_COLUMN]
  )
  const [indexes] = await db.execute(
    `SELECT INDEX_NAME, NON_UNIQUE, COLUMN_NAME, SEQ_IN_INDEX
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer_tokens'
     ORDER BY INDEX_NAME, SEQ_IN_INDEX`
  )
  const tokenColumn = columns.find(column => column.COLUMN_NAME === 'token') || null
  const hashColumn = columns.find(column => column.COLUMN_NAME === HASH_COLUMN) || null
  const hashIndexes = indexes.filter(index => index.COLUMN_NAME === HASH_COLUMN)

  return { columns, indexes, tokenColumn, hashColumn, hashIndexes }
}

async function inspectData(db, hasHashColumn) {
  const hashSelect = hasHashColumn
    ? `SUM(CASE WHEN ${HASH_COLUMN} REGEXP '^[0-9a-f]{64}$' THEN 1 ELSE 0 END) AS hashed_tokens,
       SUM(CASE WHEN ${HASH_COLUMN} IS NULL OR ${HASH_COLUMN} = '' THEN 1 ELSE 0 END) AS missing_hashes,
       SUM(CASE WHEN token IS NOT NULL AND token <> '' AND ${HASH_COLUMN} <> SHA2(token, 256) THEN 1 ELSE 0 END) AS mismatched_hashes`
    : '0 AS hashed_tokens, COUNT(*) AS missing_hashes, 0 AS mismatched_hashes'
  const [[row]] = await db.execute(`
    SELECT COUNT(*) AS total,
           SUM(CASE WHEN token IS NOT NULL AND token <> '' THEN 1 ELSE 0 END) AS plaintext_tokens,
           ${hashSelect}
    FROM customer_tokens
  `)
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value || 0)]))
}

function groupIndexes(indexes) {
  const grouped = new Map()
  for (const index of indexes) {
    if (!grouped.has(index.INDEX_NAME)) grouped.set(index.INDEX_NAME, [])
    grouped.get(index.INDEX_NAME).push(index.COLUMN_NAME)
  }
  return grouped
}

function validateReadySchema(schema) {
  const uniqueHashIndex = schema.hashIndexes.some(index => Number(index.NON_UNIQUE) === 0)
  if (!schema.hashColumn || !/^char\(64\)$/i.test(String(schema.hashColumn.COLUMN_TYPE || '')) || !uniqueHashIndex) {
    throw new Error('customer_tokens.token_hash 或唯一索引未正确建立')
  }
  if (!schema.tokenColumn || schema.tokenColumn.IS_NULLABLE !== 'YES') {
    throw new Error('customer_tokens.token 必须允许 NULL 才能停止写入明文')
  }
}

async function applyMigration(db, schema) {
  if (!schema.hashColumn) {
    await db.execute(`ALTER TABLE customer_tokens ADD COLUMN ${HASH_COLUMN} CHAR(64) NULL AFTER token`)
  }
  if (schema.tokenColumn?.IS_NULLABLE !== 'YES') {
    await db.execute('ALTER TABLE customer_tokens MODIFY COLUMN token VARCHAR(255) NULL')
  }

  await db.execute(`
    UPDATE customer_tokens
    SET ${HASH_COLUMN} = SHA2(token, 256)
    WHERE token IS NOT NULL AND token <> ''
      AND (${HASH_COLUMN} IS NULL OR ${HASH_COLUMN} = '')
  `)

  const refreshed = await inspectSchema(db)
  const uniqueHashIndex = refreshed.hashIndexes.some(index => Number(index.NON_UNIQUE) === 0)
  if (!uniqueHashIndex) {
    await db.execute(`ALTER TABLE customer_tokens ADD UNIQUE INDEX ${HASH_INDEX} (${HASH_COLUMN})`)
  }

  const verifiedSchema = await inspectSchema(db)
  validateReadySchema(verifiedSchema)
  const data = await inspectData(db, true)
  if (data.missing_hashes > 0 || data.mismatched_hashes > 0 || data.hashed_tokens !== data.total) {
    throw new Error('客户 Token 摘要回填校验失败')
  }
  return data
}

async function finalizeMigration(db, schema) {
  validateReadySchema(schema)
  const before = await inspectData(db, true)
  if (before.missing_hashes > 0 || before.mismatched_hashes > 0 || before.hashed_tokens !== before.total) {
    throw new Error('Token 摘要未完整覆盖，拒绝清空明文')
  }

  await db.beginTransaction()
  try {
    await db.execute("UPDATE customer_tokens SET token = NULL WHERE token IS NOT NULL AND token <> ''")
    await db.commit()
  } catch (error) {
    await db.rollback()
    throw error
  }

  const indexGroups = groupIndexes(schema.indexes)
  for (const [indexName, columns] of indexGroups.entries()) {
    if (indexName !== 'PRIMARY' && columns.length === 1 && columns[0] === 'token') {
      await db.execute(`ALTER TABLE customer_tokens DROP INDEX \`${indexName.replace(/`/g, '``')}\``)
    }
  }

  const after = await inspectData(db, true)
  if (after.plaintext_tokens !== 0 || after.missing_hashes > 0) {
    throw new Error('客户 Token 明文清理校验失败')
  }
  return after
}

async function rollbackMigration(db, schema) {
  if (!schema.hashColumn) return { status: 'already_rolled_back' }
  const data = await inspectData(db, true)
  if (data.plaintext_tokens !== data.total) {
    throw new Error('部分或全部明文 Token 已清空，无法从 SHA-256 摘要反推；请恢复数据库备份后回滚旧应用')
  }

  const hashIndexNames = [...new Set(schema.hashIndexes.map(index => index.INDEX_NAME))]
  for (const indexName of hashIndexNames) {
    await db.execute(`ALTER TABLE customer_tokens DROP INDEX \`${indexName.replace(/`/g, '``')}\``)
  }
  await db.execute(`ALTER TABLE customer_tokens DROP COLUMN ${HASH_COLUMN}`)
  await db.execute('ALTER TABLE customer_tokens MODIFY COLUMN token VARCHAR(255) NOT NULL')
  return { status: 'rolled_back_and_verified' }
}

async function main() {
  const db = await createConnection()
  try {
    const [[databaseRow]] = await db.execute('SELECT DATABASE() AS database_name')
    const schema = await inspectSchema(db)
    if (!schema.tokenColumn) throw new Error('customer_tokens.token 列不存在')
    const data = await inspectData(db, Boolean(schema.hashColumn))

    if (!applyChanges && !finalizeChanges && !rollbackChanges) {
      const finalized = Boolean(schema.hashColumn) && data.total === data.hashed_tokens && data.plaintext_tokens === 0
      console.log(JSON.stringify({
        status: finalized ? 'finalized' : (schema.hashColumn ? 'ready_for_finalize' : 'dry_run'),
        database: databaseRow?.database_name || process.env.DB_NAME,
        schema: {
          token_nullable: schema.tokenColumn.IS_NULLABLE === 'YES',
          token_hash_exists: Boolean(schema.hashColumn),
          token_hash_unique: schema.hashIndexes.some(index => Number(index.NON_UNIQUE) === 0)
        },
        data,
        instruction: finalized
          ? null
          : (schema.hashColumn
          ? '确认应用已按 token_hash 读写后使用 --finalize 清空明文；完成前仍可 --rollback'
          : '确认预览后使用 --apply 回填摘要并保留明文兼容窗口'
          )
      }, null, 2))
      return
    }

    if (rollbackChanges) {
      const result = await rollbackMigration(db, schema)
      console.log(JSON.stringify({ ...result, database: databaseRow?.database_name || process.env.DB_NAME }, null, 2))
      return
    }

    const result = finalizeChanges
      ? await finalizeMigration(db, schema)
      : await applyMigration(db, schema)
    console.log(JSON.stringify({
      status: finalizeChanges ? 'finalized_and_verified' : 'migrated_and_verified',
      database: databaseRow?.database_name || process.env.DB_NAME,
      data: result
    }, null, 2))
  } finally {
    await db.end()
  }
}

main().catch(error => {
  console.error(JSON.stringify({
    status: 'failed',
    code: error.code || 'CUSTOMER_TOKEN_HASH_MIGRATION_ERROR',
    message: error.message
  }, null, 2))
  process.exitCode = 1
})
