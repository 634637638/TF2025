'use strict'

const { getDatabase } = require('../config/database')
const { buildLatestSaleJoin, buildStoreFilterClause } = require('../utils/analytics-query')

const GROUP_EXPRESSIONS = Object.freeze({
  month: column => `DATE_FORMAT(${column}, '%Y-%m')`,
  quarter: column => `CONCAT(YEAR(${column}), '-Q', QUARTER(${column}))`,
  year: column => `DATE_FORMAT(${column}, '%Y')`
})

class AnalyticsProfitTrendRepository {
  constructor(database = getDatabase) {
    this.database = database
  }

  async getProfitTrend({ granularity, rangeStart, rangeEnd, storeId }) {
    const groupExpression = GROUP_EXPRESSIONS[granularity]
    if (!groupExpression) throw new TypeError('Unsupported profit trend granularity')
    const storeFilter = buildStoreFilterClause(storeId, { phoneAlias: 'p', saleAlias: 'latest_sale' })
    const latestSaleJoin = buildLatestSaleJoin({ phoneAlias: 'p', alias: 'latest_sale' })
    const soldPeriod = groupExpression('p.sale_time')
    const wholesalePeriod = groupExpression('p.wholesale_date')
    const [rows] = await this.database().execute(`
      SELECT period_key, SUM(total_sales) AS totalSales, SUM(total_revenue) AS totalRevenue,
        SUM(total_cost) AS totalCost
      FROM (
        SELECT ${soldPeriod} AS period_key, COUNT(p.id) AS total_sales,
          COALESCE(SUM(p.sale_price), 0) AS total_revenue, COALESCE(SUM(p.purchase_cost), 0) AS total_cost
        FROM phones p
        ${latestSaleJoin}
        WHERE p.status = 'sold' AND p.sale_time IS NOT NULL
          AND DATE(p.sale_time) >= ? AND DATE(p.sale_time) <= ? ${storeFilter.clause}
        GROUP BY period_key
        UNION ALL
        SELECT ${wholesalePeriod} AS period_key, COUNT(p.id) AS total_sales,
          COALESCE(SUM(p.sale_price), 0) AS total_revenue, COALESCE(SUM(p.purchase_cost), 0) AS total_cost
        FROM phones p
        ${latestSaleJoin}
        WHERE p.status = 'peer_transfer' AND p.wholesale_date IS NOT NULL
          AND DATE(p.wholesale_date) >= ? AND DATE(p.wholesale_date) <= ? ${storeFilter.clause}
        GROUP BY period_key
      ) AS profit_periods
      GROUP BY period_key
      ORDER BY period_key ASC
    `, [rangeStart, rangeEnd, ...storeFilter.params, rangeStart, rangeEnd, ...storeFilter.params])
    return rows
  }
}

module.exports = AnalyticsProfitTrendRepository
