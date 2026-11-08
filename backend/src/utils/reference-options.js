'use strict'

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

module.exports = { normalizeReferencePagination, buildReferenceOrder, buildPagination }
