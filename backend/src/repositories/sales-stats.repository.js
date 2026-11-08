'use strict'

const { getDatabase } = require('../config/database')

class SalesStatsRepository {
  constructor({ getDb = getDatabase } = {}) {
    if (typeof getDb !== 'function') throw new TypeError('SalesStatsRepository requires getDb')
    this.getDb = getDb
  }

  async getPhoneCounts() {
    const database = await this.getDb()
    const [rows] = await database.execute(`
      SELECT
        COUNT(*) as total_phones,
        COUNT(CASE WHEN status = 'in_stock' AND COALESCE(is_preordered, 0) = 0 THEN 1 END) as available_phones,
        COUNT(CASE WHEN status = 'sold' THEN 1 END) as sold_phones,
        COUNT(CASE WHEN status = 'reserved' OR (status = 'in_stock' AND COALESCE(is_preordered, 0) = 1) THEN 1 END) as reserved_phones
      FROM phones
    `)
    return rows[0]
  }

  async getCurrentMonthSales() {
    const database = await this.getDb()
    const [rows] = await database.execute(`
      SELECT
        COUNT(*) as sold_this_month,
        COALESCE(SUM(CASE WHEN status = 'sold' THEN sale_price ELSE 0 END), 0) as total_revenue
      FROM phones
      WHERE status = 'sold'
        AND YEAR(sale_time) = YEAR(CURRENT_DATE)
        AND MONTH(sale_time) = MONTH(CURRENT_DATE)
    `)
    return rows[0]
  }
}

module.exports = SalesStatsRepository
