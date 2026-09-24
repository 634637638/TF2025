'use strict'

// 将历史 phones.status = 'available' 归并到唯一的可售状态 in_stock。
// 默认只预览，执行时显式传入 --execute。
const mysql = require('mysql2/promise')
require('dotenv').config({ path: '.env' })

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
    const [[before]] = await db.query(
      "SELECT COUNT(*) AS count FROM phones WHERE status = 'available'"
    )

    if (!execute) {
      console.log(JSON.stringify({
        status: 'dry_run',
        database: process.env.DB_NAME,
        available_rows: Number(before.count)
      }, null, 2))
      return
    }

    await db.beginTransaction()
    try {
      const [result] = await db.query(
        "UPDATE phones SET status = 'in_stock' WHERE status = 'available'"
      )
      const [[after]] = await db.query(
        "SELECT COUNT(*) AS count FROM phones WHERE status = 'available'"
      )

      if (Number(after.count) !== 0 || Number(result.affectedRows) !== Number(before.count)) {
        throw new Error('available 状态迁移校验失败')
      }

      await db.commit()
      console.log(JSON.stringify({
        status: 'updated_and_verified',
        database: process.env.DB_NAME,
        affected_rows: result.affectedRows,
        remaining_available_rows: Number(after.count)
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
    code: error.code || 'PHONE_STATUS_MIGRATION_ERROR',
    message: error.message
  }, null, 2))
  process.exitCode = 1
})
