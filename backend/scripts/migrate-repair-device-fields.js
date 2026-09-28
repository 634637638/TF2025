#!/usr/bin/env node
'use strict'

const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../.env') })
const { connectToDatabase, getDatabase, closeDatabase } = require('../src/config/database')

const columns = [
  { name: 'phone_id', definition: 'INT NULL' },
  { name: 'serial_number', definition: 'VARCHAR(100) NULL' },
  { name: 'color_id', definition: 'INT NULL' },
  { name: 'memory_id', definition: 'INT NULL' },
  { name: 'photos', definition: 'LONGTEXT NULL' },
  { name: 'repair_time', definition: 'DATETIME NULL' }
]

const quoteIdentifier = value => `\`${String(value).replaceAll('`', '``')}\``

async function getExistingColumns(db) {
  const [rows] = await db.query('SHOW COLUMNS FROM repairs')
  return new Set(rows.map(row => row.Field))
}

async function main() {
  const apply = process.argv.includes('--apply')
  if (!await connectToDatabase()) throw new Error('数据库连接失败，无法迁移维修设备字段')

  try {
    const db = getDatabase()
    const existing = await getExistingColumns(db)
    const pending = columns.filter(column => !existing.has(column.name))
    const result = {
      mode: apply ? 'apply' : 'dry-run',
      table: 'repairs',
      pending: pending.map(column => column.name)
    }

    if (apply) {
      for (const column of pending) {
        await db.query(`ALTER TABLE repairs ADD COLUMN ${quoteIdentifier(column.name)} ${column.definition}`)
      }
      if (existing.has('created_at') && (existing.has('repair_time') || pending.some(column => column.name === 'repair_time'))) {
        const [backfillResult] = await db.query(
          'UPDATE repairs SET repair_time = created_at WHERE repair_time IS NULL'
        )
        result.repair_time_backfilled = Number(backfillResult.affectedRows || 0)
      }
      result.status = pending.length ? 'migrated' : 'already_ready'
    } else {
      result.status = pending.length ? 'pending' : 'already_ready'
    }

    console.log(JSON.stringify(result, null, 2))
  } finally {
    await closeDatabase()
  }
}

main().catch(error => {
  console.error(JSON.stringify({
    status: 'failed',
    code: error.code || 'REPAIR_DEVICE_MIGRATION_ERROR',
    message: error.message
  }))
  process.exitCode = 1
})
