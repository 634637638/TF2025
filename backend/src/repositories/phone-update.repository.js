'use strict'

const { getDatabase } = require('../config/database')
const { withConnection } = require('../core/db/connection')

class PhoneUpdateRepository {
  constructor({ database = getDatabase } = {}) {
    this.database = database
  }

  withConnection(operation) {
    return withConnection(this.database, operation)
  }

  async getPhoneForUpdate(connection, id) {
    const [rows] = await connection.execute(`
      SELECT id, status, brand_id, model_id, color_id, memory_id, store_id,
             imei, serial_number, purchase_cost, sale_price, is_new,
             supplier_id, inventory_operator_id, sale_operator_id,
             inventory_time, sale_time, remarks
      FROM phones WHERE id = ?
    `, [id])
    return rows[0] || null
  }

  async findDuplicateImei(connection, imei, phoneId) {
    const [rows] = await connection.execute(`
      SELECT p.id, s.customer_id
      FROM phones p
      LEFT JOIN sales s ON p.id = s.phone_id
      WHERE p.imei = ? AND p.id != ?
    `, [imei, phoneId])
    return rows
  }

  async getPhoneOperatorIds(connection, phoneId) {
    const [rows] = await connection.execute(
      'SELECT inventory_operator_id, sale_operator_id FROM phones WHERE id = ?',
      [phoneId]
    )
    return rows[0] || null
  }

  async lockPhoneStatus(connection, phoneId) {
    const [rows] = await connection.execute(
      'SELECT status FROM phones WHERE id = ? FOR UPDATE',
      [phoneId]
    )
    return rows[0]?.status || null
  }

  async updatePhone(connection, fields, values, phoneId) {
    await connection.execute(`UPDATE phones SET ${fields.join(', ')} WHERE id = ?`, [...values, phoneId])
  }

  async findCustomerPhone(connection, customerId) {
    const [rows] = await connection.execute('SELECT phone FROM customers WHERE id = ?', [customerId])
    return rows[0]?.phone || null
  }

  async findCustomerByPhone(connection, phone) {
    const [rows] = await connection.execute(
      'SELECT id, name FROM customers WHERE phone = ? ORDER BY id DESC LIMIT 1',
      [phone]
    )
    return rows[0] || null
  }

  async findActiveCustomerByPhone(connection, phone) {
    const [rows] = await connection.execute(
      'SELECT id, name FROM customers WHERE phone = ? AND status = 1',
      [phone]
    )
    return rows[0] || null
  }

