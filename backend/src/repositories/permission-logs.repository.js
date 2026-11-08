'use strict'

const { getDatabase } = require('../config/database')

class PermissionLogsRepository {
  constructor(databaseProvider = getDatabase) {
    this.databaseProvider = databaseProvider
  }

  async insertOperation({
    userId,
    username,
    action,
    targetType,
    targetId,
    targetName,
    description,
    details,
    ipAddress,
    status
  }) {
    await this.databaseProvider().execute(
      `INSERT INTO permission_operation_logs
       (user_id, username, action, target_type, target_id, target_name, description, details, ip_address, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, username, action, targetType, targetId, targetName, description, details, ipAddress, status]
    )
  }

  async getRolesByIds(roleIds) {
    const db = this.databaseProvider()
    const placeholders = roleIds.map(() => '?').join(',')
    const [roles] = await db.execute(
      `SELECT id, name FROM roles WHERE id IN (${placeholders})`,
      roleIds
    )
    return roles
  }

  async listLogs({ whereClause, params, pageSize, offset }) {
    const db = this.databaseProvider()
    const [countResult] = await db.execute(
      `SELECT COUNT(*) as total FROM permission_operation_logs ${whereClause}`,
      params
    )
    const [logs] = await db.execute(
      `SELECT id, user_id, username, action, target_type, target_id, target_name, description, details, ip_address, status, created_at
       FROM permission_operation_logs ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    )
    return { logs, total: countResult[0].total }
  }

  async getStats() {
    const [stats] = await this.databaseProvider().execute(`
      SELECT
        COUNT(*) as total_logs,
        COUNT(CASE WHEN action = 'create' THEN 1 END) as create_count,
        COUNT(CASE WHEN action = 'edit' THEN 1 END) as edit_count,
        COUNT(CASE WHEN action = 'delete' THEN 1 END) as delete_count,
        COUNT(CASE WHEN action = 'assign' THEN 1 END) as assign_count,
        COUNT(CASE WHEN action = 'permission' THEN 1 END) as permission_count,
        COUNT(CASE WHEN status = 'success' THEN 1 END) as success_count,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count
      FROM permission_operation_logs
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `)
    return stats[0]
  }

  async deleteLog(id) {
    await this.databaseProvider().execute(
      'DELETE FROM permission_operation_logs WHERE id = ?',
      [id]
    )
  }
}

module.exports = PermissionLogsRepository
