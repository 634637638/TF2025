'use strict'

const { getDatabase } = require('../config/database')
const { PREORDER_CORE_FIELDS, PREORDER_STATUS } = require('../config/preorder-response.constants')
const { withConnection } = require('../core/db/connection')

const EDITABLE_PREORDER_COLUMNS = Object.freeze({
  customer_id: 'customer_id',
  store_id: 'store_id',
  created_by: 'created_by',
  brand_id: 'brand_id',
  model_id: 'model_id',
  color_id: 'color_id',
  memory_id: 'memory_id',
  is_new: 'is_new',
  expected_arrival: 'expected_arrival',
  total_price: 'total_price',
  deposit_amount: 'deposit_amount',
  remarks: 'remarks'
})

class PreorderMutationRepository {
  constructor({ database = getDatabase } = {}) {
    this.database = database
  }

  async getStatus(id) {
    const [records] = await this.database().execute(
      'SELECT status FROM preorders WHERE id = ?',
      [id]
    )
    return records[0]?.status || null
  }

  async deleteById(id) {
    const [result] = await this.database().execute('DELETE FROM preorders WHERE id = ?', [id])
    return result.affectedRows === 1
  }

  async withConnection(callback) {
    return withConnection(this.database, callback)
  }

  async getForUpdate(connection, id) {
    const [records] = await connection.execute(
      `SELECT ${PREORDER_CORE_FIELDS.join(', ')} FROM preorders WHERE id = ? FOR UPDATE`,
      [id]
    )
    return records[0] || null
  }

  async getEditablePreorderById(connection, id) {
    const [records] = await connection.execute(
      `SELECT ${PREORDER_CORE_FIELDS.join(', ')} FROM preorders WHERE id = ?`,
      [id]
    )
    return records[0] || null
  }

  async releaseMatchedPhone(connection, phoneId, preorderId) {
    const [result] = await connection.execute(`
      UPDATE phones
      SET status = 'in_stock', is_preordered = 0
      WHERE id = ?
        AND status IN ('in_stock', 'reserved')
        AND NOT EXISTS (
          SELECT 1
          FROM preorders active_preorder
          WHERE active_preorder.matched_phone_id = phones.id
            AND active_preorder.status IN ('pending', 'arrived')
            AND active_preorder.id <> ?
        )
    `, [phoneId, preorderId])
    return result.affectedRows === 1
  }

  async updateEditablePreorder(connection, id, updates, clearMatch) {
    const entries = Object.entries(updates)
      .filter(([field]) => Object.hasOwn(EDITABLE_PREORDER_COLUMNS, field))
      .map(([field, value]) => [EDITABLE_PREORDER_COLUMNS[field], value])
    const assignments = entries.map(([field]) => `${field} = ?`)
    const values = entries.map(([, value]) => value)

    if (clearMatch) {
      assignments.push('status = ?', 'matched_phone_id = NULL', 'imei = NULL', 'matched_time = NULL', 'arrival_date = NULL', 'actual_model = NULL', 'actual_price = NULL')
      values.push(PREORDER_STATUS.PENDING)
    }

    assignments.push('updated_at = NOW()')
    values.push(id)
    await connection.execute(`UPDATE preorders SET ${assignments.join(', ')} WHERE id = ?`, values)
  }

  async markCancelled(connection, id, reason) {
    await connection.execute(`
      UPDATE preorders SET
        status = 'cancelled',
        matched_phone_id = NULL,
        imei = NULL,
        matched_time = NULL,
        arrival_date = NULL,
        actual_model = NULL,
        actual_price = NULL,
        cancelled_at = NOW(),
        cancel_reason = ?,
        updated_at = NOW()
      WHERE id = ?
    `, [reason || null, id])
  }

  async getForRestore(connection, id) {
    const [records] = await connection.execute(
      `SELECT id, status, matched_phone_id, brand_id, model_id, color_id, memory_id, is_new
       FROM preorders WHERE id = ? FOR UPDATE`,
      [id]
    )
    return records[0] || null
  }

