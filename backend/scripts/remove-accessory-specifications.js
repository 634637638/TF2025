'use strict'

const fs = require('node:fs/promises')
const path = require('node:path')
const { createHash } = require('node:crypto')

const digest = rows => createHash('sha256').update(JSON.stringify(rows)).digest('hex')

async function inspect(db) {
  const [columns] = await db.query(`SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
    FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'accessories'`)
  if (!columns.some(column => column.COLUMN_NAME === 'product_model')) throw new Error('缺少配件型号字段，拒绝移除规格')
  const column = columns.find(item => item.COLUMN_NAME === 'specifications')
  if (column && (!/^(?:text|mediumtext|longtext|varchar\(\d+\))$/i.test(column.COLUMN_TYPE) ||
    column.IS_NULLABLE !== 'YES' || column.COLUMN_DEFAULT !== null)) throw new Error('规格字段结构不符合可恢复条件，拒绝覆盖')
  return column
}

async function migrate(db, { apply = false, rollback = false, backupFile } = {}) {
  const column = await inspect(db)
  if (!rollback && !column) return { status: 'already_ready', writes: false }
  if (!apply) return { status: 'dry_run', writes: false, rollback, changes: [rollback
    ? '从指定备份恢复 specifications 字段及原值，不覆盖配件型号'
    : '备份规格原值，核验其他字段后删除 accessories.specifications'] }
  if (!backupFile) throw new Error('必须通过 --backup-file 指定受控备份路径')
  const filename = path.resolve(backupFile)
  if (rollback) {
    const backup = JSON.parse(await fs.readFile(filename, 'utf8'))
    if (backup.table !== 'accessories' || backup.column !== 'specifications' ||
      !/^(?:text|mediumtext|longtext|varchar\(\d+\))$/i.test(backup.type) ||
      !Array.isArray(backup.rows) || digest(backup.rows) !== backup.digest) throw new Error('备份内容校验失败')
    if (!column) await db.query(`ALTER TABLE accessories ADD COLUMN specifications ${backup.type} NULL DEFAULT NULL`)
    await db.beginTransaction()
    try {
      for (const row of backup.rows) {
        await db.query('UPDATE accessories SET specifications = ?, updated_at = updated_at WHERE id = ?', [row.specifications, row.id])
      }
      await db.commit()
    } catch (error) { await db.rollback(); throw error }
    return { status: 'restored', writes: true, backupFile: filename }
  }
  const [indexes] = await db.query(`SELECT INDEX_NAME FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'accessories' AND COLUMN_NAME = 'specifications'`)
  if (indexes.length) throw new Error('规格字段被索引引用，拒绝删除')
  const [before] = await db.query('SELECT * FROM accessories ORDER BY id')
  const remaining = before.map(({ specifications: _removed, ...row }) => row)
  const rows = before.map(row => ({ id: row.id, specifications: row.specifications }))
  const backup = { table: 'accessories', column: 'specifications', type: column.COLUMN_TYPE,
    createdAt: new Date().toISOString(), rows, digest: digest(rows), remainingDigest: digest(remaining) }
  await fs.mkdir(path.dirname(filename), { recursive: true, mode: 0o700 })
  await fs.writeFile(filename, JSON.stringify(backup, null, 2), { flag: 'wx', mode: 0o600 })
  const saved = JSON.parse(await fs.readFile(filename, 'utf8'))
  if (saved.digest !== digest(rows)) throw new Error('落盘备份校验失败，未删除字段')
  await db.query('ALTER TABLE accessories DROP COLUMN specifications')
  const [after] = await db.query('SELECT * FROM accessories ORDER BY id')
  if (await inspect(db) || digest(after) !== backup.remainingDigest) throw new Error('迁移核验失败，请保留备份检查并发变更')
  return { status: 'migrated_and_verified', writes: true, rows: rows.length, backupFile: filename, otherFieldsUnchanged: true }
}

async function main() {
  const { db: config } = require('../src/config')
  const db = await require('mysql2/promise').createConnection({ ...config, connectTimeout: 15000 })
  try {
    console.log(JSON.stringify(await migrate(db, {
      apply: process.argv.includes('--apply'), rollback: process.argv.includes('--rollback'),
      backupFile: process.argv.find(argument => argument.startsWith('--backup-file='))?.slice('--backup-file='.length)
    }), null, 2))
  } finally { await db.end() }
}

if (require.main === module) main().catch(error => {
  console.error(JSON.stringify({ status: 'failed', code: error.code || 'ACCESSORY_SPECIFICATIONS_MIGRATION_ERROR',
    message: error.code ? '数据库或备份操作失败' : error.message }))
  process.exitCode = 1
})

module.exports = { inspect, migrate }
