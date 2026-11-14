'use strict'

const fs = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')
const AccessoryRepository = require('../src/repositories/accessory.repository')
const { normalizeDatabaseIdentifier } = require('../src/utils/database-identifier')
const repository = new AccessoryRepository()
const columns = { request_key: 32, request_hash: 64 }
const index = 'uq_accessory_stock_in_request'

async function inspect(db) {
  const state = await repository.getStockInRequestSchema(db)
  if (state.engine !== 'InnoDB') throw new Error('采购入库表缺失或非InnoDB，拒绝迁移')
  const added = [], changes = []
  for (const [name, length] of Object.entries(columns)) {
    const field = state.fields.find(row => row.COLUMN_NAME === name)
    if (!field) { changes.push(`ADD COLUMN ${name} CHAR(${length}) CHARACTER SET ascii COLLATE ascii_bin NULL`); continue }
    if (field.COLUMN_TYPE.toLowerCase() !== `char(${length})` || field.IS_NULLABLE !== 'YES' || field.COLLATION_NAME !== 'ascii_bin') throw new Error(`采购防重字段结构冲突：${name}`)
    added.push(name)
  }
  const keys = state.indexes.filter(row => row.INDEX_NAME === index)
  if (!keys.length) changes.push(`ADD UNIQUE KEY ${index} (request_key)`)
  else if (keys.length !== 1 || keys[0].COLUMN_NAME !== 'request_key' || Number(keys[0].NON_UNIQUE) !== 0 ||
    Number(keys[0].SEQ_IN_INDEX) !== 1 || keys[0].SUB_PART !== null) throw new Error('采购防重唯一索引结构冲突')
  if (!state.fields.some(row => row.COLUMN_NAME === 'id')) throw new Error('采购原表主键缺失')
  return { ...state, added, changes, indexed: Boolean(keys.length) }
}

async function migrate(db, { apply = false, rollback = false, backupFile } = {}) {
  const state = await inspect(db)
  if (rollback && state.added.length) {
    const [[row]] = await db.query(`SELECT COUNT(*) AS count FROM accessory_stock_in WHERE ${state.added.map(name => `${name} IS NOT NULL`).join(' OR ')}`)
    if (Number(row.count)) throw new Error('已有入库请求凭据，拒绝回滚删除防重记录')
  }
  const changes = rollback ? [...(state.indexed ? [`DROP INDEX ${index}`] : []), ...state.added.map(name => `DROP COLUMN ${name}`)] : state.changes
  if (!changes.length) return { status: 'already_ready', writes: false }
  const sql = `ALTER TABLE accessory_stock_in ${changes.join(', ')}`
  if (!apply) return { status: 'dry_run', writes: false, sql }
  if (!backupFile) throw new Error('执行必须提供 --backup-file，并保留完整数据库备份、暂停采购入库')
  const originalFields = state.fields.filter(row => !Object.hasOwn(columns, row.COLUMN_NAME)).map(row => row.COLUMN_NAME)
  const select = `SELECT ${originalFields.map(name => `\`${normalizeDatabaseIdentifier(name)}\``).join(', ')} FROM accessory_stock_in ORDER BY id`
  const [[schema]] = await db.query('SHOW CREATE TABLE accessory_stock_in')
  const [rows] = await db.query('SELECT * FROM accessory_stock_in ORDER BY id')
  const [before] = await db.query(select)
  const digest = data => crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex')
  const filename = path.resolve(backupFile)
  await fs.mkdir(path.dirname(filename), { recursive: true, mode: 0o700 })
  await fs.writeFile(filename, JSON.stringify({ schema, rows, originalDigest: digest(before), rollback }, null, 2), { flag: 'wx', mode: 0o600 })
  await db.query(sql)
  const after = await inspect(db)
  if ((!rollback && after.changes.length) || (rollback && (after.added.length || after.indexed))) throw new Error('采购防重迁移后结构核验失败')
  const [current] = await db.query(select)
  if (digest(current) !== digest(before)) throw new Error('原采购数据变化，请保留备份核对并发写入')
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
  console.error({ status: 'failed', code: error.code || 'ACCESSORY_STOCK_IN_MIGRATION_ERROR', message: error.code ? '数据库或备份操作失败' : error.message })
  process.exitCode = 1
})
module.exports = { migrate, inspect }
