'use strict'

const path = require('node:path')

const COLUMNS = [
  ['return_reason', 'varchar(50)'],
  ['return_type', 'varchar(30)'],
  ['handle_method', 'varchar(30)'],
  ['refund_amount', 'decimal(10,2)'],
  ['refund_method', 'varchar(30)'],
  ['refund_channel', 'varchar(30)']
]

async function inspect(db) {
  const [rows] = await db.execute(`SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sale_reversal_logs'`)
  if (!rows.length) throw new Error('缺少 sale_reversal_logs 表，请先核对目标数据库')
  for (const name of ['reversal_date', 'created_at']) {
    if (!rows.some(row => row.COLUMN_NAME === name)) throw new Error(`退库日志缺少 ${name} 字段`)
  }
  const pending = []
  for (const [name, type] of COLUMNS) {
    const column = rows.find(row => row.COLUMN_NAME === name)
    if (!column) pending.push(name)
    else if (String(column.COLUMN_TYPE).toLowerCase() !== type || column.IS_NULLABLE !== 'YES') {
      throw new Error(`${name} 已存在但结构不一致，拒绝覆盖`)
    }
  }
  return pending
}

async function migrate(db, { apply = false, rollback = false } = {}) {
  if (apply && rollback) throw new Error('--apply 与 --rollback 不能同时使用')
  const pending = await inspect(db)
  if (rollback) {
    const existing = COLUMNS.map(([name]) => name).filter(name => !pending.includes(name))
    if (!existing.length) return { status: 'already_rolled_back' }
    const [rows] = await db.execute(`SELECT COUNT(*) AS total FROM sale_reversal_logs
      WHERE ${existing.map(name => `\`${name}\` IS NOT NULL`).join(' OR ')}`)
    if (Number(rows[0]?.total) > 0) throw new Error('已有退库明细，拒绝删除字段；请保留结构并回滚应用代码')
    await db.execute(`ALTER TABLE sale_reversal_logs ${existing.map(name => `DROP COLUMN \`${name}\``).join(', ')}`)
    return { status: 'rolled_back' }
  }
  if (!apply) return { status: pending.length ? 'dry_run' : 'already_ready', pending }
  if (pending.length) {
    await db.execute(`ALTER TABLE sale_reversal_logs ${COLUMNS
      .filter(([name]) => pending.includes(name))
      .map(([name, type]) => `ADD COLUMN \`${name}\` ${type.toUpperCase()} NULL`)
      .join(', ')}`)
  }
  if ((await inspect(db)).length) throw new Error('退库明细迁移后校验失败')
  return { status: pending.length ? 'migrated_and_verified' : 'already_ready', pending: [] }
}

async function main() {
  const envFileArg = process.argv.find(argument => argument.startsWith('--env-file='))
  const envFile = path.resolve(__dirname, '..', envFileArg?.slice('--env-file='.length) ||
    process.env.ENV_FILE || (process.env.NODE_ENV === 'production' ? '.env.production' : '.env'))
  require('dotenv').config({ path: envFile, quiet: true })
  const db = await require('mysql2/promise').createConnection({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER, password: process.env.DB_PASSWORD || process.env.DB_PASS,
    database: process.env.DB_NAME, charset: 'utf8mb4', connectTimeout: 30000
  })
  try {
    console.log(JSON.stringify(await migrate(db, {
      apply: process.argv.includes('--apply'), rollback: process.argv.includes('--rollback')
    }), null, 2))
  } finally {
    await db.end()
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(JSON.stringify({ status: 'failed', code: error.code || 'RETURN_STOCK_MIGRATION_ERROR', message: error.message }))
    process.exitCode = 1
  })
}

module.exports = { migrate, COLUMNS }
