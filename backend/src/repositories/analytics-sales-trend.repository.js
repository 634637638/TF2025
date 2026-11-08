'use strict'

const { getDatabase } = require('../config/database')

const PERIOD_CONFIG = Object.freeze({
  daily: { expression: 'DATE(s.sale_time)', days: 30 },
  weekly: { expression: 'YEARWEEK(s.sale_time, 1)', days: 28 },
  monthly: { expression: "DATE_FORMAT(s.sale_time, '%Y-%m')", days: 365 },
  quarterly: { expression: "CONCAT(YEAR(s.sale_time), '-Q', QUARTER(s.sale_time))", days: 730 }
})

class AnalyticsSalesTrendRepository {
  constructor(database = getDatabase) {
    this.database = database
  }

  async getSalesTrends({ period, storeId, startDate, endDate }) {
    const periodConfig = PERIOD_CONFIG[period]
    const conditions = [
      "s.status = 'completed'",
      `s.sale_time >= DATE_SUB(CURDATE(), INTERVAL ${periodConfig.days} DAY)`
    ]
    const params = []
    if (storeId !== null) {
      conditions.push('s.store_id = ?')
      params.push(storeId)
    }
    if (startDate) {
      conditions.push('DATE(s.sale_time) >= ?')
      params.push(String(startDate))
    }
    if (endDate) {
      conditions.push('DATE(s.sale_time) <= ?')
      params.push(String(endDate))
    }

    const [rows] = await this.database().execute(`
      SELECT
        ${periodConfig.expression} AS period,
        SUM(CASE WHEN p.is_new = 1 THEN 1 ELSE 0 END) AS new_count,
        SUM(CASE WHEN p.is_new = 0 OR p.is_new IS NULL THEN 1 ELSE 0 END) AS used_count
      FROM sales s
      INNER JOIN phones p ON p.id = s.phone_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY ${periodConfig.expression}
      ORDER BY period ASC
    `, params)
    return rows
  }
}

module.exports = AnalyticsSalesTrendRepository
