'use strict'

const BaseRepository = require('./base.repository')
const { parseStatusFilter } = require('../utils/status')
const { buildReferenceOrder } = require('../utils/reference-options')
const MODEL_COLUMNS = 'm.id, m.brand_id, m.name, m.status, m.sort_order, m.created_at, m.updated_at'
const MODEL_COLUMNS_WITH_BRAND = `${MODEL_COLUMNS}, b.name AS brand_name`

class ModelRepository extends BaseRepository {
  constructor() { super('models') }

  async listManagement({ brandId, name, status, sortBy, sortOrder, limit, offset, returnAll, byBrand = false }) {
    const conditions = []
    const params = []
    if (byBrand) {
      conditions.push('m.brand_id = ?')
      params.push(parseInt(brandId))
    } else if (brandId) {
      let resolvedId = brandId
      if (!/^\d+$/.test(String(brandId))) {
        const [brands] = await this.executePrepared('SELECT id FROM brands WHERE name = ? LIMIT 1', [String(brandId)])
        resolvedId = brands[0]?.id || 0
      }
      conditions.push('m.brand_id = ?')
      params.push(resolvedId)
    }
    const statusFilter = parseStatusFilter(status)
    if (byBrand ? status !== undefined && status !== '' : statusFilter !== null) {
      conditions.push('m.status = ?')
      params.push(statusFilter)
    }
    if (name) { conditions.push('m.name LIKE ?'); params.push(`%${name}%`) }
    const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : ''
    let order
    if (byBrand) {
      const sort = ['id', 'name', 'sort_order', 'created_at', 'updated_at'].includes(sortBy) ? sortBy : 'sort_order'
      order = `m.${sort} ${String(sortOrder).toLowerCase() === 'desc' ? 'DESC' : 'ASC'}${sort === 'sort_order' ? ', m.name ASC, m.id ASC' : ', m.sort_order ASC, m.name ASC, m.id ASC'}`
    } else {
      order = buildReferenceOrder({ sort_by: sortBy, sort_order: sortOrder,
        allowed: ['id', 'name', 'sort_order', 'created_at', 'updated_at', 'brand_id'], fallback: ['sort_order', 'name', 'id']
      }).replace(/(^|, )([a-z_]+)/g, '$1m.$2')
    }
    const paging = returnAll ? '' : ` LIMIT ${limit} OFFSET ${offset}`
    const [[rows], [counts]] = await Promise.all([
      this.executePrepared(`SELECT ${MODEL_COLUMNS_WITH_BRAND} FROM models m LEFT JOIN brands b ON ${byBrand ? 'b.id = m.brand_id' : 'm.brand_id = b.id'}${where} ORDER BY ${order}${paging}`, params),
      this.executePrepared(`SELECT COUNT(*) as total FROM models m${where}`, params)
    ])
    return { rows, total: Number(counts[0].total) || 0 }
  }

  async getManagementStats({ brandId, name, status }) {
    const conditions = []
    const params = []
    if (brandId) { conditions.push('m.brand_id = ?'); params.push(parseInt(brandId)) }
    if (name) { conditions.push('m.name LIKE ?'); params.push(`%${name}%`) }
    const statusFilter = parseStatusFilter(status)
    if (statusFilter !== null) { conditions.push('m.status = ?'); params.push(statusFilter) }
    const [rows] = await this.executePrepared(`SELECT ${MODEL_COLUMNS_WITH_BRAND}
      FROM models m LEFT JOIN brands b ON b.id = m.brand_id
      ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
      ORDER BY m.created_at DESC, m.id DESC`, params)
    return rows
  }

  async getManagementRecord(id, { withBrand = true } = {}) {
    const [rows] = await this.executePrepared(`SELECT ${withBrand ? MODEL_COLUMNS_WITH_BRAND : MODEL_COLUMNS}
      FROM models m ${withBrand ? 'LEFT JOIN brands b ON b.id = m.brand_id' : ''} WHERE m.id = ?`, [id])
    return rows[0] || null
  }

  async hasManagementDuplicate(name, brandId, excludeId) {
    const [rows] = await this.executePrepared(`SELECT id FROM models WHERE name = ? AND brand_id = ?${excludeId === undefined ? '' : ' AND id != ?'}`,
      excludeId === undefined ? [name, brandId] : [name, brandId, excludeId])
    return rows.length > 0
  }

  async insertManagementModel(values) {
    const [result] = await this.executePrepared(`INSERT INTO models (
      brand_id, name, status, sort_order, created_at, updated_at
    ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`, values)
    return result.insertId
  }

  async updateManagementModel(id, changes) {
    const allowed = new Set(['brand_id', 'name', 'status', 'sort_order'])
    const fields = Object.keys(changes)
    if (fields.some(field => !allowed.has(field))) throw new TypeError('无效的型号字段')
    await this.executePrepared(`UPDATE models SET ${fields.map(field => `${field} = ?`).join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [...fields.map(field => changes[field]), id])
  }

  async removeManagementModel(id) { await this.executePrepared('DELETE FROM models WHERE id = ?', [id]) }

  async toggleManagementStatus(id, status) {
    await this.executePrepared('UPDATE models SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, id])
  }
}

module.exports = ModelRepository
