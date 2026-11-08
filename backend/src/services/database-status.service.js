'use strict'

const DatabaseStatusRepository = require('../repositories/database-status.repository')

class DatabaseStatusService {
  constructor(repository = new DatabaseStatusRepository()) {
    this.repository = repository
  }

  getStatus() {
    return this.repository.getStatus()
  }
}

module.exports = DatabaseStatusService
