'use strict'

const { getDatabase } = require('../config/database')
const { withConnection } = require('../core/db/connection')

class SalesPhoneRepository {
  constructor({ database = getDatabase } = {}) {
    this.database = database
  }

  withConnection(operation) {
    return withConnection(this.database, operation)
  }

  async findCustomerByPhone(connection, phone) {
    const [rows] = await connection.execute('SELECT id FROM customers WHERE phone = ?', [phone])
    return rows[0] || null
  }

  async updateCustomer(connection, values) {
    await connection.execute(
      'UPDATE customers SET name = COALESCE(?, name), apple_id = COALESCE(?, apple_id) WHERE id = ?',
      [values.name, values.appleId, values.customerId]
    )
  }

  async createCustomer(connection, values) {
    const [result] = await connection.execute(
      `INSERT INTO customers (name, phone, apple_id, member_number, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [values.name, values.phone, values.appleId, values.memberNumber]
    )
    return result.insertId
  }

  async findPhonesForSale(connection, phoneIds) {
    const placeholders = phoneIds.map(() => '?').join(',')
    const [rows] = await connection.execute(
      `SELECT p.id, p.status, p.purchase_cost, p.is_new, p.is_preordered,
              p.supplier_id, p.remarks, pr.customer_id AS preorder_customer_id,
              c.name AS preorder_customer_name
       FROM phones p
       LEFT JOIN preorders pr ON p.id = pr.matched_phone_id AND pr.status IN ('pending', 'arrived')
       LEFT JOIN customers c ON c.id = pr.customer_id
       WHERE p.id IN (${placeholders})
       FOR UPDATE`,
      phoneIds
    )
    return rows
  }

  async findPreorderForUpdate(connection, preorderId) {
    const [rows] = await connection.execute(
      `SELECT id, customer_id, deposit_amount, matched_phone_id, status
       FROM preorders WHERE id = ? FOR UPDATE`,
      [preorderId]
    )
    return rows[0] || null
  }

  async findDuplicateSales(connection, phoneIds, customerId) {
    const placeholders = phoneIds.map(() => '?').join(',')
    const [rows] = await connection.execute(
      `SELECT s.id, p.imei, s.sale_time
       FROM sales s
       JOIN phones p ON s.phone_id = p.id
       WHERE s.phone_id IN (${placeholders}) AND s.customer_id = ?
       ORDER BY s.sale_time DESC LIMIT 10`,
      [...phoneIds, customerId]
    )
    return rows
  }

  async createSale(connection, values) {
    const columns = [
      'phone_id', 'customer_id', 'sale_type', 'operator_id', 'store_id',
      'sale_price', 'purchase_cost', 'payment_method'
    ]
    const params = [
      values.phoneId, values.customerId, values.saleType, values.operatorId,
      values.storeId, values.salePrice, values.purchaseCost, values.paymentMethod
    ]
    if (values.supportsPaymentChannel) {
      columns.push('payment_channel')
      params.push(values.paymentChannel)
    }
    columns.push('invoice_number', 'remarks', 'sale_time')
    params.push(values.invoiceNumber, values.remarks, values.saleTime)
    const [result] = await connection.execute(
      `INSERT INTO sales (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
      params
    )
    return result.insertId
  }

  async createPayment(connection, values) {
    const [result] = await connection.execute(
      `INSERT INTO payment_records (
        order_id, customer_id, payment_method, payment_channel, amount,
        payment_status, transaction_no, payment_time, remarks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [values.orderId, values.customerId, values.paymentMethod, values.paymentChannel,
        values.amount, values.status, values.transactionNo, values.paymentTime, values.remarks]
    )
    return result.insertId
  }

  async markPhoneSold(connection, values) {
    const [result] = await connection.execute(
      `UPDATE phones SET status = 'sold', is_preordered = 0, sale_price = ?,
         purchase_cost = ?, supplier_id = ?, remarks = ?, sale_time = ?, sale_operator_id = ?
       WHERE id = ? AND status IN ('in_stock', 'reserved')`,
      [values.salePrice, values.purchaseCost, values.supplierId, values.remarks,
        values.saleTime, values.operatorId, values.phoneId]
    )
    return result
  }

  async completePreorder(connection, values) {
    await connection.execute(
      `UPDATE preorders SET status = 'completed', actual_price = ?, delivered_time = ?,
         operator_id = ?, sale_id = ?, remaining_amount = ?, updated_at = NOW() WHERE id = ?`,
      [values.actualPrice, values.saleTime, values.operatorId, values.saleId,
        values.remainingAmount, values.preorderId]
    )
  }
}

module.exports = SalesPhoneRepository
