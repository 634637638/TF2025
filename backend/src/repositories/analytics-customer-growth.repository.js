'use strict'

const { getDatabase } = require('../config/database')

const PERIOD_DAYS = Object.freeze({ '7d': 7, '30d': 30, '90d': 90 })

class AnalyticsCustomerGrowthRepository {
  constructor(database = getDatabase) {
    this.database = database
  }

  async getGrowth({ days, storeId }) {
    const storeFilter = storeId !== null ? 'AND c.store_id = ?' : ''
    const params = storeId !== null ? [storeId] : []
    const [rows] = await this.database().execute(`
      SELECT
        DATE(c.created_at) AS date,
        COUNT(*) AS new_customers
      FROM customers c
      WHERE c.created_at >= DATE_SUB(NOW(), INTERVAL ${days} DAY)
        ${storeFilter}
      GROUP BY DATE(c.created_at)
      ORDER BY date ASC
    `, params)
    return rows
  }
}

module.exports = { AnalyticsCustomerGrowthRepository, PERIOD_DAYS }
