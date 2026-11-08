'use strict'

class ScreenLockRepository {
  async findUserPassword(database, userId) {
    const [users] = await database.execute(
      'SELECT password FROM users WHERE id = ?',
      [userId]
    )
    return users[0] || null
  }

  async listQueryUsers(connection) {
    const [rows] = await connection.execute(`
      SELECT id, name, password, is_active, created_at, updated_at, remarks
      FROM query_users
      ORDER BY created_at DESC
    `)
    return rows
  }

  async createQueryUser(connection, { name, password, remarks, createdBy }) {
    const [result] = await connection.execute(`
      INSERT INTO query_users (name, password, remarks, created_by)
      VALUES (?, ?, ?, ?)
    `, [name, password, remarks, createdBy])
    return result.insertId
  }

  async updateQueryUser(connection, id, fields, values) {
    await connection.execute(`
      UPDATE query_users
      SET ${fields.join(', ')}
      WHERE id = ?
    `, [...values, id])
  }

  async deleteQueryUser(connection, id) {
    await connection.execute('DELETE FROM query_users WHERE id = ?', [id])
  }

  async listActiveQueryUsers(connection) {
    const [rows] = await connection.execute(`
      SELECT id, name, password
      FROM query_users
      WHERE is_active = 1
    `)
    return rows
  }
}

module.exports = ScreenLockRepository
