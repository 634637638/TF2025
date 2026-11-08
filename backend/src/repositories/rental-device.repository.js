'use strict'

const { getDatabase } = require('../config/database')

const SEARCH_COLUMNS = {
  'device_info.imei': 'p.imei',
  'device_info.serial_number': 'p.serial_number',
  'device_info.brand': 'b.name',
  'device_info.model': 'm.name',
  'device_info.color': 'co.name',
  'device_info.memory': 'mem.size'
}

class RentalDeviceRepository {
  constructor({ getDb = getDatabase } = {}) {
    this.getDb = getDb
  }

  async listAvailable({ keyword, searchableFieldIds, page, pageSize, hasPagination }) {
    const params = []
    let searchSql = ''
    if (keyword) {
      const columns = searchableFieldIds.map(fieldId => SEARCH_COLUMNS[fieldId]).filter(Boolean)
      if (!columns.length) return []
      searchSql = `AND (${columns.map(column => `${column} LIKE ?`).join(' OR ')})`
      params.push(...columns.map(() => `%${keyword}%`))
    }
    const offset = (page - 1) * pageSize
    const paginationSql = hasPagination ? ` LIMIT ${pageSize} OFFSET ${offset}` : ''
    const [rows] = await this.getDb().execute(
      `SELECT p.id, p.imei, p.serial_number, p.purchase_cost,
              b.name AS brand, m.name AS model,
              co.name AS color, mem.size AS memory
       FROM phones p
       LEFT JOIN brands b ON b.id = p.brand_id
       LEFT JOIN models m ON m.id = p.model_id
       LEFT JOIN colors co ON co.id = p.color_id
       LEFT JOIN memories mem ON mem.id = p.memory_id
       WHERE p.status = 'in_stock' ${searchSql}
       ORDER BY p.inventory_time DESC, p.id DESC${paginationSql}`,
      params
    )
    return rows
  }
}

module.exports = RentalDeviceRepository
