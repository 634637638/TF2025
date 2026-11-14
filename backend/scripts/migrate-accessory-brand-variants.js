'use strict'

const INDEX = 'uq_accessories_template_brand'

async function inspect(db) {
  const [columns] = await db.query(`SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
    FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'accessories'`)
  const idType = columns.find(column => column.COLUMN_NAME === 'id')?.COLUMN_TYPE.toLowerCase()
  if (!idType || !/^(?:bigint|int)(?:\(\d+\))?(?: unsigned)?$/.test(idType)) {
    throw new Error('缺少配件主键或类型不符合预期，拒绝迁移')
  }
  const column = columns.find(item => item.COLUMN_NAME === 'template_id')
  if (column && (column.COLUMN_TYPE.toLowerCase() !== idType || column.IS_NULLABLE !== 'YES')) {
    throw new Error('template_id 结构不符合预期，拒绝覆盖')
  }
  const [indexes] = await db.query(`SELECT INDEX_NAME, NON_UNIQUE, COLUMN_NAME, SEQ_IN_INDEX
    FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'accessories' AND INDEX_NAME = ?`, [INDEX])
  const ordered = indexes.sort((a, b) => a.SEQ_IN_INDEX - b.SEQ_IN_INDEX)
  if (ordered.length && (ordered.length !== 2 || ordered.some(item => Number(item.NON_UNIQUE) !== 0) ||
      ordered.map(item => item.COLUMN_NAME).join(',') !== 'template_id,brand_id')) {
    throw new Error('模板品牌索引结构不符合预期，拒绝覆盖')
  }
  return { idType, column: Boolean(column), index: Boolean(ordered.length) }
}

async function migrate(db, { apply = false, rollback = false, backupConfirmed = false } = {}) {
  const before = await inspect(db)
  if ((!rollback && before.column && before.index) || (rollback && !before.column && !before.index)) {
    return { status: 'already_ready', writes: false, rollback }
  }
  if (rollback && before.column) {
    const [[row]] = await db.query('SELECT COUNT(*) AS count FROM accessories WHERE template_id IS NOT NULL')
    if (Number(row.count)) throw new Error('已有品牌库存商品，拒绝删除关联；保留结构并回退应用代码')
  }
  const changes = rollback
    ? [...(before.index ? [`ALTER TABLE accessories DROP INDEX ${INDEX}`] : []), ...(before.column ? ['ALTER TABLE accessories DROP COLUMN template_id'] : [])]
    : [...(!before.column ? [`ALTER TABLE accessories ADD COLUMN template_id ${before.idType} NULL`] : []),
      ...(!before.index ? [`ALTER TABLE accessories ADD UNIQUE INDEX ${INDEX} (template_id, brand_id)`] : [])]
  if (!apply) return { status: 'dry_run', writes: false, rollback, changes }
  if (!backupConfirmed) throw new Error('执行前须确认目标环境及现有备份并传入 --backup-confirmed')
  for (const sql of changes) await db.query(sql)
  const after = await inspect(db)
  if (after.column !== !rollback || after.index !== !rollback) throw new Error('迁移后核验失败')
  return { status: 'migrated_and_verified', writes: true, rollback, changes }
}

async function main() {
  const envArg = process.argv.find(argument => argument.startsWith('--env-file='))
  if (envArg) process.env.ENV_FILE = envArg.slice('--env-file='.length)
  const { db: dbConfig } = require('../src/config')
  const db = await require('mysql2/promise').createConnection({ ...dbConfig, connectTimeout: 15000 })
  try {
    console.log(JSON.stringify(await migrate(db, {
      apply: process.argv.includes('--apply'), rollback: process.argv.includes('--rollback'),
      backupConfirmed: process.argv.includes('--backup-confirmed')
    }), null, 2))
  } finally { await db.end() }
}

if (require.main === module) main().catch(error => {
  console.error(JSON.stringify({ status: 'failed', code: error.code || 'ACCESSORY_VARIANT_MIGRATION_ERROR', message: error.code ? '数据库操作失败' : error.message }))
  process.exitCode = 1
})

module.exports = { inspect, migrate }
