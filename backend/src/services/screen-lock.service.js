'use strict'

const bcrypt = require('bcryptjs')
const { getDatabase } = require('../config/database')
const { withConnection } = require('../core/db/connection')
const ScreenLockRepository = require('../repositories/screen-lock.repository')

class ScreenLockService {
  constructor({ database = getDatabase, repository = new ScreenLockRepository(), passwordVerifier = bcrypt.compare, passwordHasher = bcrypt.hash } = {}) {
    this.database = database
    this.repository = repository
    this.passwordVerifier = passwordVerifier
    this.passwordHasher = passwordHasher
  }

  async verifyPassword(userId, password) {
    const user = await this.repository.findUserPassword(this.database(), userId)
    return { exists: Boolean(user), valid: user ? await this.passwordVerifier(password, user.password) : false }
  }

  listQueryUsers() {
    return withConnection(this.database, async connection => {
      const rows = await this.repository.listQueryUsers(connection)
      return rows.map(row => ({ ...row, password: '******' }))
    })
  }

  createQueryUser({ name, password, remarks, createdBy }) {
    return withConnection(this.database, async connection => {
      const hashedPassword = await this.passwordHasher(password, 10)
      return this.repository.createQueryUser(connection, { name, password: hashedPassword, remarks: remarks || '', createdBy })
    })
  }

  updateQueryUser(id, { name, password, is_active: isActive, remarks }) {
    return withConnection(this.database, async connection => {
      const fields = []
      const values = []
      if (name !== undefined) { fields.push('name = ?'); values.push(name) }
      if (password !== undefined && password !== '') {
        fields.push('password = ?')
        values.push(await this.passwordHasher(password, 10))
      }
      if (isActive !== undefined) { fields.push('is_active = ?'); values.push(isActive) }
      if (remarks !== undefined) { fields.push('remarks = ?'); values.push(remarks) }
      if (!fields.length) return false
      await this.repository.updateQueryUser(connection, id, fields, values)
      return true
    })
  }

  deleteQueryUser(id) {
    return withConnection(this.database, connection => this.repository.deleteQueryUser(connection, id))
  }

  matchQueryPassword(password) {
    return withConnection(this.database, async connection => {
      const users = await this.repository.listActiveQueryUsers(connection)
      for (const user of users) {
        if (await this.passwordVerifier(password, user.password)) return { id: user.id, name: user.name }
      }
      return null
    })
  }
}

module.exports = ScreenLockService
