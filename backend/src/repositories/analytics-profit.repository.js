'use strict'

const { getDatabase } = require('../config/database')
const { buildLatestSaleJoin, buildStoreFilterClause } = require('../utils/analytics-query')

const PERIOD_QUERY = `
  SELECT
    COUNT(p.id) as totalSales,
    COALESCE(SUM(p.sale_price), 0) as totalRevenue,
    COALESCE(SUM(p.purchase_cost), 0) as totalCost
  FROM phones p
  {{latestSaleJoin}}
  WHERE {{statusCondition}}
    AND {{dateColumn}} IS NOT NULL
    AND DATE({{dateColumn}}) >= ?
    AND DATE({{dateColumn}}) <= ?
    {{storeCondition}}
`

class AnalyticsProfitRepository {
  constructor(database = getDatabase) {
    this.database = database
  }

  buildPeriodQuery({ statusCondition, dateColumn, latestSaleJoin, storeCondition }) {
    return PERIOD_QUERY
      .replace('{{latestSaleJoin}}', latestSaleJoin)
      .replace('{{statusCondition}}', statusCondition)
      .replaceAll('{{dateColumn}}', dateColumn)
      .replace('{{storeCondition}}', storeCondition)
  }

  async getPeriodData({ currentStartDate, currentEndDate, previousStartDate, previousEndDate, storeId }) {
    const database = this.database()
    const storeFilter = buildStoreFilterClause(storeId, { phoneAlias: 'p', saleAlias: 'latest_sale' })
    const latestSaleJoin = buildLatestSaleJoin({ phoneAlias: 'p', alias: 'latest_sale' })
    const retailQuery = this.buildPeriodQuery({
      statusCondition: "p.status = 'sold'",
      dateColumn: 'p.sale_time',
      latestSaleJoin,
      storeCondition: storeFilter.clause
    })
    const wholesaleQuery = this.buildPeriodQuery({
      statusCondition: "p.status = 'peer_transfer'",
      dateColumn: 'p.wholesale_date',
      latestSaleJoin,
      storeCondition: storeFilter.clause
    })
    const [currentRetail, currentWholesale, previousRetail, previousWholesale] = await Promise.all([
      database.execute(retailQuery, [currentStartDate, currentEndDate, ...storeFilter.params]),
      database.execute(wholesaleQuery, [currentStartDate, currentEndDate, ...storeFilter.params]),
      database.execute(retailQuery, [previousStartDate, previousEndDate, ...storeFilter.params]),
      database.execute(wholesaleQuery, [previousStartDate, previousEndDate, ...storeFilter.params])
    ])
    return {
      currentRetail: currentRetail[0]?.[0],
      currentWholesale: currentWholesale[0]?.[0],
      previousRetail: previousRetail[0]?.[0],
      previousWholesale: previousWholesale[0]?.[0]
    }
  }

  async getMostRecentRetailMonth({ beforeDate, storeId }) {
    const storeFilter = buildStoreFilterClause(storeId, { phoneAlias: 'p', saleAlias: 'latest_sale' })
    const latestSaleJoin = buildLatestSaleJoin({ phoneAlias: 'p', alias: 'latest_sale' })
    const [rows] = await this.database().execute(`
      SELECT
        DATE_FORMAT(p.sale_time, '%Y-%m') as month,
        COUNT(*) as salesCount,
        COALESCE(SUM(p.sale_price), 0) as totalRevenue,
        COALESCE(SUM(p.purchase_cost), 0) as totalCost
      FROM phones p
      ${latestSaleJoin}
      WHERE p.status = 'sold'
        AND DATE(p.sale_time) < ?
        AND DATE(p.sale_time) >= DATE_SUB(?, INTERVAL 6 MONTH)
        ${storeFilter.clause}
      GROUP BY DATE_FORMAT(p.sale_time, '%Y-%m')
      HAVING totalRevenue > 0
      ORDER BY month DESC
      LIMIT 1
    `, [beforeDate, beforeDate, ...storeFilter.params])
    return rows[0] || null
  }
}

module.exports = AnalyticsProfitRepository
