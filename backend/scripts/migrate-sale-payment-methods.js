'use strict'

const fs = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')

const LEGACY_TYPE = "enum('cash','card','mobile','transfer','mixed')"
const TARGET_TYPE = 'varchar(20)'
const digest = rows => crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex')

async function inspect(db) {
  const [rows] = await db.query("SELECT COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payment_records' AND COLUMN_NAME = 'payment_method'")
  const column = rows[0]
  if (!column || ![LEGACY_TYPE, TARGET_TYPE].includes(column.COLUMN_TYPE) || column.IS_NULLABLE !== 'NO' || column.COLUMN_DEFAULT !== null) {
    throw new Error('收款方式字段结构冲突，拒绝覆盖')
  }
  return column.COLUMN_TYPE
}

async function migrate(db, { apply = false, rollback = false, backupFile } = {}) {
  const currentType = await inspect(db)
  const targetType = rollback ? LEGACY_TYPE : TARGET_TYPE
  if (currentType === targetType) return { status: 'already_ready', writes: false }
  if (rollback) {
    const [[row]] = await db.query("SELECT COUNT(*) AS count FROM payment_records WHERE payment_method NOT IN ('cash','card','mobile','transfer','mixed')")
    if (Number(row.count)) throw new Error('已有旧枚举无法容纳的收款方式，拒绝回退截断记录')
  }
  const sql = `ALTER TABLE payment_records MODIFY COLUMN payment_method ${targetType} NOT NULL`
  if (!apply) return { status: 'dry_run', writes: false, sql }
  if (!backupFile) throw new Error('执行必须提供 --backup-file')
  const [[schema]] = await db.query('SHOW CREATE TABLE payment_records')
  const [before] = await db.query('SELECT * FROM payment_records ORDER BY id')
  const backup = { table: 'payment_records', schema, count: before.length, digest: digest(before), rollback }
  const filename = path.resolve(backupFile)
  await fs.mkdir(path.dirname(filename), { recursive: true, mode: 0o700 })
  await fs.writeFile(filename, JSON.stringify(backup, null, 2), { flag: 'wx', mode: 0o600 })
  await db.query(sql)
  if (await inspect(db) !== targetType) throw new Error('收款方式迁移结构核验失败')
  const [after] = await db.query('SELECT * FROM payment_records ORDER BY id')
  if (digest(after) !== backup.digest) throw new Error('原收款数据变化，请保留备份核对并发写入')
  return { status: 'migrated_and_verified', writes: true, originalDataUnchanged: true, rollback }
}

async function main() {
  const { db: config } = require('../src/config')
  const db = await require('mysql2/promise').createConnection({ ...config, connectTimeout: 15000 })
  try {
    console.log(JSON.stringify(await migrate(db, {
      apply: process.argv.includes('--apply'), rollback: process.argv.includes('--rollback'),
      backupFile: process.argv.find(arg => arg.startsWith('--backup-file='))?.slice(14)
    })))
  } finally { await db.end() }
}

if (require.main === module) main().catch(error => {
  console.error({ status: 'failed', code: error.code || 'SALE_PAYMENT_MIGRATION_ERROR', message: error.code ? '数据库或备份操作失败' : error.message })
  process.exitCode = 1
})
module.exports = { migrate, inspect, LEGACY_TYPE, TARGET_TYPE }
