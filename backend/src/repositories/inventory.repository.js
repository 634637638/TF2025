'use strict'

const { getDatabase } = require('../config/database')
const { withConnection } = require('../core/db/connection')
const {
  COMPLETED_TRANSACTION_STATUSES,
  getEffectivePhoneStatusSql,
  isPhoneStatusAlias,
  normalizePhoneStatus
} = require('../utils/phone-status')

const buildInventoryFilters = (query = {}, { includeLegacyDate = false } = {}) => {
  const {
    store_id, supplier_id, operator_id, status, search, brand, model,
    color, memory, is_new, date, date_start, date_end
  } = query
  const effectiveStatusSql = getEffectivePhoneStatusSql('p')
  const whereConditions = [`COALESCE(p.status, '') NOT IN (${COMPLETED_TRANSACTION_STATUSES.map(() => '?').join(', ')})`]
  const queryParams = [...COMPLETED_TRANSACTION_STATUSES]

  if (store_id) {
    whereConditions.push('p.store_id = ?')
    queryParams.push(parseInt(store_id))
  }
  if (supplier_id) {
    whereConditions.push('p.supplier_id = ?')
    queryParams.push(parseInt(supplier_id))
  }
  if (operator_id) {
    whereConditions.push('p.inventory_operator_id = ?')
    queryParams.push(parseInt(operator_id))
  }
  if (status) {
    whereConditions.push(`${effectiveStatusSql} = ?`)
    queryParams.push(normalizePhoneStatus(status))
  }
  if (brand) {
    whereConditions.push('b.name = ?')
    queryParams.push(brand)
  }
  if (model) {
    whereConditions.push('m.name = ?')
    queryParams.push(model)
  }
  if (color) {
    whereConditions.push('co.name = ?')
    queryParams.push(color)
  }
  if (memory) {
    whereConditions.push('mem.size = ?')
    queryParams.push(memory)
  }
  if (is_new !== undefined && is_new !== null && is_new !== '') {
    const isNewValue = is_new === 'true' || is_new === true || is_new === '1'
    whereConditions.push('p.is_new = ?')
    queryParams.push(isNewValue ? 1 : 0)
  }

  if (includeLegacyDate && date) {
    if (date.includes(' - ')) {
      const [startDate, endDate] = date.split(' - ').map(value => value.trim())
      if (startDate) {
        whereConditions.push('DATE(p.inventory_time) >= ?')
        queryParams.push(startDate)
      }
      if (endDate) {
        whereConditions.push('DATE(p.inventory_time) <= ?')
        queryParams.push(endDate)
      }
    } else if (date.includes('-')) {
      whereConditions.push('DATE(p.inventory_time) = ?')
      queryParams.push(date)
    }
  } else if (date_start || date_end) {
    if (date_start && date_end) {
      whereConditions.push('DATE(p.inventory_time) BETWEEN ? AND ?')
      queryParams.push(date_start, date_end)
    } else if (date_start) {
      whereConditions.push('DATE(p.inventory_time) >= ?')
      queryParams.push(date_start)
    } else {
      whereConditions.push('DATE(p.inventory_time) <= ?')
      queryParams.push(date_end)
    }
  }

  if (search) {
    const searchStr = search.trim()
    if (/^\d{15}$/.test(searchStr)) {
      whereConditions.push('p.imei = ?')
      queryParams.push(searchStr)
    } else if (/^[A-Za-z0-9]{8,}$/.test(searchStr)) {
      whereConditions.push('UPPER(p.serial_number) LIKE ?')
      queryParams.push(`%${searchStr.toUpperCase()}%`)
    } else if (/^(\d+[Gg][Bb]|1[Tt][Bb])$/.test(searchStr)) {
      whereConditions.push('UPPER(mem.size) LIKE ?')
      queryParams.push(`%${searchStr.toUpperCase()}%`)
    } else if (isPhoneStatusAlias(searchStr)) {
      whereConditions.push(`${effectiveStatusSql} = ?`)
      queryParams.push(normalizePhoneStatus(searchStr))
    } else if (['new', 'used', '全新', '二手'].includes(searchStr.toLowerCase())) {
      whereConditions.push('p.is_new = ?')
      queryParams.push(['new', '全新'].includes(searchStr.toLowerCase()) ? 1 : 0)
    } else if (/^[A-C]$/.test(searchStr.toUpperCase())) {
      whereConditions.push('UPPER(p.quality_grade) = ?')
      queryParams.push(searchStr.toUpperCase())
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(searchStr)) {
      whereConditions.push('(DATE(p.inventory_time) = ? OR DATE(p.sale_time) = ?)')
      queryParams.push(searchStr, searchStr)
    } else if (/^\d+$/.test(searchStr)) {
      whereConditions.push(`(
        p.imei LIKE ? OR p.serial_number LIKE ? OR p.purchase_number LIKE ? OR
        b.name LIKE ? OR m.name LIKE ? OR co.name LIKE ? OR mem.size LIKE ? OR
        p.sale_price = ? OR p.purchase_cost = ? OR CAST(p.id AS CHAR) LIKE ?
      )`)
      const searchTerm = `%${searchStr}%`
      const price = parseFloat(searchStr)
      queryParams.push(...Array(7).fill(searchTerm), price, price, searchTerm)
    } else {
      whereConditions.push(`(
        p.imei LIKE ? OR p.serial_number LIKE ? OR b.name LIKE ? OR m.name LIKE ? OR
        co.name LIKE ? OR mem.size LIKE ? OR p.status LIKE ? OR p.quality_grade LIKE ? OR
        p.remarks LIKE ? OR st.name LIKE ? OR s.name LIKE ? OR p.purchase_number LIKE ?
      )`)
      queryParams.push(...Array(12).fill(`%${searchStr}%`))
    }
  }

  return {
    whereConditions,
    whereClause: `WHERE ${whereConditions.join(' AND ')}`,
    queryParams
  }
}

