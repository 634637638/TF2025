'use strict'

const fs = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')
const { inspect: inspectInventory, definitions, returnEventType, correctionEventTypes } = require('./migrate-accessory-inventory-events')

const RETURN_ENUM = returnEventType
const columns = {
  source_event_id: ['bigint unsigned', 'BIGINT UNSIGNED NULL'],
  return_key: ['varchar(100)', 'VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NULL'],
  return_hash: ['char(64)', 'CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL']
}
const originalTables = ['accessories', 'accessory_stock', 'accessory_stock_in', 'accessory_sales', 'accessory_serials', 'accessory_serial_events', 'accessory_inventory_events']
const indexes = { uq_accessory_return_source: ['return_key', 'source_event_id'], idx_accessory_return_source: ['source_event_id', 'id'] }
const type = value => String(value).toLowerCase().replace(/\b(bigint|int)\(\d+\)/g, '$1')

async function inspect(db) {
  if (!await inspectInventory(db)) throw new Error('请先完成批次库存流水迁移')
  const [fields] = await db.query(`SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLLATION_NAME
    FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'accessory_inventory_events'`)
  if (fields.some(row => !Object.hasOwn(definitions, row.COLUMN_NAME) && !Object.hasOwn(columns, row.COLUMN_NAME))) throw new Error('库存流水存在未知字段，请核对结构')
  const added = [], sql = []
  for (const [name, [target, ddl]] of Object.entries(columns)) {
    const field = fields.find(row => row.COLUMN_NAME === name)
    if (!field) { sql.push(`ADD COLUMN ${name} ${ddl}`); continue }
    if (type(field.COLUMN_TYPE) !== target || field.IS_NULLABLE !== 'YES' || name !== 'source_event_id' && field.COLLATION_NAME !== 'ascii_bin') throw new Error(`退货流水字段结构冲突：${name}`)
    added.push(name)
  }
  const eventType = type(fields.find(row => row.COLUMN_NAME === 'event_type')?.COLUMN_TYPE)
  if (eventType === definitions.event_type) sql.push(`MODIFY COLUMN event_type ${RETURN_ENUM} NOT NULL`)
  else if (eventType === correctionEventTypes[0]) sql.push(`MODIFY COLUMN event_type ${correctionEventTypes[1]} NOT NULL`)
  else if (![RETURN_ENUM.toLowerCase(), correctionEventTypes[1]].includes(eventType)) throw new Error('退货流水事件枚举冲突')
  const [keys] = await db.query(`SELECT INDEX_NAME, COLUMN_NAME, NON_UNIQUE, SEQ_IN_INDEX
    FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'accessory_inventory_events' ORDER BY INDEX_NAME, SEQ_IN_INDEX`)
  const addedIndexes = []
  if (keys.some(row => Number(row.NON_UNIQUE) === 0 && !['PRIMARY', 'uq_accessory_return_source'].includes(row.INDEX_NAME))) throw new Error('库存流水存在未知唯一索引')
  for (const [name, names] of Object.entries(indexes)) {
    const rows = keys.filter(row => row.INDEX_NAME === name), unique = name.startsWith('uq_')
    if (!rows.length) { sql.push(`ADD ${unique ? 'UNIQUE ' : ''}KEY ${name} (${names.join(', ')})`); continue }
    if (rows.map(row => row.COLUMN_NAME).join(',') !== names.join(',') || rows.some(row => Number(row.NON_UNIQUE) !== Number(!unique))) throw new Error(`退货流水索引结构冲突：${name}`)
    addedIndexes.push(name)
  }
  return { sql, added, addedIndexes, extended: [RETURN_ENUM.toLowerCase(), correctionEventTypes[1]].includes(eventType), corrected: correctionEventTypes.includes(eventType) }
}

async function snapshot(db) {
  const result = {}
  for (const table of originalTables) {
    const [rows] = await db.query(table === 'accessory_inventory_events'
      ? `SELECT ${Object.keys(definitions).join(', ')} FROM accessory_inventory_events ORDER BY id`
      : `SELECT * FROM ${table} ORDER BY id`)
    result[table] = { count: rows.length, digest: crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex') }
  }
  return result
}

async function migrate(db, { apply = false, rollback = false, backupFile } = {}) {
  const state = await inspect(db)
  let changes = state.sql
  if (rollback) {
    if (state.corrected) throw new Error('请先受控回退商品库存更正结构，再回退返库结构')
    if (state.added.length || state.extended) {
      const conditions = ["event_type IN ('sale_return','gift_return')", ...state.added.map(name => `${name} IS NOT NULL`)]
      const [[row]] = await db.query(`SELECT COUNT(*) AS count FROM accessory_inventory_events WHERE ${conditions.join(' OR ')}`)
      if (Number(row.count)) throw new Error('已有商品返库追踪，拒绝回退删除凭据')
    }
    changes = [...state.addedIndexes.map(name => `DROP INDEX ${name}`), ...state.added.map(name => `DROP COLUMN ${name}`),
      ...(state.extended ? [`MODIFY COLUMN event_type ${definitions.event_type} NOT NULL`] : [])]
  }
  if (!changes.length) return { status: 'already_ready', writes: false }
  const sql = `ALTER TABLE accessory_inventory_events ${changes.join(', ')}`
  if (!apply) return { status: 'dry_run', writes: false, sql, originalDataUnchanged: true }
  if (!backupFile) throw new Error('执行必须提供 --backup-file，保留完整备份并暂停库存业务写入')
  const before = await snapshot(db), schemas = {}
  for (const table of originalTables) { const [[schema]] = await db.query(`SHOW CREATE TABLE ${table}`); schemas[table] = schema }
  const filename = path.resolve(backupFile)
  await fs.mkdir(path.dirname(filename), { recursive: true, mode: 0o700 })
  await fs.writeFile(filename, JSON.stringify({ rollback, tables: before, schemas }, null, 2), { flag: 'wx', mode: 0o600 })
  await db.query(sql)
  const after = await inspect(db)
  if (!rollback && after.sql.length || rollback && (after.added.length || after.addedIndexes.length || after.extended)) throw new Error('退货流水迁移结构核验失败')
  if (JSON.stringify(await snapshot(db)) !== JSON.stringify(before)) throw new Error('原库存或销售凭据变化，请保留备份核对并发写入')
  return { status: 'migrated_and_verified', writes: true, originalDataUnchanged: true, rollback }
}

async function main() {
  const { db: config } = require('../src/config')
  const db = await require('mysql2/promise').createConnection({ ...config, connectTimeout: 15000 })
  try {
    console.log(JSON.stringify(await migrate(db, { apply: process.argv.includes('--apply'), rollback: process.argv.includes('--rollback'),
      backupFile: process.argv.find(arg => arg.startsWith('--backup-file='))?.slice(14) })))
  } finally { await db.end() }
}
if (require.main === module) main().catch(error => {
  console.error({ status: 'failed', code: error.code || 'ACCESSORY_RETURN_MIGRATION_ERROR', message: error.code ? '数据库或备份操作失败' : error.message })
  process.exitCode = 1
})
module.exports = { migrate }
