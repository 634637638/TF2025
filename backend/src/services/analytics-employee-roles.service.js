'use strict'

const { isConnected } = require('../config/database')
const AnalyticsEmployeeRolesRepository = require('../repositories/analytics-employee-roles.repository')

class AnalyticsEmployeeRolesService {
  constructor({ repository = new AnalyticsEmployeeRolesRepository(), connected = isConnected } = {}) {
    this.repository = repository
    this.connected = connected
  }

  async getEmployeeRoles(storeId) {
    if (!this.connected()) {
      const error = new Error('数据库连接失败')
      error.statusCode = 500
      throw error
    }

    const rows = await this.repository.getEmployeeRoles(storeId)
    return rows.map(item => ({ name: item.role_name, value: item.count }))
  }
}

module.exports = AnalyticsEmployeeRolesService
