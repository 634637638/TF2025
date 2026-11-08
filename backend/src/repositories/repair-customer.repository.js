'use strict'

const { generateMemberNumber } = require('../utils/member-number')

class RepairCustomerRepository {
  constructor({ getDatabase, createMemberNumber = generateMemberNumber } = {}) {
    if (typeof getDatabase !== 'function') throw new TypeError('RepairCustomerRepository requires getDatabase')
    if (typeof createMemberNumber !== 'function') throw new TypeError('RepairCustomerRepository requires createMemberNumber')
    this.getDatabase = getDatabase
    this.createMemberNumber = createMemberNumber
  }

  async ensureReady() {
    await this.getDatabase()
  }

  async findByPhone(phone) {
    const database = await this.getDatabase()
    const [rows] = await database.execute(
      'SELECT id, name, phone FROM customers WHERE phone = ? LIMIT 1',
      [phone]
    )
    return rows[0] || null
  }

  async generateMemberNumber() {
    return this.createMemberNumber()
  }

  async createCustomer({ name, phone, memberNumber }) {
    const database = await this.getDatabase()
    const [result] = await database.execute(
      `INSERT INTO customers (name, phone, customer_type, status, member_number, created_at, updated_at)
       VALUES (?, ?, 'individual', 1, ?, NOW(), NOW())`,
      [name, phone, memberNumber]
    )
    return result.insertId
  }
}

module.exports = RepairCustomerRepository
