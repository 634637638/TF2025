const BaseRepository = require('./base.repository')

const SUPPLIER_SELECT_COLUMNS = `
  s.id, s.name, s.contact, s.phone, s.address, s.bank_info,
  s.tax_number, s.status, s.remarks, s.created_at, s.updated_at, s.sort_order
`
const SUPPLIER_SORT_COLUMNS = new Set(['id', 'name', 'status', 'sort_order', 'created_at', 'updated_at'])

const formatNullableString = value => {
  if (value === null || value === undefined) return null
  return String(value).trim()
}

const formatSupplier = row => ({
  id: Number(row.id),
  name: String(row.name || '').trim(),
  contact: formatNullableString(row.contact),
  phone: formatNullableString(row.phone),
  address: formatNullableString(row.address),
  bank_info: formatNullableString(row.bank_info),
  tax_number: formatNullableString(row.tax_number),
  status: Number(row.status) === 1 ? 1 : 0,
  remarks: formatNullableString(row.remarks),
  sort_order: Number(row.sort_order) || 0,
  created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
  updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null
})

class SupplierRepository extends BaseRepository {
  constructor() {
    super('suppliers')
  }

  async getSuppliersWithPagination(filters = {}, options = {}) {
    const { page = 1, page_size = 100, name, status } = filters
    const validPage = Math.max(Number.parseInt(page, 10) || 1, 1)
    const validPageSize = Math.min(Math.max(Number.parseInt(page_size, 10) || 100, 1), 10000)
    const offset = (validPage - 1) * validPageSize
    const conditions = []
    const params = []

    if (name) {
      conditions.push('s.name LIKE ?')
      params.push(`%${String(name).trim()}%`)
    }
    if (status !== undefined && status !== null && status !== '') {
      conditions.push('s.status = ?')
      params.push(Number(status))
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const sortColumn = SUPPLIER_SORT_COLUMNS.has(options.sort_by) ? options.sort_by : 'sort_order'
    const sortDirection = String(options.sort_order).toLowerCase() === 'desc' ? 'DESC' : 'ASC'
    const fallbackOrder = sortColumn === 'sort_order' ? ', s.name ASC, s.id ASC' : ', s.sort_order ASC, s.id ASC'
    const suppliers = await this.executeQuery(`
      SELECT ${SUPPLIER_SELECT_COLUMNS},
             COALESCE(a.accessory_count, 0) AS accessory_count,
             COALESCE(p.phone_count, 0) AS phone_count,
             COALESCE(a.total_cost, 0) AS accessory_total_cost,
             COALESCE(p.total_cost, 0) AS phone_total_cost,
             COALESCE(a.total_cost, 0) + COALESCE(p.total_cost, 0) AS total_cost
      FROM suppliers s
      LEFT JOIN (
        SELECT supplier_id, COUNT(*) AS accessory_count,
               COALESCE(SUM(purchase_cost), 0) AS total_cost
        FROM accessories
        GROUP BY supplier_id
      ) a ON a.supplier_id = s.id
      LEFT JOIN (
        SELECT supplier_id, COUNT(*) AS phone_count,
               COALESCE(SUM(purchase_cost), 0) AS total_cost
        FROM phones
        GROUP BY supplier_id
      ) p ON p.supplier_id = s.id
      ${whereClause}
      ORDER BY s.${sortColumn} ${sortDirection}${fallbackOrder}
      LIMIT ${validPageSize} OFFSET ${offset}
    `, params)
    const countRows = await this.executeQuery(
      `SELECT COUNT(*) AS total FROM suppliers s ${whereClause}`,
      params
    )
    const total = Number(countRows[0]?.total) || 0
    const total_pages = Math.ceil(total / validPageSize)

    return {
      suppliers: suppliers.map(row => ({
        ...formatSupplier(row),
        stats: {
          accessory_count: Number(row.accessory_count) || 0,
          phone_count: Number(row.phone_count) || 0,
          accessory_total_cost: Number(row.accessory_total_cost) || 0,
          phone_total_cost: Number(row.phone_total_cost) || 0,
          total_cost: Number(row.total_cost) || 0
        }
      })),
      pagination: {
        page: validPage,
        page_size: validPageSize,
        total,
        total_pages,
        has_next: validPage < total_pages,
        has_prev: validPage > 1
      }
    }
  }

  async getSupplierById(id) {
    const suppliers = await this.executeQuery(
      `SELECT ${SUPPLIER_SELECT_COLUMNS} FROM suppliers s WHERE s.id = ?`,
      [id]
    )
    if (suppliers.length === 0) return null

    const [accessoryStats, phoneStats] = await Promise.all([
      this.executeQuery(
        'SELECT COUNT(*) AS count, COALESCE(SUM(purchase_cost), 0) AS total_cost FROM accessories WHERE supplier_id = ?',
        [id]
      ),
      this.executeQuery(
        'SELECT COUNT(*) AS count, COALESCE(SUM(purchase_cost), 0) AS total_cost FROM phones WHERE supplier_id = ?',
        [id]
      )
    ])

    return {
      ...formatSupplier(suppliers[0]),
      stats: {
        accessories_count: Number(accessoryStats[0]?.count) || 0,
        accessories_total_cost: Number(accessoryStats[0]?.total_cost) || 0,
        phones_count: Number(phoneStats[0]?.count) || 0,
        phones_total_cost: Number(phoneStats[0]?.total_cost) || 0
      }
    }
  }

  async createSupplier(supplierData) {
    const {
      name, contact, phone, address, bank_info, tax_number,
      status = 1, sort_order = 0, remarks
    } = supplierData
    const [result] = await this.executeQuery(`
      INSERT INTO suppliers (
        name, contact, phone, address, bank_info, tax_number,
        status, sort_order, remarks, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
      name,
      contact || null,
      phone || null,
      address || null,
      bank_info || null,
      tax_number || null,
      Number(status),
      Number(sort_order),
      remarks || null
    ])
    return Number(result.insertId)
  }

  async updateSupplier(id, supplierData) {
    const {
      name, contact, phone, address, bank_info, tax_number,
      status, sort_order, remarks
    } = supplierData
    const [result] = await this.executeQuery(`
      UPDATE suppliers
      SET name = ?, contact = ?, phone = ?, address = ?, bank_info = ?,
          tax_number = ?, status = ?, sort_order = ?, remarks = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      name,
      contact || null,
      phone || null,
      address || null,
      bank_info || null,
      tax_number || null,
      Number(status),
      Number(sort_order),
      remarks || null,
      Number(id)
    ])
    return result.affectedRows > 0
  }

