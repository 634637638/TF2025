'use strict'

const { getDatabase } = require('../config/database')

class AnalyticsCustomerSegmentsRepository {
  constructor({ database = getDatabase } = {}) {
    this.database = database
  }

  async getSegments(storeId) {
    const storeFilter = storeId !== null ? 'AND c.store_id = ?' : ''
    const [rows] = await this.database().execute(`
      SELECT
        CASE
          WHEN totalSpent >= 50000 THEN '高价值客户'
          WHEN totalSpent >= 20000 THEN '中价值客户'
          WHEN totalSpent >= 5000 THEN '低价值客户'
          ELSE '新客户'
        END as segment,
        COUNT(*) as count,
        COALESCE(AVG(totalSpent), 0) as avgOrderValue,
        COALESCE(SUM(totalSpent), 0) as totalRevenue
      FROM (
        SELECT
          c.id,
          COALESCE(SUM(s.sale_price), 0) as totalSpent
        FROM customers c
        LEFT JOIN sales s ON c.id = s.customer_id
        WHERE c.status = 1
          ${storeFilter}
        GROUP BY c.id
      ) customerData
      GROUP BY segment
    `, storeId !== null ? [storeId] : [])
    return rows
  }
}

module.exports = AnalyticsCustomerSegmentsRepository
