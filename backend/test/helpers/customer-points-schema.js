'use strict'

const assert = require('node:assert/strict')

function fixture() {
  const tables = ['customers', 'sales', 'sales_order_items'].map(TABLE_NAME => ({ TABLE_NAME, ENGINE: 'InnoDB' }))
  const columns = [], indexes = [], foreignKeys = [], writes = []
  for (const [table, fields] of Object.entries({ customers: ['id', 'points'], sales: ['id', 'customer_id', 'points_awarded', 'points_accounted_at'],
    sales_order_items: ['id', 'order_id', 'points_awarded'] })) for (const field of fields) columns.push({ TABLE_NAME: table, COLUMN_NAME: field })
  let occupied = false, mutateAt = Infinity, failAt = Infinity
  const originals = { customers: [{ id: 9, points: 20 }], sales: [{ id: 1, customer_id: 9, points_awarded: 0, points_accounted_at: null }],
    sales_order_items: [] }
  const db = { async query(sql) {
    const scope = rows => structuredClone(rows.filter(row => !sql.includes("TABLE_NAME = 'customer_points_aftersales'") || row.TABLE_NAME === 'customer_points_aftersales'))
    if (sql.includes('information_schema.TABLES')) return [scope(tables)]
    if (sql.includes('information_schema.COLUMNS')) return [scope(columns)]
    if (sql.includes('information_schema.STATISTICS')) return [scope(indexes).sort((a, b) => a.SEQ_IN_INDEX - b.SEQ_IN_INDEX)]
    if (sql.includes('information_schema.KEY_COLUMN_USAGE')) return [scope(foreignKeys)]
    if (sql.startsWith('SHOW CREATE')) return [[{ 'Create Table': 'original schema' }]]
    if (sql.startsWith('SELECT COUNT')) return [[{ count: Number(occupied) }]]
    if (sql.startsWith('SELECT ')) {
      const table = sql.match(/FROM `(\w+)`/)[1]
      const rows = structuredClone(originals[table])
      if (writes.length > mutateAt && table === 'customers') rows[0].points++
      return [rows]
    }
    if (writes.length === failAt) { failAt = Infinity; throw new Error('ddl-interrupted') }
    writes.push(sql)
    const created = sql.match(/^CREATE TABLE (\w+)/)
    if (created) {
      const table = created[1]
      tables.push({ TABLE_NAME: table, ENGINE: 'InnoDB' })
      originals[table] = []
      for (const match of sql.matchAll(/\b(\w+)\s+((?:BIGINT|INT)(?: UNSIGNED)?|DATETIME|JSON|(?:VAR)?CHAR\(\d+\)|ENUM\('[^)]*\))(?:\s+CHARACTER SET ascii COLLATE ascii_bin)?\s+(NOT NULL|NULL)(?:\s+(AUTO_INCREMENT|DEFAULT 0))?/gi)) {
        columns.push({ TABLE_NAME: table, COLUMN_NAME: match[1], COLUMN_TYPE: match[2].toLowerCase(), IS_NULLABLE: match[3] === 'NULL' ? 'YES' : 'NO',
          COLLATION_NAME: /^(?:var)?char/i.test(match[2]) ? 'ascii_bin' : null, EXTRA: match[4] === 'AUTO_INCREMENT' ? 'auto_increment' : '', COLUMN_DEFAULT: match[4] === 'DEFAULT 0' ? '0' : null })
      }
      indexes.push({ TABLE_NAME: table, INDEX_NAME: 'PRIMARY', COLUMN_NAME: 'id', SEQ_IN_INDEX: 1, NON_UNIQUE: 0 })
      for (const match of sql.matchAll(/(UNIQUE )?KEY (\w+) \(([^)]+)\)/g)) match[3].split(',').forEach((name, i) => indexes.push({
        TABLE_NAME: table, INDEX_NAME: match[2], COLUMN_NAME: name.trim(), SEQ_IN_INDEX: i + 1, NON_UNIQUE: match[1] ? 0 : 1
      }))
      for (const match of sql.matchAll(/CONSTRAINT (\w+) FOREIGN KEY \((\w+)\) REFERENCES (\w+)\((\w+)\)/g)) foreignKeys.push({
        TABLE_NAME: table, CONSTRAINT_NAME: match[1], COLUMN_NAME: match[2], REFERENCED_TABLE_NAME: match[3], REFERENCED_COLUMN_NAME: match[4],
        DELETE_RULE: 'RESTRICT', UPDATE_RULE: 'RESTRICT'
      })
    } else if (sql.startsWith('DROP TABLE')) {
      const table = sql.match(/`(\w+)`/)[1]
      for (const collection of [tables, columns, indexes, foreignKeys]) for (let i = collection.length - 1; i >= 0; i--) {
        if (collection[i].TABLE_NAME === table) collection.splice(i, 1)
      }
    } else assert.fail(`未处理DDL：${sql}`)
    return [{}]
  } }
  return { db, tables, columns, indexes, foreignKeys, writes, originals,
    occupy() { occupied = true }, mutate() { mutateAt = writes.length }, interrupt(after) { failAt = after } }
}

module.exports = fixture
