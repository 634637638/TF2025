'use strict'

const { withConnection } = require('../core/db/connection')

const { getDatabase } = require('../config/database')

class EmployeeRoleRepository {
  constructor({ database = getDatabase } = {}) {
    this.database = database
  }

  async getActiveSystemRoles() {
    const [roles] = await this.database().execute(`
      SELECT
        id,
        name,
        description,
        COALESCE(code, CONCAT('role_', id)) AS role_code,
        role_type,
        hierarchy_level,
        is_active,
        created_at,
        updated_at
      FROM roles
      WHERE is_active = 1
      ORDER BY
        COALESCE(hierarchy_level, 0) DESC,
        id ASC
    `)
    return roles
  }

  async getRolesWithUserCount() {
    const [roles] = await this.database().execute(`
      SELECT
        r.id,
        r.name,
        r.description,
        r.created_at,
        r.updated_at,
        COUNT(ur.user_id) as user_count
      FROM roles r
      LEFT JOIN user_roles ur ON r.id = ur.role_id
      GROUP BY r.id
      ORDER BY r.id
    `)
    return roles
  }

  async createRole({ name, description }) {
    const [existingRoles] = await this.database().execute(
      'SELECT id FROM roles WHERE name = ?',
      [name]
    )
    if (existingRoles.length > 0) return { duplicate: true }

    const [result] = await this.database().execute(
      'INSERT INTO roles (name, description, created_at, updated_at) VALUES (?, ?, NOW(), NOW())',
      [name, description]
    )
    const [roles] = await this.database().execute(
      'SELECT id, name, description, created_at, updated_at FROM roles WHERE id = ?',
      [result.insertId]
    )
    return { role: roles[0] }
  }

  async updateRole({ id, name, description }) {
    const [roles] = await this.database().execute(
      'SELECT id FROM roles WHERE id = ?',
      [id]
    )
    if (roles.length === 0) return { notFound: true }

    if (name && name.trim() !== '') {
      const [existingRoles] = await this.database().execute(
        'SELECT id FROM roles WHERE name = ? AND id != ?',
        [name.trim(), id]
      )
      if (existingRoles.length > 0) return { duplicate: true }
    }

    const fields = []
    const values = []
    if (name && name.trim() !== '') {
      fields.push('name = ?')
      values.push(name.trim())
    }
    if (description !== undefined) {
      fields.push('description = ?')
      values.push(description)
    }
    if (fields.length > 0) {
      values.push(id)
      await this.database().execute(`UPDATE roles SET ${fields.join(', ')} WHERE id = ?`, values)
    }

    const [updatedRoles] = await this.database().execute(
      'SELECT id, name, description, created_at, updated_at FROM roles WHERE id = ?',
      [id]
    )
    return { role: updatedRoles[0] }
  }

  async deleteRole(id) {
    const [roles] = await this.database().execute(
      'SELECT id FROM roles WHERE id = ?',
      [id]
    )
    if (roles.length === 0) return { notFound: true }

    const [assignments] = await this.database().execute(
      'SELECT COUNT(*) as count FROM user_roles WHERE role_id = ?',
      [id]
    )
    if (assignments[0].count > 0) return { inUse: true }

    await this.database().execute('DELETE FROM roles WHERE id = ?', [id])
    return { deletedId: parseInt(id) }
  }

  async assignRoles(employeeId, roleIds) {
    return withConnection(this.database(), async connection => {
      try {
        await connection.beginTransaction()
        const [employees] = await connection.execute('SELECT id FROM users WHERE id = ?', [employeeId])
        if (employees.length === 0) {
          await connection.rollback()
          return { notFound: true }
        }

        if (roleIds.length > 0) {
          const placeholders = roleIds.map(() => '?').join(',')
          const [roles] = await connection.execute(`SELECT id FROM roles WHERE id IN (${placeholders})`, roleIds)
          if (roles.length !== roleIds.length) {
            await connection.rollback()
            return { invalidRoles: true }
          }
        }

        await connection.execute('DELETE FROM user_roles WHERE user_id = ?', [employeeId])
        if (roleIds.length > 0) {
          const values = roleIds.map(() => '(?, ?, NOW())').join(',')
          const params = roleIds.flatMap(roleId => [employeeId, roleId])
          await connection.execute(
            `INSERT INTO user_roles (user_id, role_id, assigned_at) VALUES ${values}`,
            params
          )
        }

        const [updatedEmployees] = await connection.execute(`
          SELECT
            u.id,
            u.username,
            u.name,
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
          WHERE u.id = ?
        `, [employeeId])
        await connection.commit()
        return { employee: updatedEmployees[0] }
      } catch (error) {
        await connection.rollback().catch(() => {})
        throw error
      }

    })
  }

  async removeRole(employeeId, roleId) {
    const database = this.database()
    const [employees] = await database.execute('SELECT id FROM users WHERE id = ?', [employeeId])
    if (employees.length === 0) return { notFound: true }

    const [assignments] = await database.execute(
      'SELECT user_id, role_id FROM user_roles WHERE user_id = ? AND role_id = ?',
      [employeeId, roleId]
    )
    if (assignments.length === 0) return { notAssigned: true }

    await database.execute(
      'DELETE FROM user_roles WHERE user_id = ? AND role_id = ?',
      [employeeId, roleId]
    )
    return { removed: true }
  }
}

module.exports = EmployeeRoleRepository
