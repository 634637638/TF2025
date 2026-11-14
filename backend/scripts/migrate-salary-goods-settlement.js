'use strict'

const fs = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')

const normalizeType = value => String(value).toLowerCase().replace(/\b(tinyint|smallint|mediumint|int|bigint)\(\d+\)/g, '$1')
const integerType = value => {
  const result = normalizeType(value)
  if (!/^(tinyint|smallint|mediumint|int|bigint)( unsigned)?$/.test(result)) throw new Error('原工资关联编号字段类型不受支持，拒绝猜测外键类型')
  return result
}
const definitions = (salaryId, employeeId) => ({ id: 'bigint unsigned', employee_id: employeeId,
  salary_record_id: salaryId, original_salary_record_id: salaryId, source_key: 'varchar(96)', source_hash: 'char(64)',
  amount_cents: 'bigint', source_snapshot: 'json', created_at: 'datetime' })
const indexes = [['PRIMARY', ['id'], true], ['uq_salary_goods_source', ['source_key'], true],
  ['idx_salary_goods_employee', ['employee_id', 'id'], false], ['idx_salary_goods_record', ['salary_record_id'], false],
  ['idx_salary_goods_original', ['original_salary_record_id'], false]]

async function inspect(db) {
  const [parents] = await db.query("SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'salary_records'")
  if (parents[0]?.ENGINE !== 'InnoDB') throw new Error('原工资表不存在或引擎不支持安全关联')
  const [parentColumns] = await db.query("SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'salary_records' AND COLUMN_NAME IN ('id','employee_id','goods_commission_snapshot')")
  const salaryId = integerType(parentColumns.find(row => row.COLUMN_NAME === 'id')?.COLUMN_TYPE)
  const employeeId = integerType(parentColumns.find(row => row.COLUMN_NAME === 'employee_id')?.COLUMN_TYPE)
  const snapshot = parentColumns.find(row => row.COLUMN_NAME === 'goods_commission_snapshot')
  if (snapshot && (snapshot.COLUMN_TYPE !== 'json' || snapshot.IS_NULLABLE !== 'YES' || snapshot.COLUMN_DEFAULT !== null)) throw new Error('商品工资快照字段结构冲突')
  const [tables] = await db.query("SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'salary_goods_settlements'")
  if (!tables.length) return { column: Boolean(snapshot), table: false, salaryId, employeeId }
  if (tables[0].ENGINE !== 'InnoDB') throw new Error('商品工资核销表引擎冲突')
  const [columns] = await db.query("SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA, COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'salary_goods_settlements'")
  const expected = definitions(salaryId, employeeId)
  if (columns.length !== Object.keys(expected).length) throw new Error('商品工资核销字段数量冲突')
  for (const [name, type] of Object.entries(expected)) {
    const column = columns.find(row => row.COLUMN_NAME === name)
    if (!column || normalizeType(column.COLUMN_TYPE) !== type || column.IS_NULLABLE !== (name === 'original_salary_record_id' ? 'YES' : 'NO') ||
      column.COLUMN_DEFAULT !== null || column.EXTRA !== (name === 'id' ? 'auto_increment' : '') ||
      ['source_key', 'source_hash'].includes(name) && column.COLLATION_NAME !== 'ascii_bin') throw new Error(`商品工资核销字段结构冲突：${name}`)
  }
  const [keys] = await db.query("SELECT INDEX_NAME, COLUMN_NAME, NON_UNIQUE, SEQ_IN_INDEX, SUB_PART FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'salary_goods_settlements' ORDER BY INDEX_NAME, SEQ_IN_INDEX")
  for (const [name, fields, unique] of indexes) {
    const entries = keys.filter(row => row.INDEX_NAME === name)
    if (entries.length !== fields.length || entries.some((entry, index) => entry.COLUMN_NAME !== fields[index] ||
      Number(entry.SEQ_IN_INDEX) !== index + 1 || Number(entry.NON_UNIQUE) !== Number(!unique) || entry.SUB_PART !== null)) throw new Error('商品工资核销索引结构冲突')
  }
  const [foreign] = await db.query(`SELECT k.CONSTRAINT_NAME, k.COLUMN_NAME, k.REFERENCED_TABLE_NAME, k.REFERENCED_COLUMN_NAME,
    k.ORDINAL_POSITION, r.DELETE_RULE, r.UPDATE_RULE FROM information_schema.KEY_COLUMN_USAGE k
    JOIN information_schema.REFERENTIAL_CONSTRAINTS r ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME AND r.TABLE_NAME = k.TABLE_NAME
    WHERE k.TABLE_SCHEMA = DATABASE() AND k.TABLE_NAME = 'salary_goods_settlements' AND k.REFERENCED_TABLE_NAME IS NOT NULL`)
  if (foreign.length !== 2 || ['salary_record_id', 'original_salary_record_id'].some(field => !foreign.some(row => row.COLUMN_NAME === field &&
    row.CONSTRAINT_NAME === (field === 'salary_record_id' ? 'fk_salary_goods_record' : 'fk_salary_goods_original') &&
    row.REFERENCED_TABLE_NAME === 'salary_records' && row.REFERENCED_COLUMN_NAME === 'id' && Number(row.ORDINAL_POSITION) === 1 &&
    row.DELETE_RULE === 'RESTRICT' && row.UPDATE_RULE === 'RESTRICT'))) throw new Error('商品工资核销外键结构冲突')
  return { column: Boolean(snapshot), table: true, salaryId, employeeId }
}

