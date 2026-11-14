'use strict'

const fs = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')

const definitions = {
  customer_points_entries: {
    columns: {
      id: ['bigint unsigned', 'NO'], customer_id: ['int', 'NO'],
      entry_type: ["enum('award','revoke','redeem')", 'NO'], source_type: ["enum('phone_sale','checkout_item')", 'NO'],
      source_id: ['bigint unsigned', 'NO'], points: ['int', 'NO'], untracked_points: ['int unsigned', 'NO'],
      balance_after: ['int unsigned', 'NO'], amount_cents: ['bigint unsigned', 'YES'], points_per_yuan: ['int unsigned', 'YES'],
      redemption_item_id: ['bigint unsigned', 'YES'], source_snapshot: ['json', 'NO'], created_at: ['datetime', 'NO']
    },
    indexes: { PRIMARY: ['id'], uq_points_redemption_item: ['redemption_item_id'],
      idx_points_customer: ['customer_id', 'id'], idx_points_source: ['source_type', 'source_id', 'customer_id', 'id'] },
    sql: `CREATE TABLE customer_points_entries (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      customer_id INT NOT NULL, entry_type ENUM('award','revoke','redeem') NOT NULL,
      source_type ENUM('phone_sale','checkout_item') NOT NULL, source_id BIGINT UNSIGNED NOT NULL,
      points INT NOT NULL, untracked_points INT UNSIGNED NOT NULL DEFAULT 0, balance_after INT UNSIGNED NOT NULL,
      amount_cents BIGINT UNSIGNED NULL, points_per_yuan INT UNSIGNED NULL, redemption_item_id BIGINT UNSIGNED NULL,
      source_snapshot JSON NOT NULL, created_at DATETIME NOT NULL,
      UNIQUE KEY uq_points_redemption_item (redemption_item_id), KEY idx_points_customer (customer_id, id),
      KEY idx_points_source (source_type, source_id, customer_id, id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },
  customer_points_allocations: {
    columns: {
      id: ['bigint unsigned', 'NO'], debit_entry_id: ['bigint unsigned', 'NO'], credit_entry_id: ['bigint unsigned', 'NO'],
      points: ['int unsigned', 'NO'], amount_cents: ['bigint unsigned', 'YES'], created_at: ['datetime', 'NO']
    },
    indexes: { PRIMARY: ['id'], uq_points_allocation: ['debit_entry_id', 'credit_entry_id'], idx_points_credit: ['credit_entry_id', 'id'] },
    sql: `CREATE TABLE customer_points_allocations (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      debit_entry_id BIGINT UNSIGNED NOT NULL, credit_entry_id BIGINT UNSIGNED NOT NULL,
      points INT UNSIGNED NOT NULL, amount_cents BIGINT UNSIGNED NULL, created_at DATETIME NOT NULL,
      UNIQUE KEY uq_points_allocation (debit_entry_id, credit_entry_id), KEY idx_points_credit (credit_entry_id, id),
      CONSTRAINT fk_points_allocation_debit FOREIGN KEY (debit_entry_id) REFERENCES customer_points_entries(id),
      CONSTRAINT fk_points_allocation_credit FOREIGN KEY (credit_entry_id) REFERENCES customer_points_entries(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  }
}
const originals = {
  customers: ['id', 'points'], sales: ['id', 'customer_id', 'points_awarded', 'points_accounted_at'],
  sales_order_items: ['id', 'order_id', 'points_awarded']
}
const type = value => String(value).toLowerCase().replace(/\b(int|bigint)\(\d+\)/g, '$1')
const digest = rows => crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex')
const unique = name => name === 'PRIMARY' || name.startsWith('uq_')

async function inspect(db) {
  const [tables] = await db.query(`SELECT TABLE_NAME, ENGINE FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('customers','sales','sales_order_items','customer_points_entries','customer_points_allocations')`)
  for (const name of Object.keys(originals)) if (!tables.some(row => row.TABLE_NAME === name)) throw new Error('请先完成销售积分凭据及共同结算迁移，不创建替代主表')
  if (tables.some(row => row.ENGINE !== 'InnoDB')) throw new Error('积分账及原业务表必须使用InnoDB')
  const [columns] = await db.query(`SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
    FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME IN ('customers','sales','sales_order_items','customer_points_entries','customer_points_allocations')`)
  for (const [table, fields] of Object.entries(originals)) for (const field of fields) {
    if (!columns.some(row => row.TABLE_NAME === table && row.COLUMN_NAME === field)) throw new Error(`原积分凭据缺少字段：${table}.${field}`)
  }
  const [indexes] = await db.query(`SELECT TABLE_NAME, INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX, NON_UNIQUE
    FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME IN ('customer_points_entries','customer_points_allocations') ORDER BY SEQ_IN_INDEX`)
  const [foreignKeys] = await db.query(`SELECT k.TABLE_NAME, k.CONSTRAINT_NAME, k.COLUMN_NAME, k.REFERENCED_TABLE_NAME,
    k.REFERENCED_COLUMN_NAME, r.DELETE_RULE, r.UPDATE_RULE
    FROM information_schema.KEY_COLUMN_USAGE k JOIN information_schema.REFERENTIAL_CONSTRAINTS r
    ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA AND r.TABLE_NAME = k.TABLE_NAME AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME
    WHERE k.CONSTRAINT_SCHEMA = DATABASE() AND k.TABLE_NAME IN ('customer_points_entries','customer_points_allocations')`)
  const sql = [], existing = []
  for (const [table, definition] of Object.entries(definitions)) {
    if (!tables.some(row => row.TABLE_NAME === table)) { sql.push(definition.sql); continue }
    existing.push(table)
    for (const [name, [target, nullable]] of Object.entries(definition.columns)) {
      const row = columns.find(column => column.TABLE_NAME === table && column.COLUMN_NAME === name)
      if (!row || type(row.COLUMN_TYPE) !== target || row.IS_NULLABLE !== nullable ||
        name === 'id' && !row.EXTRA?.includes('auto_increment') || name === 'untracked_points' && String(row.COLUMN_DEFAULT) !== '0') throw new Error(`积分账字段结构冲突：${table}.${name}`)
    }
    if (columns.filter(row => row.TABLE_NAME === table).length !== Object.keys(definition.columns).length) throw new Error(`积分账存在未知字段：${table}`)
    if (indexes.some(row => row.TABLE_NAME === table && Number(row.NON_UNIQUE) === 0 && !Object.hasOwn(definition.indexes, row.INDEX_NAME))) throw new Error(`积分账存在未知唯一索引：${table}`)
    for (const [name, fields] of Object.entries(definition.indexes)) {
      const rows = indexes.filter(row => row.TABLE_NAME === table && row.INDEX_NAME === name)
      if (rows.map(row => row.COLUMN_NAME).join(',') !== fields.join(',') || rows.some(row => Number(row.NON_UNIQUE) !== Number(!unique(name)))) throw new Error(`积分账索引结构冲突：${name}`)
    }
    if (foreignKeys.filter(row => row.TABLE_NAME === table).length !== (table === 'customer_points_allocations' ? 2 : 0)) throw new Error(`积分账外键数量冲突：${table}`)
    if (table === 'customer_points_allocations') for (const [name, column] of [['fk_points_allocation_debit', 'debit_entry_id'], ['fk_points_allocation_credit', 'credit_entry_id']]) {
      const rows = foreignKeys.filter(row => row.CONSTRAINT_NAME === name)
      if (rows.length !== 1 || rows[0].COLUMN_NAME !== column || rows[0].REFERENCED_TABLE_NAME !== 'customer_points_entries' ||
        rows[0].REFERENCED_COLUMN_NAME !== 'id' || !['RESTRICT', 'NO ACTION'].includes(rows[0].DELETE_RULE) ||
        !['RESTRICT', 'NO ACTION'].includes(rows[0].UPDATE_RULE)) throw new Error(`积分账外键结构冲突：${name}`)
    }
  }
  return { sql, existing }
}

async function snapshot(db) {
  const tables = {}
  for (const [table, fields] of Object.entries(originals)) {
    const [rows] = await db.query(`SELECT ${fields.map(name => `\`${name}\``).join(', ')} FROM \`${table}\` ORDER BY id`)
    tables[table] = { count: rows.length, digest: digest(rows) }
  }
  return tables
}

