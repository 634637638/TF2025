'use strict'

const { isConnected } = require('../config/database')
const {
  AnalyticsCustomerRetentionRepository,
  COHORT_CONFIG
} = require('../repositories/analytics-customer-retention.repository')

const invalid = message => Object.assign(new Error(message), { statusCode: 400 })

class AnalyticsCustomerRetentionService {
  constructor({ repository = new AnalyticsCustomerRetentionRepository(), connected = isConnected } = {}) {
    this.repository = repository
    this.connected = connected
  }

  async getRetention({ cohort, storeId }) {
    const normalizedCohort = cohort || 'monthly'
    const config = COHORT_CONFIG[normalizedCohort]
    if (!config) throw invalid('留存周期无效')
    if (!this.connected()) {
      const error = new Error('数据库连接失败')
      error.statusCode = 500
      throw error
    }

    const rows = await this.repository.getCohorts({ cohort: normalizedCohort, storeId })
    const cohortMap = new Map()
    rows.forEach(row => {
      const date = new Date(row.created_at)
      const key = normalizedCohort === 'yearly'
        ? String(date.getFullYear())
        : normalizedCohort === 'quarterly'
          ? `${date.getFullYear()}-Q${Math.floor(date.getMonth() / 3) + 1}`
          : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      if (!cohortMap.has(key)) cohortMap.set(key, { customers: new Set(), retained: new Map() })
      const item = cohortMap.get(key)
      item.customers.add(Number(row.id))
      const offset = Number(row.period_offset)
      if (!Number.isFinite(offset) || offset < 0 || offset > 5) return
      if (Number(row.has_purchase) === 1) {
        item.retained.set(offset, (item.retained.get(offset) || 0) + 1)
      }
    })

    const sortedCohorts = [...cohortMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-6)
    const periods = Array.from({ length: 6 }, (_, index) => `第${index + 1}${config.periods}`)
    const cohorts = sortedCohorts.map(([key, item]) => ({
      cohort: key,
      data: periods.map((_, index) => {
        if (index === 0) return 100
        const size = item.customers.size
        if (!size) return 0
        return Number(((item.retained.get(index) || 0) / size * 100).toFixed(1))
      })
    }))

    return { cohorts, periods }
  }
}

module.exports = AnalyticsCustomerRetentionService