class InventoryRepository {
  constructor({ database = getDatabase } = {}) {
    this.database = database
  }

  withConnection(operation) {
    return withConnection(this.database, operation)
  }

  listFilters(query, options) {
    return buildInventoryFilters(query, options)
  }

  async list(connection, { whereClause, queryParams, limit, offset }) {
    const effectiveStatusSql = getEffectivePhoneStatusSql('p')
    const joins = `
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN colors co ON p.color_id = co.id
      LEFT JOIN memories mem ON p.memory_id = mem.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN stores st ON p.store_id = st.id
    `
    const [rows] = await connection.execute(`
      SELECT p.id, p.imei, p.serial_number, m.name AS model, b.name AS brand,
        co.name AS color, mem.size AS memory, p.quality_grade AS phone_condition,
        p.purchase_cost, p.sale_price, p.store_id, p.supplier_id,
        ${effectiveStatusSql} AS status, p.is_new, p.is_preordered,
        p.inventory_time AS inventory_time, p.sale_time AS sale_time, p.remarks,
        s.name AS supplier_name, st.name AS store_name,
        p.purchase_number AS purchase_number, p.inventory_operator_id,
        inv_op.name AS inventory_operator_name, preorder.id AS preorder_id,
        preorder.customer_id AS preorder_customer_id,
        preorder_customer.name AS preorder_customer_name,
        preorder_customer.phone AS preorder_customer_phone,
        preorder.deposit_amount AS preorder_deposit_amount,
        preorder.total_price AS preorder_total_price,
        preorder.actual_price AS preorder_actual_price
      FROM phones p
      ${joins}
      LEFT JOIN users inv_op ON p.inventory_operator_id = inv_op.id
      LEFT JOIN preorders preorder ON preorder.matched_phone_id = p.id AND preorder.status = 'arrived'
      LEFT JOIN customers preorder_customer ON preorder_customer.id = preorder.customer_id
      ${whereClause}
      ORDER BY p.inventory_time DESC
      LIMIT ${limit} OFFSET ${offset}
    `, queryParams)
    const [countRows] = await connection.execute(`SELECT COUNT(*) AS total FROM phones p ${joins} ${whereClause}`, queryParams)
    return { rows, total: countRows[0].total }
  }

  async detail(connection, id) {
    const [rows] = await connection.execute(`
      SELECT
        p.id, p.brand_id, p.model_id, p.color_id, p.memory_id,
        p.imei, p.serial_number, p.purchase_cost, p.sale_price,
        p.supplier_id, p.store_id, p.inventory_time, p.sale_time,
        p.quality_grade, p.remarks AS purchase_remarks, p.is_new, p.status, p.is_preordered,
        b.name AS brand, m.name AS model, co.name AS color, mem.size AS memory,
        s.name AS supplier_name, st.name AS store_name, u.username AS operator_name
      FROM phones p
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN colors co ON p.color_id = co.id
      LEFT JOIN memories mem ON p.memory_id = mem.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN stores st ON p.store_id = st.id
      LEFT JOIN users u ON p.inventory_operator_id = u.id
      WHERE p.id = ?
    `, [id])
    return rows[0] || null
  }

