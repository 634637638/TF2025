'use strict'

const fs = require('node:fs/promises')
const path = require('node:path')
const { createHash } = require('node:crypto')

const table = 'customer_film_services'
const legacyIndex = 'uq_film_order'
const targetIndex = 'uq_film_order_phone'

const digest = rows => createHash('sha256').update(JSON.stringify(rows)).digest('hex')

async function inspect(db) {
  const [tables] = await db.query(`SELECT TABLE_NAME, ENGINE FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${table}'`)
  if (!tables.some(row => row.TABLE_NAME === table && row.ENGINE === 'InnoDB')) throw new Error('贴膜服务表缺失或不是InnoDB')
  const [columns] = await db.query(`SELECT COLUMN_NAME, IS_NULLABLE FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${table}'`)
  for (const name of ['order_id', 'phone_id']) if (!columns.some(row => row.COLUMN_NAME === name)) throw new Error(`贴膜服务字段缺失：${name}`)
  const [keys] = await db.query(`SELECT INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX, NON_UNIQUE, SUB_PART
    FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${table}'`)
  const indexFields = name => keys.filter(row => row.INDEX_NAME === name).sort((a, b) => a.SEQ_IN_INDEX - b.SEQ_IN_INDEX)
  const legacy = indexFields(legacyIndex), target = indexFields(targetIndex)
  const valid = (rows, fields, unique) => rows.length === fields.length && rows.every((row, index) =>
    row.COLUMN_NAME === fields[index] && Number(row.SEQ_IN_INDEX) === index + 1 && Number(row.NON_UNIQUE) === (unique ? 0 : 1) && row.SUB_PART === null)
  if (legacy.length && !valid(legacy, ['order_id'], true)) throw new Error('原贴膜服务唯一索引不兼容')
  if (target.length && !valid(target, ['order_id', 'phone_id'], true)) throw new Error('贴膜服务订单手机索引不兼容')
  if (legacy.length && target.length) throw new Error('贴膜服务同时存在新旧唯一索引')
  if (!legacy.length && !target.length) throw new Error('贴膜服务唯一索引缺失')
  const [duplicates] = await db.query(`SELECT order_id, phone_id, COUNT(*) AS count FROM ${table}
    GROUP BY order_id, phone_id HAVING COUNT(*) > 1`)
  const [orderDuplicates] = await db.query(`SELECT order_id, COUNT(*) AS count FROM ${table}
    GROUP BY order_id HAVING COUNT(*) > 1`)
  return { ready: Boolean(target.length), legacy: Boolean(legacy.length), target: Boolean(target.length), duplicates, orderDuplicates }
}

async function snapshot(db) {
  const [[schema]] = await db.query(`SHOW CREATE TABLE ${table}`)
  const [rows] = await db.query(`SELECT * FROM ${table} ORDER BY id`)
  return { count: rows.length, hash: digest(rows), schema }
}

async function migrate(db, { apply = false, rollback = false, backupFile } = {}) {
  const state = await inspect(db)
  if (rollback ? state.legacy : state.target) return { status: 'already_ready', writes: false }
  if (state.duplicates.length) throw new Error('贴膜服务存在重复订单手机事实，禁止改写唯一索引')
  if (rollback && state.orderDuplicates.length) throw new Error('已有多台手机贴膜记录，禁止回退整单唯一索引')
  const sql = rollback
    ? [`ALTER TABLE ${table} DROP INDEX ${targetIndex}, ADD UNIQUE KEY ${legacyIndex} (order_id)`]
    : [`ALTER TABLE ${table} DROP INDEX ${legacyIndex}, ADD UNIQUE KEY ${targetIndex} (order_id, phone_id)`]
  if (!apply) return { status: 'dry_run', writes: false, sql, rollback }
  if (!backupFile) throw new Error('执行必须提供 --backup-file')
  const before = await snapshot(db)
  const filename = path.resolve(backupFile)
  await fs.mkdir(path.dirname(filename), { recursive: true, mode: 0o700 })
  await fs.writeFile(filename, JSON.stringify({ state, rollback, before }, null, 2), { flag: 'wx', mode: 0o600 })
  const checked = await snapshot(db)
  if (checked.count !== before.count || checked.hash !== before.hash) throw new Error('备份后贴膜服务发生变化，停止迁移')
  for (const statement of sql) await db.query(statement)
  const after = await snapshot(db), current = await inspect(db)
  if (current.ready === rollback || after.count !== before.count || after.hash !== before.hash) throw new Error('贴膜服务唯一索引迁移核验失败')
  return { status: 'migrated_and_verified', writes: true, originalDataUnchanged: true, rollback }
}

function parseArgs(args) {
  if (new Set(args).size !== args.length || args.some(arg => !['--apply', '--rollback'].includes(arg) && !/^--backup-file=.+$/.test(arg)) ||
    args.filter(arg => arg.startsWith('--backup-file=')).length > 1) throw new Error('迁移参数无效')
  return { apply: args.includes('--apply'), rollback: args.includes('--rollback'), backupFile: args.find(arg => arg.startsWith('--backup-file='))?.slice(14) }
}

async function main() {
  const options = parseArgs(process.argv.slice(2)), { db: config } = require('../src/config')
  const db = await require('mysql2/promise').createConnection({ ...config, multipleStatements: false, connectTimeout: 15000 })
  try { console.log(JSON.stringify(await migrate(db, options))) } finally { await db.end() }
}

if (require.main === module) main().catch(error => {
  console.error({ status: 'failed', code: error.code || 'FILM_ORDER_PHONE_INDEX_MIGRATION_ERROR', message: error.code ? '数据库或备份操作失败' : error.message })
  process.exitCode = 1
})

module.exports = { migrate, inspect, parseArgs, legacyIndex, targetIndex }
