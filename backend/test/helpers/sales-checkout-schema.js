'use strict'

const assert = require('node:assert/strict')

/** 共同结算迁移的结构与原记录替身，不连接真实数据库。 */
function fixture() {
  const columns = [], indexes = [], tables = ['sales_orders', 'payment_records'], writes = []
  let occupied = false, incompatible = false, change = false, failAfter = Infinity
  const add = (table, name, type, nullable = 'YES', defaultValue = null, extra = '') => columns.push({ TABLE_NAME: table, COLUMN_NAME: name, COLUMN_TYPE: type.toLowerCase(), IS_NULLABLE: nullable, COLUMN_DEFAULT: defaultValue, EXTRA: extra })
  for (const table of tables) add(table, 'id', 'int', 'NO')
  add('sales_orders', 'payment_method', "enum('cash','card','mobile','transfer','mixed')")
  for (const name of ['total_cost', 'total_profit']) add('sales_orders', name, 'decimal(10,2)', 'NO', '0.00')
  add('payment_records', 'order_id', 'int', 'NO')
  const data = { sales_orders: [], payment_records: [{ id: 1, order_id: 21 }] }
  const addIndex = (table, name, fields, unique) => fields.forEach((field, i) => indexes.push({ TABLE_NAME: table, INDEX_NAME: name, COLUMN_NAME: field, SEQ_IN_INDEX: i + 1, NON_UNIQUE: unique ? 0 : 1 }))
  const db = { async query(sql, params = []) {
    if (sql.includes('information_schema.TABLES')) return [tables.map(name => ({ TABLE_NAME: name, ENGINE: 'InnoDB' }))]
    if (sql.includes('information_schema.COLUMNS')) return [structuredClone(columns)]
    if (sql.includes('information_schema.STATISTICS')) return [structuredClone(params.length ? indexes.filter(row => row.TABLE_NAME === params[0]) : indexes)]
    if (sql.startsWith('SHOW CREATE')) return [[{ 'Create Table': 'original schema' }]]
    if (sql.startsWith('SELECT COUNT')) return [[{ count: sql.includes('NOT IN') || sql.includes('order_id IS NULL') ? Number(incompatible) : Number(occupied) }]]
    if (sql.startsWith('SELECT ')) {
      const table = sql.match(/FROM `(\w+)`/)[1], fields = [...sql.split(' FROM ')[0].matchAll(/`(\w+)`/g)].map(match => match[1])
      return [data[table].map(row => Object.fromEntries(fields.map(field => [field, change && writes.length && field === 'order_id' ? 99 : row[field] ?? null])))]
    }
    if (writes.length === failAfter) { failAfter = Infinity; throw Object.assign(new Error('DDL中断'), { code: 'DDL_INTERRUPTED' }) }
    writes.push(sql)
    if (sql.startsWith('CREATE TABLE')) {
      tables.push('sales_order_items'); data.sales_order_items = []
      for (const match of sql.matchAll(/\b(\w+)\s+((?:BIGINT|INT)(?: UNSIGNED)?|VARCHAR\(\d+\)|CHAR\(\d+\)|JSON|DATETIME|DECIMAL\(\d+,\d+\)|ENUM\('[^)]*\))\s+(NOT NULL|NULL)/gi)) {
        add('sales_order_items', match[1], match[2], match[3] === 'NULL' ? 'YES' : 'NO', match[1] === 'points_awarded' ? '0' : null, match[1] === 'id' ? 'auto_increment' : '')
      }
      addIndex('sales_order_items', 'PRIMARY', ['id'], true)
      for (const match of sql.matchAll(/(UNIQUE )?KEY (\w+) \(([^)]+)\)/g)) addIndex('sales_order_items', match[2], match[3].split(',').map(value => value.trim()), Boolean(match[1]))
    } else if (sql.startsWith('DROP TABLE')) {
      tables.splice(tables.indexOf('sales_order_items'), 1)
      for (let i = columns.length - 1; i >= 0; i--) if (columns[i].TABLE_NAME === 'sales_order_items') columns.splice(i, 1)
      for (let i = indexes.length - 1; i >= 0; i--) if (indexes[i].TABLE_NAME === 'sales_order_items') indexes.splice(i, 1)
    } else {
      const table = sql.match(/ALTER TABLE `(\w+)`/)[1]
      const index = sql.match(/ADD (UNIQUE )?INDEX `(\w+)` \(([^)]+)\)/)
      const dropIndex = sql.match(/DROP INDEX `(\w+)`/), dropColumn = sql.match(/DROP COLUMN `(\w+)`/)
      if (index) addIndex(table, index[2], [...index[3].matchAll(/`(\w+)`/g)].map(match => match[1]), Boolean(index[1]))
      else if (dropIndex) {
        for (let i = indexes.length - 1; i >= 0; i--) if (indexes[i].TABLE_NAME === table && indexes[i].INDEX_NAME === dropIndex[1]) indexes.splice(i, 1)
      } else if (dropColumn) columns.splice(columns.findIndex(row => row.TABLE_NAME === table && row.COLUMN_NAME === dropColumn[1]), 1)
      else {
        const match = sql.match(/(ADD|MODIFY) COLUMN `(\w+)` (.+?) (NOT NULL|NULL)(?: DEFAULT (.+))?$/)
        if (!match) assert.fail(`未处理的DDL：${sql}`)
        if (match[1] === 'MODIFY') columns.splice(columns.findIndex(row => row.TABLE_NAME === table && row.COLUMN_NAME === match[2]), 1)
        add(table, match[2], match[3], match[4] === 'NULL' ? 'YES' : 'NO', match[5] ?? null)
      }
    }
    return [{}]
  } }
  return { db, writes, columns, indexes, tables, data, occupy() { occupied = true }, incompatible() { incompatible = true }, change() { change = true }, interrupt(after) { failAfter = after } }
}

module.exports = fixture
