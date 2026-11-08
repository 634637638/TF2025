'use strict'

const BaseRepository = require('./base.repository')
const STORE_PUBLIC_COLUMNS = 's.id, s.name, s.location, s.phone, s.manager_id, s.status, s.sort_order, s.created_at, s.updated_at'

class StoreRepository extends BaseRepository {
  constructor() { super('stores') }

  async selectManagementStore(id) {
    const [rows] = await this.executePrepared(`SELECT ${STORE_PUBLIC_COLUMNS}, u.name AS manager_name
      FROM stores s LEFT JOIN users u ON u.id = s.manager_id WHERE s.id = ?`, [id])
    return rows[0] || null
  }

  async selectActiveManager(id) {
    const [rows] = await this.executePrepared('SELECT id, phone FROM users WHERE id = ? AND status = 1 LIMIT 1', [id])
    return rows[0] || null
  }

  async listManagementOptions({ name, storeIds }) {
    const conditions = ['s.status = 1']
    const params = []
    if (storeIds) {
      conditions.push(`s.id IN (${storeIds.map(() => '?').join(',')})`)
      params.push(...storeIds)
    }
    if (name) { conditions.push('s.name LIKE ?'); params.push(`%${name}%`) }
    const [rows] = await this.executePrepared(`SELECT s.id, s.name, s.sort_order FROM stores s
      WHERE ${conditions.join(' AND ')} ORDER BY s.sort_order ASC, s.name ASC, s.id ASC`, params)
    return rows
  }

  async listManagementStores({ name, status, limit, offset }) {
    const conditions = []
    const params = []
    if (name) { conditions.push(' s.name LIKE ?'); params.push(`%${name}%`) }
    if (status !== undefined) { conditions.push(' s.status = ?'); params.push(status) }
    const where = conditions.length ? ' WHERE' + conditions.join(' AND') : ''
    const [rows] = await this.executePrepared(`SELECT ${STORE_PUBLIC_COLUMNS}, u.name as manager_name
      FROM stores s LEFT JOIN users u ON s.manager_id = u.id${where}
      ORDER BY s.sort_order ASC, s.id DESC LIMIT ${limit} OFFSET ${offset}`, params)
    const [counts] = await this.executePrepared(`SELECT COUNT(*) as total FROM stores s${where}`, [...params])
    return { rows, total: counts[0].total }
  }

  async exportManagementStores({ name, status }) {
    const conditions = []
    const params = []
    if (name) { conditions.push('s.name LIKE ?'); params.push(`%${name}%`) }
    if (status !== undefined) { conditions.push('s.status = ?'); params.push(status) }
    const [rows] = await this.executePrepared(`SELECT s.id, s.name, s.location, s.phone, s.status, s.sort_order,
      s.created_at, s.updated_at, u.name as manager_name FROM stores s LEFT JOIN users u ON s.manager_id = u.id
      ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''} ORDER BY s.sort_order ASC, s.id DESC`, params)
    return rows
  }

  async hasManagementDuplicate(name, id) {
    const [rows] = await this.executePrepared(`SELECT id FROM stores WHERE name = ?${id === undefined ? '' : ' AND id != ?'}`, id === undefined ? [name] : [name, id])
    return rows.length > 0
  }

  async currentManagementName(id) {
    const [rows] = await this.executePrepared('SELECT name FROM stores WHERE id = ?', [id])
    return rows[0]?.name
  }

  async createManagementStore(values) {
    const [result] = await this.executePrepared('INSERT INTO stores (name, location, phone, manager_id, status, sort_order) VALUES (?, ?, ?, ?, ?, ?)', values)
    return result.insertId
  }

  async updateManagementStore(values) {
    const [result] = await this.executePrepared('UPDATE stores SET name = ?, location = ?, phone = ?, manager_id = ?, status = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', values)
    return result.affectedRows
  }

  async removeManagementStore(id) {
    const [result] = await this.executePrepared('DELETE FROM stores WHERE id = ?', [id])
    return result.affectedRows
  }

  async listManagementManagers() {
    const [rows] = await this.executePrepared(`
      SELECT u.id, u.name, u.username, u.phone,
        (SELECT GROUP_CONCAT(r.name ORDER BY r.id SEPARATOR ', ')
           FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = u.id) AS roles
      FROM users u WHERE u.status = 1 ORDER BY u.name ASC, u.username ASC, u.id ASC
    `)
    return rows
  }

  async getManagementStats({ name, status }) {
    const conditions = []
    const params = []
    if (name) { conditions.push('s.name LIKE ?'); params.push(`%${name}%`) }
    if (status !== '') { conditions.push('s.status = ?'); params.push(Number(status) === 1 ? 1 : 0) }
    const [rows] = await this.executePrepared(`
      SELECT COUNT(*) AS total,
        SUM(s.status = 1) AS active, SUM(s.status = 0) AS inactive,
        SUM(s.manager_id IS NOT NULL AND s.manager_id != '') AS with_manager,
        SUM(s.phone IS NOT NULL AND s.phone != '') AS with_phone,
        SUM(s.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS recent
      FROM stores s ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
    `, params)
    return rows[0] || {}
  }
}

module.exports = StoreRepository
