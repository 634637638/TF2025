'use strict'

const fs = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')

const { inspect, definitions, indexes, DDL } = require('../src/utils/accessory-inventory-adjustment-schema')
const table = 'accessory_inventory_adjustments'
const originalTables = ['accessory_inventory_events', 'accessory_stock', 'accessory_stock_in']
const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')

async function snapshot(db) {
  const result = {}
  for (const name of originalTables) {
    const [rows] = await db.query(`SELECT * FROM ${name} ORDER BY id`)
    result[name] = { count: rows.length, digest: digest(rows) }
  }
  return result
}

async function migrate(db, { apply = false, rollback = false, backupFile } = {}) {
  const state = await inspect(db)
  if (rollback) {
    if (!state.exists) return { status: 'already_ready', writes: false }
    const [[count]] = await db.query(`SELECT COUNT(*) AS count FROM ${table}`)
    if (Number(count.count)) throw new Error('已有盘点审计记录，拒绝删除')
    if (!apply) return { status: 'dry_run', writes: false, sql: `DROP TABLE ${table}` }
    if (!backupFile) throw new Error('执行回退必须提供 --backup-file')
    await saveBackup(db, backupFile, true)
    await db.query(`DROP TABLE ${table}`)
    return { status: 'migrated_and_verified', writes: true, rollback: true }
  }
  if (state.exists) return { status: 'already_ready', writes: false }
  if (!apply) return { status: 'dry_run', writes: false, sql: DDL }
  if (!backupFile) throw new Error('执行必须提供 --backup-file；须先完整备份并暂停配件库存写入')
  const before = await snapshot(db)
  await saveBackup(db, backupFile, false, before)
  await db.query(DDL)
  if (!(await inspect(db)).exists || JSON.stringify(await snapshot(db)) !== JSON.stringify(before)) throw new Error('库存盘点迁移核验失败')
  return { status: 'migrated_and_verified', writes: true, originalDataUnchanged: true }
}

async function saveBackup(db, filename, rollback, current) {
  const schema = {}
  for (const name of [...originalTables, ...(rollback ? [table] : [])]) {
    const [[row]] = await db.query(`SHOW CREATE TABLE ${name}`)
    schema[name] = row
  }
  const data = current || { [table]: { count: Number((await db.query(`SELECT COUNT(*) AS count FROM ${table}`))[0][0].count) } }
  const target = path.resolve(filename)
  await fs.mkdir(path.dirname(target), { recursive: true, mode: 0o700 })
  await fs.writeFile(target, JSON.stringify({ rollback, schema, data }, null, 2), { flag: 'wx', mode: 0o600 })
}

async function main() {
  const { db: config } = require('../src/config')
  const db = await require('mysql2/promise').createConnection({ ...config, connectTimeout: 15000 })
  try { console.log(JSON.stringify(await migrate(db, { apply: process.argv.includes('--apply'), rollback: process.argv.includes('--rollback'), backupFile: process.argv.find(arg => arg.startsWith('--backup-file='))?.slice(14) }))) }
  finally { await db.end() }
}
if (require.main === module) main().catch(error => { console.error({ status: 'failed', code: error.code || 'ACCESSORY_INVENTORY_ADJUSTMENT_MIGRATION_ERROR', message: error.code ? '数据库或备份操作失败' : error.message }); process.exitCode = 1 })
module.exports = { migrate, inspect, snapshot, definitions, indexes, DDL }
