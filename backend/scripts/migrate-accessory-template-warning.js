'use strict'
const fs = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')
async function inspect(db) {
  const [columns] = await db.query("SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'accessories' AND COLUMN_NAME = 'min_stock'")
  if (!columns.length) return false
  const field = columns[0]
  if (!/^int(?:\(\d+\))? unsigned$/.test(field.COLUMN_TYPE) || field.IS_NULLABLE !== 'NO' || Number(field.COLUMN_DEFAULT) !== 5) throw new Error('模板预警字段结构冲突，拒绝覆盖')
  return true
}
async function migrate(db, { apply = false, backupFile } = {}) {
  if (await inspect(db)) return { status: 'already_ready', writes: false }
  if (!apply) return { status: 'dry_run', writes: false, sql: 'ALTER TABLE accessories ADD COLUMN min_stock INT UNSIGNED NOT NULL DEFAULT 5' }
  if (!backupFile) throw new Error('执行必须提供 --backup-file')
  const [[schema]] = await db.query('SHOW CREATE TABLE accessories')
  const [rows] = await db.query('SELECT * FROM accessories ORDER BY id')
  const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')
  const file = path.resolve(backupFile)
  await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 })
  await fs.writeFile(file, JSON.stringify({ schema, rows }, null, 2), { flag: 'wx', mode: 0o600 })
  await db.query('ALTER TABLE accessories ADD COLUMN min_stock INT UNSIGNED NOT NULL DEFAULT 5')
  const [after] = await db.query('SELECT * FROM accessories ORDER BY id')
  if (!await inspect(db) || digest(after.map(({ min_stock: _warning, ...original }) => original)) !== digest(rows)) throw new Error('模板预警迁移核验失败，请保留备份核对')
  return { status: 'migrated_and_verified', writes: true, originalDataUnchanged: true }
}
async function main() {
  const { db: config } = require('../src/config')
  const db = await require('mysql2/promise').createConnection({ ...config, connectTimeout: 15000 })
  try { console.log(JSON.stringify(await migrate(db, { apply: process.argv.includes('--apply'), backupFile: process.argv.find(arg => arg.startsWith('--backup-file='))?.slice(14) }))) }
  finally { await db.end() }
}
if (require.main === module) main().catch(error => { console.error({ status: 'failed', code: error.code || 'ACCESSORY_WARNING_MIGRATION_ERROR', message: error.code ? '数据库或备份操作失败' : error.message }); process.exitCode = 1 })
module.exports = { migrate, inspect }
