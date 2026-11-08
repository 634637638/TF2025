'use strict'

const { getDatabase } = require('../config/database')

class UserRolesRepository {
  constructor({ database = getDatabase } = {}) {
    this.database = database
  }

  async getUserRoles(userId) {
    const database = this.database()
    const [users] = await database.execute('SELECT id FROM users WHERE id = ?', [userId])
    if (users.length === 0) return { exists: false, roles: [] }

    const [roles] = await database.execute(`
      SELECT r.id, r.name, r.description
      FROM roles r
      INNER JOIN user_roles ur ON r.id = ur.role_id
      WHERE ur.user_id = ?
      ORDER BY r.id
    `, [userId])
    return { exists: true, roles }
  }

  async listRoles({ search, page, pageSize, supportsRoleCode, supportsRoleIsActive }) {
    const roleParams = []
    const roleWhere = search
      ? `WHERE ${supportsRoleCode
        ? '(r.name LIKE ? OR r.code LIKE ? OR r.description LIKE ?)'
        : '(r.name LIKE ? OR r.description LIKE ?)'} `
      : ''
    if (search) {
      const searchPattern = `%${search}%`
      roleParams.push(searchPattern)
      if (supportsRoleCode) roleParams.push(searchPattern)
      roleParams.push(searchPattern)
    }

    const database = this.database()
    const [countResult] = await database.execute(
      `SELECT COUNT(*) as total FROM roles r ${roleWhere}`,
      roleParams
    )
    const total = countResult[0].total
    const selectCodeColumn = supportsRoleCode ? 'r.code' : 'NULL as code'
    const selectIsActiveColumn = supportsRoleIsActive ? 'r.is_active' : '1 as is_active'
    const groupByColumns = [
      'r.id',
      'r.name',
      ...(supportsRoleCode ? ['r.code'] : []),
      'r.description',
      'r.created_at',
      'r.updated_at',
      ...(supportsRoleIsActive ? ['r.is_active'] : [])
    ].join(', ')
    const offset = (page - 1) * pageSize
    const [roles] = await database.query(`
      SELECT
        r.id,
        r.name,
        ${selectCodeColumn},
        r.description,
        r.created_at,
        r.updated_at,
        ${selectIsActiveColumn},
        COUNT(ur.user_id) as user_count
      FROM roles r
      LEFT JOIN user_roles ur ON r.id = ur.role_id
      ${roleWhere}
      GROUP BY ${groupByColumns}
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?
    `, [...roleParams, pageSize, offset])

    return { roles, total }
  }
}

module.exports = UserRolesRepository
