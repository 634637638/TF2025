'use strict'

const fs = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')
const { inspect: inspectCheckout } = require('./migrate-sales-checkout')

const definitions = {
  sales_aftersales: {
    columns: {
      id: 'bigint unsigned', request_key: 'varchar(36)', request_hash: 'char(64)', order_id: 'int', operation_type: "enum('goods_return','phone_return','goods_exchange')",
      customer_id: 'int', original_store_id: 'int', store_id: 'int', created_by: 'int', base_refund_cents: 'bigint unsigned',
      recovery_cents: 'bigint unsigned', compensation_cents: 'bigint unsigned', refund_cents: 'bigint unsigned', collection_cents: 'bigint unsigned',
      points_delta: 'int', settlement_method: 'varchar(20)', settlement_channel: 'varchar(64)', business_time: 'datetime',
      remarks: 'varchar(200)', result_snapshot: 'json', created_at: 'datetime', gift_charge_cents: 'bigint unsigned', replacement_cents: 'bigint unsigned'
    },
    nullable: ['settlement_method', 'settlement_channel'],
    indexes: { PRIMARY: ['id'], uq_sales_aftersale_request: ['request_key'], idx_sales_aftersale_order: ['order_id', 'id'],
      idx_sales_aftersale_customer: ['customer_id', 'id'], idx_sales_aftersale_store: ['store_id', 'business_time', 'id'] }
  },
  sales_aftersale_items: {
    columns: { id: 'bigint unsigned', aftersale_id: 'bigint unsigned', original_item_id: 'bigint unsigned', quantity: 'int unsigned', fact_snapshot: 'json' },
    nullable: [], indexes: { PRIMARY: ['id'], uq_sales_aftersale_item: ['aftersale_id', 'original_item_id'], idx_sales_aftersale_original: ['original_item_id', 'id'] }
  },
  sales_goods_exchanges: {
    columns: { id: 'bigint unsigned', aftersale_id: 'bigint unsigned', original_item_id: 'bigint unsigned', replacement_order_id: 'int',
      replacement_item_id: 'bigint unsigned', root_order_id: 'int', root_item_id: 'bigint unsigned', quantity: 'int unsigned', exchange_credit_cents: 'bigint unsigned' },
    nullable: [], indexes: { PRIMARY: ['id'], uq_sales_exchange_aftersale: ['aftersale_id'], uq_sales_exchange_order: ['replacement_order_id'],
      uq_sales_exchange_item: ['replacement_item_id'], idx_sales_exchange_original: ['original_item_id', 'id'], idx_sales_exchange_root: ['root_order_id', 'root_item_id', 'id'] }
  }
}
const type = value => String(value).toLowerCase().replace(/\b(int|bigint)\(\d+\)/g, '$1')
const unique = name => name === 'PRIMARY' || name.startsWith('uq_')
const ddl = table => {
  const schema = definitions[table]
  const columns = Object.entries(schema.columns).map(([name, target]) => `\`${name}\` ${target}${['request_key', 'request_hash'].includes(name) ? ' CHARACTER SET ascii COLLATE ascii_bin' : ''} ${schema.nullable.includes(name) ? 'NULL' : 'NOT NULL'}${name === 'id' ? ' AUTO_INCREMENT' : ''}${['gift_charge_cents', 'replacement_cents'].includes(name) ? ' DEFAULT 0' : ''}`)
  const indexes = Object.entries(schema.indexes).map(([name, fields]) => `${name === 'PRIMARY' ? 'PRIMARY KEY' : `${unique(name) ? 'UNIQUE ' : ''}KEY \`${name}\``} (${fields.map(field => `\`${field}\``).join(', ')})`)
  return `CREATE TABLE \`${table}\` (${[...columns, ...indexes].join(',\n')}) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
}

async function inspect(db) {
  if ((await inspectCheckout(db)).sql.length) throw new Error('请先完成共同结算迁移，不创建替代订单表')
  const sql = [], existing = []
  const missingMoneyColumns = []
  for (const [table, schema] of Object.entries(definitions)) {
    const [tables] = await db.query('SELECT TABLE_NAME, ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?', [table])
    if (!tables.length) { sql.push(ddl(table)); continue }
    if (tables.length !== 1 || tables[0].ENGINE !== 'InnoDB') throw new Error(`共同售后凭据必须使用InnoDB：${table}`)
    existing.push(table)
    const [fields] = await db.query(`SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA, COLLATION_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`, [table])
    if (fields.some(field => !Object.hasOwn(schema.columns, field.COLUMN_NAME))) throw new Error(`共同售后字段数量冲突：${table}`)
    for (const [name, target] of Object.entries(schema.columns)) {
      const field = fields.find(row => row.COLUMN_NAME === name)
      if (table === 'sales_aftersales' && ['gift_charge_cents', 'replacement_cents'].includes(name) && !field) {
        missingMoneyColumns.push(name)
        sql.push(`ALTER TABLE \`sales_aftersales\` ADD COLUMN \`${name}\` bigint unsigned NOT NULL DEFAULT 0`)
        continue
      }
      const legacyOperation = name === 'operation_type' && field && ["enum('goods_return')", "enum('goods_return','phone_return')"].includes(type(field.COLUMN_TYPE))
      if (!field || !legacyOperation && type(field.COLUMN_TYPE) !== target || field.IS_NULLABLE !== (schema.nullable.includes(name) ? 'YES' : 'NO') ||
        name === 'id' && !field.EXTRA?.includes('auto_increment') ||
        ['gift_charge_cents', 'replacement_cents'].includes(name) && String(field.COLUMN_DEFAULT) !== '0' ||
        ['request_key', 'request_hash'].includes(name) && field.COLLATION_NAME !== 'ascii_bin') throw new Error(`共同售后字段结构冲突：${table}.${name}`)
      if (legacyOperation) sql.push(`ALTER TABLE \`sales_aftersales\` MODIFY COLUMN \`operation_type\` ${target} NOT NULL`)
    }
    const [keys] = await db.query(`SELECT INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX, NON_UNIQUE FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY SEQ_IN_INDEX`, [table])
    if (keys.some(row => Number(row.NON_UNIQUE) === 0 && !Object.hasOwn(schema.indexes, row.INDEX_NAME))) throw new Error(`共同售后存在未知唯一索引：${table}`)
    for (const [name, columns] of Object.entries(schema.indexes)) {
      const rows = keys.filter(row => row.INDEX_NAME === name)
      if (rows.map(row => row.COLUMN_NAME).join(',') !== columns.join(',') || rows.some(row => Number(row.NON_UNIQUE) !== Number(!unique(name)))) throw new Error(`共同售后索引结构冲突：${table}.${name}`)
    }
    const [foreign] = await db.query(`SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL`, [table])
    if (foreign.length) throw new Error('共同售后存在未知外键，不允许级联删除原单凭据')
  }
  return { sql, existing, missingMoneyColumns }
}

