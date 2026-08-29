'use strict'

const mysql = require('mysql2/promise')
const path = require('node:path')
require('dotenv').config({ path: path.resolve(__dirname, '../.env') })

// These names are historical physical columns already covered by the completed rename scripts.
const legacyCandidates = [
  'purchase_price',
  'selling_price',
  'stock_in_date',
  'sale_date',
  'salestime',
  'Inventorytime',
  'price',
  'cost',
  'purchase_date',
  'inbound_date'
]

async function getTables(db) {
  const [rows] = await db.query('SHOW TABLES')
  return rows.map(row => Object.values(row)[0])
}

async function getColumns(db, table) {
  const [rows] = await db.query('SHOW COLUMNS FROM ??', [table])
  return rows.map(row => row.Field)
}

async function main() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || process.env.DB_PASS,
    database: process.env.DB_NAME,
    connectTimeout: 10000
  })

  try {
    const legacyColumns = []
    const caseColumns = []
    for (const table of await getTables(db)) {
      for (const column of await getColumns(db, table)) {
        if (legacyCandidates.includes(column)) {
          legacyColumns.push({ table, column })
        }
        if (/[A-Z]/.test(column)) {
          caseColumns.push({ table, column })
        }
      }
    }

    const result = {
      status: legacyColumns.length === 0 && caseColumns.length === 0 ? 'completed' : 'attention_required',
      database: process.env.DB_NAME,
      legacy_candidate_columns: legacyColumns,
      uppercase_or_camel_case_columns: caseColumns,
      excluded_canonical_fields: [
        {
          table: 'price_history',
          column: 'cost_price',
          reason: '独立价格历史契约，不等同于 phones.purchase_cost'
        }
      ]
    }

    console.log(JSON.stringify(result, null, 2))
    if (result.status !== 'completed') process.exitCode = 1
  } finally {
    await db.end()
  }
}

main().catch(error => {
  console.error(JSON.stringify({
    status: 'failed',
    code: error.code || 'PHYSICAL_FIELD_AUDIT_ERROR',
    message: error.message
  }))
  process.exitCode = 1
})
