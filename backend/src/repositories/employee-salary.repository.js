'use strict'

const { getDatabase } = require('../config/database')

class EmployeeSalaryRepository {
  constructor({ database = getDatabase } = {}) {
    this.database = database
  }

  async getSalaryList({ isAdmin, userId }) {
    const query = isAdmin
      ? `SELECT id, username, name, phone, status, hire_date, salary_template_id
         FROM users WHERE status = 1 ORDER BY id`
      : `SELECT id, username, name, phone, status, hire_date, salary_template_id
         FROM users WHERE id = ? AND status = 1 ORDER BY id`
    const [employees] = await this.database().execute(query, isAdmin ? [] : [userId])
    return employees
  }

  async getCurrentSalaryRows({ isAdmin, userId }) {
    const query = isAdmin
      ? `SELECT
           u.id,
           u.username,
           u.name,
           u.hire_date,
           u.salary_template_id,
           st.base_salary,
           st.auto_raise_rule,
           st.commission_type,
           st.commission_fixed,
           st.commission_new_fixed,
           st.commission_used_fixed,
           st.commission_percentage,
           st.overtime_hourly_rate,
           st.rest_days
         FROM users u
         LEFT JOIN salary_templates st ON u.salary_template_id = st.id
         WHERE u.status = 1
         ORDER BY u.id`
      : `SELECT
           u.id,
           u.username,
           u.name,
           u.hire_date,
           u.salary_template_id,
           st.base_salary,
           st.auto_raise_rule,
           st.commission_type,
           st.commission_fixed,
           st.commission_new_fixed,
           st.commission_used_fixed,
           st.commission_percentage,
           st.overtime_hourly_rate,
           st.rest_days
         FROM users u
         LEFT JOIN salary_templates st ON u.salary_template_id = st.id
         WHERE u.id = ? AND u.status = 1
         ORDER BY u.id`
    const [employees] = await this.database().execute(query, isAdmin ? [] : [userId])
    return employees
  }
}

module.exports = EmployeeSalaryRepository
