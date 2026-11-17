'use strict'

const table = 'accessory_inventory_adjustments'
const DDL = `CREATE TABLE ${table} (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  request_key CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  request_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  accessory_id BIGINT NOT NULL, store_id BIGINT NOT NULL, stock_in_id BIGINT NOT NULL,
  previous_quantity INT NOT NULL, counted_quantity INT NOT NULL, quantity_delta INT NOT NULL,
  inventory_event_id BIGINT UNSIGNED NOT NULL,
  operator_id BIGINT NOT NULL, operator_name VARCHAR(100) NULL,
  remarks VARCHAR(1000) NOT NULL, created_at DATETIME NOT NULL,
  UNIQUE KEY uq_accessory_inventory_adjustment_request (request_key),
  UNIQUE KEY uq_accessory_inventory_adjustment_event (inventory_event_id),
  KEY idx_accessory_inventory_adjustment_batch (accessory_id, stock_in_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
const definitions = { id: 'bigint unsigned', request_key: 'char(32)', request_hash: 'char(64)', accessory_id: 'bigint',
  store_id: 'bigint', stock_in_id: 'bigint', previous_quantity: 'int', counted_quantity: 'int', quantity_delta: 'int',
  inventory_event_id: 'bigint unsigned', operator_id: 'bigint', operator_name: 'varchar(100)', remarks: 'varchar(1000)', created_at: 'datetime' }
const indexes = { PRIMARY: ['id'], uq_accessory_inventory_adjustment_request: ['request_key'],
  uq_accessory_inventory_adjustment_event: ['inventory_event_id'], idx_accessory_inventory_adjustment_batch: ['accessory_id', 'stock_in_id', 'id'] }
const normalize = value => String(value).toLowerCase().replace(/\b(bigint|int)\(\d+\)/g, '$1')

const schemaError = message => Object.assign(new Error(message), { code: 'INVENTORY_ADJUSTMENT_SCHEMA_CONFLICT' })

async function inspect(db) {
  const [originals] = await db.query("SELECT TABLE_NAME, ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('accessory_inventory_events', 'accessory_stock', 'accessory_stock_in')")
  if (originals.length !== 3 || originals.some(row => row.ENGINE !== 'InnoDB')) throw schemaError('盘点依赖的原库存表结构未就绪')
  const [tables] = await db.query(`SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${table}'`)
  const [events] = await db.query("SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'accessory_inventory_events' AND COLUMN_NAME = 'event_type'")
  if (!events.length || !normalize(events[0].COLUMN_TYPE).includes("'stock_correct'")) throw schemaError('请先完成商品库存更正迁移')
  if (!tables.length) return { exists: false }
  if (tables[0].ENGINE !== 'InnoDB') throw schemaError('库存盘点审计表引擎冲突，拒绝覆盖')
  const [fields] = await db.query(`SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${table}'`)
  if (fields.length !== Object.keys(definitions).length) throw schemaError('库存盘点审计字段结构冲突')
  for (const [name, type] of Object.entries(definitions)) {
    const field = fields.find(row => row.COLUMN_NAME === name)
    if (!field || normalize(field.COLUMN_TYPE) !== type || field.IS_NULLABLE !== (name === 'operator_name' ? 'YES' : 'NO') ||
      ['request_key', 'request_hash'].includes(name) && field.COLLATION_NAME !== 'ascii_bin') throw schemaError(`库存盘点审计字段结构冲突：${name}`)
  }
  const [keys] = await db.query(`SELECT INDEX_NAME, COLUMN_NAME, NON_UNIQUE, SEQ_IN_INDEX, SUB_PART FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${table}' ORDER BY INDEX_NAME, SEQ_IN_INDEX`)
  for (const [name, columns] of Object.entries(indexes)) {
    const rows = keys.filter(row => row.INDEX_NAME === name)
    if (rows.length !== columns.length || rows.some((row, index) => row.COLUMN_NAME !== columns[index] || Number(row.NON_UNIQUE) !== (name.startsWith('idx_') ? 1 : 0) || Number(row.SEQ_IN_INDEX) !== index + 1 || row.SUB_PART !== null)) throw schemaError(`库存盘点审计索引结构冲突：${name}`)
  }
  return { exists: true }
}

module.exports = { inspect, definitions, indexes, DDL }
