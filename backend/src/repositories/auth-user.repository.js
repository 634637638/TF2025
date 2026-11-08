'use strict'

class AuthUserRepository {
  findCurrentUser(database, id) {
    return database.execute('SELECT id, username, name, phone, email, status, last_login FROM users WHERE id = ?', [id])
  }

  findLoginUser(database, username) {
    return database.execute('SELECT id, username, password, name, status FROM users WHERE username = ?', [username])
  }

  recordLogin(database, id) {
    return database.execute('UPDATE users SET last_login = NOW() WHERE id = ?', [id])
  }

  findRefreshUser(database, id) {
    return database.execute(`SELECT id, username, name, status
      FROM users WHERE id = ? AND (status = 1 OR status = 'active')`, [id])
  }

  revokeAll(database, jti, userId) {
    return database.execute(`INSERT INTO jwt_blacklist
      (jti, user_id, token_type, reason, created_at, expires_at)
      VALUES (?, ?, 'access', 'logout_all', NOW(), DATE_ADD(NOW(), INTERVAL 31 DAY))`, [jti, userId])
  }
}

module.exports = AuthUserRepository
