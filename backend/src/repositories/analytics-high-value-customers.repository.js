'use strict'

const { getDatabase } = require('../config/database')

class AnalyticsHighValueCustomersRepository {
  constructor({ database = getDatabase } = {}) {
    this.database = database
  }

  async list({ pageSize, offset, search, startDate, endDate, storeId }) {
    const searchCondition = search ? ' AND (c.name LIKE ? OR c.phone LIKE ?)' : ''
    const searchParams = search ? [`%${search}%`, `%${search}%`] : []
    const saleConditions = []
    const saleParams = []
    if (startDate) {
      saleConditions.push('DATE(s.sale_time) >= ?')
      saleParams.push(startDate)
    }
    if (endDate) {
      saleConditions.push('DATE(s.sale_time) <= ?')
      saleParams.push(endDate)
    }
    if (storeId !== null) {
      saleConditions.push('s.store_id = ?')
      saleParams.push(storeId)
    }
    const saleJoinFilter = saleConditions.length > 0 ? ` AND ${saleConditions.join(' AND ')}` : ''
    const params = [...saleParams, ...searchParams]

    const customersQuery = `
      SELECT
        c.id,
        c.name,
        c.phone,
        c.created_at,
        COUNT(s.id) as orders_count,
        COALESCE(SUM(s.sale_price), 0) as total_amount,
        COALESCE(SUM(s.sale_price) / NULLIF(COUNT(s.id), 0), 0) as avg_order_value,
        MAX(s.sale_time) as last_order_date,
        CASE
          WHEN COALESCE(SUM(s.sale_price), 0) >= 50000 THEN 'high-value'
          WHEN COALESCE(SUM(s.sale_price), 0) >= 10000 THEN 'potential'
          WHEN DATEDIFF(NOW(), MAX(s.sale_time)) > 90 THEN 'lost'
          ELSE 'at-risk'
        END as segment
      FROM customers c
      LEFT JOIN sales s ON c.id = s.customer_id${saleJoinFilter}
      WHERE c.status = 1 ${searchCondition}
      GROUP BY c.id, c.name, c.phone, c.created_at
      HAVING COALESCE(SUM(s.sale_price), 0) > 0
      ORDER BY total_amount DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `

    const countQuery = `
      SELECT COUNT(*) as total
      FROM (
        SELECT c.id
        FROM customers c
        LEFT JOIN sales s ON c.id = s.customer_id${saleJoinFilter}
        WHERE c.status = 1 ${searchCondition}
        GROUP BY c.id
        HAVING COALESCE(SUM(s.sale_price), 0) > 0
      ) as customers_with_orders
    `

    const db = this.database()
    const [customersResult, totalResult] = await Promise.all([
      db.query(customersQuery, params),
      db.query(countQuery, params)
    ])
    return {
      customers: customersResult[0] || [],
      total: totalResult[0]?.[0]?.total || 0
    }
  }
}

module.exports = AnalyticsHighValueCustomersRepository