  async deleteSupplier(id) {
    const [accessories, phones] = await Promise.all([
      this.executeQuery('SELECT COUNT(*) AS count FROM accessories WHERE supplier_id = ?', [id]),
      this.executeQuery('SELECT COUNT(*) AS count FROM phones WHERE supplier_id = ?', [id])
    ])
    const accessory_count = Number(accessories[0]?.count) || 0
    const phone_count = Number(phones[0]?.count) || 0
    if (accessory_count > 0 || phone_count > 0) {
      return {
        can_delete: false,
        reason: '该供应商下还有关联的商品，无法删除',
        accessory_count,
        phone_count
      }
    }

    const [result] = await this.executeQuery('DELETE FROM suppliers WHERE id = ?', [id])
    return { can_delete: true, deleted: result.affectedRows > 0 }
  }

  async batchUpdateStatus(ids, status) {
    const placeholders = ids.map(() => '?').join(',')
    const [result] = await this.executeQuery(`
      UPDATE suppliers
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id IN (${placeholders})
    `, [Number(status), ...ids.map(Number)])
    return Number(result.affectedRows) || 0
  }

  async searchSuppliers(keyword, filters = {}) {
    const { page = 1, page_size = 20, status } = filters
    const validPage = Math.max(Number.parseInt(page, 10) || 1, 1)
    const validPageSize = Math.min(Math.max(Number.parseInt(page_size, 10) || 20, 1), 10000)
    const offset = (validPage - 1) * validPageSize
    const conditions = ['(s.name LIKE ? OR s.contact LIKE ? OR s.phone LIKE ? OR s.address LIKE ?)']
    const searchValue = `%${String(keyword).trim()}%`
    const params = [searchValue, searchValue, searchValue, searchValue]

    if (status !== undefined && status !== null && status !== '') {
      conditions.push('s.status = ?')
      params.push(Number(status))
    }
    const whereClause = conditions.join(' AND ')
    const suppliers = await this.executeQuery(`
      SELECT ${SUPPLIER_SELECT_COLUMNS},
             COALESCE(a.accessory_count, 0) AS accessory_count,
             COALESCE(p.phone_count, 0) AS phone_count
      FROM suppliers s
      LEFT JOIN (
        SELECT supplier_id, COUNT(*) AS accessory_count FROM accessories GROUP BY supplier_id
      ) a ON a.supplier_id = s.id
      LEFT JOIN (
        SELECT supplier_id, COUNT(*) AS phone_count FROM phones GROUP BY supplier_id
      ) p ON p.supplier_id = s.id
      WHERE ${whereClause}
      ORDER BY s.sort_order ASC, s.name ASC, s.id ASC
      LIMIT ${validPageSize} OFFSET ${offset}
    `, params)
    const countRows = await this.executeQuery(
      `SELECT COUNT(*) AS total FROM suppliers s WHERE ${whereClause}`,
      params
    )
    const total = Number(countRows[0]?.total) || 0
    const total_pages = Math.ceil(total / validPageSize)

    return {
      suppliers: suppliers.map(row => ({
        ...formatSupplier(row),
        stats: {
          accessory_count: Number(row.accessory_count) || 0,
          phone_count: Number(row.phone_count) || 0
        }
      })),
      pagination: {
        page: validPage,
        page_size: validPageSize,
        total,
        total_pages,
        has_next: validPage < total_pages,
        has_prev: validPage > 1
      }
    }
  }

