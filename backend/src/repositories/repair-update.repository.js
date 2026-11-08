'use strict'

const { getDatabase } = require('../config/database')
const { withConnection } = require('../core/db/connection')

const REFERENCE_TABLES = new Set(['customers', 'brands', 'phones', 'colors', 'memories', 'users'])

class RepairUpdateRepository {
  constructor({ getDb = getDatabase, listQuery } = {}) {
    if (typeof getDb !== 'function') throw new TypeError('RepairUpdateRepository requires getDb')
    if (typeof listQuery !== 'string' || !listQuery.trim()) throw new TypeError('RepairUpdateRepository requires listQuery')
    this.getDb = getDb
    this.listQuery = listQuery
  }

  async hasReference(table, id, activeOnly = false) {
    if (!REFERENCE_TABLES.has(table)) throw new TypeError('Unsupported repair reference table')
    const database = await this.getDb()
    const status = activeOnly ? ' AND status = 1' : ''
    const [rows] = await database.execute(`SELECT id FROM ${table} WHERE id = ?${status}`, [id])
    return rows.length > 0
  }

  async withConnection(operation) {
    return withConnection(this.getDb, operation)
  }

  async getMediaForUpdate(connection, id) {
    const [rows] = await connection.execute('SELECT photos FROM repairs WHERE id = ? FOR UPDATE', [id])
    return rows[0] || null
  }

  async update(connection, fields, values, id) {
    return connection.execute(`UPDATE repairs SET ${fields.join(', ')} WHERE id = ?`, [...values, id])
  }

  async getUpdated(connection, id) {
    const [rows] = await connection.execute(`${this.listQuery} WHERE r.id = ?`, [id])
    return rows[0] || null
  }
}

module.exports = RepairUpdateRepository
