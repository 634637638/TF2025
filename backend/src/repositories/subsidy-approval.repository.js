'use strict'

const { appendStoreScopeCondition } = require('../utils/store-scope')

const { getDatabase } = require('../config/database')

class SubsidyApprovalRepository {
  constructor({ getDb = getDatabase } = {}) {
    this.getDb = getDb
  }

  async setApprovalStatus(recordId, status, scope) {
    const conditions = ['id = ?']; const scopeParams = []
    appendStoreScopeCondition(scope, 'store_id', conditions, scopeParams)
    const [result] = await this.getDb().execute(
      `UPDATE national_subsidies SET apply_status = ? WHERE ${conditions.join(' AND ')}`,
      [status, recordId, ...scopeParams]
    )
    return result.affectedRows > 0
  }
}

module.exports = SubsidyApprovalRepository
