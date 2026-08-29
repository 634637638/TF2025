'use strict'

const mysql = require('mysql2/promise')
require('dotenv').config({ path: '.env' })

const mappings = [
  { table: 'phones', from: 'Inventorytime', to: 'inventory_time', kind: 'datetime' },
  { table: 'phones', from: 'salestime', to: 'sale_time', kind: 'datetime' },
  { table: 'sales', from: 'price', to: 'sale_price', kind: 'money' },
  { table: 'sales', from: 'cost', to: 'purchase_cost', kind: 'money' },
  { table: 'sales', from: 'sale_date', to: 'sale_time', kind: 'datetime' }
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
  const expressions = fields.map(field => {
    const quotedField = quoteIdentifier(field.from)
    const prefix = field.kind === 'money' ? `SUM(COALESCE(${quotedField}, 0))` : 'COUNT(*)'
    return `${prefix} AS ${quoteIdentifier(`${field.from}_aggregate`)}`
  })
  const nullExpressions = fields.map(field => {
    const quotedField = quoteIdentifier(field.from)
    return `SUM(CASE WHEN ${quotedField} IS NULL THEN 1 ELSE 0 END) AS ${quoteIdentifier(`${field.from}_nulls`)}`
  })
  const [rows] = await db.query(
    `SELECT COUNT(*) AS row_count, ${[...expressions, ...nullExpressions].join(', ')} FROM ${quotedTable}`
  )
  return rows[0]
}

function assertSameSnapshot(before, after, fieldMappings) {
  if (String(before.row_count) !== String(after.row_count)) {
    throw new Error('row count changed during phones/sales column migration')
  }

  for (const field of fieldMappings) {
    const aggregateKey = `${field.from}_aggregate`
    const nullKey = `${field.from}_nulls`
    if (String(before[aggregateKey]) !== String(after[aggregateKey])) {
      throw new Error(`aggregate changed during column migration: ${field.table}.${field.from}`)
    }
    if (String(before[nullKey]) !== String(after[nullKey])) {
      throw new Error(`null count changed during column migration: ${field.table}.${field.from}`)
    }
  }
}

function inspectSchema(columns, table) {
  const columnNames = new Set(columns.map(column => column.COLUMN_NAME))
  const state = tableMappings(table).map(({ from, to }) => ({
    table,
    from,
    to,
    migrated: !columnNames.has(from) && columnNames.has(to),
    ready: columnNames.has(from) && !columnNames.has(to)
  }))

  if (state.some(item => !item.migrated && !item.ready)) {
    throw new Error(`incomplete or conflicting schema state in ${table}`)
  }
  if (state.some(item => item.migrated) && state.some(item => item.ready)) {
    throw new Error(`partially migrated schema state in ${table}`)
  }
  return state
}

async function main() {
  const execute = process.argv.includes('--execute')
  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || process.env.DB_PASS,
    database: process.env.DB_NAME,
    connectTimeout: 10000
  })

  try {
    const tables = [...new Set(mappings.map(item => item.table))]
    const states = {}
    for (const table of tables) {
      states[table] = inspectSchema(await getColumns(db, table), table)
    }

    if (Object.values(states).every(items => items.every(item => item.migrated))) {
      console.log(JSON.stringify({ status: 'already_migrated', database: process.env.DB_NAME, mappings }, null, 2))
      return
    }

    if (!execute) {
      console.log(JSON.stringify({ status: 'dry_run', database: process.env.DB_NAME, mappings, states }, null, 2))
      return
    }

    const before = {}
    for (const table of tables) {
      before[table] = await getSnapshot(db, table, tableMappings(table))
    }

    for (const table of tables) {
      const renames = tableMappings(table)
        .map(({ from, to }) => `RENAME COLUMN ${quoteIdentifier(from)} TO ${quoteIdentifier(to)}`)
        .join(', ')
      await db.query(`ALTER TABLE ${quoteIdentifier(table)} ${renames}`)
    }

    const after = {}
    for (const table of tables) {
      const migratedFields = tableMappings(table).map(field => ({ ...field, from: field.to }))
      after[table] = await getSnapshot(db, table, migratedFields)
      const normalizedAfter = {}
      for (const field of tableMappings(table)) {
        normalizedAfter[`${field.from}_aggregate`] = after[table][`${field.to}_aggregate`]
        normalizedAfter[`${field.from}_nulls`] = after[table][`${field.to}_nulls`]
      }
      normalizedAfter.row_count = after[table].row_count
      assertSameSnapshot(before[table], normalizedAfter, tableMappings(table))
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
