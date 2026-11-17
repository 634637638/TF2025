'use strict'

const { appendStoreScopeCondition } = require('../utils/store-scope')

const { getDatabase } = require('../config/database')

class SubsidyAuditRepository {
  constructor({ getDb = getDatabase } = {}) {
    this.getDb = getDb
  }

  async markAudited(recordId, scope) {
    const conditions = ['id = ?']; const scopeParams = []
    appendStoreScopeCondition(scope, 'store_id', conditions, scopeParams)
    const [result] = await this.getDb().execute(`
      UPDATE national_subsidies
      SET apply_time = NOW()
      WHERE ${conditions.join(' AND ')}
    `, [recordId, ...scopeParams])
    return result.affectedRows > 0
  }
}

module.exports = SubsidyAuditRepository
