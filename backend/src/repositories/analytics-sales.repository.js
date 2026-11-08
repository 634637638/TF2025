'use strict'

const { getDatabase } = require('../config/database')

class AnalyticsSalesRepository {
  constructor(database = getDatabase) {
    this.database = database
  }

  async getSales({ startDate, endDate, storeId, supplierId }) {
    const whereConditions = ['so.order_status = "completed"']
    const queryParams = []
    if (startDate) {
      whereConditions.push('DATE(so.order_date) >= ?')
      queryParams.push(startDate)
    }
    if (endDate) {
      whereConditions.push('DATE(so.order_date) <= ?')
      queryParams.push(endDate)
    }
    if (storeId !== null) {
      whereConditions.push('so.store_id = ?')
      queryParams.push(storeId)
    }
    const whereClause = `WHERE ${whereConditions.join(' AND ')}`
    const salesQuery = `
      SELECT COUNT(DISTINCT so.id) as totalOrders,
        SUM(so.final_amount) as totalSales,
        AVG(so.final_amount) as averageOrderValue,
        DATE(so.order_date) as date
      FROM sales_orders so
      ${whereClause}
      GROUP BY DATE(so.order_date)
      ORDER BY date DESC
      LIMIT 30
    `
    const storeSalesQuery = `
      SELECT st.id, st.name,
        COUNT(DISTINCT so.id) as totalOrders,
        SUM(so.final_amount) as totalSales,
        AVG(so.final_amount) as averageOrderValue
      FROM stores st
      LEFT JOIN sales_orders so ON st.id = so.store_id AND so.order_status = 'completed'
      ${startDate || endDate ? `WHERE ${whereConditions.filter(condition => !condition.includes('store_id')).join(' AND ')}` : ''}
      GROUP BY st.id, st.name
      ORDER BY totalSales DESC
    `
    const storeSalesParams = []
    if (startDate) storeSalesParams.push(startDate)
    if (endDate) storeSalesParams.push(endDate)
    const topProductsQuery = `
      SELECT p.id, p.imei, m.name as model_name, b.name as brand_name,
        COUNT(s.id) as quantity, SUM(p.sale_price) as revenue, p.status as stock_status
      FROM sales s
      JOIN phones p ON s.phone_id = p.id
      JOIN models m ON p.model_id = m.id
      JOIN brands b ON p.brand_id = b.id
      WHERE s.status = 'completed'
      ${startDate ? 'AND DATE(s.sale_time) >= ?' : ''}
      ${endDate ? 'AND DATE(s.sale_time) <= ?' : ''}
      ${storeId !== null ? 'AND p.store_id = ?' : ''}
      ${supplierId !== null ? 'AND p.supplier_id = ?' : ''}
      GROUP BY p.id, m.name, b.name, p.status
      ORDER BY quantity DESC
      LIMIT 10
    `
    const productParams = []
    if (startDate) productParams.push(startDate)
    if (endDate) productParams.push(endDate)
    if (storeId !== null) productParams.push(storeId)
    if (supplierId !== null) productParams.push(supplierId)
    const database = this.database()
    const [salesResult, storeResult, productResult] = await Promise.all([
      database.execute(salesQuery, queryParams),
      database.execute(storeSalesQuery, storeSalesParams),
      database.execute(topProductsQuery, productParams)
    ])
    return { salesRows: salesResult[0], storeRows: storeResult[0], productRows: productResult[0] }
  }
}

module.exports = AnalyticsSalesRepository
