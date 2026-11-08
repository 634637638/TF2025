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
      `SELECT status,billing_mode,start_date,sale_id,phone_id,customer_id,unit_price,term_months,sale_price,
              down_payment,principal_amount,monthly_rent,monitoring_lock,deposit,remarks,
              (SELECT purchase_cost FROM phones WHERE id=rentals.phone_id) AS purchase_cost,
              (SELECT is_new FROM phones WHERE id=rentals.phone_id) AS is_new
       FROM rentals WHERE id=? FOR UPDATE`,
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
