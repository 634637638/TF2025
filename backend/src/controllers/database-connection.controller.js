'use strict'

const { getDatabase, isConnected, connectToDatabase, setConnected } = require('../config/database')
const DatabaseConnectionService = require('../services/database-connection.service')
const ApiResponse = require('../utils/response')
const log = require('../utils/log')

class DatabaseConnectionController {
  constructor({
    database = getDatabase,
    isDatabaseConnected = isConnected,
    connect = connectToDatabase,
    setDatabaseConnected = setConnected,
    response = ApiResponse,
    logger = log
  } = {}) {
    this.service = new DatabaseConnectionService({ database, isDatabaseConnected, connect, setDatabaseConnected })
    this.response = response
    this.logger = logger
  }

  async testConnection(_req, res) {
    try {
      await this.service.testConnection()
      return this.response.success(res, null, '数据库连接成功')
    } catch (error) {
      this.logger.error('数据库连接测试失败:', error.code, error.message)
      return this.response.error(res, '数据库连接失败', 500, error.code)
    }
  }

  getStatus(_req, res) {
    return this.response.success(res, this.service.getStatus())
  }

  async reconnect(_req, res) {
    try {
      const connected = await this.service.reconnect()
      if (connected) return this.response.success(res, null, '数据库重连成功')
      return this.response.error(res, '数据库重连失败', 500)
    } catch (error) {
      this.logger.error('数据库重连失败:', error)
      return this.response.error(res, '数据库重连失败', 500)
    }
  }
}

module.exports = DatabaseConnectionController
