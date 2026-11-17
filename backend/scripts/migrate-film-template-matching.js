'use strict'

const fs = require('node:fs/promises')
const path = require('node:path')
const { createHash } = require('node:crypto')
const { additions, inspect } = require('../src/utils/film-template-schema')
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const strip = (rows, table) => rows.map(row => Object.fromEntries(Object.entries(row).filter(([key]) => !Object.hasOwn(additions[table], key))))
async function snapshot(db) {
  const result = {}
  for (const table of Object.keys(additions)) {
    const [rows] = await db.query(`SELECT * FROM ${table} ORDER BY id`)
    const [[schema]] = await db.query(`SHOW CREATE TABLE ${table}`)
    result[table] = { count: rows.length, hash: digest(strip(rows, table)), schema }
  }
  return result
}
async function migrate(db, { apply = false, rollback = false, backupFile } = {}) {
  const state = await inspect(db)
  const fields = Object.entries(additions).flatMap(([table, definitions]) => Object.keys(definitions).map(name => ({ table, name })))
  const present = fields.filter(row => !state.missing.some(missing => missing.table === row.table && missing.name === row.name))
  if (rollback ? !present.length : state.ready) return { status: 'already_ready', writes: false }
  if (rollback) for (const { table, name } of present) {
    const [[row]] = await db.query(`SELECT COUNT(*) AS count FROM ${table} WHERE ${name} ${table === 'accessories' ? '<> 0' : 'IS NOT NULL'}`)
    if (Number(row.count)) throw new Error('已有模板贴膜配置或设备服务关联，禁止删除扩展结构')
  }
  const sql = rollback ? present.map(({ table, name }) => `ALTER TABLE ${table} DROP COLUMN ${name}`)
    : state.missing.map(({ table, name, definition }) => `ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`)
  if (!apply) return { status: 'dry_run', writes: false, sql, rollback }
  if (!backupFile) throw new Error('须先完整备份并停写，再提供独占 --backup-file 保存结构及原记录摘要')
  const before = await snapshot(db), filename = path.resolve(backupFile)
  await fs.mkdir(path.dirname(filename), { recursive: true, mode: 0o700 })
  await fs.writeFile(filename, JSON.stringify({ rollback, state, before }, null, 2), { flag: 'wx', mode: 0o600 })
  if (digest(before) !== digest(await snapshot(db))) throw new Error('备份后原表变化，停止迁移')
  for (const statement of sql) await db.query(statement)
  const afterState = await inspect(db), after = await snapshot(db)
  if (rollback ? afterState.missing.length !== fields.length : !afterState.ready) throw new Error('贴膜匹配结构回读失败')
  for (const table of Object.keys(additions)) {
    if (before[table].count !== after[table].count || before[table].hash !== after[table].hash) throw new Error('原业务记录变化，请保留备份核对')
  }
  if (!rollback) for (const { table, name } of state.missing) {
    const [[row]] = await db.query(`SELECT COUNT(*) AS count FROM ${table} WHERE ${name} ${table === 'accessories' ? '<> 0' : 'IS NOT NULL'}`)
    if (Number(row.count)) throw new Error('迁移期间新增字段出现业务写入，请保留备份核对')
  }
  return { status: 'migrated_and_verified', writes: true, rollback, originalDataUnchanged: true }
}
function parseArgs(args) {
  if (new Set(args).size !== args.length || args.some(arg => !['--apply', '--rollback'].includes(arg) && !/^--backup-file=.+$/.test(arg)) || args.filter(arg => arg.startsWith('--backup-file=')).length > 1) throw new Error('迁移参数无效')
  return { apply: args.includes('--apply'), rollback: args.includes('--rollback'), backupFile: args.find(arg => arg.startsWith('--backup-file='))?.slice(14) }
}
async function main() {
  const options = parseArgs(process.argv.slice(2)), { db: config } = require('../src/config')
  const db = await require('mysql2/promise').createConnection({ ...config, multipleStatements: false, connectTimeout: 15000 })
  try { console.log(JSON.stringify(await migrate(db, options))) } finally { await db.end() }
}
if (require.main === module) main().catch(error => {
  console.error({ status: 'failed', code: error.code || 'FILM_TEMPLATE_MIGRATION_ERROR', message: error.code ? '数据库或备份操作失败' : error.message })
  process.exitCode = 1
})
module.exports = { migrate, inspect, parseArgs }
