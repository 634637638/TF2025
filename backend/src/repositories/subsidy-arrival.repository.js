'use strict'

const { appendStoreScopeCondition } = require('../utils/store-scope')

const { getDatabase } = require('../config/database')

class SubsidyArrivalRepository {
  constructor({ getDb = getDatabase } = {}) {
    this.getDb = getDb
  }

  async confirmArrival(id, scope) {
    const conditions = ['id = ?']; const scopeParams = []
    appendStoreScopeCondition(scope, 'store_id', conditions, scopeParams)
    const [result] = await this.getDb().execute(`
      UPDATE national_subsidies
      SET arrival_time = NOW()
      WHERE ${conditions.join(' AND ')}
    `, [id, ...scopeParams])
    return result.affectedRows !== 0
  }
}

module.exports = SubsidyArrivalRepository
