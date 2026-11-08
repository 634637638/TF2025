'use strict'

const { getDatabase } = require('../config/database')

class PermissionUsersListRepository {
  constructor({ database = getDatabase } = {}) {
    this.database = database
  }

  async list({ search, roleId, storeId, hasStore, page, pageSize, includeStores, supportsUserStatus, supportsUserLastLogin }) {
    const whereParts = []
    const params = []
    if (search) {
      const searchPattern = `%${search}%`
      whereParts.push('(u.username LIKE ? OR u.name LIKE ? OR u.email LIKE ?)')
      params.push(searchPattern, searchPattern, searchPattern)
    }
    if (roleId) {
      whereParts.push('EXISTS (SELECT 1 FROM user_roles filter_ur WHERE filter_ur.user_id = u.id AND filter_ur.role_id = ?)')
      params.push(roleId)
    }
    if (storeId) {
      whereParts.push('EXISTS (SELECT 1 FROM user_stores filter_us WHERE filter_us.user_id = u.id AND filter_us.store_id = ?)')
      params.push(storeId)
    }
    if (hasStore === 'true') {
      whereParts.push('EXISTS (SELECT 1 FROM user_stores filter_us WHERE filter_us.user_id = u.id)')
    } else if (hasStore === 'false') {
      whereParts.push('NOT EXISTS (SELECT 1 FROM user_stores filter_us WHERE filter_us.user_id = u.id)')
    }
    const whereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : ''
    const database = this.database()
    const [countRows] = await database.execute(
      `SELECT COUNT(*) as total FROM users u ${whereClause}`,
      params
    )
    const total = countRows[0].total
    const statusColumn = supportsUserStatus ? 'u.status' : '1 as status'
    const lastLoginColumn = supportsUserLastLogin ? 'u.last_login' : 'NULL as last_login'
    const groupByColumns = [
      'u.id', 'u.username', 'u.name', 'u.email',
      ...(supportsUserStatus ? ['u.status'] : []),
      ...(supportsUserLastLogin ? ['u.last_login'] : []),
      'u.created_at', 'u.updated_at'
    ].join(', ')
    const offset = (page - 1) * pageSize
    const [users] = await database.query(`
      SELECT
        u.id,
        u.username,
        u.name as full_name,
        u.email,
        ${statusColumn},
        ${lastLoginColumn},
        u.created_at,
        u.updated_at,
        GROUP_CONCAT(r.name SEPARATOR ', ') as roles,
        GROUP_CONCAT(r.id SEPARATOR ',') as role_ids
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      ${whereClause}
      GROUP BY ${groupByColumns}
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, pageSize, offset])

    if (includeStores && users.length > 0) {
      const userIds = users.map(user => Number(user.id)).filter(Number.isInteger)
      if (userIds.length > 0) {
        const placeholders = userIds.map(() => '?').join(',')
        const [storeRows] = await database.execute(`
          SELECT
            us.user_id,
            us.id,
            us.store_id,
            us.is_primary,
            us.assigned_at,
            s.name AS store_name,
            s.location AS store_address,
            s.phone AS store_phone,
            s.manager_id,
            manager.name AS manager_name
          FROM user_stores us
          INNER JOIN stores s ON us.store_id = s.id
          LEFT JOIN users manager ON s.manager_id = manager.id
          WHERE us.user_id IN (${placeholders})
          ORDER BY us.is_primary DESC, us.assigned_at DESC
        `, userIds)
        const storesByUserId = new Map()
        for (const store of storeRows) {
          const userId = Number(store.user_id)
          const stores = storesByUserId.get(userId) || []
          stores.push(store)
          storesByUserId.set(userId, stores)
        }
        users.forEach(user => { user.stores = storesByUserId.get(Number(user.id)) || [] })
      }
    }

    return { users, total }
  }
}

module.exports = PermissionUsersListRepository
