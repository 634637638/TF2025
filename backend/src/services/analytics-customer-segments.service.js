'use strict'

const { isConnected } = require('../config/database')
const AnalyticsCustomerSegmentsRepository = require('../repositories/analytics-customer-segments.repository')

class AnalyticsCustomerSegmentsService {
  constructor({ repository = new AnalyticsCustomerSegmentsRepository(), connected = isConnected } = {}) {
    this.repository = repository
    this.connected = connected
  }

  async getSegments({ storeId }) {
    if (!this.connected()) {
      const error = new Error('数据库连接失败')
      error.statusCode = 500
      throw error
    }

    const rows = await this.repository.getSegments(storeId)
    return rows.map(item => ({
      segment: item.segment,
      count: Number(item.count) || 0,
      avg_order_value: Number(item.avgOrderValue) || 0,
      total_revenue: Number(item.totalRevenue) || 0
    }))
  }
}

module.exports = AnalyticsCustomerSegmentsService