const originals = ['sales_orders', 'sales_order_items', 'sales', 'phones', 'accessory_sales', 'accessory_stock', 'accessory_serials',
  'accessory_serial_events', 'accessory_inventory_events', 'payment_records', 'customers']
async function snapshot(db, tables, omitColumns = []) {
  const result = {}
  for (const table of tables) {
    const [rows] = await db.query(`SELECT * FROM \`${table}\` ORDER BY id`)
    if (table === 'sales_aftersales') for (const row of rows) for (const column of omitColumns) delete row[column]
    result[table] = { count: rows.length, digest: crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex') }
  }
  return result
}

async function migrate(db, { apply = false, rollback = false, backupFile } = {}) {
  const state = await inspect(db)
  let sql = state.sql
  if (rollback) {
    for (const table of state.existing) {
      const [[row]] = await db.query(`SELECT COUNT(*) AS count FROM \`${table}\``)
      if (Number(row.count)) throw new Error('已有共同售后历史，拒绝回退删表')
    }
    sql = [...state.existing].reverse().map(table => `DROP TABLE \`${table}\``)
  }
  if (!sql.length) return { status: 'already_ready', writes: false }
  if (!apply) return { status: 'dry_run', writes: false, sql, originalDataUnchanged: true }
  if (!backupFile) throw new Error('执行必须提供 --backup-file，并保留可恢复完整备份；请暂停销售及售后写入')
  const tables = [...originals, ...state.existing], before = await snapshot(db, tables, state.missingMoneyColumns), schemas = {}
  for (const table of tables) {
    const [[schema]] = await db.query(`SHOW CREATE TABLE \`${table}\``)
    schemas[table] = schema
  }
  const filename = path.resolve(backupFile)
  await fs.mkdir(path.dirname(filename), { recursive: true, mode: 0o700 })
  await fs.writeFile(filename, JSON.stringify({ rollback, tables: before, schemas }, null, 2), { flag: 'wx', mode: 0o600 })
  for (const statement of sql) await db.query(statement)
  const after = await inspect(db)
  if (rollback ? after.existing.length : after.sql.length) throw new Error('共同售后迁移结构回读失败')
  const retained = tables.filter(table => !rollback || !state.existing.includes(table))
  const expected = Object.fromEntries(retained.map(table => [table, before[table]]))
  if (JSON.stringify(await snapshot(db, retained, state.missingMoneyColumns)) !== JSON.stringify(expected)) throw new Error('原销售、库存或收款事实变化，请保留备份核对并发写入')
  if (!rollback) for (const column of state.missingMoneyColumns) {
    const [[row]] = await db.query(`SELECT COUNT(*) AS count FROM \`sales_aftersales\` WHERE ${column} <> 0`)
    if (Number(row.count)) throw new Error('历史售后新增金额默认值回读失败，请核对并发写入')
  }
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
  console.error({ status: 'failed', code: error.code || 'SALES_AFTERSALE_MIGRATION_ERROR', message: error.code ? '数据库或备份操作失败' : error.message })
  process.exitCode = 1
})
module.exports = { migrate }
