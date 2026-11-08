'use strict'

const { getDatabase } = require('../config/database')

class AnalyticsEmployeeRolesRepository {
  constructor(database = getDatabase) {
    this.database = database
  }

  async getEmployeeRoles(storeId) {
    const [rows] = await this.database().execute(`
      SELECT
        r.name AS role_name,
        COUNT(ur.user_id) AS count
      FROM user_roles ur
      INNER JOIN roles r ON ur.role_id = r.id
      INNER JOIN users u ON ur.user_id = u.id
      WHERE ur.status = 'active'
        AND u.status = 1
        AND r.is_active = 1
        ${storeId !== null ? 'AND u.store_id = ?' : ''}
      GROUP BY r.id, r.name
      ORDER BY count DESC
    `, storeId !== null ? [storeId] : [])
    return rows
  }
}

module.exports = AnalyticsEmployeeRolesRepository
