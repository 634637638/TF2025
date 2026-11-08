'use strict'

const { getDatabase } = require('../config/database')

class PermissionConflictsRepository {
  constructor({ database = getDatabase } = {}) {
    this.database = database
  }

  async getConflicts({ supportsModuleIsActive }) {
    const pool = this.database()
    const [[duplicates], [orphaned]] = await Promise.all([
      pool.execute(`
        SELECT
          role_id,
          module_key,
          permission_type,
          COUNT(*) as count
        FROM role_permissions
        GROUP BY role_id, module_key, permission_type
        HAVING count > 1
      `),
      pool.execute(`
        SELECT DISTINCT rp.module_key
        FROM role_permissions rp
        LEFT JOIN modules m ON rp.module_key = m.\`key\`
        WHERE m.\`key\` IS NULL ${supportsModuleIsActive ? 'OR m.is_active = 0' : ''}
      `)
    ])
    return { duplicates, orphaned }
  }

  async getDuplicatesForCleanup(connection) {
    const [duplicates] = await connection.execute(`
      SELECT
        role_id,
        module_key,
        permission_type,
        COUNT(*) as count,
        MIN(id) as keep_id
      FROM role_permissions
      GROUP BY role_id, module_key, permission_type
      HAVING count > 1
    `)
    return duplicates
  }

  async deleteDuplicatePermissions(connection, duplicate) {
    const [result] = await connection.execute(`
      DELETE FROM role_permissions
      WHERE role_id = ? AND module_key = ? AND permission_type = ? AND id != ?
    `, [duplicate.role_id, duplicate.module_key, duplicate.permission_type, duplicate.keep_id])
    return result.affectedRows
  }

  async deleteOrphanedPermissions(connection, supportsModuleIsActive) {
    const [result] = await connection.execute(`
      DELETE rp FROM role_permissions rp
      LEFT JOIN modules m ON rp.module_key = m.\`key\`
      WHERE m.\`key\` IS NULL ${supportsModuleIsActive ? 'OR m.is_active = 0' : ''}
    `)
    return result.affectedRows
  }
}

module.exports = PermissionConflictsRepository
