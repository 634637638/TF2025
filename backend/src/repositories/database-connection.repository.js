'use strict'

const { getDatabase } = require('../config/database')

class DatabaseConnectionRepository {
  constructor({ database = getDatabase } = {}) { this.database = database }
  test() { return this.database().execute('SELECT 1') }
}

module.exports = DatabaseConnectionRepository
