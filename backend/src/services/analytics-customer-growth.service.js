'use strict'

const { isConnected } = require('../config/database')
const { AnalyticsCustomerGrowthRepository, PERIOD_DAYS } = require('../repositories/analytics-customer-growth.repository')

class AnalyticsCustomerGrowthService {
  constructor({ repository = new AnalyticsCustomerGrowthRepository(), connected = isConnected } = {}) {
    this.repository = repository
    this.connected = connected
  }

  async getGrowth({ period, storeId }) {
    const normalizedPeriod = PERIOD_DAYS[period] ? period : '30d'
    if (!this.connected()) {
      const error = new Error('数据库连接失败')
      error.statusCode = 500
      throw error
    }

    const rows = await this.repository.getGrowth({ days: PERIOD_DAYS[normalizedPeriod], storeId })
    return {
      labels: rows.map(row => row.date),
      values: rows.map(row => Number(row.new_customers) || 0)
    }
  }
}

module.exports = AnalyticsCustomerGrowthService
