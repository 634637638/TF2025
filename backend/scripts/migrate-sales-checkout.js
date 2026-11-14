'use strict'

const fs = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')
const { normalizeDatabaseIdentifier } = require('../src/utils/database-identifier')

const legacyMethod = "enum('cash','card','mobile','transfer','mixed')"
const additions = {
  sales_orders: { request_key: 'varchar(36)', request_hash: 'char(64)', checkout_result: 'json', points_config_snapshot: 'json',
    points_awarded: 'int unsigned', payment_channel: 'varchar(64)' },
  payment_records: { sales_order_id: 'int' }
}
const itemColumns = {
  id: ['bigint unsigned', 'NO'], order_id: ['int', 'NO'], line_key: ['varchar(100)', 'NO'], item_type: ["enum('phone','accessory')", 'NO'],
  sale_id: ['int', 'YES'], accessory_sale_id: ['bigint', 'YES'], phone_id: ['int', 'YES'], accessory_id: ['bigint', 'YES'], linked_phone_sale_id: ['int', 'YES'],
  quantity: ['int unsigned', 'NO'], unit_price: ['decimal(10,2)', 'NO'], total_amount: ['decimal(10,2)', 'NO'], purchase_cost: ['decimal(10,2)', 'YES'],
  points_awarded: ['int unsigned', 'NO'], snapshot: ['json', 'NO'], created_at: ['datetime', 'NO']
}
const indexes = {
  sales_orders: { uq_sales_checkout_request: ['request_key'] },
  payment_records: { idx_payment_sales_order: ['sales_order_id', 'id'] },
  sales_order_items: { PRIMARY: ['id'], uq_sales_order_line: ['order_id', 'line_key'], uq_sales_order_phone_sale: ['sale_id'],
    uq_sales_order_accessory_sale: ['accessory_sale_id'], idx_sales_order_linked_phone: ['linked_phone_sale_id'] }
}
const unique = name => name === 'PRIMARY' || name.startsWith('uq_')
const itemDDL = `CREATE TABLE sales_order_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL, line_key VARCHAR(100) NOT NULL, item_type ENUM('phone','accessory') NOT NULL,
  sale_id INT NULL, accessory_sale_id BIGINT NULL, phone_id INT NULL, accessory_id BIGINT NULL, linked_phone_sale_id INT NULL,
  quantity INT UNSIGNED NOT NULL, unit_price DECIMAL(10,2) NOT NULL, total_amount DECIMAL(10,2) NOT NULL, purchase_cost DECIMAL(10,2) NULL,
  points_awarded INT UNSIGNED NOT NULL DEFAULT 0, snapshot JSON NOT NULL, created_at DATETIME NOT NULL,
  UNIQUE KEY uq_sales_order_line (order_id, line_key), UNIQUE KEY uq_sales_order_phone_sale (sale_id),
  UNIQUE KEY uq_sales_order_accessory_sale (accessory_sale_id), KEY idx_sales_order_linked_phone (linked_phone_sale_id),
  CONSTRAINT fk_sales_order_items_order FOREIGN KEY (order_id) REFERENCES sales_orders(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
const type = value => value.toLowerCase().replace(/\b(int|bigint)\(\d+\)/g, '$1')
const digest = rows => crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex')
const quote = value => `\`${normalizeDatabaseIdentifier(value)}\``

