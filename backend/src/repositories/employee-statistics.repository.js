'use strict'

const { getDatabase } = require('../config/database')

class EmployeeStatisticsRepository {
  constructor({ database = getDatabase } = {}) {
    this.database = database
  }

  async getOverviewStats({ status, search }) {
    const conditions = []
    const params = []
    if (status !== undefined) {
      conditions.push('u.status = ?')
      params.push(status)
    }
    if (search) {
      conditions.push(`(
        (CONVERT(u.name USING utf8mb4) COLLATE utf8mb4_unicode_ci) LIKE ? OR
        (CONVERT(u.username USING utf8mb4) COLLATE utf8mb4_unicode_ci) LIKE ? OR
        (CONVERT(u.phone USING utf8mb4) COLLATE utf8mb4_unicode_ci) LIKE ? OR
        (CONVERT(u.email USING utf8mb4) COLLATE utf8mb4_unicode_ci) LIKE ?
      )`)
      const pattern = `%${search}%`
      params.push(pattern, pattern, pattern, pattern)
    }
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const database = this.database()
    const [stats] = await database.execute(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) as inactive,
        SUM(CASE WHEN phone IS NOT NULL AND phone != '' THEN 1 ELSE 0 END) as with_phone,
        SUM(CASE WHEN email IS NOT NULL AND email != '' THEN 1 ELSE 0 END) as with_email,
        SUM(CASE WHEN salary_template_id IS NOT NULL THEN 1 ELSE 0 END) as with_salary_template
      FROM users u
      ${whereClause}
    `, params)
    const [roleStats] = await database.execute(`
      SELECT r.name as role_name, COUNT(ur.user_id) as count
      FROM roles r
      LEFT JOIN user_roles ur ON r.id = ur.role_id
      GROUP BY r.id, r.name
    `)
    const [recentLoginStats] = await database.execute(`
      SELECT COUNT(*) as recent_logins
      FROM users
      WHERE last_login >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    `)

    return { stats: stats[0], roleStats, recentLoginStats: recentLoginStats[0] }
  }
}

module.exports = EmployeeStatisticsRepository
