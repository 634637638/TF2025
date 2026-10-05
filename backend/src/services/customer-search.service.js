'use strict'

const { getDatabase } = require('../config/database')

const CUSTOMER_FIELDS = new Set([
  'id', 'name', 'phone', 'email', 'id_card', 'apple_id', 'member_number',
  'vip_level', 'customer_type', 'status', 'remarks', 'created_at', 'updated_at'
])

const normalizePage = value => Math.max(1, Number.parseInt(String(value ?? 1), 10) || 1)
const normalizePageSize = value => Math.min(100, Math.max(1, Number.parseInt(String(value ?? 20), 10) || 20))

const normalizeFields = fields => {
  const requested = Array.isArray(fields) && fields.length > 0 ? fields : ['id', 'name', 'phone']
  const normalized = requested.filter(field => CUSTOMER_FIELDS.has(field))
  return normalized.includes('id') ? normalized : ['id', ...normalized]
}

const normalizeSearchFields = fields => {
  const requested = Array.isArray(fields) && fields.length > 0 ? fields : ['name', 'phone']
  return requested.filter(field => CUSTOMER_FIELDS.has(field) && field !== 'id' && field !== 'status')
}

/**
 * 客户远程检索的唯一 SQL 构造入口。
 * 业务路由只传入授权后的字段集合，不允许将表名或排序字段直接拼接进查询。
 */
const searchCustomers = async ({
  keyword,
  page = 1,
  page_size = 20,
  fields,
  search_fields,
  status = 1,
  order_by = 'id',
  order_direction = 'DESC'
} = {}) => {
  const normalizedKeyword = String(keyword || '').trim()
  const pageNumber = normalizePage(page)
  const pageSize = normalizePageSize(page_size)
  const offset = (pageNumber - 1) * pageSize
  const selectFields = normalizeFields(fields)
  const searchFields = normalizeSearchFields(search_fields)
  const sortField = CUSTOMER_FIELDS.has(order_by) ? order_by : 'id'
  const sortDirection = String(order_direction).toUpperCase() === 'ASC' ? 'ASC' : 'DESC'
  const conditions = ['status = ?']
  const params = [Number(status) === 0 ? 0 : 1]

  if (normalizedKeyword && searchFields.length > 0) {
    conditions.push(`(${searchFields.map(field => `${field} LIKE ?`).join(' OR ')})`)
    params.push(...searchFields.map(() => `%${normalizedKeyword}%`))
  }

  const whereClause = conditions.join(' AND ')
  const db = getDatabase()
  const [rows] = await db.execute(
    `SELECT ${selectFields.join(', ')}
     FROM customers
     WHERE ${whereClause}
     ORDER BY ${sortField} ${sortDirection}, id DESC
     LIMIT ${pageSize} OFFSET ${offset}`,
    params
  )
  const [countRows] = await db.execute(
    `SELECT COUNT(*) AS total FROM customers WHERE ${whereClause}`,
    params
  )
  const total = Number(countRows[0]?.total || 0)
  const totalPages = Math.ceil(total / pageSize)

  return {
    records: rows,
    pagination: {
      page: pageNumber,
      page_size: pageSize,
      total,
      total_pages: totalPages,
      has_next: pageNumber < totalPages,
      has_prev: pageNumber > 1
    }
  }
}

module.exports = {
  searchCustomers,
  normalizePage,
  normalizePageSize
}
