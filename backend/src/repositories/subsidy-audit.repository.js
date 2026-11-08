'use strict'

const { getDatabase } = require('../config/database')

class SubsidyAuditRepository {
  constructor({ getDb = getDatabase } = {}) {
    this.getDb = getDb
  }

  async markAudited(recordId) {
    const [result] = await this.getDb().execute(`
      UPDATE national_subsidies
      SET apply_time = NOW()
      WHERE id = ?
    `, [recordId])
    return result.affectedRows > 0
  }
}

module.exports = SubsidyAuditRepository
