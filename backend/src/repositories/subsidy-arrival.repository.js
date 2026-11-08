'use strict'

const { getDatabase } = require('../config/database')

class SubsidyArrivalRepository {
  constructor({ getDb = getDatabase } = {}) {
    this.getDb = getDb
  }

  async confirmArrival(id) {
    const [result] = await this.getDb().execute(`
      UPDATE national_subsidies
      SET arrival_time = NOW()
      WHERE id = ?
    `, [id])
    return result.affectedRows !== 0
  }
}

module.exports = SubsidyArrivalRepository
