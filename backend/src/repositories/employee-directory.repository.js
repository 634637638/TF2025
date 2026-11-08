'use strict'

const { getDatabase } = require('../config/database')

class EmployeeDirectoryRepository {
  constructor({ database = getDatabase } = {}) {
    this.database = database
  }

  async listEmployees({ status, search, pageSize, offset }) {
    const whereConditions = []
    const queryParams = []
    if (status !== undefined) {
      whereConditions.push('status = ?')
      queryParams.push(status)
    }
    if (search) {
      whereConditions.push('(name LIKE ? OR username LIKE ? OR phone LIKE ? OR email LIKE ?)')
      const searchPattern = `%${search}%`
      queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern)
    }
    const whereClause = whereConditions.length ? `WHERE ${whereConditions.join(' AND ')}` : ''
    const database = this.database()
    const [countRows] = await database.execute(
      `SELECT COUNT(*) as total FROM users u ${whereClause}`,
      queryParams
    )
    const [employees] = await database.execute(`
      SELECT
        u.id,
        u.username,
        u.name,
        u.phone,
        u.email,
        u.salary_template_id,
        u.status,
        u.last_login,
        u.created_at,
        u.updated_at,
        u.hire_date,
        CASE
          WHEN EXISTS(SELECT 1 FROM stores WHERE manager_id = u.id) THEN
            (SELECT name FROM stores WHERE manager_id = u.id LIMIT 1)
          ELSE '未分配'
        END as store_name,
        CASE
          WHEN u.salary_template_id IS NOT NULL THEN
            CONCAT('薪资模板-', u.salary_template_id)
          ELSE '未设置'
        END as salary_template_name,
        (
          SELECT GROUP_CONCAT(r.name ORDER BY r.id SEPARATOR ', ')
          FROM user_roles ur
          JOIN roles r ON ur.role_id = r.id
          WHERE ur.user_id = u.id
        ) as role_names,
        (
          SELECT GROUP_CONCAT(r.id ORDER BY r.id SEPARATOR ',')
          FROM user_roles ur
          JOIN roles r ON ur.role_id = r.id
          WHERE ur.user_id = u.id
        ) as role_ids
      FROM users u
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?
    `, [...queryParams, pageSize, offset])

    return { employees, total: countRows[0].total }
  }

  async getEmployeeById(id) {
    const [employees] = await this.database().execute(`
      SELECT
        id,
        username,
        name,
        phone,
        email,
        salary_template_id,
        status,
        last_login,
        created_at,
        hire_date,
        COALESCE(
          (SELECT GROUP_CONCAT(r.name)
           FROM user_roles ur
           INNER JOIN roles r ON ur.role_id = r.id
           WHERE ur.user_id = users.id),
          '未分配角色'
        ) as role_names,
        COALESCE(
          (SELECT GROUP_CONCAT(ur.role_id)
           FROM user_roles ur
           WHERE ur.user_id = users.id),
          ''
        ) as role_ids,
        CASE
          WHEN EXISTS(SELECT 1 FROM stores WHERE manager_id = users.id) THEN
            (SELECT name FROM stores WHERE manager_id = users.id LIMIT 1)
          ELSE '未分配'
        END as store_name,
        CASE
          WHEN users.salary_template_id IS NOT NULL THEN
            CONCAT('薪资模板-', users.salary_template_id)
          ELSE '未设置'
        END as salary_template_name
      FROM users
      WHERE id = ?
    `, [id])
    return employees[0] || null
  }
}

module.exports = EmployeeDirectoryRepository
