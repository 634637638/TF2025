'use strict'

const { getDatabase } = require('../config/database')

const employeeFields = `
  id,
  username,
  name,
  phone,
  email,
  salary_template_id,
  status,
  last_login,
  created_at,
  updated_at,
  hire_date,
  CASE
    WHEN EXISTS(SELECT 1 FROM stores WHERE manager_id = users.id) THEN
      (SELECT name FROM stores WHERE manager_id = users.id LIMIT 1)
    ELSE '未分配'
  END as store_name`

class EmployeeMutationRepository {
  constructor({ database = getDatabase } = {}) {
    this.database = database
  }

  async getValidRoles(roleIds) {
    const placeholders = roleIds.map(() => '?').join(',')
    const [roles] = await this.database().execute(
      `SELECT id FROM roles WHERE id IN (${placeholders})`,
      roleIds
    )
    return roles
  }

  async findByUsername(username, excludeId) {
    const query = excludeId === undefined
      ? 'SELECT id FROM users WHERE username = ?'
      : 'SELECT id FROM users WHERE username = ? AND id != ?'
    const params = excludeId === undefined ? [username] : [username, excludeId]
    const [users] = await this.database().execute(query, params)
    return users[0] || null
  }

  async findByPhone(phone, excludeId) {
    const query = excludeId === undefined
      ? 'SELECT id FROM users WHERE phone = ?'
      : 'SELECT id FROM users WHERE phone = ? AND id != ?'
    const params = excludeId === undefined ? [phone] : [phone, excludeId]
    const [users] = await this.database().execute(query, params)
    return users[0] || null
  }

  async findId(id) {
    const [users] = await this.database().execute(
      'SELECT id FROM users WHERE id = ?',
      [id]
    )
    return users[0] || null
  }

  async insertEmployee({ username, name, password, phone, email, salaryTemplateId, hireDate }) {
    const [result] = await this.database().execute(`
      INSERT INTO users (
        username, name, password, phone, email,
        salary_template_id, hire_date, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())
    `, [username, name, password, phone, email, salaryTemplateId, hireDate])
    return result.insertId
  }

  async findCreatedEmployee(username) {
    const [users] = await this.database().execute(`
      SELECT ${employeeFields}
      FROM users
      WHERE username = ?
    `, [username])
    return users[0]
  }

  async assignRole(userId, roleId) {
    await this.database().execute(
      'INSERT INTO user_roles (user_id, role_id, created_at) VALUES (?, ?, NOW())',
      [userId, roleId]
    )
  }

  async updateEmployee(fields, values, id) {
    await this.database().execute(
      `UPDATE users SET ${fields.map(field => `${field} = ?`).join(', ')} WHERE id = ?`,
      [...values, id]
    )
  }

  async replaceRoles(userId, roleIds) {
    await this.database().execute(
      'DELETE FROM user_roles WHERE user_id = ?',
      [userId]
    )
    for (const roleId of roleIds) await this.assignRole(userId, roleId)
  }

  async findUpdatedEmployee(id) {
    const [users] = await this.database().execute(`
      SELECT
        ${employeeFields},
        CASE
          WHEN users.salary_template_id IS NOT NULL THEN
            CONCAT('薪资模板-', users.salary_template_id)
          ELSE '未设置'
        END as salary_template_name
      FROM users
      WHERE id = ?
    `, [id])
    return users[0]
  }

  async deleteEmployee(id) {
    await this.database().execute('DELETE FROM users WHERE id = ?', [id])
  }

  async updateStatus(id, status) {
    await this.database().execute(
      'UPDATE users SET status = ? WHERE id = ?',
      [status, id]
    )
  }
}

module.exports = EmployeeMutationRepository
