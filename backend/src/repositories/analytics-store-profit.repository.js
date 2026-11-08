'use strict'

const { getDatabase } = require('../config/database')
const { buildLatestSaleJoin, buildStoreFilterClause } = require('../utils/analytics-query')

class AnalyticsStoreProfitRepository {
  constructor(database = getDatabase) {
    this.database = database
  }

  async getStoreProfit({ startDate, endDate, storeId, supplierId }) {
    const storeFilter = buildStoreFilterClause(storeId, { phoneAlias: 'p', saleAlias: 'latest_sale' })
    const supplierClause = supplierId ? 'AND p.supplier_id = ?' : ''
    const subQueryParams = [
      startDate,
      endDate,
      ...storeFilter.params,
      ...(supplierId ? [supplierId] : [])
    ]
    const [rows] = await this.database().execute(`
      SELECT summary.store_id, st.name AS store_name,
        SUM(summary.sales_count) AS sales_count,
        SUM(summary.total_revenue) AS total_revenue,
        SUM(summary.total_cost) AS total_cost
      FROM (
        SELECT COALESCE(latest_sale.store_id, p.store_id) AS store_id,
          COUNT(p.id) AS sales_count, COALESCE(SUM(p.sale_price), 0) AS total_revenue,
          COALESCE(SUM(p.purchase_cost), 0) AS total_cost
        FROM phones p
        ${buildLatestSaleJoin({ phoneAlias: 'p', alias: 'latest_sale' })}
        WHERE p.status = 'sold' AND p.sale_time IS NOT NULL
          AND DATE(p.sale_time) >= ? AND DATE(p.sale_time) <= ?
          ${storeFilter.clause} ${supplierClause}
        GROUP BY COALESCE(latest_sale.store_id, p.store_id)
        UNION ALL
        SELECT COALESCE(latest_sale.store_id, p.store_id) AS store_id,
          COUNT(p.id) AS sales_count, COALESCE(SUM(p.sale_price), 0) AS total_revenue,
          COALESCE(SUM(p.purchase_cost), 0) AS total_cost
        FROM phones p
        ${buildLatestSaleJoin({ phoneAlias: 'p', alias: 'latest_sale' })}
        WHERE p.status = 'peer_transfer' AND p.wholesale_date IS NOT NULL
          AND DATE(p.wholesale_date) >= ? AND DATE(p.wholesale_date) <= ?
          ${storeFilter.clause} ${supplierClause}
        GROUP BY COALESCE(latest_sale.store_id, p.store_id)
      ) summary
      LEFT JOIN stores st ON st.id = summary.store_id
      WHERE summary.store_id IS NOT NULL
      GROUP BY summary.store_id, st.name
      ORDER BY (SUM(summary.total_revenue) - SUM(summary.total_cost)) DESC
    `, [...subQueryParams, ...subQueryParams])
    return rows
  }
}

module.exports = AnalyticsStoreProfitRepository
