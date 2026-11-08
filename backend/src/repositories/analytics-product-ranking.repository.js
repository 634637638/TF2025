'use strict'

const { getDatabase } = require('../config/database')
const { buildLatestSaleJoin, buildStoreFilterClause, hasValidQueryValue } = require('../utils/analytics-query')

const RESOURCES = Object.freeze({
  brand: { table: 'brands', join: '', columns: 'b.id, b.name' },
  model: { table: 'models', join: 'LEFT JOIN brands b ON m.brand_id = b.id', columns: 'm.id, m.name, b.name as brand_name, COALESCE(SUM(p.purchase_cost), 0) as cost' }
})

class AnalyticsProductRankingRepository {
  constructor(database = getDatabase) {
    this.database = database
  }

  async getRanking(type, filters) {
    const resource = RESOURCES[type]
    if (!resource) throw new TypeError('Unsupported product ranking type')
    const tableAlias = type === 'brand' ? 'b' : 'm'
    const storeFilter = buildStoreFilterClause(filters.storeId, { phoneAlias: 'p', saleAlias: 'latest_sale' })
    const conditions = (saleType, dateColumn) => {
      const clauses = [
        saleType === 'sold' ? 'p.status = "sold"' : "p.status = 'peer_transfer'",
        `${dateColumn} IS NOT NULL`
      ]
      const params = []
      if (filters.startDate) {
        clauses.push(`DATE(${dateColumn}) >= ?`)
        params.push(filters.startDate)
      }
      if (filters.endDate) {
        clauses.push(`DATE(${dateColumn}) <= ?`)
        params.push(filters.endDate)
      }
      if (storeFilter.storeId) {
        clauses.push('COALESCE(latest_sale.store_id, p.store_id) = ?')
        params.push(storeFilter.storeId)
      }
      if (hasValidQueryValue(filters.supplierId)) {
        clauses.push('p.supplier_id = ?')
        params.push(filters.supplierId)
      }
      return { where: clauses.join(' AND '), params }
    }
    const retailFilters = conditions('sold', 'p.sale_time')
    const wholesaleFilters = conditions('peer_transfer', 'p.wholesale_date')
    const latestSaleJoin = buildLatestSaleJoin({ phoneAlias: 'p', alias: 'latest_sale' })
    const query = (where) => `
      SELECT ${resource.columns}, COUNT(p.id) as count, COALESCE(SUM(p.sale_price), 0) as amount
      FROM ${resource.table} ${tableAlias}
      ${resource.join}
      LEFT JOIN phones p ON ${tableAlias === 'b' ? 'b.id = p.brand_id' : 'm.id = p.model_id'}
      ${latestSaleJoin}
      WHERE ${where}
      GROUP BY ${tableAlias}.id, ${tableAlias}.name${type === 'model' ? ', b.name' : ''}
    `
    const database = this.database()
    const [[retailRows], [wholesaleRows]] = await Promise.all([
      database.execute(query(retailFilters.where), retailFilters.params),
      database.execute(query(wholesaleFilters.where), wholesaleFilters.params)
    ])
    return { retailRows, wholesaleRows }
  }
}

module.exports = AnalyticsProductRankingRepository
