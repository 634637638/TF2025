'use strict'

const SalesStatsRepository = require('../repositories/sales-stats.repository')

class SalesStatsService {
  constructor({ repository = new SalesStatsRepository() } = {}) {
    if (!repository || typeof repository.getPhoneCounts !== 'function' || typeof repository.getCurrentMonthSales !== 'function') {
      throw new TypeError('SalesStatsService requires a sales stats repository')
    }
    this.repository = repository
  }

  async getStats() {
    const phoneCounts = await this.repository.getPhoneCounts()
    const monthSales = await this.repository.getCurrentMonthSales()
    return {
      ...phoneCounts,
      sold_this_month: monthSales.sold_this_month,
      total_revenue: Number.parseFloat(monthSales.total_revenue)
    }
  }
}

module.exports = SalesStatsService