  async checkNameAvailability(name, exclude_id = null) {
    let query = 'SELECT id FROM suppliers WHERE name = ?'
    const params = [name]
    if (exclude_id) {
      query += ' AND id != ?'
      params.push(Number(exclude_id))
    }
    const result = await this.executeQuery(query, params)
    return result.length === 0
  }

  async getSupplierStats() {
    const totalStats = await this.executeQuery(`
      SELECT COUNT(*) AS total_suppliers,
             SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) AS active_suppliers,
             SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) AS inactive_suppliers
      FROM suppliers
    `)
    const productStats = await this.executeQuery(`
      SELECT COUNT(DISTINCT s.id) AS suppliers_with_products
      FROM suppliers s
      LEFT JOIN accessories a ON a.supplier_id = s.id
      LEFT JOIN phones p ON p.supplier_id = s.id
      WHERE a.id IS NOT NULL OR p.id IS NOT NULL
    `)
    return {
      total_suppliers: Number(totalStats[0]?.total_suppliers) || 0,
      active_suppliers: Number(totalStats[0]?.active_suppliers) || 0,
      inactive_suppliers: Number(totalStats[0]?.inactive_suppliers) || 0,
      suppliers_with_products: Number(productStats[0]?.suppliers_with_products) || 0
    }
  }

  async getActiveSuppliers() {
    const suppliers = await this.executeQuery(`
      SELECT ${SUPPLIER_SELECT_COLUMNS}
      FROM suppliers s
      WHERE s.status = 1
      ORDER BY s.sort_order ASC, s.name ASC, s.id ASC
    `)
    return suppliers.map(formatSupplier)
  }

  async exportSuppliers(filters = {}) {
    const { name, status } = filters
    const conditions = []
    const params = []
    if (name) {
      conditions.push('s.name LIKE ?')
      params.push(`%${String(name).trim()}%`)
    }
    if (status !== undefined && status !== null && status !== '') {
      conditions.push('s.status = ?')
      params.push(Number(status))
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const suppliers = await this.executeQuery(`
      SELECT ${SUPPLIER_SELECT_COLUMNS},
             COALESCE(a.accessory_count, 0) AS accessory_count,
             COALESCE(p.phone_count, 0) AS phone_count,
             COALESCE(a.total_cost, 0) + COALESCE(p.total_cost, 0) AS total_cost
      FROM suppliers s
      LEFT JOIN (
        SELECT supplier_id, COUNT(*) AS accessory_count,
               COALESCE(SUM(purchase_cost), 0) AS total_cost
        FROM accessories GROUP BY supplier_id
      ) a ON a.supplier_id = s.id
      LEFT JOIN (
        SELECT supplier_id, COUNT(*) AS phone_count,
               COALESCE(SUM(purchase_cost), 0) AS total_cost
        FROM phones GROUP BY supplier_id
      ) p ON p.supplier_id = s.id
      ${whereClause}
      ORDER BY s.sort_order ASC, s.name ASC, s.id ASC
    `, params)

    return suppliers.map(row => ({
      id: Number(row.id),
      name: String(row.name || '').trim(),
      contact: formatNullableString(row.contact),
      phone: formatNullableString(row.phone),
      address: formatNullableString(row.address),
      bank_info: formatNullableString(row.bank_info),
      tax_number: formatNullableString(row.tax_number),
      status: Number(row.status) === 1 ? 1 : 0,
      sort_order: Number(row.sort_order) || 0,
      remarks: formatNullableString(row.remarks),
      accessory_count: Number(row.accessory_count) || 0,
      phone_count: Number(row.phone_count) || 0,
      total_cost: Number(row.total_cost) || 0,
      created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
      updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null
    }))
  }
}

module.exports = SupplierRepository
