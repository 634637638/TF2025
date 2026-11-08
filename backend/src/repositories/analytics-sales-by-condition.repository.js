'use strict'

const { getDatabase } = require('../config/database')
const { buildLatestSaleJoin, buildStoreFilterClause } = require('../utils/analytics-query')

class AnalyticsSalesByConditionRepository {
  constructor(database = getDatabase) {
    this.database = database
  }

  getConditions(dateColumn, filters) {
    const clauses = []
    const params = []
    if (filters.startDate) {
      clauses.push(`DATE(${dateColumn}) >= ?`)
      params.push(filters.startDate)
    }
    if (filters.endDate) {
      clauses.push(`DATE(${dateColumn}) <= ?`)
      params.push(filters.endDate)
    }
    const storeFilter = buildStoreFilterClause(filters.storeId, { phoneAlias: 'p', saleAlias: 'latest_sale' })
    if (storeFilter.storeId) {
      clauses.push('COALESCE(latest_sale.store_id, p.store_id) = ?')
      params.push(storeFilter.storeId)
    }
    if (filters.supplierId) {
      clauses.push('p.supplier_id = ?')
      params.push(filters.supplierId)
    }
    return { clauses, params }
  }

  async getRetailTotals(filters) {
    const { clauses, params } = this.getConditions('p.sale_time', filters)
    const where = ['p.status = "sold"', 'p.sale_time IS NOT NULL', ...clauses].join(' AND ')
    const latestSaleJoin = buildLatestSaleJoin({ phoneAlias: 'p', alias: 'latest_sale' })
    const database = this.database()
    const query = condition => `
      SELECT COUNT(p.id) as salesCount,
        COALESCE(SUM(p.sale_price), 0) as salesAmount,
        COALESCE(SUM(p.sale_price - COALESCE(p.purchase_cost, 0)), 0) as profit
      FROM phones p
      ${latestSaleJoin}
      WHERE ${where} AND ${condition}
    `
    const [newResult, usedResult] = await Promise.all([
      database.execute(query('p.is_new = 1'), params),
      database.execute(query('(p.is_new = 0 OR p.is_new IS NULL)'), params)
    ])
    return [newResult[0]?.[0], usedResult[0]?.[0]]
  }

  async getWholesaleTotals(filters) {
    const { clauses, params } = this.getConditions('p.wholesale_date', filters)
    const where = ['p.wholesale_date IS NOT NULL', ...clauses].join(' AND ')
    const latestSaleJoin = buildLatestSaleJoin({ phoneAlias: 'p', alias: 'latest_sale' })
    const database = this.database()
    const query = condition => `
      SELECT COUNT(p.id) as salesCount,
        COALESCE(SUM(p.sale_price), 0) as salesAmount,
        COALESCE(SUM(p.sale_price - COALESCE(p.purchase_cost, 0)), 0) as profit
      FROM phones p
      ${latestSaleJoin}
      WHERE p.status = 'peer_transfer' AND ${condition} AND ${where}
    `
    const [newResult, usedResult] = await Promise.all([
      database.execute(query('p.is_new = 1'), params),
      database.execute(query('(p.is_new = 0 OR p.is_new IS NULL)'), params)
    ])
    return [newResult[0]?.[0], usedResult[0]?.[0]]
  }
}

module.exports = AnalyticsSalesByConditionRepository
