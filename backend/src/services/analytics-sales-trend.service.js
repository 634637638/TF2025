'use strict'

const { isConnected } = require('../config/database')
const AnalyticsSalesTrendRepository = require('../repositories/analytics-sales-trend.repository')

const VALID_PERIODS = new Set(['daily', 'weekly', 'monthly', 'quarterly'])

class AnalyticsSalesTrendService {
  constructor({ repository = new AnalyticsSalesTrendRepository(), connected = isConnected } = {}) {
    this.repository = repository
    this.connected = connected
  }

  async getSalesTrends(query) {
    const period = String(query.period || 'monthly')
    if (!VALID_PERIODS.has(period)) {
      const error = new Error('销售趋势周期无效')
      error.statusCode = 400
      throw error
    }
    if (!this.connected()) {
      const error = new Error('数据库连接失败')
      error.statusCode = 500
      throw error
    }

    const rows = await this.repository.getSalesTrends({
      period,
      storeId: query.storeId ?? null,
      startDate: query.startDate,
      endDate: query.endDate
    })
    return rows.map(row => ({
      period: row.period,
      new: Number(row.new_count) || 0,
      used: Number(row.used_count) || 0
    }))
  }
}

module.exports = AnalyticsSalesTrendService
