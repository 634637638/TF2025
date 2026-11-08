'use strict'

const { getDatabase } = require('../config/database')

class UserManagementRepository {
  constructor({ database = getDatabase } = {}) { this.database = database }

  async listEmployees({ status, normalizedKeyword, strictStoreScope, superAdmin, scopedStoreIds, requestedStoreId, isAdmin, usePagination, pageSizeInt, pageInt, userId }) {
    const whereParts = ['u.status = ?']
    const whereParams = [status]

    if (normalizedKeyword) {
      whereParts.push('(u.name LIKE ? OR u.username LIKE ? OR u.phone LIKE ?)')
      const pattern = `%${normalizedKeyword}%`
      whereParams.push(pattern, pattern, pattern)
    }

    if (strictStoreScope && !superAdmin) {
      if (scopedStoreIds.length === 0) {
        whereParts.push('1 = 0')
      } else {
        const placeholders = scopedStoreIds.map(() => '?').join(',')
        whereParts.push(`(u.store_id IN (${placeholders}) OR EXISTS (SELECT 1 FROM user_stores scope_us WHERE scope_us.user_id = u.id AND scope_us.store_id IN (${placeholders})))`)
        whereParams.push(...scopedStoreIds, ...scopedStoreIds)
      }
    } else if (strictStoreScope && requestedStoreId !== null) {
      whereParts.push('(u.store_id = ? OR EXISTS (SELECT 1 FROM user_stores scope_us WHERE scope_us.user_id = u.id AND scope_us.store_id = ?))')
      whereParams.push(requestedStoreId, requestedStoreId)
    }

    const db = this.database()
    const whereSql = whereParts.join(' AND ')
    let users
    let total = 0
    if (isAdmin) {
      const countResult = await db.execute(`SELECT COUNT(*) AS total FROM users u WHERE ${whereSql}`, whereParams)
      total = Number(countResult[0][0]?.total || 0)
      const paginationSql = usePagination ? ` LIMIT ${pageSizeInt} OFFSET ${(pageInt - 1) * pageSizeInt}` : ''
        ;[users] = await db.execute(
        `SELECT u.id, u.username, u.name, u.status,
                  EXISTS (SELECT 1 FROM salary_templates st WHERE st.id = u.salary_template_id) AS has_salary_template
           FROM users u
           WHERE ${whereSql}
           ORDER BY COALESCE(NULLIF(u.name, ''), u.username) ASC, u.id ASC${paginationSql}`,
        whereParams
      )
    } else {
      ;[users] = await db.execute(
        `SELECT u.id, u.username, u.name, u.status,
                  EXISTS (SELECT 1 FROM salary_templates st WHERE st.id = u.salary_template_id) AS has_salary_template
           FROM users u
           WHERE u.id = ? AND ${whereSql}`,
        [userId, ...whereParams]
      )
      total = users.length
    }

    return { users, total }
  }

  remove(userId) { return this.database().execute('DELETE FROM users WHERE id = ?', [userId]) }

  setStatus(userId, status) {
    return this.database().execute('UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, userId])
  }
}

module.exports = UserManagementRepository
