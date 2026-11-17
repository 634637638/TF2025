'use strict'

const schemaError = message => Object.assign(new Error(message), { code: 'STOCK_CORRECTION_SCHEMA_CONFLICT' })

const table = 'accessory_stock_corrections'
const definitions = { id: 'bigint unsigned', source_stock_in_id: 'bigint', target_stock_in_id: 'bigint', request_key: 'char(32)', request_hash: 'char(64)',
  before_snapshot: 'json', after_snapshot: 'json', operator_id: 'bigint', operator_name: 'varchar(100)', created_at: 'datetime' }
const indexes = { PRIMARY: ['id'], uq_stock_correction_source: ['source_stock_in_id'], uq_stock_correction_target: ['target_stock_in_id'], uq_stock_correction_request: ['request_key'] }
const DDL = `CREATE TABLE ${table} (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  source_stock_in_id BIGINT NOT NULL, target_stock_in_id BIGINT NOT NULL,
  request_key CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  request_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  before_snapshot JSON NOT NULL, after_snapshot JSON NOT NULL,
  operator_id BIGINT NOT NULL, operator_name VARCHAR(100) NULL, created_at DATETIME NOT NULL,
  UNIQUE KEY uq_stock_correction_source (source_stock_in_id),
  UNIQUE KEY uq_stock_correction_target (target_stock_in_id), UNIQUE KEY uq_stock_correction_request (request_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
const type = input => String(input).toLowerCase().replace(/\b(bigint|int)\(\d+\)/g, '$1')

async function inspectStockCorrectionSchema(db) {
  const [events] = await db.query("SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'accessory_inventory_events' AND COLUMN_NAME = 'event_type'")
  const eventType = type(events[0]?.COLUMN_TYPE)
  if (!/^enum\('[a-z_',]+\)$/.test(eventType) || !eventType.includes("'stock_in'")) throw schemaError('库存更正事件枚举冲突')
  const [tables] = await db.query(`SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${table}'`)
  if (!tables.length) return { exists: false, eventType }
  if (tables[0].ENGINE !== 'InnoDB') throw schemaError('库存更正表引擎冲突')
  const [fields] = await db.query(`SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${table}'`)
  if (fields.length !== Object.keys(definitions).length) throw schemaError('库存更正字段结构冲突')
  for (const [name, expected] of Object.entries(definitions)) {
    const field = fields.find(row => row.COLUMN_NAME === name)
    if (!field || type(field.COLUMN_TYPE) !== expected || field.IS_NULLABLE !== (name === 'operator_name' ? 'YES' : 'NO') ||
      ['request_key', 'request_hash'].includes(name) && field.COLLATION_NAME !== 'ascii_bin') throw schemaError(`库存更正字段结构冲突：${name}`)
  }
  const [keys] = await db.query(`SELECT INDEX_NAME, COLUMN_NAME, NON_UNIQUE, SEQ_IN_INDEX, SUB_PART FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${table}' ORDER BY INDEX_NAME, SEQ_IN_INDEX`)
  if (keys.some(row => !Object.hasOwn(indexes, row.INDEX_NAME))) throw schemaError('库存更正索引结构冲突')
  for (const [name, columns] of Object.entries(indexes)) {
    const rows = keys.filter(row => row.INDEX_NAME === name)
    if (rows.length !== columns.length || rows.some((row, index) => row.COLUMN_NAME !== columns[index] || Number(row.NON_UNIQUE) !== 0 || Number(row.SEQ_IN_INDEX) !== index + 1 || row.SUB_PART !== null)) throw schemaError('库存更正唯一索引结构冲突')
  }
  return { exists: true, eventType }
}

module.exports = { inspectStockCorrectionSchema, definitions, indexes, DDL, table }
