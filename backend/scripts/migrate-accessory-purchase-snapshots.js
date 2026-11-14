'use strict'

const fs = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')
const Repository = require('../src/repositories/accessory.repository')
const { normalizeDatabaseIdentifier } = require('../src/utils/database-identifier')
const repository = new Repository()

async function inspect(db) {
  const state = await repository.getStockInRequestSchema(db)
  if (state.engine !== 'InnoDB' || !state.fields.some(row => row.COLUMN_NAME === 'id')) throw new Error('采购表缺失、非InnoDB或缺少原主键，拒绝迁移')
  const column = state.fields.find(row => row.COLUMN_NAME === 'product_snapshot')
  if (column && (column.COLUMN_TYPE.toLowerCase() !== 'json' || column.IS_NULLABLE !== 'YES')) throw new Error('原采购快照字段结构冲突')
  return { ...state, ready: Boolean(column) }
}

async function migrate(db, { apply = false, rollback = false, backupFile } = {}) {
  const state = await inspect(db)
  if (rollback && state.ready) {
    const [[row]] = await db.query('SELECT COUNT(*) AS count FROM accessory_stock_in WHERE product_snapshot IS NOT NULL')
    if (Number(row.count)) throw new Error('已有采购资料快照，拒绝回滚删除原单事实')
  }
  if (rollback ? !state.ready : state.ready) return { status: 'already_ready', writes: false }
  const sql = `ALTER TABLE accessory_stock_in ${rollback ? 'DROP COLUMN product_snapshot' : 'ADD COLUMN product_snapshot JSON NULL'}`
  if (!apply) return { status: 'dry_run', writes: false, sql }
  if (!backupFile) throw new Error('执行必须提供 --backup-file，并保留完整数据库备份、暂停采购入库')
  const fields = state.fields.filter(row => row.COLUMN_NAME !== 'product_snapshot').map(row => `\`${normalizeDatabaseIdentifier(row.COLUMN_NAME)}\``)
  const originalQuery = `SELECT ${fields.join(', ')} FROM accessory_stock_in ORDER BY id`
  const [[schema]] = await db.query('SHOW CREATE TABLE accessory_stock_in')
  const [rows] = await db.query('SELECT * FROM accessory_stock_in ORDER BY id')
  const [before] = await db.query(originalQuery)
  const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')
  const filename = path.resolve(backupFile)
  await fs.mkdir(path.dirname(filename), { recursive: true, mode: 0o700 })
  await fs.writeFile(filename, JSON.stringify({ schema, rows, originalDigest: digest(before), rollback }, null, 2), { flag: 'wx', mode: 0o600 })
  await db.query(sql)
  if ((await inspect(db)).ready === rollback) throw new Error('采购快照迁移后结构核验失败')
  const [after] = await db.query(originalQuery)
  if (digest(before) !== digest(after)) throw new Error('原采购数据变化，请保留备份核对并发写入')
  return { status: 'migrated_and_verified', writes: true, originalDataUnchanged: true, rollback }
}

async function main() {
  const { db: config } = require('../src/config')
  const db = await require('mysql2/promise').createConnection({ ...config, connectTimeout: 15000 })
  try {
    console.log(JSON.stringify(await migrate(db, { apply: process.argv.includes('--apply'), rollback: process.argv.includes('--rollback'),
      backupFile: process.argv.find(arg => arg.startsWith('--backup-file='))?.slice(14) })))
  } finally { await db.end() }
}
if (require.main === module) main().catch(error => {
  console.error({ status: 'failed', code: error.code || 'PURCHASE_SNAPSHOT_MIGRATION_ERROR', message: error.code ? '数据库或备份操作失败' : error.message })
  process.exitCode = 1
})
module.exports = { migrate, inspect }
