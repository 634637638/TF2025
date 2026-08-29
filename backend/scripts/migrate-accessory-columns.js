'use strict'

const mysql = require('mysql2/promise')
require('dotenv').config({ path: '.env' })

const mappings = [
  { table: 'accessories', from: 'purchase_price', to: 'purchase_cost' },
  { table: 'accessories', from: 'selling_price', to: 'sale_price' },
  { table: 'accessory_stock_in', from: 'purchase_price', to: 'purchase_cost' },
  { table: 'accessory_stock_in', from: 'stock_in_date', to: 'inventory_time' }
]

const quoteIdentifier = value => `\`${value.replaceAll('`', '``')}\``
const tableMappings = table => mappings.filter(item => item.table === table)

async function getColumns(db, table) {
  const [rows] = await db.query(
    `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
     ORDER BY ORDINAL_POSITION`,
    [process.env.DB_NAME, table]
  )
  return rows
}

async function getSnapshot(db, table, fields) {
  const quotedTable = quoteIdentifier(table)
  const expressions = fields.map(field => `SUM(COALESCE(${quoteIdentifier(field)}, 0)) AS ${quoteIdentifier(`${field}_sum`)}`)
  const [rows] = await db.query(
    `SELECT COUNT(*) AS row_count, ${expressions.join(', ')} FROM ${quotedTable}`
  )
  return rows[0]
}

function assertSameSnapshot(before, after, fieldMappings) {
  if (String(before.row_count) !== String(after.row_count)) {
    throw new Error('row count changed during accessory column migration')
  }
  for (const { from, to } of fieldMappings) {
    const beforeKey = `${from}_sum`
    const afterKey = `${to}_sum`
    if (String(before[beforeKey]) !== String(after[afterKey])) {
      throw new Error(`aggregate changed during accessory column migration: ${from}`)
    }
  }
}

async function main() {
  const execute = process.argv.includes('--execute')
  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectTimeout: 10000
  })

  try {
    const tables = [...new Set(mappings.map(item => item.table))]
    const states = {}
    for (const table of tables) {
      const columns = new Set((await getColumns(db, table)).map(column => column.COLUMN_NAME))
      const tableState = tableMappings(table).map(({ from, to }) => ({
        from,
        to,
        migrated: !columns.has(from) && columns.has(to),
        ready: columns.has(from) && !columns.has(to)
      }))
      if (tableState.some(item => !item.migrated && !item.ready)) {
        throw new Error(`incomplete or conflicting schema state in ${table}`)
      }
      if (tableState.some(item => item.migrated) && tableState.some(item => item.ready)) {
        throw new Error(`partially migrated schema state in ${table}`)
      }
      states[table] = tableState
    }

    if (Object.values(states).every(items => items.every(item => item.migrated))) {
      console.log(JSON.stringify({ status: 'already_migrated', database: process.env.DB_NAME, mappings }, null, 2))
      return
    }

    if (!execute) {
      console.log(JSON.stringify({ status: 'dry_run', database: process.env.DB_NAME, mappings }, null, 2))
      return
    }

    const before = {}
    for (const table of tables) {
      const fields = tableMappings(table).map(item => item.from)
      before[table] = await getSnapshot(db, table, fields)
    }

    for (const table of tables) {
      const renames = tableMappings(table)
        .map(({ from, to }) => `RENAME COLUMN ${quoteIdentifier(from)} TO ${quoteIdentifier(to)}`)
        .join(', ')
      await db.query(`ALTER TABLE ${quoteIdentifier(table)} ${renames}`)
    }

    const after = {}
    for (const table of tables) {
      const fields = tableMappings(table).map(item => item.to)
      after[table] = await getSnapshot(db, table, fields)
      assertSameSnapshot(before[table], after[table], tableMappings(table))
    }

    console.log(JSON.stringify({ status: 'migrated_and_verified', database: process.env.DB_NAME, before, after, mappings }, null, 2))
  } finally {
    await db.end()
  }
}

main().catch(error => {
  console.error(JSON.stringify({ status: 'failed', code: error.code || 'MIGRATION_ERROR', message: error.message }))
  process.exitCode = 1
})
