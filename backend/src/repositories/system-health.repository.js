'use strict'

const { getDatabase } = require('../config/database')

class SystemHealthRepository {
  constructor({ database = getDatabase } = {}) {
    this.database = database
  }

  async getEmployeeCount() {
    const [rows] = await this.database().execute('SELECT COUNT(*) as count FROM users')
    return rows[0]?.count || 0
  }

  async getRoleCount() {
    const [rows] = await this.database().execute('SELECT COUNT(DISTINCT role) as count FROM users WHERE role IS NOT NULL AND role != ""')
    return rows[0]?.count || 0
  }

  async getStoreCount() {
    const [rows] = await this.database().execute('SELECT COUNT(*) as count FROM stores')
    return rows[0]?.count || 0
  }

  async getLogCount() {
    const [rows] = await this.database().execute('SELECT COUNT(*) as count FROM system_logs WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)')
    return rows[0]?.count || 0
  }

  async checkPool() {
    const database = this.database()
    if (!database?.pool) return 'unknown'
    await database.pool.execute('SELECT 1')
    return 'healthy'
  }
}

module.exports = SystemHealthRepository
