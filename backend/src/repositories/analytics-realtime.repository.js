'use strict'

const { getDatabase } = require('../config/database')

class AnalyticsRealtimeRepository {
  constructor(database = getDatabase) {
    this.database = database
  }

  async getSnapshots(storeId) {
    const filter = storeId !== null ? 'AND store_id = ?' : ''
    const params = storeId !== null ? [storeId] : []
    const db = this.database()
    const [salesResult, pendingResult] = await Promise.all([
      db.execute(`
        SELECT COUNT(*) AS order_count,
               COALESCE(SUM(final_amount), 0) AS total_sales
        FROM sales_orders
        WHERE DATE(created_at) = CURDATE()
          AND order_status = 'completed'
          ${filter}
      `, params),
      db.execute(`
        SELECT COUNT(*) AS pending_count
        FROM sales_orders
        WHERE order_status IN ('pending', 'processing')
          ${filter}
      `, params)
    ])
    return { sales: salesResult[0]?.[0] || {}, pending: pendingResult[0]?.[0] || {} }
  }
}

module.exports = AnalyticsRealtimeRepository
