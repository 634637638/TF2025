'use strict'

const { getDatabase, isConnected } = require('../config/database')

const normalizeReferencePagination = ({ page, page_size, defaultPage = 1, defaultPageSize = 20, maxPageSize = 100 }) => {
  const pageNumber = Math.max(1, Number.parseInt(String(page ?? defaultPage), 10) || defaultPage)
  const pageSize = Math.min(maxPageSize, Math.max(1, Number.parseInt(String(page_size ?? defaultPageSize), 10) || defaultPageSize))
  return {
    page: pageNumber,
    page_size: pageSize,
    offset: (pageNumber - 1) * pageSize
  }
}

const buildReferenceOrder = ({ sort_by, sort_order, allowed, defaultSort = 'sort_order', fallback = [] }) => {
  const sortColumn = allowed.includes(sort_by) ? sort_by : defaultSort
  const direction = String(sort_order || '').toLowerCase() === 'desc' ? 'DESC' : 'ASC'
  const fallbackColumns = fallback.filter(column => column !== sortColumn)
  return `${sortColumn} ${direction}${fallbackColumns.length ? `, ${fallbackColumns.map(column => `${column} ASC`).join(', ')}` : ''}`
}

const buildPagination = (page, pageSize, total) => {
  const totalPages = Math.ceil(total / pageSize)
  return {
    page,
    page_size: pageSize,
    total,
    total_pages: totalPages,
    has_next: page < totalPages,
    has_prev: page > 1
  }
}

const TEMPLATE_OPTION_CONFIG = Object.freeze({
  brands: {
    table: 'brands',
    columns: 'id, name, sort_order',
    labelColumn: 'name',
    format: row => ({ id: Number(row.id), name: String(row.name || '').trim(), sort_order: Number(row.sort_order) || 0 })
  },
  models: {
    table: 'models',
    columns: 'id, name, brand_id, sort_order',
    labelColumn: 'name',
    format: row => ({
      id: Number(row.id),
      name: String(row.name || '').trim(),
      brand_id: Number(row.brand_id) || 0,
      sort_order: Number(row.sort_order) || 0
    })
  },
  colors: {
    table: 'colors',
    columns: 'id, name, sort_order',
    labelColumn: 'name',
    format: row => ({ id: Number(row.id), name: String(row.name || '').trim(), sort_order: Number(row.sort_order) || 0 })
  },
  memories: {
    table: 'memories',
    columns: 'id, size, sort_order',
    labelColumn: 'size',
    format: row => ({ id: Number(row.id), size: String(row.size || '').trim(), sort_order: Number(row.sort_order) || 0 })
  }
})

const listModelsByBrand = async ({ brand_id, name = '', include_id = null, activeOnly = true } = {}) => {
  let brandId = Number.parseInt(String(brand_id), 10)
  if (!Number.isSafeInteger(brandId) || brandId <= 0) {
    const brandName = String(brand_id || '').trim()
    if (!brandName) return []
    const [brands] = await getDatabase().execute(
      'SELECT id FROM brands WHERE name = ? LIMIT 1',
      [brandName]
    )
    brandId = Number(brands[0]?.id) || 0
    if (!brandId) return []
  }

  const keyword = String(name || '').trim()
  const includeId = Number.parseInt(String(include_id || ''), 10)
  const conditions = ['m.brand_id = ?']
  const params = [brandId]

  if (activeOnly) conditions.push('(m.status = 1 OR m.status IS NULL)')
  if (keyword) {
    if (Number.isSafeInteger(includeId) && includeId > 0) {
      conditions.push('(m.name LIKE ? OR m.id = ?)')
      params.push(`%${keyword}%`, includeId)
    } else {
      conditions.push('m.name LIKE ?')
      params.push(`%${keyword}%`)
    }
  }

  const orderSql = Number.isSafeInteger(includeId) && includeId > 0
    ? `CASE WHEN m.id = ${includeId} THEN 0 ELSE 1 END, m.sort_order ASC, m.name ASC, m.id ASC`
    : 'm.sort_order ASC, m.name ASC, m.id ASC'
  const [rows] = await getDatabase().execute(`
    SELECT m.id, m.name, m.brand_id, m.status, m.sort_order,
           m.created_at, m.updated_at, b.name AS brand_name
    FROM models m
    LEFT JOIN brands b ON b.id = m.brand_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY ${orderSql}
  `, params)
  return rows
}

const listActiveReferenceOptions = async (resource, { includeNullStatus = false } = {}) => {
  const config = TEMPLATE_OPTION_CONFIG[resource]
  if (!['brands', 'colors', 'memories'].includes(resource) || !config) {
    throw new Error(`不支持的启用基础选项类型: ${resource}`)
  }
  if (!isConnected()) throw new Error('数据库未连接')

  const statusCondition = includeNullStatus ? '(status = 1 OR status IS NULL)' : 'status = 1'
  const [rows] = await getDatabase().execute(
    `SELECT ${config.columns} FROM ${config.table} WHERE ${statusCondition} ORDER BY sort_order ASC, ${config.labelColumn} ASC, id ASC`
  )
  return rows.map(config.format)
}

/**
 * 模板管理基础选项的唯一 SQL 入口。
 * `/shop/base-data/*` 是历史兼容路由，仍保留原权限和响应格式，
 * 但不再在路由内重复维护品牌、型号、颜色、内存查询逻辑。
 */
const listTemplateReferenceOptions = async (resource, { brand_id: brandId } = {}) => {
  const config = TEMPLATE_OPTION_CONFIG[resource]
  if (!config) throw new Error(`不支持的基础选项类型: ${resource}`)
  if (!isConnected()) throw new Error('数据库未连接')

  const conditions = []
  const params = []
  if (resource === 'models' && brandId !== undefined && brandId !== null && String(brandId).trim() !== '') {
    const parsedBrandId = Number.parseInt(String(brandId), 10)
    if (!Number.isInteger(parsedBrandId) || parsedBrandId <= 0) {
      const error = new Error('brand_id 参数无效')
      error.statusCode = 400
      throw error
    }
    conditions.push('brand_id = ?')
    params.push(parsedBrandId)
  }

  const whereClause = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : ''
  const [rows] = await getDatabase().execute(
    `SELECT ${config.columns} FROM ${config.table}${whereClause} ORDER BY sort_order ASC, ${config.labelColumn} ASC, id ASC`,
    params
  )
  return rows.map(config.format)
}

module.exports = {
  normalizeReferencePagination,
  buildReferenceOrder,
  buildPagination,
  listTemplateReferenceOptions,
  listModelsByBrand,
  listActiveReferenceOptions
}
