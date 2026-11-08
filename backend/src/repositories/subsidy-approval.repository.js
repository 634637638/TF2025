'use strict'

const { getDatabase } = require('../config/database')

class SubsidyApprovalRepository {
  constructor({ getDb = getDatabase } = {}) {
    this.getDb = getDb
  }

  async setApprovalStatus(recordId, status) {
    const [result] = await this.getDb().execute(
      'UPDATE national_subsidies SET apply_status = ? WHERE id = ?',
      [status, recordId]
    )
    return result.affectedRows > 0
  }
}

module.exports = SubsidyApprovalRepository
