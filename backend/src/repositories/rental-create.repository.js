'use strict'

const { getDatabase } = require('../config/database')
const { withConnection } = require('../core/db/connection')

class RentalCreateRepository {
  constructor({ database = getDatabase } = {}) {
    this.database = database
  }

  withConnection(operation) {
    return withConnection(this.database, operation)
  }

  async findActiveCustomerForUpdate(connection, customerId) {
    const [rows] = await connection.execute(
      'SELECT id,id_card FROM customers WHERE id=? AND status=1 FOR UPDATE',
      [customerId]
    )
    return rows[0] || null
  }

  async findPhoneForUpdate(connection, phoneId) {
    const [rows] = await connection.execute(
      'SELECT id,status,purchase_cost,store_id,is_new FROM phones WHERE id=? FOR UPDATE',
      [phoneId]
    )
    return rows[0] || null
  }

  async updatePhonePurchaseCost(connection, phoneId, purchaseCost) {
    await connection.execute('UPDATE phones SET purchase_cost=? WHERE id=?', [purchaseCost, phoneId])
  }

  async createRental(connection, values) {
    const { billingMode } = values
    const insertParams = billingMode === 'buyout'
      ? [values.phoneId, values.customerId, billingMode, 0, values.termMonths, values.salePrice, values.downPayment, values.principalAmount, values.monthlyRent, values.monitoringLock, values.startDate, values.startDate, values.termMonths, 0, values.salePrice, values.operatorId, null, values.remarks]
      : [values.phoneId, values.customerId, billingMode, values.unitPrice, null, values.monitoringLock, values.startDate, values.deposit, values.salePrice, values.operatorId, null, values.remarks]
    const insertSql = billingMode === 'buyout'
      ? `INSERT INTO rentals (phone_id,customer_id,billing_mode,unit_price,term_months,sale_price,down_payment,principal_amount,monthly_rent,monitoring_lock,start_date,end_date,deposit,total_cost,status,operator_id,sale_id,remarks)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,DATE_ADD(?, INTERVAL ? MONTH),?,?,'active',?,?,?)`
      : `INSERT INTO rentals (phone_id,customer_id,billing_mode,unit_price,term_months,sale_price,monitoring_lock,start_date,end_date,deposit,total_cost,status,operator_id,sale_id,remarks)
         VALUES (?,?,?,?,?,?,?, ?,NULL,?,?,'active',?,?,?)`
    const [result] = await connection.execute(insertSql, insertParams)
    return result.insertId
  }

  async setContractNumber(connection, rentalId, contractNumber) {
    await connection.execute('UPDATE rentals SET contract_number=? WHERE id=?', [contractNumber, rentalId])
  }

  async createSale(connection, values) {
    const [result] = await connection.execute(
      `INSERT INTO sales (phone_id,customer_id,sale_type,operator_id,store_id,sale_price,purchase_cost,payment_method,invoice_number,remarks,sale_time)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [values.phoneId, values.customerId, 'retail', values.operatorId, values.storeId, values.salePrice, values.purchaseCost, values.paymentMethod, values.invoiceNumber, values.remarks, values.saleDate]
    )
    return result.insertId
  }

  async linkSale(connection, saleId, rentalId) {
    await connection.execute('UPDATE rentals SET sale_id=? WHERE id=?', [saleId, rentalId])
  }

  async markPhoneSold(connection, values) {
    await connection.execute(
      'UPDATE phones SET status=\'sold\',sale_price=?,sale_time=?,sale_operator_id=?,remarks=CONCAT(COALESCE(remarks,\'\'), ?) WHERE id=?',
      [values.salePrice, values.saleDate, values.operatorId, values.remarks, values.phoneId]
    )
  }

  async createDownPayment(connection, values) {
    await connection.execute(
      "INSERT INTO rental_payments (rental_id,amount,period_number,payment_type,operator_id,remarks) VALUES (?,?,NULL,'down_payment',?,?)",
      [values.rentalId, values.amount, values.operatorId, values.remarks]
    )
  }

  async createPaymentRecord(connection, values) {
    await connection.execute(
      `INSERT INTO payment_records (order_id,customer_id,payment_method,payment_channel,amount,payment_status,transaction_no,payment_time,remarks)
       VALUES (?,?,?,?,?,'success',?,?,?)`,
      [values.saleId, values.customerId, values.paymentMethod, values.paymentChannel, values.amount, null, values.paymentTime, values.remarks]
    )
  }

  async findRentalSaleId(connection, rentalId) {
    const [rows] = await connection.execute('SELECT sale_id FROM rentals WHERE id=?', [rentalId])
    return rows[0]?.sale_id || null
  }

  async markPhoneRented(connection, phoneId) {
    await connection.execute("UPDATE phones SET status='rented' WHERE id=?", [phoneId])
  }
}

module.exports = RentalCreateRepository
