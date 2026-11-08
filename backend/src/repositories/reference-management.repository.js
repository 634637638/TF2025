'use strict'

const BaseRepository = require('./base.repository')
const { parseStatusFilter } = require('../utils/status')
const { buildReferenceOrder } = require('../utils/reference-options')

const REFERENCE_DOMAINS = Object.freeze({
  colors: { field: 'name', alias: 'c', phoneField: 'color_id', sorts: ['id', 'name', 'created_at', 'updated_at', 'sort_order'] },
  memories: { field: 'size', alias: 'm', phoneField: 'memory_id', sorts: ['id', 'size', 'created_at', 'updated_at', 'sort_order', 'status'] }
})

class ReferenceManagementRepository extends BaseRepository {
  constructor(domain) {
    if (!Object.hasOwn(REFERENCE_DOMAINS, domain)) throw new TypeError('不支持的基础资料类型')
    super(domain)
    this.domain = REFERENCE_DOMAINS[domain]
    this.columns = `id, ${this.domain.field}, status, sort_order, created_at, updated_at`
  }

  async listManagement({ keyword, storageUnit, status, sortBy, descending, returnAll, limit, offset }) {
    const { field, sorts } = this.domain
    const conditions = []
    const params = []
    if (storageUnit && field === 'size') { conditions.push('size LIKE ?'); params.push(`%${storageUnit}`) }
    const statusFilter = parseStatusFilter(status)
    if (statusFilter !== null) { conditions.push('status = ?'); params.push(statusFilter) }
    if (keyword) { conditions.push(`${field} LIKE ?`); params.push(`%${keyword}%`) }
    const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : ''
    const order = buildReferenceOrder({ sort_by: sortBy, sort_order: descending ? 'desc' : 'asc', allowed: sorts, fallback: ['sort_order', field, 'id'] })
    const paging = returnAll ? '' : ` LIMIT ${limit} OFFSET ${offset}`
    const [[rows], [counts]] = await Promise.all([
      this.executePrepared(`SELECT ${this.columns} FROM ${this.tableName}${where} ORDER BY ${order}${paging}`, params),
      this.executePrepared(`SELECT COUNT(*) as total FROM ${this.tableName}${where}`, params)
    ])
    return { rows, total: Number(counts[0].total) || 0 }
  }

  async getManagementRecord(id) {
    const [rows] = await this.executePrepared(`SELECT ${this.columns} FROM ${this.tableName} WHERE id = ?`, [id])
    return rows[0] || null
  }

  async existsManagementId(id) {
    const [rows] = await this.executePrepared(`SELECT id FROM ${this.tableName} WHERE id = ?`, [id])
    return rows.length > 0
  }

  async currentManagementLabel(id) {
    const [rows] = await this.executePrepared(`SELECT ${this.domain.field} FROM ${this.tableName} WHERE id = ?`, [id])
    return rows[0]?.[this.domain.field]
  }

  async hasManagementDuplicate(label, excludeId) {
    const [rows] = await this.executePrepared(
      `SELECT id FROM ${this.tableName} WHERE ${this.domain.field} = ?${excludeId === undefined ? '' : ' AND id != ?'}`,
      excludeId === undefined ? [label] : [label, excludeId]
    )
    return rows.length > 0
  }

  async insertManagementRecord({ label, status, sortOrder }) {
    const isMemory = this.tableName === 'memories'
    const [result] = await this.executePrepared(`
      INSERT INTO ${this.tableName} (
        ${this.domain.field}, ${isMemory ? 'sort_order, status' : 'status, sort_order'}, created_at, updated_at
      ) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, isMemory ? [label, sortOrder, status] : [label, status, sortOrder])
    return result.insertId
  }

  async updateManagementRecord(id, changes) {
    const allowed = new Set([this.domain.field, 'status', 'sort_order'])
    if (Object.keys(changes).some(key => !allowed.has(key))) throw new TypeError('无效的基础资料字段')
    const fields = Object.keys(changes)
    await this.executePrepared(
      `UPDATE ${this.tableName} SET ${fields.map(field => `${field} = ?`).join(', ')}, updated_at = NOW() WHERE id = ?`,
      [...fields.map(field => changes[field]), id]
    )
  }

  async removeManagementRecord(id) {
    await this.executePrepared(`DELETE FROM ${this.tableName} WHERE id = ?`, [id])
  }

  async toggleManagementStatus(id, status) {
    await this.executePrepared(`UPDATE ${this.tableName} SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [status, id])
  }

  async getManagementStats({ keyword, status, storageUnit }) {
    const { field, alias, phoneField } = this.domain
    const conditions = []
    const params = []
    // 颜色与内存保留各自原来的绑定顺序。
    const addKeyword = () => { if (keyword) { conditions.push(`${alias}.${field} LIKE ?`); params.push(`%${keyword}%`) } }
    if (field === 'name') addKeyword()
    if (storageUnit && field === 'size') { conditions.push(`${alias}.size LIKE ?`); params.push(`%${storageUnit}`) }
    if (status !== '') { conditions.push(`${alias}.status = ?`); params.push(Number(status) === 1 ? 1 : 0) }
    if (field === 'size') addKeyword()
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const [[rows], [phones]] = await Promise.all([
      this.executePrepared(`
        SELECT COUNT(*) AS total,
          SUM(CASE WHEN ${alias}.status = 1 THEN 1 ELSE 0 END) AS active,
          SUM(CASE WHEN ${alias}.status <> 1 OR ${alias}.status IS NULL THEN 1 ELSE 0 END) AS inactive
        FROM ${this.tableName} ${alias} ${where}
      `, params),
      this.executePrepared(`
        SELECT COUNT(*) AS related_phones FROM phones p
        INNER JOIN ${this.tableName} ${alias} ON ${alias}.id = p.${phoneField} ${where}
      `, params)
    ])
    return { ...rows[0], related_phones: phones[0].related_phones }
  }
}

module.exports = ReferenceManagementRepository
