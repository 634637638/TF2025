'use strict'

const fs = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')
const { inspect: inspectInventory, correctionEventTypes } = require('./migrate-accessory-inventory-events')

const { inspectStockCorrectionSchema, definitions, indexes, DDL, table } = require('../src/utils/accessory-stock-correction-schema')
const originalTables = ['accessories', 'accessory_stock', 'accessory_stock_in', 'accessory_inventory_events', 'accessory_serials', 'accessory_serial_events', 'accessory_purchase_payments']

async function inspect(db) {
  if (!await inspectInventory(db)) throw new Error('请先完成批次库存流水迁移')
  return inspectStockCorrectionSchema(db)
}

async function snapshot(db) {
  const result = {}
  for (const name of originalTables) {
    const [rows] = await db.query(`SELECT * FROM ${name} ORDER BY id`)
    result[name] = { count: rows.length, digest: crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex') }
  }
  return result
}

async function migrate(db, { apply = false, rollback = false, backupFile } = {}) {
  const state = await inspect(db), extended = correctionEventTypes.includes(state.eventType)
  const sql = []
  if (rollback) {
    if (state.exists) {
      const [[row]] = await db.query(`SELECT COUNT(*) AS count FROM ${table}`)
      if (Number(row.count)) throw new Error('已有库存更正记录，拒绝删除前后事实或原单关联')
      sql.push(`DROP TABLE ${table}`)
    }
    if (extended) {
      const [[row]] = await db.query("SELECT COUNT(*) AS count FROM accessory_inventory_events WHERE event_type = 'stock_correct'")
      if (Number(row.count)) throw new Error('已有库存更正流水，拒绝回退')
      sql.push(`ALTER TABLE accessory_inventory_events MODIFY COLUMN event_type ${state.eventType.replace(",'stock_correct'", '')} NOT NULL`)
    }
  } else {
    if (!state.exists) sql.push(DDL)
    if (!extended) sql.push(`ALTER TABLE accessory_inventory_events MODIFY COLUMN event_type ${state.eventType.slice(0, -1)},'stock_correct') NOT NULL`)
  }
  if (!sql.length) return { status: 'already_ready', writes: false }
  if (!apply) return { status: 'dry_run', writes: false, sql, originalDataUnchanged: true }
  if (!backupFile) throw new Error('执行必须提供 --backup-file，且须先完整备份并暂停配件业务写入')
  const before = await snapshot(db), schemas = {}
  for (const name of [...originalTables, ...(state.exists ? [table] : [])]) {
    const [[schema]] = await db.query(`SHOW CREATE TABLE ${name}`); schemas[name] = schema
  }
  const filename = path.resolve(backupFile)
  await fs.mkdir(path.dirname(filename), { recursive: true, mode: 0o700 })
  await fs.writeFile(filename, JSON.stringify({ rollback, schemas, tables: before }, null, 2), { flag: 'wx', mode: 0o600 })
  for (const statement of sql) await db.query(statement)
  const after = await inspect(db)
  if (after.exists !== !rollback || correctionEventTypes.includes(after.eventType) !== !rollback) throw new Error('库存更正迁移结构核验失败')
  if (JSON.stringify(await snapshot(db)) !== JSON.stringify(before)) throw new Error('原业务记录发生变化，请保留备份核对并发写入')
  return { status: 'migrated_and_verified', writes: true, originalDataUnchanged: true, rollback }
}

async function main() {
  const { db: config } = require('../src/config')
  const db = await require('mysql2/promise').createConnection({ ...config, connectTimeout: 15000 })
  try { console.log(JSON.stringify(await migrate(db, { apply: process.argv.includes('--apply'), rollback: process.argv.includes('--rollback'), backupFile: process.argv.find(arg => arg.startsWith('--backup-file='))?.slice(14) }))) }
  finally { await db.end() }
}
if (require.main === module) main().catch(error => { console.error({ status: 'failed', code: error.code || 'STOCK_CORRECTION_MIGRATION_ERROR', message: error.code ? '数据库或备份操作失败' : error.message }); process.exitCode = 1 })
module.exports = { migrate, inspect, definitions, indexes }
