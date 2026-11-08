'use strict'

const BaseService = require('../core/base/base.service')
const DatabaseConnectionRepository = require('../repositories/database-connection.repository')
const { isConnected, connectToDatabase, setConnected } = require('../config/database')

class DatabaseConnectionService extends BaseService {
  constructor({ database, isDatabaseConnected = isConnected, connect = connectToDatabase, setDatabaseConnected = setConnected,
    repository = new DatabaseConnectionRepository({ database }) } = {}) {
    super()
    Object.assign(this, { repository, isDatabaseConnected, connect, setDatabaseConnected })
  }

  async testConnection() {
    try {
      await this.repository.test()
      this.setDatabaseConnected(true)
    } catch (error) {
      this.setDatabaseConnected(false)
      throw error
    }
  }

  getStatus() { return { connected: this.isDatabaseConnected() } }
  reconnect() { return this.connect(3, 2000) }
}

module.exports = DatabaseConnectionService
