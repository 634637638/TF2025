'use strict'

const fs = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')
const { inspect: inspectLedger } = require('./migrate-customer-points-ledger')

const TABLE = 'customer_points_aftersales'
const columns = {
  id: ['bigint unsigned', 'NO'], request_key: ['varchar(100)', 'NO'], request_hash: ['char(64)', 'NO'],
  customer_id: ['int', 'NO'], operation_type: ["enum('award_return','redemption_return')", 'NO'],
  source_type: ["enum('phone_sale','checkout_item')", 'NO'], source_id: ['bigint unsigned', 'NO'],
  points: ['int unsigned', 'NO'], balance_delta: ['int', 'NO'], amount_cents: ['bigint unsigned', 'NO'],
  balance_after: ['int unsigned', 'NO'], allocation_snapshot: ['json', 'NO'], created_at: ['datetime', 'NO']
}
const indexes = { PRIMARY: ['id'], uq_points_aftersale_request: ['request_key'],
  idx_points_aftersale_customer: ['customer_id', 'id'], idx_points_aftersale_source: ['source_type', 'source_id', 'customer_id', 'id'] }
const create = `CREATE TABLE customer_points_aftersales (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  request_key VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  request_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  customer_id INT NOT NULL, operation_type ENUM('award_return','redemption_return') NOT NULL,
  source_type ENUM('phone_sale','checkout_item') NOT NULL, source_id BIGINT UNSIGNED NOT NULL,
  points INT UNSIGNED NOT NULL, balance_delta INT NOT NULL, amount_cents BIGINT UNSIGNED NOT NULL,
  balance_after INT UNSIGNED NOT NULL, allocation_snapshot JSON NOT NULL, created_at DATETIME NOT NULL,
  UNIQUE KEY uq_points_aftersale_request (request_key), KEY idx_points_aftersale_customer (customer_id, id),
  KEY idx_points_aftersale_source (source_type, source_id, customer_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
const originalTables = ['customers', 'sales', 'sales_order_items', 'customer_points_entries', 'customer_points_allocations']
const type = value => String(value).toLowerCase().replace(/\b(int|bigint)\(\d+\)/g, '$1')

async function inspect(db) {
  const ledger = await inspectLedger(db)
  if (ledger.sql.length) throw new Error('请先完成积分来源及消费分配账迁移，不创建替代账表')
  const [tables] = await db.query(`SELECT TABLE_NAME, ENGINE FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer_points_aftersales'`)
  if (!tables.length) return { exists: false, sql: [create] }
  if (tables.length !== 1 || tables[0].ENGINE !== 'InnoDB') throw new Error('积分售后账必须使用InnoDB')
  const [fields] = await db.query(`SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, EXTRA, COLLATION_NAME
    FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer_points_aftersales'`)
  if (fields.length !== Object.keys(columns).length) throw new Error('积分售后账字段数量冲突')
  for (const [name, [target, nullable]] of Object.entries(columns)) {
    const field = fields.find(row => row.COLUMN_NAME === name)
    if (!field || type(field.COLUMN_TYPE) !== target || field.IS_NULLABLE !== nullable ||
      name === 'id' && !field.EXTRA?.includes('auto_increment') ||
      ['request_key', 'request_hash'].includes(name) && field.COLLATION_NAME !== 'ascii_bin') throw new Error(`积分售后账字段结构冲突：${name}`)
  }
  const [keys] = await db.query(`SELECT INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX, NON_UNIQUE
    FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer_points_aftersales' ORDER BY SEQ_IN_INDEX`)
  if (keys.some(row => Number(row.NON_UNIQUE) === 0 && !Object.hasOwn(indexes, row.INDEX_NAME))) throw new Error('积分售后账存在未知唯一索引')
  for (const [name, fields] of Object.entries(indexes)) {
    const rows = keys.filter(row => row.INDEX_NAME === name), unique = name === 'PRIMARY' || name.startsWith('uq_')
    if (rows.map(row => row.COLUMN_NAME).join(',') !== fields.join(',') || rows.some(row => Number(row.NON_UNIQUE) !== Number(!unique))) throw new Error(`积分售后账索引冲突：${name}`)
  }
  const [foreignKeys] = await db.query(`SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer_points_aftersales' AND REFERENCED_TABLE_NAME IS NOT NULL`)
  if (foreignKeys.length) throw new Error('积分售后账存在未知外键，不允许级联删除凭据')
  return { exists: true, sql: [] }
}

async function snapshot(db) {
  const result = {}
  for (const table of originalTables) {
    const [rows] = await db.query(`SELECT * FROM \`${table}\` ORDER BY id`)
    result[table] = { count: rows.length, digest: crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex') }
  }
  return result
}

async function migrate(db, { apply = false, rollback = false, backupFile } = {}) {
  const state = await inspect(db)
  let sql = state.sql
  if (rollback) {
    if (state.exists) {
      const [[row]] = await db.query('SELECT COUNT(*) AS count FROM customer_points_aftersales')
      if (Number(row.count)) throw new Error('已有积分售后历史，拒绝回退删表')
    }
    sql = state.exists ? ['DROP TABLE `customer_points_aftersales`'] : []
  }
  if (!sql.length) return { status: 'already_ready', writes: false }
  if (!apply) return { status: 'dry_run', writes: false, sql, originalDataUnchanged: true }
  if (!backupFile) throw new Error('执行必须提供 --backup-file，且保留完整可恢复备份；请暂停积分业务写入')
  const before = await snapshot(db), schemas = {}
  for (const table of [...originalTables, ...(state.exists ? [TABLE] : [])]) {
    const [[schema]] = await db.query(`SHOW CREATE TABLE \`${table}\``)
    schemas[table] = schema
  }
  const filename = path.resolve(backupFile)
  await fs.mkdir(path.dirname(filename), { recursive: true, mode: 0o700 })
  await fs.writeFile(filename, JSON.stringify({ rollback, tables: before, schemas }, null, 2), { flag: 'wx', mode: 0o600 })
  for (const statement of sql) await db.query(statement)
  const after = await inspect(db)
  if (after.exists === rollback) throw new Error('积分售后账迁移结构核验失败')
  if (JSON.stringify(await snapshot(db)) !== JSON.stringify(before)) throw new Error('原余额或销售积分凭据变化，请保留备份核对并发写入')
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
  console.error({ status: 'failed', code: error.code || 'POINTS_AFTERSALE_MIGRATION_ERROR', message: error.code ? '数据库或备份操作失败' : error.message })
  process.exitCode = 1
})
module.exports = { migrate }
