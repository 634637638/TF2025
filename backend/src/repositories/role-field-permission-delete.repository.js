'use strict'

const { getDatabase } = require('../config/database')

class RoleFieldPermissionDeleteRepository {
  constructor({ getDb = getDatabase } = {}) {
    this.getDb = getDb
  }

  async delete(roleId, moduleKey) {
    const [result] = await this.getDb().execute(
      'DELETE FROM role_field_permissions WHERE role_id = ? AND module_key = ?',
      [roleId, moduleKey]
    )
    return result.affectedRows || 0
  }
}

module.exports = RoleFieldPermissionDeleteRepository