  async findRestoreCandidate(connection, preorder) {
    const [records] = await connection.execute(`
      SELECT p.id, p.imei, b.name AS brand_name, m.name AS model_name
      FROM phones p
      LEFT JOIN brands b ON b.id = p.brand_id
      LEFT JOIN models m ON m.id = p.model_id
      WHERE p.status IN ('in_stock', 'reserved')
        AND COALESCE(p.is_preordered, 0) = 0
        AND NOT EXISTS (
          SELECT 1 FROM preorders active_preorder
          WHERE active_preorder.matched_phone_id = p.id
            AND active_preorder.status IN ('pending', 'arrived')
        )
        AND p.brand_id = ?
        AND p.model_id = ?
        AND p.color_id = ?
        AND p.memory_id = ?
        AND p.is_new = ?
      ORDER BY p.inventory_time ASC, p.id ASC
      LIMIT 1
      FOR UPDATE
    `, [
      preorder.brand_id,
      preorder.model_id,
      preorder.color_id,
      preorder.memory_id,
      Number(preorder.is_new) === 0 ? 0 : 1
    ])
    return records[0] || null
  }

  async reserveRestoreCandidate(connection, phoneId) {
    const [result] = await connection.execute(`
      UPDATE phones
      SET status = 'in_stock', is_preordered = 1
      WHERE id = ?
        AND status IN ('in_stock', 'reserved')
        AND COALESCE(is_preordered, 0) = 0
    `, [phoneId])
    return result.affectedRows === 1
  }

  async restorePreorder(connection, id, matchedPhone) {
    const [result] = await connection.execute(`
      UPDATE preorders SET
        status = ?,
        matched_phone_id = ?,
        imei = ?,
        matched_time = CASE WHEN ? IS NULL THEN NULL ELSE NOW() END,
        arrival_date = CASE WHEN ? IS NULL THEN NULL ELSE CURDATE() END,
        actual_model = ?,
        actual_price = NULL,
        cancelled_at = NULL,
        cancel_reason = NULL,
        updated_at = NOW()
      WHERE id = ?
    `, [
      matchedPhone ? PREORDER_STATUS.MATCHED : PREORDER_STATUS.PENDING,
      matchedPhone?.id || null,
      matchedPhone?.imei || null,
      matchedPhone?.id || null,
      matchedPhone?.id || null,
      matchedPhone ? [matchedPhone.brand_name, matchedPhone.model_name].filter(Boolean).join(' ') : null,
      id
    ])
    return result.affectedRows === 1
  }

  async getForMatching(connection, id) {
    const [records] = await connection.execute(
      `SELECT ${PREORDER_CORE_FIELDS.join(', ')} FROM preorders WHERE id = ? FOR UPDATE`,
      [id]
    )
    return records[0] || null
  }

  async getPhoneForMatching(connection, phoneId, imei) {
    const predicate = phoneId ? 'p.id = ?' : 'p.imei = ?'
    const [records] = await connection.execute(`
      SELECT p.id, p.imei, p.brand_id, p.model_id, p.color_id, p.memory_id,
             p.is_new, p.status, p.is_preordered, p.sale_price, p.purchase_cost,
             b.name AS brand_name, m.name AS model_name
      FROM phones p
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN models m ON p.model_id = m.id
      WHERE ${predicate}
      FOR UPDATE
    `, [phoneId || String(imei).trim()])
    return records[0] || null
  }

  async hasOtherActivePreorder(connection, phoneId, preorderId) {
    const [records] = await connection.execute(`
      SELECT id FROM preorders
      WHERE matched_phone_id = ?
        AND status IN ('pending', 'arrived')
        AND id <> ?
      LIMIT 1
      FOR UPDATE
    `, [phoneId, preorderId])
    return records.length > 0
  }

  async getPreviousPhoneForMatching(connection, phoneId) {
    const [records] = await connection.execute(
      'SELECT id, status, is_preordered FROM phones WHERE id = ? FOR UPDATE',
      [phoneId]
    )
    return records[0] || null
  }

