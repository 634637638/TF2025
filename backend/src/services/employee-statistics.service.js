'use strict'

const EmployeeStatisticsRepository = require('../repositories/employee-statistics.repository')

class EmployeeStatisticsService {
  constructor({ repository = new EmployeeStatisticsRepository() } = {}) {
    this.repository = repository
  }

  async getOverviewStats({ status: rawStatus, search: rawSearch } = {}) {
    const statusText = String(rawStatus ?? '').trim()
    const search = String(rawSearch || '').trim()
    const status = statusText === '' ? undefined : (Number.parseInt(statusText, 10) === 0 ? 0 : 1)
    const { stats, roleStats, recentLoginStats } = await this.repository.getOverviewStats({ status, search })

    return {
      ...stats,
      ...recentLoginStats,
      by_role: roleStats.reduce((result, role) => {
        result[role.role_name] = role.count
        return result
      }, {})
    }
  }
}

module.exports = EmployeeStatisticsService
