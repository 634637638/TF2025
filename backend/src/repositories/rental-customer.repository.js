'use strict'

const { getDatabase } = require('../config/database')

class RentalCustomerRepository {
  constructor({ getDb = getDatabase } = {}) {
    if (typeof getDb !== 'function') throw new TypeError('RentalCustomerRepository requires getDb')
    this.getDb = getDb
  }

  async getActiveStores() {
    const [rows] = await this.getDb().execute(
      'SELECT id, name FROM stores WHERE status=1 ORDER BY sort_order, name, id'
    )
    return rows
  }

  async findByPhone(phone) {
    const [rows] = await this.getDb().execute(
      'SELECT id, name, phone FROM customers WHERE phone = ? LIMIT 1',
      [phone]
    )
    return rows[0] || null
  }

  async updateExistingIdentity({ id, name, idCard }) {
    await this.getDb().execute(
      'UPDATE customers SET name=?,id_card=?,updated_at=NOW() WHERE id=?',
      [name, idCard, id]
    )
  }

  async create({ name, phone, idCard }) {
    const [result] = await this.getDb().execute(
      `INSERT INTO customers (name, phone, id_card, customer_type, status, source, register_date, created_at, updated_at)
       VALUES (?, ?, ?, 'individual', 1, 'rental', CURDATE(), NOW(), NOW())`,
      [name, phone, idCard]
    )
    return result.insertId
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
