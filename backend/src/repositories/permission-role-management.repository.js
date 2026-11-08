'use strict'

const { getDatabase } = require('../config/database')

class PermissionRoleManagementRepository {
  constructor({ database = getDatabase } = {}) {
    this.database = database
  }

  async findByName(name, excludeId = null) {
    const params = excludeId === null ? [name] : [name, excludeId]
    const whereId = excludeId === null ? '' : ' AND id != ?'
    const [rows] = await this.database().execute(
      `SELECT id FROM roles WHERE name = ?${whereId}`,
      params
    )
    return rows
  }

  async findByCode(code) {
    const [rows] = await this.database().execute('SELECT id FROM roles WHERE code = ?', [code])
    return rows
  }

  async findById(id, { supportsRoleType, supportsRoleCode }) {
    const roleTypeColumn = supportsRoleType ? ', role_type' : ', NULL as role_type'
    const roleCodeColumn = supportsRoleCode ? ', code' : ''
    const [rows] = await this.database().execute(
      `SELECT id, name, description${roleTypeColumn}${roleCodeColumn} FROM roles WHERE id = ?`,
      [id]
    )
    return rows[0] || null
  }

  async create({ name, description, code, supportsRoleCode }) {
    const result = supportsRoleCode
      ? await this.database().execute(
        'INSERT INTO roles (name, code, description, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
        [name, code, description]
      )
      : await this.database().execute(
        'INSERT INTO roles (name, description, created_at, updated_at) VALUES (?, ?, NOW(), NOW())',
        [name, description]
      )
    const roleId = result[0].insertId
    const finalCode = supportsRoleCode ? (code || `role_${roleId}`) : null
    if (supportsRoleCode && !code) {
      await this.database().execute('UPDATE roles SET code = ? WHERE id = ?', [finalCode, roleId])
    }
    return { id: roleId, name, code: finalCode, description }
  }

  async update({ id, name, description, roleType, supportsRoleType }) {
    if (supportsRoleType) {
      await this.database().execute(
        'UPDATE roles SET name = ?, description = ?, role_type = COALESCE(?, role_type), updated_at = NOW() WHERE id = ?',
        [name, description, roleType || null, id]
      )
    } else {
      await this.database().execute(
        'UPDATE roles SET name = ?, description = ?, updated_at = NOW() WHERE id = ?',
        [name, description, id]
      )
    }
  }

  async remove(id) {
    const [existingRoles] = await this.database().execute('SELECT name FROM roles WHERE id = ?', [id])
    if (existingRoles.length === 0) return { role: null, usersCount: 0 }
    const [userCount] = await this.database().execute(
      'SELECT COUNT(*) as count FROM user_roles WHERE role_id = ?',
      [id]
    )
    if (userCount[0].count > 0) return { role: existingRoles[0], usersCount: userCount[0].count }
    await this.database().execute('DELETE FROM role_permissions WHERE role_id = ?', [id])
    await this.database().execute('DELETE FROM roles WHERE id = ?', [id])
    return { role: existingRoles[0], usersCount: 0 }
  }

  async findStatusById(id) {
    const [rows] = await this.database().execute(
      'SELECT id, name, is_active FROM roles WHERE id = ?',
      [id]
    )
    return rows[0] || null
  }

  async updateStatus(id, isActive) {
    await this.database().execute(
      'UPDATE roles SET is_active = ?, updated_at = NOW() WHERE id = ?',
      [isActive, id]
    )
  }

  async listUserIdsByRole(id) {
    const [rows] = await this.database().execute(
      `SELECT DISTINCT u.id FROM users u
       INNER JOIN user_roles ur ON u.id = ur.user_id
       WHERE ur.role_id = ?`,
      [id]
    )
    return rows.map(user => user.id)
  }

  async deleteRefreshTokens(userIds) {
    const placeholders = userIds.map(() => '?').join(',')
    await this.database().execute(
      `DELETE FROM refresh_tokens WHERE user_id IN (${placeholders})`,
      userIds
    )
  }
}

module.exports = PermissionRoleManagementRepository
