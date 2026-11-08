'use strict'

const { getDatabase } = require('../config/database')
const fs = require('node:fs')
const path = require('node:path')

class DevTempService {
  constructor({ database = { getDatabase }, fileSystem = fs, pathModule = path } = {}) {
    this.database = database
    this.fileSystem = fileSystem
    this.pathModule = pathModule
  }

  async makeAdmin(username) {
    await this.database.getDatabase().query(
      "UPDATE users SET role = 'admin' WHERE username = ?",
      [username]
    )
  }

  async migrateHomeSections() {
    const sql = this.fileSystem.readFileSync(
      this.pathModule.join(__dirname, '../../migrations/create_home_sections.sql'),
      'utf8'
    )
    const database = this.database.getDatabase()
    await database.query(sql)
    const [sections] = await database.query('SELECT * FROM H5_home_sections')
    return sections
  }
}

module.exports = DevTempService
