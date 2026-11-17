'use strict'

const table = 'accessory_template_colors'
const DDL = `CREATE TABLE ${table} (
  template_id BIGINT NOT NULL,
  accessory_id BIGINT NOT NULL,
  color_id BIGINT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (accessory_id),
  UNIQUE KEY uq_accessory_template_color (template_id, color_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
const definitions = { template_id: 'bigint', accessory_id: 'bigint', color_id: 'bigint', created_at: 'datetime' }
const indexes = { PRIMARY: ['accessory_id'], uq_accessory_template_color: ['template_id', 'color_id'] }
const conflict = message => Object.assign(new Error(message), { statusCode: 409, code: 'TEMPLATE_COLOR_SCHEMA_CONFLICT' })
const normalize = value => String(value).toLowerCase().replace(/\b(bigint|int)\(\d+\)/g, '$1')

async function inspect(db) {
  const [tables] = await db.query(`SELECT TABLE_NAME, ENGINE FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('accessories', 'colors', '${table}')`)
  for (const name of ['accessories', 'colors']) {
    if (!tables.some(row => row.TABLE_NAME === name && row.ENGINE === 'InnoDB')) throw conflict('商品及颜色原表结构未就绪')
  }
  const current = tables.find(row => row.TABLE_NAME === table)
  if (!current) return { exists: false }
  if (current.ENGINE !== 'InnoDB') throw conflict('模板颜色表必须使用InnoDB')
  const [fields] = await db.query(`SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${table}'`)
  if (fields.length !== Object.keys(definitions).length || Object.entries(definitions).some(([name, type]) =>
    !fields.some(field => field.COLUMN_NAME === name && normalize(field.COLUMN_TYPE) === type && field.IS_NULLABLE === 'NO'))) throw conflict('模板颜色字段结构冲突')
  if (!fields.some(field => field.COLUMN_NAME === 'created_at' && String(field.COLUMN_DEFAULT).toLowerCase().replace(/\(\)$/, '') === 'current_timestamp')) throw conflict('模板颜色创建时间默认值冲突')
  const [keys] = await db.query(`SELECT INDEX_NAME, COLUMN_NAME, NON_UNIQUE, SEQ_IN_INDEX, SUB_PART FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${table}' ORDER BY INDEX_NAME, SEQ_IN_INDEX`)
  for (const [name, columns] of Object.entries(indexes)) {
    const rows = keys.filter(row => row.INDEX_NAME === name)
    if (rows.length !== columns.length || rows.some((row, index) => row.COLUMN_NAME !== columns[index] || Number(row.NON_UNIQUE) !== 0 ||
      Number(row.SEQ_IN_INDEX) !== index + 1 || row.SUB_PART !== null)) throw conflict('模板颜色唯一索引结构冲突')
  }
  if (keys.some(row => Number(row.NON_UNIQUE) === 0 && !Object.hasOwn(indexes, row.INDEX_NAME))) throw conflict('模板颜色存在额外唯一约束')
  return { exists: true }
}

module.exports = { table, DDL, definitions, indexes, inspect }
