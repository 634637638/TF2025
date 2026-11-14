'use strict'

const fs = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')

async function inspect(db) {
  const [rows] = await db.query("SELECT COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'salary_templates' AND COLUMN_NAME = 'goods_commission_rule'")
  if (!rows.length) return false
  const field = rows[0]
  if (field.COLUMN_TYPE !== 'json' || field.IS_NULLABLE !== 'YES' || field.COLUMN_DEFAULT !== null) {
    throw new Error('商品提成规则字段结构冲突，拒绝覆盖')
  }
  return true
}

const digest = rows => crypto.createHash('sha256').update(JSON.stringify(rows.map(({ goods_commission_rule: _rule, ...row }) => row))).digest('hex')

/** 必须停写维护；默认只预览，不在普通API请求中迁移结构。 */
async function migrate(db, { apply = false, rollback = false, backupFile } = {}) {
  const ready = await inspect(db)
  if (rollback ? !ready : ready) return { status: 'already_ready', writes: false }
  const [[schema]] = await db.query('SHOW CREATE TABLE salary_templates')
  const [before] = await db.query('SELECT * FROM salary_templates ORDER BY id')
  if (rollback && before.some(row => row.goods_commission_rule !== null)) throw new Error('已有商品提成配置，拒绝删除字段，请保留历史配置')
  const sql = rollback ? 'ALTER TABLE salary_templates DROP COLUMN goods_commission_rule' :
    'ALTER TABLE salary_templates ADD COLUMN goods_commission_rule JSON NULL'
  if (!apply) return { status: 'dry_run', writes: false, sql, count: before.length, rollback }
  if (!backupFile) throw new Error('执行必须提供 --backup-file')
  const filename = path.resolve(backupFile)
  await fs.mkdir(path.dirname(filename), { recursive: true, mode: 0o700 })
  await fs.writeFile(filename, JSON.stringify({ table: 'salary_templates', schema, rows: before,
    count: before.length, digest: digest(before), rollback }, null, 2), { flag: 'wx', mode: 0o600 })
  await db.query(sql)
  if (await inspect(db) !== !rollback) throw new Error('商品提成字段迁移结构核验失败')
  const [after] = await db.query('SELECT * FROM salary_templates ORDER BY id')
  if (digest(after) !== digest(before) || !rollback && after.some(row => row.goods_commission_rule !== null)) {
    throw new Error('原工资模板或新规则发生变化，请保留备份核对并发写入')
  }
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
  console.error({ status: 'failed', code: error.code || 'SALARY_GOODS_MIGRATION_ERROR', message: error.code ? '数据库或备份操作失败' : error.message })
  process.exitCode = 1
})
module.exports = { migrate, inspect }
