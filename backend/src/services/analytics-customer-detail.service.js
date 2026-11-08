'use strict'

const { isConnected } = require('../config/database')
const AnalyticsCustomerDetailRepository = require('../repositories/analytics-customer-detail.repository')

class AnalyticsCustomerDetailService {
  constructor({ repository = new AnalyticsCustomerDetailRepository(), connected = isConnected } = {}) {
    this.repository = repository
    this.connected = connected
  }

  async getDetail({ customerId, storeId }) {
    if (!this.connected()) {
      const error = new Error('数据库连接失败')
      error.statusCode = 500
      throw error
    }

    const [trendRows, preferenceRows] = await Promise.all([
      this.repository.getTrend(customerId, storeId),
      this.repository.getPreferences(customerId, storeId)
    ])

    return {
      trends: trendRows.slice().reverse().map(row => ({
        period: row.period,
        amount: Number(row.amount) || 0
      })),
      preferences: preferenceRows.map(row => ({
        name: row.name || '其他',
        value: Number(row.value) || 0
      }))
    }
  }
}

module.exports = AnalyticsCustomerDetailService