async function inspect(db) {
  const [tables] = await db.query("SELECT TABLE_NAME, ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('sales_orders','payment_records','sales_order_items')")
  for (const name of ['sales_orders', 'payment_records']) if (!tables.some(row => row.TABLE_NAME === name)) throw new Error('缺少原销售或收款表，拒绝创建替代主表')
  if (tables.some(row => row.ENGINE !== 'InnoDB')) throw new Error('结算相关表必须使用InnoDB')
  const [columns] = await db.query("SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('sales_orders','payment_records','sales_order_items') ORDER BY ORDINAL_POSITION")
  const find = (table, column) => columns.find(row => row.TABLE_NAME === table && row.COLUMN_NAME === column)
  const sql = []
  for (const [table, fields] of Object.entries(additions)) {
    for (const [name, target] of Object.entries(fields)) {
      const row = find(table, name), nullable = name === 'points_awarded' ? 'NO' : 'YES'
      if (row && (type(row.COLUMN_TYPE) !== target || row.IS_NULLABLE !== nullable || (name === 'points_awarded' ? String(row.COLUMN_DEFAULT) !== '0' : row.COLUMN_DEFAULT !== null))) throw new Error(`结算字段结构冲突：${table}.${name}`)
      if (!row) sql.push(`ALTER TABLE ${quote(table)} ADD COLUMN ${quote(name)} ${target} ${nullable === 'YES' ? 'NULL' : 'NOT NULL DEFAULT 0'}`)
    }
  }
  for (const [table, name, allowed, target, nullable] of [
    ['sales_orders', 'payment_method', [legacyMethod, 'varchar(20)'], 'varchar(20)', 'YES'],
    ['sales_orders', 'total_cost', ['decimal(10,2)'], 'decimal(10,2)', 'YES'],
    ['sales_orders', 'total_profit', ['decimal(10,2)'], 'decimal(10,2)', 'YES'],
    ['payment_records', 'order_id', ['int'], 'int', 'YES']
  ]) {
    const row = find(table, name)
    if (!row || !allowed.includes(type(row.COLUMN_TYPE))) throw new Error(`原销售字段结构冲突：${table}.${name}`)
    if (type(row.COLUMN_TYPE) !== target || row.IS_NULLABLE !== nullable) sql.push(`ALTER TABLE ${quote(table)} MODIFY COLUMN ${quote(name)} ${target} NULL${['total_cost', 'total_profit'].includes(name) ? ' DEFAULT 0' : ''}`)
  }
  const exists = tables.some(row => row.TABLE_NAME === 'sales_order_items')
  if (exists) {
    for (const [name, [target, nullable]] of Object.entries(itemColumns)) {
      const row = find('sales_order_items', name)
      if (!row || type(row.COLUMN_TYPE) !== target || row.IS_NULLABLE !== nullable) throw new Error(`结算明细结构冲突：${name}`)
    }
    if (!find('sales_order_items', 'id').EXTRA.includes('auto_increment')) throw new Error('结算明细主键结构冲突')
  } else sql.push(itemDDL)
  const [actualIndexes] = await db.query("SELECT TABLE_NAME, INDEX_NAME, COLUMN_NAME, NON_UNIQUE, SEQ_IN_INDEX FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('sales_orders','payment_records','sales_order_items') ORDER BY SEQ_IN_INDEX")
  for (const [table, definitions] of Object.entries(indexes)) {
    if (table === 'sales_order_items' && !exists) continue
    for (const [name, fields] of Object.entries(definitions)) {
      const rows = actualIndexes.filter(row => row.TABLE_NAME === table && row.INDEX_NAME === name)
      if (rows.length && (rows.map(row => row.COLUMN_NAME).join(',') !== fields.join(',') || rows.some(row => Number(row.NON_UNIQUE) !== Number(!unique(name))))) throw new Error(`结算索引结构冲突：${name}`)
      if (!rows.length) {
        if (table === 'sales_order_items') throw new Error(`结算明细缺少索引：${name}`)
        sql.push(`ALTER TABLE ${quote(table)} ADD ${unique(name) ? 'UNIQUE ' : ''}INDEX ${quote(name)} (${fields.map(quote).join(', ')})`)
      }
    }
  }
  return { sql, columns, exists }
}

