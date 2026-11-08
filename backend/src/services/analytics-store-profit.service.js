'use strict'

const { isConnected } = require('../config/database')
const AnalyticsStoreProfitRepository = require('../repositories/analytics-store-profit.repository')

class AnalyticsStoreProfitService {
  constructor({ repository = new AnalyticsStoreProfitRepository(), connected = isConnected, now = () => new Date() } = {}) {
    this.repository = repository
    this.connected = connected
    this.now = now
  }

  async getStoreProfit({ startDate, endDate, storeId = null, supplierId = null }) {
    if (!this.connected()) throw new Error('数据库连接失败')
    let queryStartDate = startDate
    let queryEndDate = endDate
    if (!queryStartDate || !queryEndDate) {
      const now = this.now()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      queryStartDate = `${year}-${month}-01`
      queryEndDate = `${year}-${month}-${new Date(year, now.getMonth() + 1, 0).getDate()}`
    }
    const rows = await this.repository.getStoreProfit({
      startDate: queryStartDate,
      endDate: queryEndDate,
      storeId,
      supplierId
    })
    return Array.from(rows || [])
      .filter(item => (parseInt(item.sales_count, 10) || 0) > 0)
      .map(item => ({
        id: item.store_id,
        name: item.store_name || '未知门店',
        revenue: Math.round(parseFloat(item.total_revenue) || 0),
        cost: Math.round(parseFloat(item.total_cost) || 0),
        count: parseInt(item.sales_count, 10) || 0,
        profit: Math.round((parseFloat(item.total_revenue) || 0) - (parseFloat(item.total_cost) || 0))
      }))
      .sort((a, b) => b.profit - a.profit)
  }
}

module.exports = AnalyticsStoreProfitService
