'use strict'

const fs = require('node:fs/promises')
const path = require('node:path')
const { table, DDL, inspect } = require('../src/utils/accessory-template-color-schema')

/** 仅创建空规格关系表；不回填或修改原商品、库存和交易。 */
async function migrate(db, { apply = false, rollback = false, backupFile } = {}) {
  const state = await inspect(db)
  if (rollback) {
    if (!state.exists) return { status: 'already_ready', writes: false }
    const [[row]] = await db.query(`SELECT COUNT(*) AS count FROM ${table}`)
    if (Number(row.count)) throw new Error('已有颜色规格，拒绝回退删除')
  } else if (state.exists) return { status: 'already_ready', writes: false }
  const sql = rollback ? `DROP TABLE ${table}` : DDL
  if (!apply) return { status: 'dry_run', writes: false, sql }
  if (!backupFile) throw new Error('执行前须完整备份并暂停商品写入，提供 --backup-file 保存结构摘要')
  const schema = {}
  for (const name of ['accessories', 'colors', ...(state.exists ? [table] : [])]) {
    const [[row]] = await db.query(`SHOW CREATE TABLE ${name}`)
    schema[name] = row
  }
  const target = path.resolve(backupFile)
  await fs.mkdir(path.dirname(target), { recursive: true, mode: 0o700 })
  await fs.writeFile(target, JSON.stringify({ rollback, schema }, null, 2), { flag: 'wx', mode: 0o600 })
  await db.query(sql)
  const after = await inspect(db)
  if (after.exists === rollback) throw new Error('模板颜色结构迁移核验失败')
  return { status: 'migrated_and_verified', writes: true, rollback }
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
  console.error({ status: 'failed', code: error.code || 'TEMPLATE_COLOR_MIGRATION_ERROR', message: error.code ? '数据库或备份操作失败' : error.message })
  process.exitCode = 1
})
module.exports = { migrate, inspect }