  async findForRemoval(connection, id) {
    const [rows] = await connection.execute(
      'SELECT id, imei, status, is_preordered FROM phones WHERE id = ?',
      [id]
    )
    return rows[0] || null
  }

  async relatedCounts(connection, id) {
    const [rentals] = await connection.execute('SELECT COUNT(*) as count FROM rentals WHERE phone_id = ?', [id])
    const [sales] = await connection.execute('SELECT COUNT(*) as count FROM sales WHERE phone_id = ?', [id])
    const [repairs] = await connection.execute('SELECT COUNT(*) as count FROM repairs WHERE phone_id = ?', [id])
    return { rental: rentals[0].count, sale: sales[0].count, repair: repairs[0].count }
  }

  async deletePhone(connection, id) {
    const [result] = await connection.execute('DELETE FROM phones WHERE id = ?', [id])
    return result.affectedRows
  }

  async findForUpdate(connection, id) {
    const [rows] = await connection.execute(
      'SELECT id, imei, status, is_preordered FROM phones WHERE id = ?',
      [id]
    )
    return rows[0] || null
  }

  async phoneImeiExists(connection, imei, excludeId) {
    const [rows] = await connection.execute(
      'SELECT id FROM phones WHERE imei = ? AND id != ?',
      [imei, excludeId]
    )
    return rows.length > 0
  }

  async referenceExists(connection, table, id) {
    const allowedTables = new Set(['suppliers', 'stores'])
    if (!allowedTables.has(table)) throw new TypeError('Unsupported inventory reference table')
    const [rows] = await connection.execute(`SELECT id FROM ${table} WHERE id = ?`, [id])
    return rows.length > 0
  }

  async updatePhone(connection, id, values) {
    const updateFields = []
    const updateValues = []
    for (const [field, value] of Object.entries(values)) {
      if (value === undefined || value === null) continue
      if (field === 'is_new') {
        updateFields.push('quality_grade = ?', 'is_new = ?')
        updateValues.push(value === 1 ? 'A' : 'B', value)
      } else {
        updateFields.push(`${field} = ?`)
        updateValues.push(value)
      }
    }
    if (updateFields.length === 0) return { affectedRows: null, query: null, params: [] }
    updateValues.push(id)
    const query = `UPDATE phones SET ${updateFields.join(', ')} WHERE id = ?`
    const [result] = await connection.execute(query, updateValues)
    return { affectedRows: result.affectedRows, query, params: updateValues }
  }

  async updatedPhone(connection, id) {
    const [rows] = await connection.execute(
      'SELECT id, imei, serial_number, purchase_cost, quality_grade, inventory_time, sale_time FROM phones WHERE id = ?',
      [id]
    )
    return rows[0] || null
  }

  async overview(connection, { whereClause, queryParams }) {
    const joins = `
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN colors co ON p.color_id = co.id
      LEFT JOIN memories mem ON p.memory_id = mem.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN stores st ON p.store_id = st.id
    `
    const [stats] = await connection.execute(`
      SELECT COUNT(*) AS total,
        COUNT(CASE WHEN p.is_new = 1 THEN 1 END) AS new_count,
        COUNT(CASE WHEN p.is_new = 0 THEN 1 END) AS used_count,
        COALESCE(SUM(p.purchase_cost), 0) AS total_value
      FROM phones p ${joins} ${whereClause}
    `, queryParams)
    const [stores] = await connection.execute(`
      SELECT st.name AS store_name, COUNT(*) AS count
      FROM phones p ${joins} ${whereClause}
      GROUP BY p.store_id, st.name ORDER BY count DESC
    `, queryParams)
    const [brands] = await connection.execute(`
      SELECT b.name AS brand_name, COUNT(*) AS count
      FROM phones p ${joins} ${whereClause}
      GROUP BY b.name ORDER BY count DESC LIMIT 10
    `, queryParams)
    return { stats: stats[0], stores, brands }
  }

