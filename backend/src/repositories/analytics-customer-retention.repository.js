'use strict'

const { getDatabase } = require('../config/database')

const COHORT_CONFIG = Object.freeze({
  monthly: Object.freeze({ unit: 'MONTH', windowMonths: 11, periods: '月' }),
  quarterly: Object.freeze({ unit: 'QUARTER', windowMonths: 23, periods: '季度' }),
  yearly: Object.freeze({ unit: 'YEAR', windowMonths: 59, periods: '年' })
})

class AnalyticsCustomerRetentionRepository {
  constructor({ database = getDatabase } = {}) {
    this.database = database
  }

  async getCohorts({ cohort, storeId }) {
    const config = COHORT_CONFIG[cohort]
    const periodExpression = cohort === 'monthly'
      ? "TIMESTAMPDIFF(MONTH, DATE_FORMAT(c.created_at, '%Y-%m-01'), DATE_FORMAT(s.sale_time, '%Y-%m-01'))"
      : cohort === 'quarterly'
        ? '(YEAR(s.sale_time) - YEAR(c.created_at)) * 4 + QUARTER(s.sale_time) - QUARTER(c.created_at)'
        : 'YEAR(s.sale_time) - YEAR(c.created_at)'
    const storeFilter = storeId !== null ? 'AND c.store_id = ?' : ''
    const [rows] = await this.database().execute(`
      SELECT
        c.id,
        c.created_at,
        ${periodExpression} AS period_offset,
        MAX(s.id IS NOT NULL) AS has_purchase
      FROM customers c
      LEFT JOIN sales s ON s.customer_id = c.id
        AND s.sale_time >= c.created_at
        AND s.sale_time < DATE_ADD(c.created_at, INTERVAL 6 ${config.unit})
      WHERE c.status = 1
        ${storeFilter}
        AND c.created_at >= DATE_SUB(CURDATE(), INTERVAL ${config.windowMonths} MONTH)
      GROUP BY c.id, c.created_at, period_offset
    `, storeId !== null ? [storeId] : [])
    return rows
  }
}

module.exports = { AnalyticsCustomerRetentionRepository, COHORT_CONFIG }