async function migrate(db, { apply = false, rollback = false, backupFile } = {}) {
  const state = await inspect(db)
  let sql = state.sql
  if (rollback) {
    for (const table of state.existing) {
      const [[row]] = await db.query(`SELECT COUNT(*) AS count FROM \`${table}\``)
      if (Number(row.count)) throw new Error('已有积分来源或消费分配历史，拒绝回退删表')
    }
    sql = [...state.existing].reverse().map(table => `DROP TABLE \`${table}\``)
  }
  if (!sql.length) return { status: 'already_ready', writes: false }
  if (!apply) return { status: 'dry_run', writes: false, sql, historicalPointsUnchanged: true }
  if (!backupFile) throw new Error('执行必须提供 --backup-file，且保留已有完整备份；请暂停积分业务写入')
  const before = await snapshot(db), schemas = {}
  for (const table of [...Object.keys(originals), ...state.existing]) {
    const [[schema]] = await db.query(`SHOW CREATE TABLE \`${table}\``)
    schemas[table] = schema
  }
  const filename = path.resolve(backupFile)
  await fs.mkdir(path.dirname(filename), { recursive: true, mode: 0o700 })
  await fs.writeFile(filename, JSON.stringify({ rollback, tables: before, schemas }, null, 2), { flag: 'wx', mode: 0o600 })
  for (const statement of sql) await db.query(statement)
  const after = await inspect(db)
  if (!rollback && after.sql.length || rollback && after.existing.length) throw new Error('积分账迁移结构核验失败')
  if (JSON.stringify(await snapshot(db)) !== JSON.stringify(before)) throw new Error('原客户余额或积分凭据变化，请保留备份核对并发写入')
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
  console.error({ status: 'failed', code: error.code || 'POINTS_LEDGER_MIGRATION_ERROR', message: error.code ? '数据库或备份操作失败' : error.message })
  process.exitCode = 1
})
module.exports = { migrate, inspect }