  async stats(connection) {
    const completedStatusSql = `COALESCE(status, '') NOT IN (${COMPLETED_TRANSACTION_STATUSES.map(() => '?').join(', ')})`
    const [total] = await connection.execute(`SELECT COUNT(*) AS total FROM phones WHERE ${completedStatusSql}`, COMPLETED_TRANSACTION_STATUSES)
    const [inStock] = await connection.execute(`SELECT COUNT(*) AS inStock FROM phones WHERE ${completedStatusSql} AND is_new = 1`, COMPLETED_TRANSACTION_STATUSES)
    const [sold] = await connection.execute(`SELECT COUNT(*) AS sold FROM phones WHERE ${completedStatusSql} AND is_new = 0`, COMPLETED_TRANSACTION_STATUSES)
    const [value] = await connection.execute(`SELECT COALESCE(SUM(purchase_cost), 0) AS totalValue FROM phones WHERE ${completedStatusSql}`, COMPLETED_TRANSACTION_STATUSES)
    return { total: total[0].total, inStock: inStock[0].inStock, sold: sold[0].sold, totalValue: value[0].totalValue }
  }

  async validateQuickSaleReferences(connection, { brandId, modelId, colorId, memoryId }) {
    const [[brands], [models], [colors], [memories]] = await Promise.all([
      connection.execute('SELECT id FROM brands WHERE id = ? AND status = 1', [brandId]),
      connection.execute('SELECT id FROM models WHERE id = ? AND brand_id = ? AND status = 1', [modelId, brandId]),
      connection.execute('SELECT id FROM colors WHERE id = ? AND status = 1', [colorId]),
      connection.execute('SELECT id FROM memories WHERE id = ? AND status = 1', [memoryId])
    ])
    return Boolean(brands.length && models.length && colors.length && memories.length)
  }

  async findCustomer(connection, phone) {
    const [rows] = await connection.execute('SELECT id FROM customers WHERE phone = ?', [phone])
    return rows[0] || null
  }

  updateCustomer(connection, { name, appleId, customerId }) {
    return connection.execute(
      'UPDATE customers SET name = COALESCE(NULLIF(?, \'\'), name), apple_id = COALESCE(?, apple_id) WHERE id = ?',
      [name, appleId, customerId]
    )
  }

  async createCustomer(connection, { name, phone, appleId, memberNumber }) {
    const [result] = await connection.execute(
      'INSERT INTO customers (name, phone, apple_id, member_number, created_at) VALUES (?, ?, ?, ?, NOW())',
      [name, phone, appleId, memberNumber]
    )
    return result.insertId
  }

  async hasCustomerPhoneDuplicate(connection, { imei, customerId }) {
    const [rows] = await connection.execute(
      `SELECT p.id, p.imei, s.customer_id FROM phones p
       LEFT JOIN sales s ON p.id = s.phone_id
       WHERE p.imei = ? AND s.customer_id = ?`,
      [imei, customerId]
    )
    return rows.length > 0
  }

  async quickSaleImeiExists(connection, imei) {
    const [rows] = await connection.execute('SELECT id FROM phones WHERE imei = ?', [imei])
    return rows.length > 0
  }

  async createQuickSalePhone(connection, values) {
    const [result] = await connection.execute(`
      INSERT INTO phones (
        purchase_number, inventory_operator_id, brand_id, model_id, color_id, memory_id,
        imei, serial_number, purchase_cost, sale_price, is_new, supplier_id, store_id, status,
        quality_grade, remarks, inventory_time, sale_time, sale_operator_id, payment_method
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, values)
    return result.insertId
  }

  async createQuickSale(connection, values) {
    const [result] = await connection.execute(`
      INSERT INTO sales (
        phone_id, customer_id, sale_type, operator_id, store_id,
        sale_price, purchase_cost, payment_method, payment_channel, invoice_number, sale_time, remarks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, values)
    return result.insertId
  }

  updateQuickSalePhone(connection, values) {
    return connection.execute('UPDATE phones SET sale_id = ?, wholesale_date = ?, wholesale_price = ? WHERE id = ?', values)
  }

  createQuickSalePayment(connection, values) {
    return connection.execute(`
      INSERT INTO payment_records (
        order_id, customer_id, payment_method, payment_channel,
        amount, payment_status, payment_time, remarks
      ) VALUES (?, ?, ?, ?, ?, 'success', ?, ?)
    `, values)
  }
}

module.exports = InventoryRepository
