'use strict'

const COLUMN = 'product_model'
const ADD_SQL = 'ALTER TABLE accessories ADD COLUMN product_model VARCHAR(100) NULL AFTER category'
const DROP_SQL = 'ALTER TABLE accessories DROP COLUMN product_model'

async function inspect(db) {
  const [columns] = await db.query(
    `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'accessories'`
  )
  if (!columns.length) throw new Error('缺少 accessories 表，拒绝执行迁移')
  const column = columns.find(item => item.COLUMN_NAME === COLUMN)
  if (column && (column.COLUMN_TYPE.toLowerCase() !== 'varchar(100)' || column.IS_NULLABLE !== 'YES')) {
    throw new Error('product_model 已存在但结构不符合预期，拒绝覆盖')
  }
  return Boolean(column)
}

async function migrate(db, { apply = false, rollback = false, backupConfirmed = false } = {}) {
  const exists = await inspect(db)
  if ((!rollback && exists) || (rollback && !exists)) return { status: 'already_ready', rollback }
  if (rollback) {
    const [rows] = await db.query("SELECT COUNT(*) AS count FROM accessories WHERE product_model IS NOT NULL AND product_model <> ''")
    if (Number(rows[0].count) > 0) throw new Error('配件型号已有数据，拒绝删除字段；保留字段并回退应用代码')
  }
  const sql = rollback ? DROP_SQL : ADD_SQL
  if (!apply) return { status: 'dry_run', rollback, changes: [sql], writes: false }
  if (!backupConfirmed) throw new Error('执行前须确认目标环境、现有备份并传入 --backup-confirmed')
  await db.query(sql)
  if (await inspect(db) !== !rollback) throw new Error('迁移后字段核验失败')
  return { status: 'migrated_and_verified', rollback, changes: [sql] }
}

async function main() {
  const envArg = process.argv.find(argument => argument.startsWith('--env-file='))
  if (envArg) process.env.ENV_FILE = envArg.slice('--env-file='.length)
  const { db: dbConfig } = require('../src/config')
  const db = await require('mysql2/promise').createConnection({ ...dbConfig, connectTimeout: 15000 })
  try {
    const result = await migrate(db, {
      apply: process.argv.includes('--apply'),
      rollback: process.argv.includes('--rollback'),
      backupConfirmed: process.argv.includes('--backup-confirmed')
    })
    console.log(JSON.stringify(result, null, 2))
  } finally {
    await db.end()
  }
}

if (require.main === module) {
  main().catch(error => {
    // 数据库异常只输出错误码，避免驱动信息包含云端连接资料。
    console.error(JSON.stringify({ status: 'failed', code: error.code || 'ACCESSORY_SCHEMA_ERROR', message: error.code ? '数据库操作失败' : error.message }))
    process.exitCode = 1
  })
}

module.exports = { inspect, migrate }
