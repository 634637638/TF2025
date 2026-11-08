'use strict'

const { getDatabase } = require('../config/database')

class SubsidyPhoneSearchRepository {
  constructor({ getDb = getDatabase } = {}) {
    this.getDb = getDb
  }

  async findSoldPhones(searchPattern) {
    const [rows] = await this.getDb().execute(`
      SELECT
        p.id as phone_id,
        p.imei,
        p.serial_number,
        p.is_new,
        p.inventory_time,
        p.status,
        b.name as brand,
        m.name as model,
        co.name as color,
        mem.size as memory,
        p.sale_price,
        p.sale_time as sale_time,
        st.name as store_name
      FROM phones p
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN colors co ON p.color_id = co.id
      LEFT JOIN memories mem ON p.memory_id = mem.id
      LEFT JOIN stores st ON p.store_id = st.id
      WHERE p.status = 'sold'
        AND (p.imei LIKE ? OR p.serial_number LIKE ?)
      ORDER BY p.sale_time DESC
    `, [searchPattern, searchPattern])
    return rows
  }

  async findRelatedData(phoneIds) {
    const database = this.getDb()
    const placeholders = phoneIds.map(() => '?').join(',')
    const [latestSales, subsidyRecords] = await Promise.all([
      database.execute(`
        SELECT
          latest.phone_id,
          c.name as customer_name,
          c.phone as customer_phone
        FROM (
          SELECT s.phone_id, s.customer_id
          FROM sales s
          INNER JOIN (
            SELECT phone_id, MAX(created_at) as max_created_at
            FROM sales
            WHERE phone_id IN (${placeholders})
            GROUP BY phone_id
          ) latest_sale
            ON latest_sale.phone_id = s.phone_id
           AND latest_sale.max_created_at = s.created_at
        ) latest
        LEFT JOIN customers c ON c.id = latest.customer_id
      `, phoneIds).then(([rows]) => rows),
      database.execute(`
        SELECT phone_id, apply_status, subsidy_amount
        FROM national_subsidies
        WHERE phone_id IN (${placeholders})
      `, phoneIds).then(([rows]) => rows)
    ])

    return { latestSales, subsidyRecords }
  }
}

module.exports = SubsidyPhoneSearchRepository
