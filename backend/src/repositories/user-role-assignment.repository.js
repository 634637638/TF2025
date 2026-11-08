'use strict'

class UserRoleAssignmentRepository {
  async findUser(connection, userId) {
    const [rows] = await connection.execute(
      'SELECT id, username FROM users WHERE id = ?',
      [userId]
    )
    return rows[0] || null
  }

  async listPreviousRoles(connection, userId) {
    const [rows] = await connection.execute(
      `SELECT r.id, r.name
       FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = ?
       ORDER BY r.id`,
      [userId]
    )
    return rows
  }

  async listExistingRoleIds(connection, roleIds) {
    if (roleIds.length === 0) return []
    const placeholders = roleIds.map(() => '?').join(',')
    const [rows] = await connection.execute(
      `SELECT id FROM roles WHERE id IN (${placeholders})`,
      roleIds
    )
    return rows.map(row => row.id)
  }

  async removeUserRoles(connection, userId) {
    await connection.execute('DELETE FROM user_roles WHERE user_id = ?', [userId])
  }

  async assignUserRoles(connection, userId, roleIds) {
    if (roleIds.length === 0) return
    const values = roleIds.map(() => '(?, ?)').join(',')
    await connection.execute(
      `INSERT INTO user_roles (user_id, role_id) VALUES ${values}`,
      roleIds.flatMap(roleId => [userId, roleId])
    )
  }
}

module.exports = UserRoleAssignmentRepository
