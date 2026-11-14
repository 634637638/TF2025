'use strict'

const { parseInput } = require('../middleware/validation')
const referenceStateFields = {
  status: { type: 'number', integer: true, min: 0, max: 1, label: '状态' },
  sort_order: { type: 'number', integer: true, min: 0, max: 2147483647, label: '排序值' }
}

const parseReferenceInput = (body, { field = 'name', required = false, message } = {}) => parseInput(body, {
  ...Object.fromEntries(Object.entries(referenceStateFields).map(([key, rules]) => [key, { ...rules, required: body?.[key] !== undefined }])),
  [field]: { type: 'string', required: required || body?.[field] !== undefined, minLength: 1, maxLength: 100, label: '名称', message }
})

const parseReferenceId = value => parseInput({ id: value }, { id: { type: 'id', required: true, label: 'ID' } }).id

const parseReferenceOrder = items => {
  if (!Array.isArray(items) || items.length === 0) throw Object.assign(new Error('请提供有效的排序数据'), { statusCode: 400 })
  const seen = new Set()
  return items.map(item => {
    const normalized = parseInput(item, {
      id: { type: 'id', required: true, label: 'ID' },
      sort_order: { ...referenceStateFields.sort_order, required: true }
    })
    if (seen.has(normalized.id)) throw Object.assign(new Error('排序数据包含重复ID'), { statusCode: 400 })
    seen.add(normalized.id)
    return normalized
  })
}

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

module.exports = { normalizeReferencePagination, buildReferenceOrder, buildPagination, parseReferenceInput, parseReferenceId, parseReferenceOrder }
