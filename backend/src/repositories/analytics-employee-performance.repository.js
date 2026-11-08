'use strict'

const { getDatabase } = require('../config/database')
const { buildLatestSaleJoin, buildStoreFilterClause } = require('../utils/analytics-query')

class AnalyticsEmployeePerformanceRepository {
  constructor(database = getDatabase) {
    this.database = database
  }

  async getPerformance({ startDate, endDate, storeId }) {
    const storeFilter = buildStoreFilterClause(storeId, { phoneAlias: 'p', saleAlias: 'latest_sale' })
    const retailLatestSaleJoin = buildLatestSaleJoin({ phoneAlias: 'p', alias: 'latest_sale' })
    const wholesaleLatestSaleJoin = buildLatestSaleJoin({ phoneAlias: 'p', alias: 'latest_sale' })
    const retailQuery = `
      SELECT
        u.id as user_id,
        u.username as user_name,
        u.name as real_name,
        s.id as store_id,
        s.name as store_name,
        COALESCE(SUM(CASE WHEN p.is_new = 1 THEN 1 ELSE 0 END), 0) as new_sales_count,
        COALESCE(SUM(CASE WHEN p.is_new = 1 THEN p.sale_price ELSE 0 END), 0) as new_sales_amount,
        COALESCE(SUM(CASE WHEN p.is_new = 1 THEN (p.sale_price - COALESCE(p.purchase_cost, 0)) ELSE 0 END), 0) as new_profit,
        COALESCE(SUM(CASE WHEN p.is_new = 0 OR p.is_new IS NULL THEN 1 ELSE 0 END), 0) as used_sales_count,
        COALESCE(SUM(CASE WHEN p.is_new = 0 OR p.is_new IS NULL THEN p.sale_price ELSE 0 END), 0) as used_sales_amount,
        COALESCE(SUM(CASE WHEN p.is_new = 0 OR p.is_new IS NULL THEN (p.sale_price - COALESCE(p.purchase_cost, 0)) ELSE 0 END), 0) as used_profit
      FROM users u
      LEFT JOIN stores s ON u.store_id = s.id
      LEFT JOIN phones p ON p.sale_operator_id = u.id
        AND p.status = 'sold'
        AND DATE(p.sale_time) >= ?
        AND DATE(p.sale_time) <= ?
      ${retailLatestSaleJoin}
      WHERE u.status = 1
        ${storeFilter.storeId ? 'AND COALESCE(latest_sale.store_id, p.store_id) = ?' : ''}
      GROUP BY u.id, u.username, u.name, s.id, s.name
    `
    const wholesaleQuery = `
      SELECT
        u.id as user_id,
        COALESCE(SUM(CASE WHEN p.is_new = 1 THEN 1 ELSE 0 END), 0) as new_wholesale_count,
        COALESCE(SUM(CASE WHEN p.is_new = 1 THEN p.sale_price ELSE 0 END), 0) as new_wholesale_amount,
        COALESCE(SUM(CASE WHEN p.is_new = 1 THEN (p.sale_price - COALESCE(p.purchase_cost, 0)) ELSE 0 END), 0) as new_wholesale_profit,
        COALESCE(SUM(CASE WHEN p.is_new = 0 OR p.is_new IS NULL THEN 1 ELSE 0 END), 0) as used_wholesale_count,
        COALESCE(SUM(CASE WHEN p.is_new = 0 OR p.is_new IS NULL THEN p.sale_price ELSE 0 END), 0) as used_wholesale_amount,
        COALESCE(SUM(CASE WHEN p.is_new = 0 OR p.is_new IS NULL THEN (p.sale_price - COALESCE(p.purchase_cost, 0)) ELSE 0 END), 0) as used_wholesale_profit
      FROM users u
      LEFT JOIN phones p ON p.sale_operator_id = u.id
        AND p.status = 'peer_transfer'
        AND p.wholesale_date IS NOT NULL
        AND DATE(p.wholesale_date) >= ?
        AND DATE(p.wholesale_date) <= ?
      ${wholesaleLatestSaleJoin}
      WHERE u.status = 1
        ${storeFilter.storeId ? 'AND COALESCE(latest_sale.store_id, p.store_id) = ?' : ''}
      GROUP BY u.id
    `
    const database = this.database()
    const params = [startDate, endDate, ...storeFilter.params]
    const [retailResult, wholesaleResult] = await Promise.all([
      database.execute(retailQuery, params),
      database.execute(wholesaleQuery, params)
    ])
    return { retailRows: retailResult[0], wholesaleRows: wholesaleResult[0] }
  }
}

module.exports = AnalyticsEmployeePerformanceRepository