  async updateCustomer(connection, fields, values, customerId) {
    await connection.execute(
      `UPDATE customers SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      [...values, customerId]
    )
  }

  async updateCustomerName(connection, name, customerId) {
    await connection.execute(
      'UPDATE customers SET name = ?, updated_at = NOW() WHERE id = ?',
      [name, customerId]
    )
  }

  async createCustomer(connection, { name, phone, memberNumber }) {
    const [result] = await connection.execute(
      'INSERT INTO customers (name, phone, member_number, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
      [name, phone, memberNumber]
    )
    return result.insertId
  }

  async updateCustomerAppleId(connection, appleId, customerId) {
    await connection.execute(
      'UPDATE customers SET apple_id = ?, updated_at = NOW() WHERE id = ?',
      [appleId, customerId]
    )
  }

  async findLatestSaleByPhone(connection, phoneId) {
    const [rows] = await connection.execute(
      `SELECT id, customer_id, operator_id, sale_time, store_id, remarks,
              invoice_number, sale_price, purchase_cost, sale_type,
              payment_method, payment_channel
       FROM sales WHERE phone_id = ? ORDER BY created_at DESC LIMIT 1`,
      [phoneId]
    )
    return rows[0] || null
  }

  async syncCompletedPreorderOperator(connection, { operatorId, saleId, phoneId }) {
    await connection.execute(`
      UPDATE preorders
      SET operator_id = ?, sale_id = ?, updated_at = NOW()
      WHERE matched_phone_id = ? AND status = 'completed'
    `, [operatorId, saleId, phoneId])
  }

  async createSale(connection, values) {
    const [result] = await connection.execute(`
      INSERT INTO sales (
        phone_id, customer_id, sale_type, operator_id, store_id,
        sale_price, purchase_cost, payment_method, payment_channel,
        sale_time, invoice_number, remarks, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [values.phoneId, values.customerId, values.saleType, values.operatorId,
      values.storeId, values.salePrice, values.purchaseCost, values.paymentMethod,
      values.paymentChannel, values.saleTime,
      values.invoiceNumber, values.remarks])
    return result.insertId
  }

  async updateSale(connection, fields, values, saleId) {
    const [result] = await connection.execute(
      `UPDATE sales SET ${fields.join(', ')} WHERE id = ?`,
      [...values, saleId]
    )
    return result
  }

  async linkPhoneSale(connection, { saleId, operatorId, phoneId }) {
    await connection.execute(
      'UPDATE phones SET sale_id = ?, sale_operator_id = ? WHERE id = ?',
      [saleId, operatorId, phoneId]
    )
  }

  async getUpdatedPhone(connection, phoneId) {
    const [rows] = await connection.execute(`
      SELECT p.id, p.imei, p.serial_number, p.brand_id, p.model_id, p.color_id, p.memory_id,
             p.sale_price, p.purchase_cost, p.is_new, p.status, p.quality_grade, p.remarks,
             p.purchase_number, p.inventory_operator_id, p.sale_operator_id, p.supplier_id,
             p.store_id, p.inventory_time, p.sale_time, s.name AS supplier_name,
             st.name AS store_name, su.name AS sale_operator_name,
             inv_u.name AS inventory_operator_name, latest_sale.customer_id,
             c.name AS customer_name, c.phone AS customer_phone, c.apple_id AS customer_apple_id
      FROM phones p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN stores st ON p.store_id = st.id
      LEFT JOIN users su ON p.sale_operator_id = su.id
      LEFT JOIN users inv_u ON p.inventory_operator_id = inv_u.id
      LEFT JOIN (
        SELECT s.customer_id, s.phone_id,
               ROW_NUMBER() OVER (PARTITION BY s.phone_id ORDER BY s.created_at DESC) AS rn
        FROM sales s
      ) latest_sale ON p.id = latest_sale.phone_id AND latest_sale.rn = 1
      LEFT JOIN customers c ON latest_sale.customer_id = c.id
      WHERE p.id = ?
    `, [phoneId])
    return rows[0] || null
  }

  async findOldestMatchingPreorder(connection, { brandId, modelId, colorId, memoryId, isNew }) {
    const [rows] = await connection.execute(`
      SELECT p.id, p.preorder_number, p.customer_id, c.name AS customer_name,
             c.phone AS customer_phone, p.brand_id, p.model_id, p.color_id,
             p.memory_id, p.total_price, p.deposit_amount
      FROM preorders p
      LEFT JOIN customers c ON c.id = p.customer_id
      WHERE p.status = 'pending' AND p.brand_id = ? AND p.model_id = ?
        AND p.color_id = ? AND p.memory_id = ? AND p.is_new = ?
      ORDER BY p.created_at ASC LIMIT 1
    `, [brandId, modelId, colorId, memoryId, isNew])
    return rows[0] || null
  }

  async matchPreorderToPhone(connection, { phoneId, imei, brandId, modelId, preorderId }) {
    await connection.execute(`
      UPDATE preorders SET
        status = 'arrived', matched_phone_id = ?, imei = ?,
        actual_model = (SELECT CONCAT(b.name, ' ', m.name) FROM brands b, models m WHERE b.id = ? AND m.id = ?),
        matched_time = NOW(), updated_at = NOW()
      WHERE id = ?
    `, [phoneId, imei, brandId, modelId, preorderId])
  }

  async markPhonePreordered(connection, phoneId) {
    await connection.execute('UPDATE phones SET is_preordered = 1, updated_at = NOW() WHERE id = ?', [phoneId])
  }

  async getManagedMedia(connection, phoneId) {
    const [rows] = await connection.query(`
      SELECT id, image_url FROM H5_images
      WHERE phone_id = ?
        AND (image_url LIKE '%/uploads/phones/%' OR image_url LIKE '%/uploads/videos/%')
    `, [phoneId])
    return rows
  }

  async updateMediaUrl(connection, { url, imageId, phoneId }) {
    await connection.query(
      'UPDATE H5_images SET image_url = ? WHERE id = ? AND phone_id = ?',
      [url, imageId, phoneId]
    )
  }
}

module.exports = PhoneUpdateRepository
