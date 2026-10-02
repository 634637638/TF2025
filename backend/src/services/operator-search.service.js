'use strict'

const { getDatabase } = require('../config/database')

const parseStoreId = value => {
  if (value === undefined || value === null || value === '') return null
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    const error = new Error('store_id 参数无效')
    error.statusCode = 400
    throw error
  }
  return parsed
}

const searchOperators = async ({
  user,
  superAdmin = false,
  keyword = '',
  page,
  page_size,
  store_id,
  strict_scope = false,
  status = '1',
  includeDetails = false
} = {}) => {
  const requestedStoreId = parseStoreId(store_id)
  const normalizedKeyword = String(keyword || '').trim()
  const strictStoreScope = strict_scope === 'true' || strict_scope === true
  const userStoreIds = Array.isArray(user?.store_ids)
    ? user.store_ids.map(Number).filter(id => Number.isInteger(id) && id > 0)
    : []

  if (strictStoreScope && !superAdmin && requestedStoreId !== null && !userStoreIds.includes(requestedStoreId)) {
    const error = new Error('无权访问该门店操作员')
    error.statusCode = 403
    throw error
  }

  const scopedStoreIds = requestedStoreId === null ? userStoreIds : [requestedStoreId]
  const whereParts = ['u.status = ?', 'r.is_active = 1']
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

  const usePagination = page !== undefined || page_size !== undefined || normalizedKeyword !== ''
  const pageNumber = Math.max(1, Number.parseInt(String(page || 1), 10) || 1)
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(String(page_size || 50), 10) || 50))
  const whereSql = whereParts.join(' AND ')
  const selectFields = includeDetails
    ? 'u.id, u.username, u.name, u.phone, u.status, u.salary_template_id, GROUP_CONCAT(DISTINCT r.name SEPARATOR \", \") AS role_name, GROUP_CONCAT(DISTINCT COALESCE(r.code, CONCAT(\'role_\', r.id)) SEPARATOR \", \") AS role_codes'
    : 'u.id, u.username, u.name, u.status'
  const groupFields = includeDetails
    ? 'u.id, u.username, u.name, u.phone, u.status, u.salary_template_id'
    : 'u.id, u.username, u.name, u.status'
  const paginationSql = usePagination ? ` LIMIT ${pageSize} OFFSET ${(pageNumber - 1) * pageSize}` : ''
  const db = getDatabase()

  const [[rows], [countRows]] = await Promise.all([
    db.execute(`
      SELECT ${selectFields}
      FROM users u
      INNER JOIN user_roles ur ON u.id = ur.user_id
      INNER JOIN roles r ON ur.role_id = r.id
      WHERE ${whereSql}
      GROUP BY ${groupFields}
      ORDER BY COALESCE(NULLIF(u.name, ''), u.username) ASC, u.id ASC${paginationSql}
    `, whereParams),
    db.execute(`
      SELECT COUNT(DISTINCT u.id) AS total
      FROM users u
      INNER JOIN user_roles ur ON u.id = ur.user_id
      INNER JOIN roles r ON ur.role_id = r.id
      WHERE ${whereSql}
    `, whereParams)
  ])

  const total = Number(countRows[0]?.total || 0)
  return {
    records: rows,
    usePagination,
    pagination: {
      page: pageNumber,
      page_size: pageSize,
      total,
      total_pages: Math.ceil(total / pageSize),
      has_next: pageNumber * pageSize < total,
      has_prev: pageNumber > 1
    }
  }
}

module.exports = { searchOperators }
