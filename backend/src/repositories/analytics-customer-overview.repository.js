'use strict'

const { getDatabase } = require('../config/database')

class AnalyticsCustomerOverviewRepository {
  constructor({ getDb = getDatabase } = {}) {
    this.getDb = getDb
  }

  async getOverview({ startDate, endDate, storeId }) {
    const db = this.getDb()
    const dateCondition = startDate && endDate
      ? 'AND DATE(c.created_at) >= ? AND DATE(c.created_at) <= ?'
      : startDate
        ? 'AND DATE(c.created_at) >= ?'
        : endDate ? 'AND DATE(c.created_at) <= ?' : ''
    const dateParams = startDate && endDate ? [startDate, endDate] : startDate ? [startDate] : endDate ? [endDate] : []
    const storeJoin = storeId ? 'LEFT JOIN sales s2 ON c.id = s2.customer_id' : ''
    const storeCondition = storeId ? 'AND s2.store_id = ?' : ''
    const storeParams = storeId ? [storeId] : []

    const totalQuery = `SELECT COUNT(DISTINCT c.id) as totalCustomers FROM customers c ${storeJoin} WHERE c.status = 1 ${storeCondition} ${dateCondition}`

    const newDateCondition = startDate && endDate
      ? 'AND DATE(c.created_at) >= ? AND DATE(c.created_at) <= ?'
      : 'AND DATE_FORMAT(c.created_at, "%Y-%m") = DATE_FORMAT(NOW(), "%Y-%m")'
    const newParams = [...storeParams, ...(startDate && endDate ? [startDate, endDate] : [])]
    const newQuery = `SELECT COUNT(DISTINCT c.id) as newCustomers FROM customers c ${storeJoin} WHERE c.status = 1 ${storeCondition} ${newDateCondition}`

    const activeDateCondition = startDate && endDate
      ? 'AND DATE(s.sale_time) >= ? AND DATE(s.sale_time) <= ?'
      : 'AND s.sale_time >= DATE_SUB(NOW(), INTERVAL 1 YEAR)'
    const activeParams = [...(startDate && endDate ? [startDate, endDate] : []), ...(storeId ? [storeId] : [])]
    const activeStoreCondition = storeId ? 'AND s.store_id = ?' : ''
    const activeQuery = `SELECT COUNT(*) as activeCustomers FROM (SELECT s.customer_id FROM sales s WHERE s.customer_id IS NOT NULL ${activeDateCondition} ${activeStoreCondition} GROUP BY s.customer_id HAVING COUNT(*) >= 2) as repeat_customers`

    const highValueParams = [...(startDate && endDate ? [startDate, endDate] : []), ...(storeId ? [storeId] : [])]
    const highValueStoreCondition = storeId ? 'AND s.store_id = ?' : ''
    const highValueDateCondition = startDate && endDate ? 'AND DATE(s.sale_time) >= ? AND DATE(s.sale_time) <= ?' : ''
    const highValueQuery = `SELECT COUNT(DISTINCT s.customer_id) as highValueCount FROM sales s WHERE s.customer_id IS NOT NULL ${highValueDateCondition} ${highValueStoreCondition} GROUP BY s.customer_id HAVING SUM(s.sale_price) >= 50000`

    const segmentStoreCondition = storeId ? 'AND s.store_id = ?' : ''
    const segmentParams = [...(storeId ? [storeId] : []), ...(startDate && endDate ? [startDate, endDate] : [])]
    const segmentDateCondition = startDate && endDate ? 'AND DATE(s.sale_time) >= ? AND DATE(s.sale_time) <= ?' : ''
    const segmentQuery = `
      SELECT CASE WHEN totalSpent >= 50000 THEN '高价值客户' WHEN totalSpent >= 20000 THEN '中价值客户' WHEN totalSpent >= 5000 THEN '低价值客户' ELSE '新客户' END as segment,
        COUNT(*) as count, COALESCE(AVG(totalSpent), 0) as avgOrderValue, COALESCE(SUM(totalSpent), 0) as totalRevenue
      FROM (SELECT c.id, COALESCE(SUM(s.sale_price), 0) as totalSpent FROM customers c
        LEFT JOIN sales s ON c.id = s.customer_id WHERE c.status = 1 ${segmentStoreCondition} ${segmentDateCondition} GROUP BY c.id) customerData
      GROUP BY segment`

    const [total, added, active, highValue, segments] = await Promise.all([
      db.execute(totalQuery, [...storeParams, ...dateParams]),
      db.execute(newQuery, newParams),
      db.execute(activeQuery, activeParams),
      db.execute(highValueQuery, highValueParams),
      db.execute(segmentQuery, segmentParams)
    ])
    const [lastMonth] = await db.execute('SELECT COUNT(*) as lastMonthNew FROM customers c WHERE c.status = 1 AND DATE_FORMAT(c.created_at, "%Y-%m") = DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 1 MONTH), "%Y-%m")', [])
    const [lastYearActive] = await db.execute('SELECT COUNT(*) as lastYearActive FROM (SELECT s.customer_id FROM sales s WHERE s.customer_id IS NOT NULL AND s.sale_time >= DATE_SUB(DATE_SUB(NOW(), INTERVAL 1 YEAR), INTERVAL 1 YEAR) AND s.sale_time < DATE_SUB(NOW(), INTERVAL 1 YEAR) GROUP BY s.customer_id HAVING COUNT(*) >= 2) as last_year_repeat_customers', [])

    return {
      totalCustomers: total[0][0]?.totalCustomers || 0,
      newCustomers: added[0][0]?.newCustomers || 0,
      activeCustomers: active[0][0]?.activeCustomers || 0,
      highValueCount: highValue[0].length || 0,
      segments: segments[0],
      lastMonthNew: lastMonth[0][0]?.lastMonthNew || 0,
      lastYearActive: lastYearActive[0][0]?.lastYearActive || 0
    }
  }
}

module.exports = AnalyticsCustomerOverviewRepository
