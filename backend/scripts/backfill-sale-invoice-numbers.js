'use strict'

const path = require('node:path')
const dotenv = require('dotenv')
const mysql = require('mysql2/promise')
const {
  prepareInvoiceNumberTransaction,
  generateInvoiceNumber
} = require('../src/utils/invoice-number')

dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true })

const SALE_TYPES = new Set(['retail', 'batch_item', 'wholesale', 'peer_transfer', 'supplier_proxy'])
const applyChanges = process.argv.includes('--apply')

async function createConnection() {
  return mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || process.env.DB_PASS,
    database: process.env.DB_NAME,
    charset: 'utf8mb4',
    timezone: 'Z',
    dateStrings: true,
    connectTimeout: 30000
  })
}

function getSaleDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) {
    throw new Error(`销售记录缺少有效销售日期: ${value}`)
  }

  return `${match[1]}-${match[2]}-${match[3]}`
}

async function main() {
  const db = await createConnection()

  try {
    const [[summary]] = await db.execute(`
      SELECT
        COUNT(*) AS missing_count,
        MIN(sale_time) AS earliest_sale,
        MAX(sale_time) AS latest_sale
      FROM sales
      WHERE invoice_number IS NULL OR TRIM(invoice_number) = ''
    `)
    const [typeRows] = await db.execute(`
      SELECT COALESCE(NULLIF(TRIM(sale_type), ''), 'retail') AS sale_type,
             COUNT(*) AS count
      FROM sales
      WHERE invoice_number IS NULL OR TRIM(invoice_number) = ''
      GROUP BY COALESCE(NULLIF(TRIM(sale_type), ''), 'retail')
      ORDER BY sale_type
    `)

    if (!applyChanges) {
      console.log(JSON.stringify({
        status: 'dry_run',
        database: process.env.DB_NAME,
        missing_invoice_count: Number(summary.missing_count),
        earliest_sale: summary.earliest_sale,
        latest_sale: summary.latest_sale,
        sale_types: typeRows.map(row => ({
          sale_type: row.sale_type,
          count: Number(row.count)
        })),
        instruction: '确认预览结果后，使用 --apply 执行回填'
      }, null, 2))
      return
    }

    await prepareInvoiceNumberTransaction(db)
    await db.beginTransaction()
    try {
      const [sales] = await db.execute(`
        SELECT id, sale_type, sale_time
        FROM sales
        WHERE invoice_number IS NULL OR TRIM(invoice_number) = ''
        ORDER BY sale_time, id
        FOR UPDATE
      `)
      const updated = []

      for (const sale of sales) {
        const saleType = String(sale.sale_type || 'retail').trim() || 'retail'
        if (!SALE_TYPES.has(saleType)) {
          throw new Error(`销售记录 ${sale.id} 使用未知销售类型: ${saleType}`)
        }

        const invoiceNumber = await generateInvoiceNumber(
          saleType,
          db,
          getSaleDate(sale.sale_time)
        )
        const [result] = await db.execute(`
          UPDATE sales
          SET invoice_number = ?
          WHERE id = ? AND (invoice_number IS NULL OR TRIM(invoice_number) = '')
        `, [invoiceNumber, sale.id])

        if (result.affectedRows !== 1) {
          throw new Error(`销售记录 ${sale.id} 回填未生效，已取消本次事务`)
        }
        updated.push({ id: sale.id, invoice_number: invoiceNumber })
      }

      const [[remaining]] = await db.execute(`
        SELECT COUNT(*) AS count
        FROM sales
        WHERE invoice_number IS NULL OR TRIM(invoice_number) = ''
      `)
      if (Number(remaining.count) !== 0) {
        throw new Error(`回填后仍有 ${remaining.count} 条销售记录缺少单号`)
      }

      await db.commit()
      console.log(JSON.stringify({
        status: 'updated_and_verified',
        database: process.env.DB_NAME,
        affected_rows: updated.length,
        remaining_missing_invoice_count: Number(remaining.count),
        sample: updated.slice(0, 5)
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
    code: error.code || 'SALE_INVOICE_BACKFILL_ERROR',
    message: error.message
  }, null, 2))
  process.exitCode = 1
})
