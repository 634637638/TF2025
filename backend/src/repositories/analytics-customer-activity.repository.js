'use strict'

const { getDatabase } = require('../config/database')

class AnalyticsCustomerActivityRepository {
  constructor({ database = getDatabase } = {}) {
    this.database = database
  }

  async getActivity(storeId) {
    const customerStoreFilter = storeId !== null ? 'AND c.store_id = ?' : ''
    const weeklyStoreFilter = storeId !== null ? 'AND s.store_id = ?' : ''
    const params = storeId !== null ? [storeId] : []
    const db = this.database()

    const activityDistributionQuery = `
      SELECT * FROM (
        SELECT
          CASE
            WHEN days_since_last_purchase <= 30 THEN '非常活跃'
            WHEN days_since_last_purchase <= 90 THEN '活跃'
            WHEN days_since_last_purchase <= 180 THEN '一般'
            ELSE '不活跃'
          END as activity_level,
          COUNT(*) as count
        FROM (
          SELECT
            c.id,
            DATEDIFF(NOW(), MAX(s.sale_time)) as days_since_last_purchase
          FROM customers c
          INNER JOIN sales s ON c.id = s.customer_id
          WHERE c.status = 1
            ${customerStoreFilter}
          GROUP BY c.id
        ) customer_activity
        GROUP BY activity_level
      ) as result
    `
    const activeRateQuery = `
      SELECT
        COUNT(DISTINCT c.id) as total_customers,
        COUNT(DISTINCT CASE WHEN s.sale_time >= DATE_SUB(NOW(), INTERVAL 90 DAY) THEN c.id END) as active_customers
      FROM customers c
      LEFT JOIN sales s ON c.id = s.customer_id
      WHERE c.status = 1
        ${customerStoreFilter}
    `
    const weeklyActivityQuery = `
      SELECT
        DATE(DATE_SUB(NOW(), INTERVAL n DAY)) as date,
        COUNT(DISTINCT s.customer_id) as active_users
      FROM (
        SELECT 0 as n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3
        UNION SELECT 4 UNION SELECT 5 UNION SELECT 6
      ) days
      LEFT JOIN sales s ON DATE(s.sale_time) = DATE(DATE_SUB(NOW(), INTERVAL n DAY))
        ${weeklyStoreFilter}
      GROUP BY DATE(DATE_SUB(NOW(), INTERVAL n DAY))
      ORDER BY date ASC
    `

    const [activityRows] = await db.execute(activityDistributionQuery, params)
    const [activeRateRows] = await db.execute(activeRateQuery, params)
    const [weeklyActivityRows] = await db.execute(weeklyActivityQuery, params)

    return {
      distribution: activityRows || [],
      rate: activeRateRows?.[0] || null,
      weeklyActivity: weeklyActivityRows || []
    }
  }
}

module.exports = AnalyticsCustomerActivityRepository
