'use strict'

const { appendStoreScopeCondition } = require('../utils/store-scope')

const { getLatestActiveSaleIdSql } = require('../utils/sale-status')
const { getDatabase } = require('../config/database')

class SalesStatsRepository {
  constructor({ getDb = getDatabase } = {}) {
    if (typeof getDb !== 'function') throw new TypeError('SalesStatsRepository requires getDb')
    this.getDb = getDb
  }

  async getPhoneCounts(scope) {
    const conditions = ['1 = 1']
    const params = []
    appendStoreScopeCondition(scope, 'store_id', conditions, params)
    const database = await this.getDb()
    const [rows] = await database.execute(`
      SELECT
        COUNT(*) as total_phones,
        COUNT(CASE WHEN status = 'in_stock' AND COALESCE(is_preordered, 0) = 0 THEN 1 END) as available_phones,
        COUNT(CASE WHEN status = 'sold' THEN 1 END) as sold_phones,
        COUNT(CASE WHEN status = 'reserved' OR (status = 'in_stock' AND COALESCE(is_preordered, 0) = 1) THEN 1 END) as reserved_phones
      FROM phones WHERE ${conditions.join(' AND ')}
    `, params)
    return rows[0]
  }

  async getCurrentMonthSales(scope) {
    const conditions = ['1 = 1']
    const params = []
    appendStoreScopeCondition(scope, 's.store_id', conditions, params)
    const database = await this.getDb()
    const [rows] = await database.execute(`
      SELECT
        COUNT(*) as sold_this_month,
        COALESCE(SUM(CASE WHEN p.status = 'sold' THEN s.sale_price ELSE 0 END), 0) as total_revenue
      FROM phones p JOIN sales s ON s.id = (${getLatestActiveSaleIdSql('p')})
      WHERE p.status = 'sold' AND ${conditions.join(' AND ')}
        AND YEAR(s.sale_time) = YEAR(CURRENT_DATE)
        AND MONTH(s.sale_time) = MONTH(CURRENT_DATE)
    `, params)
    return rows[0]
  }
}

module.exports = SalesStatsRepository
