'use strict'

const { getDatabase } = require('../config/database')

class AnalyticsSalesForecastRepository {
  constructor({ database = getDatabase } = {}) {
    this.database = database
  }

  async getTopProducts({ dates, storeId }) {
    const storeCondition = storeId ? 'AND p.store_id = ?' : ''
    const topProductsQuery = `
      SELECT
        b.name as brand_name,
        m.name as model_name,
        c.name as color_name,
        mem.size as memory,
        COALESCE(SUM(CASE WHEN DATE(p.sale_time) >= ? THEN 1 ELSE 0 END), 0) as sales_30d,
        COALESCE(SUM(CASE WHEN DATE(p.sale_time) >= ? AND DATE(p.sale_time) < ? THEN 1 ELSE 0 END), 0) as sales_31_60d,
        COALESCE(SUM(CASE WHEN DATE(p.sale_time) >= ? AND DATE(p.sale_time) < ? THEN 1 ELSE 0 END), 0) as sales_61_90d,
        COUNT(p.id) as total_sales,
        ROUND(
          COALESCE(SUM(CASE WHEN DATE(p.sale_time) >= ? THEN 1 ELSE 0 END), 0) * 0.5 +
          COALESCE(SUM(CASE WHEN DATE(p.sale_time) >= ? AND DATE(p.sale_time) < ? THEN 1 ELSE 0 END), 0) * 0.3 +
          COALESCE(SUM(CASE WHEN DATE(p.sale_time) >= ? AND DATE(p.sale_time) < ? THEN 1 ELSE 0 END), 0) * 0.2,
          2
        ) as weighted_score
      FROM phones p
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN colors c ON p.color_id = c.id
      LEFT JOIN memories mem ON p.memory_id = mem.id
      WHERE p.status = 'sold'
        AND p.sale_time IS NOT NULL
        AND DATE(p.sale_time) >= ?
        AND m.name IS NOT NULL
        AND c.name IS NOT NULL
        AND mem.size IS NOT NULL
        ${storeCondition}
      GROUP BY b.name, m.name, c.name, mem.size
      ORDER BY weighted_score DESC, total_sales DESC
      LIMIT 10
    `
    const topProductsParams = [
      dates.day30Ago, dates.day60Ago, dates.day30Ago,
      dates.day90Ago, dates.day60Ago,
      dates.day30Ago, dates.day60Ago, dates.day30Ago,
      dates.day90Ago, dates.day60Ago,
      dates.day90Ago
    ]
    if (storeId) topProductsParams.push(parseInt(storeId))

    const db = this.database()
    const [rows] = await db.query(topProductsQuery, topProductsParams)
    return rows
  }

  async getCombinationSales({ dates, today, storeId, products }) {
    const storeCondition = storeId ? 'AND p.store_id = ?' : ''
    const productConditions = products.map(() => '(b.name = ? AND m.name = ? AND c.name = ? AND mem.size = ?)').join(' OR ')
    const queryParams = [dates.day90Ago, today]
    products.forEach(product => queryParams.push(product.brand_name, product.model_name, product.color_name, product.memory))
    if (storeId) queryParams.push(parseInt(storeId))
    const combinationQuery = `
      SELECT
        b.name as brand_name,
        m.name as model_name,
        c.name as color_name,
        mem.size as memory,
        COUNT(p.id) as sales_count,
        COALESCE(SUM(p.sale_price), 0) as total_revenue,
        COALESCE(SUM(p.sale_price - COALESCE(p.purchase_cost, 0)), 0) as total_profit,
        DATE(p.sale_time) as sale_time
      FROM phones p
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN colors c ON p.color_id = c.id
      LEFT JOIN memories mem ON p.memory_id = mem.id
      WHERE p.status = 'sold'
        AND p.sale_time IS NOT NULL
        AND DATE(p.sale_time) >= ?
        AND DATE(p.sale_time) <= ?
        AND m.name IS NOT NULL
        AND c.name IS NOT NULL
        AND mem.size IS NOT NULL
        AND (${productConditions})
        ${storeCondition}
      GROUP BY b.name, m.name, c.name, mem.size, DATE(p.sale_time)
      ORDER BY sale_time DESC
    `

    const db = this.database()
    const [results] = await db.execute(combinationQuery, queryParams)
    return results
  }
}

module.exports = AnalyticsSalesForecastRepository
