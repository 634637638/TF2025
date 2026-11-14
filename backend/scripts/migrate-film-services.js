'use strict'

const fs = require('node:fs/promises')
const path = require('node:path')
const { createHash } = require('node:crypto')

const table = 'customer_film_services'
const parents = ['sales_orders', 'customers', 'sales', 'stores', 'users', 'accessory_categories']
const references = { order_id: ['sales_orders', 'id'], customer_id: ['customers', 'id'],
  qualification_sale_id: ['sales', 'id'], store_id: ['stores', 'id'], operator_id: ['users', 'id'], created_by: ['users', 'id'] }
const indexes = { PRIMARY: ['id'], uq_film_order: ['order_id'], idx_film_customer: ['customer_id', 'id'] }
const digest = rows => createHash('sha256').update(JSON.stringify(rows)).digest('hex')

function definitions(types) {
  return { id: ['bigint unsigned', 'NO', null, 'auto_increment'],
    ...Object.fromEntries(Object.entries(references).map(([name, [parent]]) => [name,
      [types[parent], name === 'qualification_sale_id' ? 'YES' : 'NO', null, '']])),
    quantity: ['int unsigned', 'NO', null, ''], business_time: ['datetime', 'NO', null, ''], created_at: ['datetime', 'NO', null, ''] }
}

async function inspect(db) {
  const [tables] = await db.query(`SELECT TABLE_NAME, ENGINE FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('sales_orders','customers','sales','stores','users','accessory_categories','customer_film_services')`)
  for (const parent of parents) if (!tables.some(row => row.TABLE_NAME === parent && row.ENGINE === 'InnoDB')) throw new Error(`贴膜前置表缺失或不是InnoDB：${parent}`)
  const [columns] = await db.query(`SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
    FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME IN ('sales_orders','customers','sales','stores','users','accessory_categories','customer_film_services')`)
  const types = Object.fromEntries(parents.filter(name => name !== 'accessory_categories').map(name => {
    const type = columns.find(row => row.TABLE_NAME === name && row.COLUMN_NAME === 'id')?.COLUMN_TYPE?.toLowerCase()
    if (!type || !/^(?:tinyint|smallint|mediumint|int|bigint)(?:\(\d+\))?(?: unsigned)?$/.test(type)) throw new Error(`贴膜父键类型不兼容：${name}`)
    return [name, type.replace(/\(\d+\)/, '')]
  }))
  const flag = columns.find(row => row.TABLE_NAME === 'accessory_categories' && row.COLUMN_NAME === 'film_enabled')
  if (flag && (!/^tinyint(?:\(1\))?$/.test(flag.COLUMN_TYPE.toLowerCase()) || flag.IS_NULLABLE !== 'NO' ||
    String(flag.COLUMN_DEFAULT) !== '0' || flag.EXTRA)) throw new Error('film_enabled字段与契约不一致')
  const exists = tables.some(row => row.TABLE_NAME === table)
  if (exists) {
    if (!tables.some(row => row.TABLE_NAME === table && row.ENGINE === 'InnoDB')) throw new Error('贴膜表必须使用InnoDB')
    const actual = columns.filter(row => row.TABLE_NAME === table), expected = definitions(types)
    if (actual.length !== Object.keys(expected).length) throw new Error('贴膜表字段数量不一致')
    for (const [name, [type, nullable, defaultValue, extra]] of Object.entries(expected)) {
      const row = actual.find(item => item.COLUMN_NAME === name)
      if (!row || row.COLUMN_TYPE.toLowerCase().replace(/\(\d+\)/, '') !== type || row.IS_NULLABLE !== nullable ||
        row.COLUMN_DEFAULT !== defaultValue || row.EXTRA !== extra) throw new Error(`贴膜字段不兼容：${name}`)
    }
    const [keys] = await db.query(`SELECT INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX, NON_UNIQUE, SUB_PART
      FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer_film_services'`)
    for (const [name, fields] of Object.entries(indexes)) {
      const rows = keys.filter(row => row.INDEX_NAME === name).sort((a, b) => a.SEQ_IN_INDEX - b.SEQ_IN_INDEX)
      if (rows.map(row => row.COLUMN_NAME).join(',') !== fields.join(',') ||
        rows.some((row, index) => Number(row.SEQ_IN_INDEX) !== index + 1 || row.SUB_PART !== null ||
          Number(row.NON_UNIQUE) !== (name === 'idx_film_customer' ? 1 : 0))) throw new Error(`贴膜索引不兼容：${name}`)
    }
    const [foreign] = await db.query(`SELECT k.CONSTRAINT_NAME, k.COLUMN_NAME, k.REFERENCED_TABLE_NAME, k.REFERENCED_COLUMN_NAME,
      k.ORDINAL_POSITION, r.DELETE_RULE, r.UPDATE_RULE
      FROM information_schema.KEY_COLUMN_USAGE k JOIN information_schema.REFERENTIAL_CONSTRAINTS r
        ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME AND r.TABLE_NAME = k.TABLE_NAME
      WHERE k.TABLE_SCHEMA = DATABASE() AND k.TABLE_NAME = 'customer_film_services' AND k.REFERENCED_TABLE_NAME IS NOT NULL`)
    if (foreign.length !== Object.keys(references).length) throw new Error('贴膜外键数量不一致')
    for (const [name, [parent, column]] of Object.entries(references)) {
      if (!foreign.some(row => row.COLUMN_NAME === name && row.CONSTRAINT_NAME === `fk_film_${name}` &&
        row.REFERENCED_TABLE_NAME === parent && row.REFERENCED_COLUMN_NAME === column && Number(row.ORDINAL_POSITION) === 1 &&
        row.DELETE_RULE === 'RESTRICT' && row.UPDATE_RULE === 'RESTRICT')) throw new Error(`贴膜外键不兼容：${name}`)
    }
  }
  return { flag: Boolean(flag), exists, types }
}

