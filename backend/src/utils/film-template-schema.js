'use strict'

/** 模板匹配扩展不回填旧类型标记；旧服务的设备来源保持NULL。 */
const additions = {
  accessories: { film_enabled: 'TINYINT(1) NOT NULL DEFAULT 0', free_film: 'TINYINT(1) NOT NULL DEFAULT 0' },
  customer_film_services: { phone_id: 'BIGINT NULL', model_id: 'BIGINT NULL', phone_snapshot: 'JSON NULL' }
}
const normalize = value => String(value).toLowerCase().replace(/\b(bigint|tinyint)\(\d+\)/g, '$1')
async function inspect(db) {
  const [tables] = await db.query("SELECT TABLE_NAME, ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('accessories','customer_film_services','accessory_categories','accessory_compatible_models','accessory_template_colors')")
  for (const name of ['accessories', 'customer_film_services', 'accessory_categories', 'accessory_compatible_models', 'accessory_template_colors']) {
    if (!tables.some(row => row.TABLE_NAME === name && row.ENGINE === 'InnoDB')) throw new Error(`贴膜匹配前置表缺失或引擎冲突：${name}`)
  }
  const [columns] = await db.query("SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('accessories','customer_film_services')")
  const missing = []
  for (const [table, fields] of Object.entries(additions)) for (const [name, definition] of Object.entries(fields)) {
    const row = columns.find(item => item.TABLE_NAME === table && item.COLUMN_NAME === name)
    if (!row) { missing.push({ table, name, definition }); continue }
    const flag = table === 'accessories'
    if (normalize(row.COLUMN_TYPE) !== (flag ? 'tinyint' : name === 'phone_snapshot' ? 'json' : 'bigint') ||
      row.IS_NULLABLE !== (flag ? 'NO' : 'YES') || (flag ? String(row.COLUMN_DEFAULT) !== '0' : row.COLUMN_DEFAULT !== null) || row.EXTRA) {
      throw new Error(`贴膜匹配字段结构冲突：${table}.${name}`)
    }
  }
  return { ready: !missing.length, missing }
}
module.exports = { additions, inspect }
