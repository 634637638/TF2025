'use strict'

class RepairReadRepository {
  constructor({ getDatabase, listQuery } = {}) {
    if (typeof getDatabase !== 'function') throw new TypeError('RepairReadRepository requires getDatabase')
    if (typeof listQuery !== 'string' || !listQuery.trim()) throw new TypeError('RepairReadRepository requires listQuery')
    this.getDatabase = getDatabase
    this.listQuery = listQuery
  }

  async ensureReady() {
    await this.getDatabase()
  }

  async getList(where, params, pageSize, offset) {
    const database = await this.getDatabase()
    const [rowsResult, countResult] = await Promise.all([
      database.execute(
        `${this.listQuery}${where} ORDER BY COALESCE(r.repair_time, r.created_at) DESC, r.id DESC LIMIT ? OFFSET ?`,
        [...params, pageSize, offset]
      ),
      database.execute(`SELECT COUNT(*) AS total FROM repairs r LEFT JOIN customers c ON c.id = r.customer_id${where}`, params)
    ])
    return {
      rows: rowsResult[0] || [],
      total: Number(countResult[0]?.[0]?.total || 0)
    }
  }

  async getStatistics(where, params) {
    const database = await this.getDatabase()
    const [rows] = await database.execute(`
      SELECT
        COALESCE(SUM(r.status = 'pending'), 0) AS pending,
        COALESCE(SUM(r.status = 'processing'), 0) AS processing,
        COALESCE(SUM(r.status = 'completed'), 0) AS completed,
        COALESCE(SUM(CASE WHEN r.status = 'completed' AND COALESCE(r.repair_time, r.created_at) >= DATE_FORMAT(CURDATE(), '%Y-%m-01') THEN COALESCE(r.actual_cost, 0) ELSE 0 END), 0) AS monthly_revenue
      FROM repairs r
      LEFT JOIN customers c ON c.id = r.customer_id
      ${where}
    `, params)
    return rows
  }

  async getDetail(id) {
    const database = await this.getDatabase()
    const [rows] = await database.execute(`${this.listQuery} WHERE r.id = ?`, [id])
    return rows[0] || null
  }
}

module.exports = RepairReadRepository
