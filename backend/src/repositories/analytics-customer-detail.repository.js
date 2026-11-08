'use strict'

const { getDatabase } = require('../config/database')

class AnalyticsCustomerDetailRepository {
  constructor({ database = getDatabase } = {}) {
    this.database = database
  }

  async getTrend(customerId, storeId) {
    const storeFilter = storeId !== null ? 'AND store_id = ?' : ''
    const params = storeId !== null ? [customerId, storeId] : [customerId]
    const [rows] = await this.database().execute(`
      SELECT DATE_FORMAT(sale_time, '%Y-%m') AS period,
             COALESCE(SUM(sale_price), 0) AS amount
      FROM sales
      WHERE customer_id = ?
        ${storeFilter}
      GROUP BY DATE_FORMAT(sale_time, '%Y-%m')
      ORDER BY period DESC
      LIMIT 6
    `, params)
    return rows
  }

  async getPreferences(customerId, storeId) {
    const storeFilter = storeId !== null ? 'AND s.store_id = ?' : ''
    const params = storeId !== null ? [customerId, storeId] : [customerId]
    const [rows] = await this.database().execute(`
      SELECT COALESCE(NULLIF(m.name, ''), NULLIF(b.name, ''), '其他') AS name,
             COUNT(*) AS value
      FROM sales s
      LEFT JOIN phones p ON p.id = s.phone_id
      LEFT JOIN models m ON m.id = p.model_id
      LEFT JOIN brands b ON b.id = p.brand_id
      WHERE s.customer_id = ?
        ${storeFilter}
      GROUP BY COALESCE(NULLIF(m.name, ''), NULLIF(b.name, ''), '其他')
      ORDER BY value DESC, name ASC
      LIMIT 8
    `, params)
    return rows
  }
}

module.exports = AnalyticsCustomerDetailRepository
