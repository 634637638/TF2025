'use strict'

const { appendStoreScopeCondition } = require('../utils/store-scope')

const { getDatabase } = require('../config/database')

class RentalCustomerRepository {
  constructor({ getDb = getDatabase } = {}) {
    if (typeof getDb !== 'function') throw new TypeError('RentalCustomerRepository requires getDb')
    this.getDb = getDb
  }

  async getActiveStores(scope) {
    const conditions = ['status=1']; const params = []
    appendStoreScopeCondition(scope, 'id', conditions, params)
    const [rows] = await this.getDb().execute(
      `SELECT id, name FROM stores WHERE ${conditions.join(' AND ')} ORDER BY sort_order, name, id`, params
    )
    return rows
  }

  async findPhoneOwner(phone, id) {
    const [rows] = await this.getDb().execute(
      'SELECT id FROM customers WHERE phone=? AND id<>? LIMIT 1',
      [phone, id]
    )
    return rows[0] || null
  }

  async updateActiveCustomer({ id, name, phone, idCard }) {
    const [result] = await this.getDb().execute(
      'UPDATE customers SET name=?,phone=?,id_card=?,updated_at=NOW() WHERE id=? AND status=1',
      [name, phone, idCard, id]
    )
    return result.affectedRows > 0
  }
}

module.exports = RentalCustomerRepository
