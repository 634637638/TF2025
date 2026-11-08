'use strict'

class RepairStatusRepository {
  constructor({ getDatabase, listQuery } = {}) {
    if (typeof getDatabase !== 'function') throw new TypeError('RepairStatusRepository requires getDatabase')
    if (typeof listQuery !== 'string' || !listQuery.trim()) throw new TypeError('RepairStatusRepository requires listQuery')
    this.getDatabase = getDatabase
    this.listQuery = listQuery
  }

  async updateStatus(id, status) {
    const database = await this.getDatabase()
    const [result] = await database.execute(
      "UPDATE repairs SET status = ?, completed_at = CASE WHEN ? = 'completed' THEN COALESCE(completed_at, NOW()) ELSE NULL END WHERE id = ?",
      [status, status, id]
    )
    if (!result.affectedRows) return null

    const [rows] = await database.execute(`${this.listQuery} WHERE r.id = ?`, [id])
    return rows[0] || null
  }

  async cancel(id) {
    const database = await this.getDatabase()
    const [result] = await database.execute(
      "UPDATE repairs SET status = 'cancelled' WHERE id = ? AND status != 'completed'",
      [id]
    )
    return result.affectedRows > 0
  }
}

module.exports = RepairStatusRepository