  async releasePreviousPhone(connection, phoneId) {
    const [result] = await connection.execute(`
      UPDATE phones
      SET is_preordered = 0
      WHERE id = ?
        AND status IN ('in_stock', 'reserved')
        AND COALESCE(is_preordered, 0) = 1
    `, [phoneId])
    return result.affectedRows === 1
  }

  async updateMatchedPreorder(connection, { id, phone, model, arrivalDate, price }) {
    await connection.execute(`
      UPDATE preorders SET
        status = ?,
        matched_phone_id = ?,
        imei = ?,
        actual_model = ?,
        arrival_date = COALESCE(?, CURDATE()),
        actual_price = ?,
        matched_time = NOW(),
        updated_at = NOW()
      WHERE id = ?
    `, [PREORDER_STATUS.MATCHED, phone.id, phone.imei, model || null, arrivalDate || null, price, id])
  }

  async reserveMatchedPhone(connection, phoneId) {
    const [result] = await connection.execute(`
      UPDATE phones
      SET is_preordered = 1
      WHERE id = ?
        AND status IN ('in_stock', 'reserved')
        AND (COALESCE(is_preordered, 0) = 0 OR id = ?)
    `, [phoneId, phoneId])
    return result.affectedRows === 1
  }

  async hasCustomer(connection, customerId) {
    const [records] = await connection.execute('SELECT id FROM customers WHERE id = ?', [customerId])
    return records.length > 0
  }

  async hasReference(connection, table, id) {
    const columns = {
      brands: 'id, name',
      models: 'id, name',
      colors: 'id, name',
      memories: 'id, size'
    }
    const selection = columns[table]
    if (!selection) throw new Error('Unsupported preorder reference table')
    const [records] = await connection.execute(`SELECT ${selection} FROM ${table} WHERE id = ?`, [id])
    return records.length > 0
  }

  async hasActiveUser(connection, userId) {
    const [records] = await connection.execute(
      'SELECT id FROM users WHERE id = ? AND status = 1',
      [userId]
    )
    return records.length > 0
  }

  async findAutoMatchCandidate(connection, { brand_id, model_id, color_id, memory_id, is_new }) {
    const [records] = await connection.execute(`
      SELECT id, imei, purchase_cost, store_id
      FROM phones
      WHERE brand_id = ?
        AND model_id = ?
        AND color_id = ?
        AND memory_id = ?
        AND is_new = ?
        AND status IN ('in_stock', 'reserved')
        AND COALESCE(is_preordered, 0) = 0
        AND NOT EXISTS (
          SELECT 1 FROM preorders active_preorder
          WHERE active_preorder.matched_phone_id = phones.id
            AND active_preorder.status IN ('pending', 'arrived')
        )
      ORDER BY id ASC
      LIMIT 1
      FOR UPDATE
    `, [brand_id, model_id, color_id, memory_id, is_new])
    return records[0] || null
  }

  async reserveAutoMatchPhone(connection, phoneId) {
    const [result] = await connection.execute(`
      UPDATE phones
      SET status = 'in_stock', is_preordered = 1
      WHERE id = ?
        AND status IN ('in_stock', 'reserved')
        AND COALESCE(is_preordered, 0) = 0
    `, [phoneId])
    return result.affectedRows === 1
  }

  async insertPreorder(connection, values) {
    const [result] = await connection.execute(`
      INSERT INTO preorders (
        preorder_number, customer_id, store_id,
        brand_id, model_id, color_id, memory_id, is_new,
        deposit_amount, deposit_paid, total_price, expected_arrival,
        status, remarks, operator_id, created_by, matched_phone_id, imei, matched_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      values.preorderNumber,
      values.customerId,
      values.storeId,
      values.brandId,
      values.modelId,
      values.colorId,
      values.memoryId,
      values.isNew,
      values.depositAmount,
      values.depositAmount,
      values.totalPrice,
      values.expectedArrival,
      values.status,
      values.remarks || null,
      null,
      values.createdBy,
      values.matchedPhone?.id || null,
      values.matchedPhone?.imei || null,
      values.matchedPhone ? new Date() : null
    ])
    return result.insertId
  }
}

module.exports = PreorderMutationRepository