function createTable(types) {
  const fields = Object.entries(definitions(types)).map(([name, [type, nullable, , extra]]) =>
    `${name} ${type.toUpperCase()} ${nullable === 'YES' ? 'NULL' : 'NOT NULL'}${extra ? ' AUTO_INCREMENT' : ''}`)
  return `CREATE TABLE ${table} (\n${fields.join(',\n')},
    PRIMARY KEY (id), UNIQUE KEY uq_film_order (order_id), KEY idx_film_customer (customer_id, id),
    ${Object.entries(references).map(([name, [parent, column]]) =>
    `CONSTRAINT fk_film_${name} FOREIGN KEY (${name}) REFERENCES ${parent}(${column}) ON DELETE RESTRICT ON UPDATE RESTRICT`).join(',\n')}
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
}

/** 默认仅预览；DDL中断保留备份，有服务历史或启用标记时禁止删结构。 */
async function migrate(db, { apply = false, rollback = false, backupFile } = {}) {
  const state = await inspect(db)
  if (rollback ? !state.exists && !state.flag : state.exists && state.flag) return { status: 'already_ready', writes: false }
  const [categories] = await db.query('SELECT * FROM accessory_categories ORDER BY id')
  const [services] = state.exists ? await db.query('SELECT * FROM customer_film_services ORDER BY id') : [[]]
  if (services.length || state.flag && categories.some(row => row.film_enabled !== 0)) {
    throw new Error('已有贴膜标记或服务历史，禁止删除或重建缺失结构')
  }
  const sql = rollback ? [state.exists && `DROP TABLE ${table}`, state.flag && 'ALTER TABLE accessory_categories DROP COLUMN film_enabled'].filter(Boolean)
    : [!state.flag && 'ALTER TABLE accessory_categories ADD COLUMN film_enabled TINYINT(1) NOT NULL DEFAULT 0', !state.exists && createTable(state.types)].filter(Boolean)
  if (!apply) return { status: 'dry_run', writes: false, sql, rollback, category_count: categories.length }
  if (!backupFile) throw new Error('执行必须提供 --backup-file')
  const [[categorySchema]] = await db.query('SHOW CREATE TABLE accessory_categories')
  const [[serviceSchema]] = state.exists ? await db.query('SHOW CREATE TABLE customer_film_services') : [[null]]
  const filename = path.resolve(backupFile)
  await fs.mkdir(path.dirname(filename), { recursive: true, mode: 0o700 })
  await fs.writeFile(filename, JSON.stringify({ state, rollback, categorySchema, serviceSchema, categories, services }, null, 2), { flag: 'wx', mode: 0o600 })
  for (const statement of sql) await db.query(statement)
  const afterState = await inspect(db)
  if (afterState.flag !== !rollback || afterState.exists !== !rollback) throw new Error('贴膜结构迁移核验失败')
  const [after] = await db.query('SELECT * FROM accessory_categories ORDER BY id')
  const strip = rows => rows.map(({ film_enabled: _flag, ...row }) => row)
  if (digest(strip(categories)) !== digest(strip(after)) || !rollback && after.some(row => row.film_enabled !== 0)) {
    throw new Error('原商品类型或贴膜标记发生变化，请保留备份核对并发写入')
  }
  if (!rollback) {
    const [rows] = await db.query('SELECT * FROM customer_film_services ORDER BY id')
    if (rows.length) throw new Error('迁移期间出现贴膜服务，请保留备份核对')
  }
  return { status: 'migrated_and_verified', writes: true, originalDataUnchanged: true, rollback }
}

async function main() {
  const { db: config } = require('../src/config')
  const db = await require('mysql2/promise').createConnection({ ...config, connectTimeout: 15000 })
  try { console.log(JSON.stringify(await migrate(db, { apply: process.argv.includes('--apply'), rollback: process.argv.includes('--rollback'),
    backupFile: process.argv.find(arg => arg.startsWith('--backup-file='))?.slice(14) }))) }
  finally { await db.end() }
}
if (require.main === module) main().catch(error => {
  console.error({ status: 'failed', code: error.code || 'FILM_SERVICE_MIGRATION_ERROR', message: error.code ? '数据库或备份操作失败' : error.message })
  process.exitCode = 1
})
module.exports = { migrate, inspect, definitions, indexes, references }
