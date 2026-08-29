'use strict'

const mysql = require('mysql2/promise')
require('dotenv').config({ path: '.env' })

async function getSnapshot(db) {
  const [[phones]] = await db.query(`
    SELECT
      COUNT(*) AS total,
      SUM(purchase_cost <> 0 OR purchase_cost IS NULL) AS invalid_purchase_cost,
      SUM(sale_price <> 0 OR sale_price IS NULL) AS invalid_sale_price,
      SUM(wholesale_price <> 0 OR wholesale_price IS NULL) AS invalid_wholesale_price
    FROM phones
    WHERE status = 'supplier_proxy'
  `)
  const [[sales]] = await db.query(`
    SELECT
      COUNT(*) AS total,
      SUM(purchase_cost <> 0 OR purchase_cost IS NULL) AS invalid_purchase_cost,
      SUM(sale_price <> 0 OR sale_price IS NULL) AS invalid_sale_price
    FROM sales
    WHERE sale_type = 'supplier_proxy'
  `)

  return { phones, sales }
}

function assertZeroed(snapshot) {
  const invalidValues = [
    snapshot.phones.invalid_purchase_cost,
    snapshot.phones.invalid_sale_price,
    snapshot.phones.invalid_wholesale_price,
    snapshot.sales.invalid_purchase_cost,
    snapshot.sales.invalid_sale_price
  ]

  if (invalidValues.some(value => Number(value) !== 0)) {
    throw new Error('supplier_proxy amount verification failed')
  }
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
    const before = await getSnapshot(db)
    if (!execute) {
      console.log(JSON.stringify({ status: 'dry_run', database: process.env.DB_NAME, before }, null, 2))
      return
    }

    await db.beginTransaction()
    try {
      await db.query("SELECT id FROM phones WHERE status = 'supplier_proxy' FOR UPDATE")
      await db.query("SELECT id FROM sales WHERE sale_type = 'supplier_proxy' FOR UPDATE")

      const [phoneResult] = await db.query(`
        UPDATE phones
        SET purchase_cost = 0,
            sale_price = 0,
            wholesale_price = 0
        WHERE status = 'supplier_proxy'
      `)
      const [saleResult] = await db.query(`
        UPDATE sales
        SET purchase_cost = 0,
            sale_price = 0
        WHERE sale_type = 'supplier_proxy'
      `)

      const after = await getSnapshot(db)
      assertZeroed(after)
      if (String(before.phones.total) !== String(after.phones.total) ||
          String(before.sales.total) !== String(after.sales.total)) {
        throw new Error('supplier_proxy row count changed during amount migration')
      }

      await db.commit()
      console.log(JSON.stringify({
        status: 'updated_and_verified',
        database: process.env.DB_NAME,
        before,
        after,
        affected_rows: {
          phones: phoneResult.affectedRows,
          sales: saleResult.affectedRows
        }
      }, null, 2))
    } catch (error) {
      await db.rollback()
      throw error
    }
  } finally {
    await db.end()
  }
}

main().catch(error => {
  console.error(JSON.stringify({
    status: 'failed',
    code: error.code || 'SUPPLIER_PROXY_AMOUNT_MIGRATION_ERROR',
    message: error.message
  }))
  process.exitCode = 1
})
