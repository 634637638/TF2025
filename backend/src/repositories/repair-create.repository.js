'use strict'

const { getDatabase } = require('../config/database')
const { withConnection } = require('../core/db/connection')

class RepairCreateRepository {
  constructor({ getDb = getDatabase, listQuery } = {}) {
    if (typeof getDb !== 'function') throw new TypeError('RepairCreateRepository requires getDb')
    if (typeof listQuery !== 'string' || !listQuery.trim()) throw new TypeError('RepairCreateRepository requires listQuery')
    this.getDb = getDb
    this.listQuery = listQuery
  }

  async validateReferences({ customerId, brandId, colorId, memoryId, phoneId, technicianId }) {
    const database = await this.getDb()
    const [customerRows] = await database.execute('SELECT id FROM customers WHERE id = ? AND status = 1', [customerId])
    if (!customerRows.length) return '客户不存在或已停用'
    if (brandId) {
      const [brandRows] = await database.execute('SELECT id FROM brands WHERE id = ?', [brandId])
      if (!brandRows.length) return '品牌不存在'
    }
    for (const [value, table, label] of [[colorId, 'colors', '颜色'], [memoryId, 'memories', '内存']]) {
      if (!value) continue
      const [rows] = await database.execute(`SELECT id FROM ${table} WHERE id = ?`, [value])
      if (!rows.length) return `${label}不存在`
    }
    if (phoneId) {
      const [phoneRows] = await database.execute('SELECT id FROM phones WHERE id = ?', [phoneId])
      if (!phoneRows.length) return '关联设备不存在'
    }
    if (technicianId) {
      const [technicianRows] = await database.execute('SELECT id FROM users WHERE id = ? AND status = 1', [technicianId])
      if (!technicianRows.length) return '维修员不存在或已停用'
    }
    return null
  }

  async withConnection(operation) {
    return withConnection(this.getDb, operation)
  }

  async insert(connection, input) {
    const [result] = await connection.execute(`
      INSERT INTO repairs (order_no, customer_id, phone_id, brand_id, phone_model, imei, serial_number, color_id, memory_id, problem_description, technician_id, remarks, photos, created_at, repair_time, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), COALESCE(?, NOW()), 'pending')
    `, [
      input.orderNo,
      input.customerId,
      input.phoneId,
      input.brandId,
      input.phoneModel,
      input.imei,
      input.serialNumber,
      input.colorId,
      input.memoryId,
      input.problem,
      input.technicianId,
      input.remarks,
      '[]',
      input.repairTime
    ])
    return result.insertId
  }

  async updatePhotos(connection, id, photos) {
    await connection.execute('UPDATE repairs SET photos = ? WHERE id = ?', [JSON.stringify(photos), id])
  }

  async getCreated(connection, id) {
    const [rows] = await connection.execute(`${this.listQuery} WHERE r.id = ?`, [id])
    return rows[0] || null
  }
}

module.exports = RepairCreateRepository
