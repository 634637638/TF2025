'use strict'

const { getDatabase } = require('../config/database')
const { buildReferenceOrder } = require('../utils/reference-options')
const { withConnection } = require('../core/db/connection')
const { appendStoreScopeCondition } = require('../utils/store-scope')

const COLUMNS = [
  'id', 'name', 'contact', 'phone', 'address', 'bank_info', 'tax_number', 'business_scope',
  'status', 'remarks', 'created_at', 'updated_at', 'sort_order'
].join(', ')
const SORT_COLUMNS = ['id', 'name', 'status', 'sort_order', 'created_at', 'updated_at']

function buildFilters({ name, status }) {
  const conditions = []
  const params = []
  if (name) { conditions.push('name LIKE ?'); params.push(`%${name}%`) }
  if (status !== null) { conditions.push('status = ?'); params.push(status) }
  return { where: conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '', params }
}

class SupplierManagementRepository {
  constructor({ database = getDatabase } = {}) { this.database = database }
  withConnection(operation) { return withConnection(this.database, operation) }

  list(filters, { all = false, page_size, offset, sort_by, sort_order } = {}) {
    const { where, params } = buildFilters(filters)
    const order = buildReferenceOrder({ sort_by, sort_order, allowed: SORT_COLUMNS, fallback: ['sort_order', 'name', 'id'] })
    const pagination = all ? '' : ` LIMIT ${page_size} OFFSET ${offset}`
    return this.database().execute(`SELECT ${COLUMNS} FROM suppliers${where} ORDER BY ${order}${pagination}`, params)
  }

  count(filters) {
    const { where, params } = buildFilters(filters)
    return this.database().execute(`SELECT COUNT(*) AS total FROM suppliers${where}`, params)
  }

  stats(filters) {
    const { where, params } = buildFilters(filters)
    return this.database().execute(`SELECT COUNT(*) AS total,
      SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) AS active,
      SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) AS inactive,
      SUM(CASE WHEN phone IS NOT NULL AND TRIM(phone) <> '' THEN 1 ELSE 0 END) AS phone_completion
      FROM suppliers${where}`, params)
  }

  exportRows(filters) {
    const { where, params } = buildFilters(filters)
    return this.database().execute(`SELECT ${COLUMNS} FROM suppliers${where} ORDER BY sort_order ASC, name ASC, id ASC`, params)
  }

  findDuplicate(name, exceptId) {
    return exceptId === undefined
      ? this.database().execute('SELECT id FROM suppliers WHERE name = ?', [name])
      : this.database().execute('SELECT id FROM suppliers WHERE name = ? AND id != ?', [name, exceptId])
  }

  create(values) {
    return this.database().execute(`INSERT INTO suppliers (
      name, contact, phone, address, bank_info, tax_number, business_scope, status, sort_order, remarks, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`, values)
  }

  update(values) {
    return this.database().execute(`UPDATE suppliers
      SET name = ?, contact = ?, phone = ?, address = ?, bank_info = ?,
          tax_number = ?, business_scope = ?, status = ?, sort_order = ?, remarks = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`, values)
  }

  countAccessories(id, executor = this.database()) { return executor.execute('SELECT COUNT(*) AS count FROM accessories WHERE supplier_id = ?', [id]) }
  async hasAccessoryHistory(id, executor = this.database()) {
    const [[row]] = await executor.execute(`SELECT
      EXISTS(SELECT 1 FROM accessory_stock_in WHERE supplier_id = ?) OR
      EXISTS(SELECT 1 FROM accessory_purchase_payments WHERE supplier_id = ?) AS has_history`, [id, id])
    return Number(row.has_history) === 1
  }
  countPhones(id, executor = this.database()) { return executor.execute('SELECT COUNT(*) AS count FROM phones WHERE supplier_id = ?', [id]) }
  remove(id, executor = this.database()) { return executor.execute('DELETE FROM suppliers WHERE id = ?', [id]) }
  findById(id, executor = this.database(), lock = false) { return executor.execute(`SELECT ${COLUMNS} FROM suppliers WHERE id = ?${lock ? ' FOR UPDATE' : ''}`, [id]) }
  phoneStats(id, scope, executor) {
    const conditions = ['supplier_id = ?'], params = [id]
    appendStoreScopeCondition(scope, 'store_id', conditions, params)
    return executor.execute(`SELECT COUNT(*) AS count, CASE WHEN COUNT(*) = COUNT(purchase_cost)
      THEN CAST(COALESCE(SUM(purchase_cost * 100), 0) AS DECIMAL(65, 0)) ELSE NULL END AS total_cents FROM phones WHERE ${conditions.join(' AND ')}`, params)
  }
}

module.exports = SupplierManagementRepository
