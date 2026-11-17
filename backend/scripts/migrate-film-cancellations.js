'use strict'

const fs = require('node:fs/promises')
const path = require('node:path')
const { createHash } = require('node:crypto')

const table = 'customer_film_cancellations'
const parents = ['customer_film_services', 'sales_aftersales']
const references = { service_id: ['customer_film_services', 'id'], aftersale_id: ['sales_aftersales', 'id'] }
const indexes = { PRIMARY: ['id'], uq_film_cancel_service: ['service_id'], uq_film_cancel_aftersale: ['aftersale_id'] }
const normalizeType = value => String(value).toLowerCase().replace(/\b(tinyint|smallint|mediumint|int|bigint)\(\d+\)/g, '$1')
const digest = rows => createHash('sha256').update(JSON.stringify(rows)).digest('hex')

/** 资金、积分和办理人保留在原售后账；这里只追加一次服务撤销及实际耗膜状态。 */
const definitions = types => ({ id: 'bigint unsigned', service_id: types.customer_film_services,
  aftersale_id: types.sales_aftersales, actually_used: 'tinyint', reason: 'varchar(200)' })

function createTable(types) {
  const fields = Object.entries(definitions(types)).map(([name, type]) =>
    `${name} ${type.toUpperCase()} NOT NULL${name === 'id' ? ' AUTO_INCREMENT' : ''}`)
  return `CREATE TABLE ${table} (${fields.join(',\n')},
    PRIMARY KEY (id), UNIQUE KEY uq_film_cancel_service (service_id),
    UNIQUE KEY uq_film_cancel_aftersale (aftersale_id),
    ${Object.entries(references).map(([name, [parent, column]]) =>
    `CONSTRAINT fk_film_cancel_${name} FOREIGN KEY (${name}) REFERENCES ${parent}(${column}) ON DELETE RESTRICT ON UPDATE RESTRICT`).join(',\n')}
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
}

async function inspect(db) {
  const names = [...parents, table]
  const [tables] = await db.query(`SELECT TABLE_NAME, ENGINE FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${names.map(() => '?').join(',')})`, names)
  for (const name of parents) {
    if (!tables.some(row => row.TABLE_NAME === name && row.ENGINE === 'InnoDB')) throw new Error(`贴膜撤销前置表缺失或引擎冲突：${name}`)
  }
  const [columns] = await db.query(`SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
    FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME IN (${names.map(() => '?').join(',')})`, names)
  const types = Object.fromEntries(parents.map(name => {
    const id = columns.find(row => row.TABLE_NAME === name && row.COLUMN_NAME === 'id')
    const type = normalizeType(id?.COLUMN_TYPE)
    if (!/^(?:tinyint|smallint|mediumint|int|bigint)(?: unsigned)?$/.test(type) || id.IS_NULLABLE !== 'NO') {
      throw new Error(`贴膜撤销父键类型冲突：${name}`)
    }
    return [name, type]
  }))
  const exists = tables.some(row => row.TABLE_NAME === table)
  if (!exists) return { exists: false, types }
  if (!tables.some(row => row.TABLE_NAME === table && row.ENGINE === 'InnoDB')) throw new Error('贴膜撤销表引擎冲突')
  const expected = definitions(types), fields = columns.filter(row => row.TABLE_NAME === table)
  if (fields.length !== Object.keys(expected).length) throw new Error('贴膜撤销字段数量冲突')
  for (const [name, type] of Object.entries(expected)) {
    const field = fields.find(row => row.COLUMN_NAME === name)
    if (!field || normalizeType(field.COLUMN_TYPE) !== type || field.IS_NULLABLE !== 'NO' ||
      field.COLUMN_DEFAULT !== null || field.EXTRA !== (name === 'id' ? 'auto_increment' : '')) throw new Error(`贴膜撤销字段冲突：${name}`)
  }
  const [keys] = await db.query(`SELECT INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX, NON_UNIQUE, SUB_PART
    FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`, [table])
  if (keys.some(row => !Object.hasOwn(indexes, row.INDEX_NAME))) throw new Error('贴膜撤销索引冲突')
  for (const [name, columns] of Object.entries(indexes)) {
    const rows = keys.filter(row => row.INDEX_NAME === name).sort((a, b) => a.SEQ_IN_INDEX - b.SEQ_IN_INDEX)
    if (rows.length !== columns.length || rows.some((row, index) => row.COLUMN_NAME !== columns[index] ||
      Number(row.NON_UNIQUE) !== 0 || Number(row.SEQ_IN_INDEX) !== index + 1 || row.SUB_PART !== null)) throw new Error(`贴膜撤销唯一索引冲突：${name}`)
  }
  const [foreign] = await db.query(`SELECT k.CONSTRAINT_NAME, k.COLUMN_NAME, k.REFERENCED_TABLE_NAME,
    k.REFERENCED_COLUMN_NAME, k.ORDINAL_POSITION, r.DELETE_RULE, r.UPDATE_RULE
    FROM information_schema.KEY_COLUMN_USAGE k JOIN information_schema.REFERENTIAL_CONSTRAINTS r
    ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME AND r.TABLE_NAME = k.TABLE_NAME
    WHERE k.TABLE_SCHEMA = DATABASE() AND k.TABLE_NAME = ? AND k.REFERENCED_TABLE_NAME IS NOT NULL`, [table])
  if (foreign.length !== Object.keys(references).length) throw new Error('贴膜撤销外键数量冲突')
  for (const [name, [parent, column]] of Object.entries(references)) {
    if (!foreign.some(row => row.CONSTRAINT_NAME === `fk_film_cancel_${name}` && row.COLUMN_NAME === name &&
      row.REFERENCED_TABLE_NAME === parent && row.REFERENCED_COLUMN_NAME === column && Number(row.ORDINAL_POSITION) === 1 &&
      row.DELETE_RULE === 'RESTRICT' && row.UPDATE_RULE === 'RESTRICT')) throw new Error(`贴膜撤销外键冲突：${name}`)
  }
  return { exists: true, types }
}

async function snapshot(db, names) {
  const result = {}
  for (const name of names) {
    const [rows] = await db.query(`SELECT * FROM ${name} ORDER BY id`)
    result[name] = { count: rows.length, digest: digest(rows) }
  }
  return result
}

/** 默认只读；DDL不可由业务事务回滚，失败保留备份，不自动删除追加事实。 */
async function migrate(db, { apply = false, rollback = false, backupFile } = {}) {
  const state = await inspect(db)
  if ((rollback && !state.exists) || (!rollback && state.exists)) return { status: 'already_ready', writes: false }
  if (rollback) {
    const [[row]] = await db.query(`SELECT COUNT(*) AS count FROM ${table}`)
    if (Number(row.count)) throw new Error('已有贴膜撤销记录，拒绝删除服务、资金和耗膜关联')
  }
  const sql = [rollback ? `DROP TABLE ${table}` : createTable(state.types)]
  if (!apply) return { status: 'dry_run', writes: false, sql, originalDataUnchanged: true }
  if (!backupFile) throw new Error('执行须提供 --backup-file，先完整备份并暂停贴膜、售后及工资写入')
  const names = [...parents, ...(state.exists ? [table] : [])]
  const before = await snapshot(db, names), schemas = {}
  for (const name of names) {
    const [[schema]] = await db.query(`SHOW CREATE TABLE ${name}`)
    schemas[name] = schema
  }
  const filename = path.resolve(backupFile)
  await fs.mkdir(path.dirname(filename), { recursive: true, mode: 0o700 })
  await fs.writeFile(filename, JSON.stringify({ rollback, tables: before, schemas }, null, 2), { flag: 'wx', mode: 0o600 })
  // 备份期间若仍有写入，不能继续执行DDL，尤其不能回退删除新追加的撤销事实。
  if (JSON.stringify(await inspect(db)) !== JSON.stringify(state) ||
    JSON.stringify(await snapshot(db, names)) !== JSON.stringify(before)) {
    throw new Error('备份期间贴膜、售后或撤销结构/记录发生变化，停止迁移，请确认业务已停写')
  }
  for (const statement of sql) await db.query(statement)
  const after = await inspect(db)
  if (after.exists !== !rollback) throw new Error('贴膜撤销结构回读失败')
  const retained = rollback ? parents : names
  if (JSON.stringify(await snapshot(db, retained)) !== JSON.stringify(Object.fromEntries(retained.map(name => [name, before[name]])))) {
    throw new Error('原贴膜或售后记录发生变化，请保留备份核对并发写入')
  }
  if (!rollback) {
    const [[row]] = await db.query(`SELECT COUNT(*) AS count FROM ${table}`)
    if (Number(row.count)) throw new Error('迁移期间出现撤销记录，请保留备份核对并发写入')
  }
  return { status: 'migrated_and_verified', writes: true, originalDataUnchanged: true, rollback }
}

async function main(args = process.argv.slice(2)) {
  if (args.some(arg => !['--apply', '--rollback'].includes(arg) && !/^--backup-file=.+$/.test(arg)) ||
    args.filter(arg => arg === '--apply').length > 1 || args.filter(arg => arg === '--rollback').length > 1 ||
    args.filter(arg => arg.startsWith('--backup-file=')).length > 1) throw new Error('仅支持 --apply、--rollback 和单个 --backup-file=路径')
  const { db: config } = require('../src/config')
  const db = await require('mysql2/promise').createConnection({ ...config, multipleStatements: false, connectTimeout: 15000 })
  try {
    console.log(JSON.stringify(await migrate(db, { apply: args.includes('--apply'), rollback: args.includes('--rollback'),
      backupFile: args.find(arg => arg.startsWith('--backup-file='))?.slice(14) })))
  } finally { await db.end() }
}
if (require.main === module) main().catch(error => {
  console.error({ status: 'failed', code: error.code || 'FILM_CANCELLATION_MIGRATION_ERROR', message: error.code ? '数据库或备份操作失败' : error.message })
  process.exitCode = 1
})
module.exports = { migrate, inspect, definitions, indexes, references }