const createTable = state => `CREATE TABLE salary_goods_settlements (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  employee_id ${state.employeeId} NOT NULL,
  salary_record_id ${state.salaryId} NOT NULL,
  original_salary_record_id ${state.salaryId} NULL,
  source_key VARCHAR(96) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  source_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  amount_cents BIGINT NOT NULL, source_snapshot JSON NOT NULL, created_at DATETIME NOT NULL,
  UNIQUE KEY uq_salary_goods_source (source_key), KEY idx_salary_goods_employee (employee_id, id),
  KEY idx_salary_goods_record (salary_record_id), KEY idx_salary_goods_original (original_salary_record_id),
  CONSTRAINT fk_salary_goods_record FOREIGN KEY (salary_record_id) REFERENCES salary_records (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_salary_goods_original FOREIGN KEY (original_salary_record_id) REFERENCES salary_records (id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
const digest = rows => crypto.createHash('sha256').update(JSON.stringify(rows.map(({ goods_commission_snapshot: _snapshot, ...row }) => row))).digest('hex')

/** 显式停写维护入口；DDL非事务，失败保留备份和部分结构，禁止自动删历史。 */
async function migrate(db, { apply = false, rollback = false, backupFile } = {}) {
  const state = await inspect(db)
  if (rollback ? !state.column && !state.table : state.column && state.table) return { status: 'already_ready', writes: false }
  const [before] = await db.query('SELECT * FROM salary_records ORDER BY id')
  const [ledger] = state.table ? await db.query('SELECT * FROM salary_goods_settlements ORDER BY id') : [[]]
  if (ledger.length || before.some(row => state.column && row.goods_commission_snapshot !== null)) {
    throw new Error('已有商品工资快照或核销历史，拒绝删除或重建缺失结构')
  }
  const sql = rollback ? [state.table && 'DROP TABLE salary_goods_settlements', state.column && 'ALTER TABLE salary_records DROP COLUMN goods_commission_snapshot'].filter(Boolean)
    : [!state.column && 'ALTER TABLE salary_records ADD COLUMN goods_commission_snapshot JSON NULL', !state.table && createTable(state)].filter(Boolean)
  if (!apply) return { status: 'dry_run', writes: false, sql, rollback, count: before.length }
  if (!backupFile) throw new Error('执行必须提供 --backup-file')
  const [[salarySchema]] = await db.query('SHOW CREATE TABLE salary_records')
  const [[ledgerSchema]] = state.table ? await db.query('SHOW CREATE TABLE salary_goods_settlements') : [[null]]
  const backup = { rollback, state, salarySchema, ledgerSchema, salary_records: before, salary_goods_settlements: ledger, digest: digest(before) }
  const filename = path.resolve(backupFile)
  await fs.mkdir(path.dirname(filename), { recursive: true, mode: 0o700 })
  await fs.writeFile(filename, JSON.stringify(backup, null, 2), { flag: 'wx', mode: 0o600 })
  for (const statement of sql) await db.query(statement)
  const afterState = await inspect(db)
  if (afterState.column !== !rollback || afterState.table !== !rollback) throw new Error('商品工资核销迁移结构核验失败')
  const [after] = await db.query('SELECT * FROM salary_records ORDER BY id')
  const [afterLedger] = !rollback ? await db.query('SELECT * FROM salary_goods_settlements ORDER BY id') : [[]]
  if (digest(after) !== backup.digest || !rollback && (after.some(row => row.goods_commission_snapshot !== null) || afterLedger.length)) {
    throw new Error('原工资或核销数据发生变化，请保留备份核对并发写入')
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
  console.error({ status: 'failed', code: error.code || 'SALARY_GOODS_SETTLEMENT_MIGRATION_ERROR', message: error.code ? '数据库或备份操作失败' : error.message })
  process.exitCode = 1
})
module.exports = { migrate, inspect, definitions, indexes }
