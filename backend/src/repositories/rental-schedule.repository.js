'use strict'

const { getDatabase } = require('../config/database')

class RentalScheduleRepository {
  constructor({ getDb = getDatabase } = {}) {
    this.getDb = getDb
  }

  async getRental(rentalId) {
    const [rows] = await this.getDb().execute(
      "SELECT billing_mode,term_months,unit_price,sale_price,down_payment,principal_amount,monthly_rent,DATE_FORMAT(start_date,'%Y-%m-%d') start_date FROM rentals WHERE id=?",
      [rentalId]
    )
    return rows[0] || null
  }

  async getPayments(rentalId) {
    const [rows] = await this.getDb().execute(
      `SELECT rp.id,rp.period_number,rp.amount,DATE_FORMAT(rp.paid_at,'%Y-%m-%d %H:%i:%s') paid_at,
              COALESCE(u.name,u.username) operator_name,rp.remarks
       FROM rental_payments rp LEFT JOIN users u ON u.id=rp.operator_id
       WHERE rp.rental_id=? ORDER BY COALESCE(rp.period_number,255),rp.id`,
      [rentalId]
    )
    return rows
  }

  async getPaymentRental(connection, rentalId) {
    const [rows] = await connection.execute(
      `SELECT r.contract_number,r.billing_mode,r.term_months,r.unit_price,r.sale_price,r.down_payment,r.principal_amount,r.monthly_rent,
              r.status,r.sale_id,r.customer_id,s.payment_method AS sale_payment_method,s.payment_channel AS sale_payment_channel
       FROM rentals r LEFT JOIN sales s ON s.id=r.sale_id WHERE r.id=? FOR UPDATE`,
      [rentalId]
    )
    return rows[0] || null
  }

  async findPaidPeriods(connection, rentalId, periodNumbers) {
    const [rows] = await connection.execute(
      `SELECT period_number FROM rental_payments WHERE rental_id=? AND period_number IN (${periodNumbers.map(() => '?').join(',')}) FOR UPDATE`,
      [rentalId, ...periodNumbers]
    )
    return rows
  }

  async insertInstallment(connection, { rentalId, amount, periodNumber, operatorId, remarks }) {
    const [result] = await connection.execute(
      "INSERT INTO rental_payments (rental_id,amount,period_number,payment_type,operator_id,remarks) VALUES (?,?,?,'installment',?,?)",
      [rentalId, amount, periodNumber, operatorId, remarks]
    )
    return result
  }

  async insertPaymentRecord(connection, { saleId, customerId, paymentMethod, paymentChannel, amount, remarks }) {
    await connection.execute(
      `INSERT INTO payment_records (order_id,customer_id,payment_method,payment_channel,amount,payment_status,transaction_no,payment_time,remarks)
       VALUES (?,?,?,?,?,'success',NULL,NOW(),?)`,
      [saleId, customerId, paymentMethod, paymentChannel, amount, remarks]
    )
  }

  async countPaidPeriods(connection, rentalId) {
    const [rows] = await connection.execute(
      'SELECT COUNT(DISTINCT period_number) AS count FROM rental_payments WHERE rental_id=? AND period_number IS NOT NULL',
      [rentalId]
    )
    return Number(rows[0]?.count || 0)
  }

  async markBoughtOut(connection, rentalId) {
    await connection.execute("UPDATE rentals SET status='bought_out' WHERE id=?", [rentalId])
  }

  async insertDailyPayment(connection, { rentalId, amount, operatorId, remarks }) {
    const [result] = await connection.execute(
      "INSERT INTO rental_payments (rental_id,amount,period_number,payment_type,operator_id,remarks) VALUES (?,?,NULL,'daily',?,?)",
      [rentalId, amount, operatorId, remarks]
    )
    return result
  }

}

module.exports = RentalScheduleRepository
