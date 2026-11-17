'use strict'

const { getDatabase } = require('../config/database')
const { withConnection } = require('../core/db/connection')

class RentalUpdateRepository {
  constructor({ database = getDatabase } = {}) {
    this.database = database
  }

  async withConnection(operation) {
    return withConnection(this.database, operation)
  }

  async findForUpdate(connection, id) {
    const [rows] = await connection.execute(
      `SELECT r.*, p.purchase_cost, p.is_new, p.store_id AS source_store_id,
              COALESCE(s.store_id, p.store_id) AS store_id
       FROM rentals r JOIN phones p ON p.id=r.phone_id
       LEFT JOIN sales s ON s.id=r.sale_id WHERE r.id=? FOR UPDATE`,
      [id]
    )
    return rows[0] || null
  }

  async countPaidPeriods(connection, id) {
    const [rows] = await connection.execute(
      'SELECT COUNT(*) AS count FROM rental_payments WHERE rental_id=? AND period_number IS NOT NULL',
      [id]
    )
    return Number(rows[0]?.count || 0)
  }

  async updateRental(connection, id, assignments, values) {
    await connection.execute(`UPDATE rentals SET ${assignments.join(',')} WHERE id=?`, [...values, id])
  }

  async updateSale(connection, id, assignments, values) {
    await connection.execute(`UPDATE sales SET ${assignments.join(',')} WHERE id=?`, [...values, id])
  }

  async updateSoldPhonePrice(connection, phoneId, price) {
    await connection.execute('UPDATE phones SET sale_price=? WHERE id=? AND status=?', [price, phoneId, 'sold'])
  }

  async updatePhonePurchaseCost(connection, phoneId, cost) {
    await connection.execute('UPDATE phones SET purchase_cost=? WHERE id=?', [cost, phoneId])
  }
}

module.exports = RentalUpdateRepository
