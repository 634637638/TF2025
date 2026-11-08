'use strict'

const { getDatabase } = require('../config/database')
const { withConnection } = require('../core/db/connection')

class SubsidyApplyRepository {
  constructor({ getDb = getDatabase } = {}) {
    this.getDb = getDb
  }

  withConnection(operation) {
    return withConnection(this.getDb, operation)
  }

  async findByPhoneForUpdate(connection, phoneId) {
    const [records] = await connection.execute(
      'SELECT id, apply_status FROM national_subsidies WHERE phone_id = ? FOR UPDATE',
      [phoneId]
    )
    return records[0] || null
  }

  async updateCustomerIdCard(connection, customerId, idCard) {
    await connection.execute(
      'UPDATE customers SET id_card = ? WHERE id = ?',
      [idCard, customerId]
    )
  }

  async hasPhotoReference(connection, relativePath) {
    const [records] = await connection.execute(
      'SELECT id FROM national_subsidies WHERE subsidy_photos LIKE ? LIMIT 1',
      [`%${relativePath}%`]
    )
    return records.length > 0
  }

  async create(connection, data) {
    const [result] = await connection.execute(`
      INSERT INTO national_subsidies (
        sale_id, phone_id, customer_id, customer_name, customer_phone,
        customer_idcard, phone_brand, phone_model, phone_color, phone_memory,
        serial_number, imei1, imei2, sale_price, sale_time, store_id,
        store_name, salesman_id, salesman_name, subsidy_amount, subsidy_rate,
        apply_time, apply_status, remarks, subsidy_photos,
        has_different_handler, handler_name, handler_phone, handler_idcard
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending', ?, ?, ?, ?, ?, ?)
    `, [
      data.sale_id,
      data.phone_id,
      data.customer_id,
      data.customer_name,
      data.customer_phone,
      data.customer_idcard || null,
      data.phone_brand,
      data.phone_model,
      data.phone_color,
      data.phone_memory,
      data.serial_number,
      data.imei1,
      data.imei2 || null,
      data.sale_price,
      data.sale_time,
      data.store_id || null,
      data.store_name || null,
      data.salesman_id || null,
      data.salesman_name || null,
      data.subsidy_amount,
      data.subsidy_rate,
      data.remarks || null,
      JSON.stringify(data.subsidy_photos),
      data.has_different_handler || false,
      data.handler_name,
      data.handler_phone,
      data.handler_idcard
    ])
    return result.insertId
  }
}

module.exports = SubsidyApplyRepository
