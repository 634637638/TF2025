'use strict'

const COLUMN = 'business_scope'
const ADD_SQL = "ALTER TABLE brands ADD COLUMN business_scope ENUM('phone','accessory','both') NOT NULL DEFAULT 'both' AFTER status"

async function inspect(db) {
  const [columns] = await db.query(
    `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'brands'`
  )
  if (!columns.length) throw new Error('缺少 brands 表，拒绝执行迁移')
  const column = columns.find(item => item.COLUMN_NAME === COLUMN)
  if (column && (column.COLUMN_TYPE.toLowerCase() !== "enum('phone','accessory','both')" || column.IS_NULLABLE !== 'NO' || column.COLUMN_DEFAULT !== 'both')) {
    throw new Error('business_scope 已存在但结构不符合预期，拒绝覆盖')
  }
  return Boolean(column)
}

async function migrate(db, { apply = false, backupConfirmed = false } = {}) {
  const exists = await inspect(db)
  if (exists) return { status: 'already_ready', writes: false }
  if (!apply) return { status: 'dry_run', changes: [ADD_SQL], writes: false }
  if (!backupConfirmed) throw new Error('执行前须确认目标环境、现有备份并传入 --backup-confirmed')
  await db.query(ADD_SQL)
  if (!await inspect(db)) throw new Error('迁移后字段核验失败')
  return { status: 'migrated_and_verified', changes: [ADD_SQL], writes: true }
}

async function main() {
  const envArg = process.argv.find(argument => argument.startsWith('--env-file='))
  if (envArg) process.env.ENV_FILE = envArg.slice('--env-file='.length)
  const { db: dbConfig } = require('../src/config')
  const db = await require('mysql2/promise').createConnection({ ...dbConfig, connectTimeout: 15000 })
  try {
    console.log(JSON.stringify(await migrate(db, {
      apply: process.argv.includes('--apply'),
      backupConfirmed: process.argv.includes('--backup-confirmed')
    }), null, 2))
  } finally {
    await db.end()
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(JSON.stringify({ status: 'failed', code: error.code || 'BRAND_SCOPE_SCHEMA_ERROR', message: error.code ? '数据库操作失败' : error.message }))
    process.exitCode = 1
  })
}

module.exports = { inspect, migrate }
