'use strict'

const USER_PUBLIC_COLUMNS = 'u.id, u.username, u.name, u.email, u.phone, u.status, u.store_id, u.salary_template_id, u.created_at, u.updated_at'

class UserMutationRepository {
  findRoleByName(connection, role) { return connection.execute('SELECT id FROM roles WHERE code = ? OR name = ? LIMIT 1', [role, role]) }
  findRolesByIds(connection, ids) { return connection.execute(`SELECT id FROM roles WHERE id IN (${ids.map(() => '?').join(',')})`, ids) }
  findByUsername(connection, username) { return connection.execute('SELECT id FROM users WHERE username = ?', [username]) }
  findById(connection, id) { return connection.execute('SELECT id FROM users WHERE id = ?', [id]) }
  findDuplicateUsername(connection, username, id) { return connection.execute('SELECT id FROM users WHERE username = ? AND id != ?', [username, id]) }
  create(connection, values) { return connection.execute('INSERT INTO users (username, password, name, email, phone, status, store_id, salary_template_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)', values) }
  update(connection, fields, values) { return connection.execute(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values) }
  async replaceUserRoles(connection, userId, roleIds) {
    if (roleIds === null) return

    await connection.execute('DELETE FROM user_roles WHERE user_id = ?', [userId])
    if (roleIds.length === 0) return

    const values = roleIds.map(() => '(?, ?, NOW(), NOW())').join(',')
    await connection.execute(
      `INSERT INTO user_roles (user_id, role_id, assigned_at, created_at) VALUES ${values}`,
      roleIds.flatMap(roleId => [userId, roleId])
    )
  }
  async selectPublicUser(connection, { id, username } = {}) {
    const whereClause = id !== undefined ? 'u.id = ?' : 'u.username = ?'
    const value = id !== undefined ? id : username
    const [users] = await connection.execute(
      `SELECT ${USER_PUBLIC_COLUMNS},
              GROUP_CONCAT(DISTINCT r.name ORDER BY r.id SEPARATOR ', ') AS role,
              GROUP_CONCAT(DISTINCT r.id ORDER BY r.id SEPARATOR ',') AS role_ids
         FROM users u
         LEFT JOIN user_roles ur ON ur.user_id = u.id
         LEFT JOIN roles r ON r.id = ur.role_id
        WHERE ${whereClause}
        GROUP BY u.id`,
      [value]
    )

    if (users.length === 0) return null
    const user = users[0]
    return {
      ...user,
      role_ids: user.role_ids ? String(user.role_ids).split(',').map(Number) : []
    }
  }
}
module.exports = UserMutationRepository