async function migrate(db, { apply = false, rollback = false, backupFile } = {}) {
  const state = await inspect(db)
  let sql = state.sql
  if (rollback) {
    const checks = []
    if (state.exists) checks.push('SELECT COUNT(*) AS count FROM sales_order_items')
    const orderFacts = Object.keys(additions.sales_orders).filter(name => state.columns.some(row => row.TABLE_NAME === 'sales_orders' && row.COLUMN_NAME === name))
    if (orderFacts.length) checks.push(`SELECT COUNT(*) AS count FROM sales_orders WHERE ${orderFacts.map(name => `${quote(name)} ${name === 'points_awarded' ? '<> 0' : 'IS NOT NULL'}`).join(' OR ')}`)
    if (state.columns.some(row => row.TABLE_NAME === 'payment_records' && row.COLUMN_NAME === 'sales_order_id')) checks.push('SELECT COUNT(*) AS count FROM payment_records WHERE sales_order_id IS NOT NULL')
    checks.push("SELECT COUNT(*) AS count FROM sales_orders WHERE payment_method NOT IN ('cash','card','mobile','transfer','mixed') OR total_cost IS NULL OR total_profit IS NULL")
    checks.push('SELECT COUNT(*) AS count FROM payment_records WHERE order_id IS NULL')
    for (const query of checks) { const [[row]] = await db.query(query); if (Number(row.count)) throw new Error('已有共同结算历史或旧结构无法容纳的数据，拒绝回退') }
    sql = state.exists ? ['DROP TABLE sales_order_items'] : []
    for (const [table, definitions] of Object.entries(indexes)) {
      if (table === 'sales_order_items') continue
      const [rows] = await db.query('SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?', [table])
      for (const name of Object.keys(definitions)) if (rows.some(row => row.INDEX_NAME === name)) sql.push(`ALTER TABLE ${quote(table)} DROP INDEX ${quote(name)}`)
    }
    for (const [table, fields] of Object.entries(additions)) for (const name of Object.keys(fields)) if (state.columns.some(row => row.TABLE_NAME === table && row.COLUMN_NAME === name)) sql.push(`ALTER TABLE ${quote(table)} DROP COLUMN ${quote(name)}`)
    for (const [table, name, target, nullable] of [['sales_orders', 'payment_method', legacyMethod, 'YES'], ['sales_orders', 'total_cost', 'decimal(10,2)', 'NO'],
      ['sales_orders', 'total_profit', 'decimal(10,2)', 'NO'], ['payment_records', 'order_id', 'int', 'NO']]) {
      const row = state.columns.find(row => row.TABLE_NAME === table && row.COLUMN_NAME === name)
      if (type(row.COLUMN_TYPE) !== target || row.IS_NULLABLE !== nullable) sql.push(`ALTER TABLE ${quote(table)} MODIFY COLUMN ${quote(name)} ${target} ${nullable === 'YES' ? 'NULL' : 'NOT NULL'}${name.startsWith('total_') ? ' DEFAULT 0' : ''}`)
    }
  }
  if (!sql.length) return { status: 'already_ready', writes: false }
  if (!apply) return { status: 'dry_run', writes: false, sql }
  if (!backupFile) throw new Error('执行必须提供 --backup-file，且保留已有可恢复完整备份')
  const backup = {}
  for (const table of ['sales_orders', 'payment_records']) {
    const fields = state.columns.filter(row => row.TABLE_NAME === table && (!rollback || !Object.hasOwn(additions[table], row.COLUMN_NAME))).map(row => row.COLUMN_NAME)
    const [[schema]] = await db.query(`SHOW CREATE TABLE ${quote(table)}`)
    const [rows] = await db.query(`SELECT ${fields.map(quote).join(', ')} FROM ${quote(table)} ORDER BY id`)
    backup[table] = { schema, fields, count: rows.length, digest: digest(rows) }
  }
  const filename = path.resolve(backupFile)
  await fs.mkdir(path.dirname(filename), { recursive: true, mode: 0o700 })
  await fs.writeFile(filename, JSON.stringify({ rollback, tables: backup }, null, 2), { flag: 'wx', mode: 0o600 })
  for (const statement of sql) await db.query(statement)
  const after = await inspect(db)
  if (!rollback && after.sql.length || rollback && (after.exists || Object.keys(additions).some(table => after.columns.some(row => row.TABLE_NAME === table && Object.hasOwn(additions[table], row.COLUMN_NAME))))) throw new Error('共同结算迁移结构核验失败')
  for (const [table, snapshot] of Object.entries(backup)) {
    const [rows] = await db.query(`SELECT ${snapshot.fields.map(quote).join(', ')} FROM ${quote(table)} ORDER BY id`)
    if (digest(rows) !== snapshot.digest) throw new Error('原销售收款记录变化，请保留备份核对并发写入')
  }
  return { status: 'migrated_and_verified', writes: true, originalDataUnchanged: true, rollback }
}

async function main() {
  const { db: config } = require('../src/config')
  const db = await require('mysql2/promise').createConnection({ ...config, connectTimeout: 15000 })
  try { console.log(JSON.stringify(await migrate(db, { apply: process.argv.includes('--apply'), rollback: process.argv.includes('--rollback'), backupFile: process.argv.find(arg => arg.startsWith('--backup-file='))?.slice(14) }))) }
  finally { await db.end() }
}
if (require.main === module) main().catch(error => { console.error({ status: 'failed', code: error.code || 'SALES_CHECKOUT_MIGRATION_ERROR', message: error.code ? '数据库或备份操作失败' : error.message }); process.exitCode = 1 })
module.exports = { migrate, inspect }
