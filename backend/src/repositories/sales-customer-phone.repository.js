'use strict'

const { getDatabase } = require('../config/database')

class SalesCustomerPhoneRepository {
  constructor({ getDb = getDatabase } = {}) {
    if (typeof getDb !== 'function') throw new TypeError('SalesCustomerPhoneRepository requires getDb')
    this.getDb = getDb
  }

  async findLatestByPhone(phone) {
    const database = await this.getDb()
    const [customers] = await database.execute(
      'SELECT id, name, phone, apple_id, created_at FROM customers WHERE phone = ? ORDER BY id DESC LIMIT 1',
      [phone]
    )
    return customers[0] || null
  }
}

module.exports = SalesCustomerPhoneRepository
