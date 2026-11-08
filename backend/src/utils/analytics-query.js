'use strict'

const { getBeijingTimeString } = require('./time')

function parseOptionalInt(value) {
  if (value === undefined || value === null || value === '' || value === 'undefined' || value === 'null') {
    return null
  }
  const parsed = parseInt(String(value), 10)
  return Number.isNaN(parsed) ? null : parsed
}

function hasValidQueryValue(value) {
  return value !== undefined && value !== null && value !== '' && value !== 'undefined' && value !== 'null'
}

function parseOptionalDate(value) {
  if (!hasValidQueryValue(value)) return null
  const text = String(value).trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null
  const parsed = new Date(`${text}T00:00:00Z`)
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text ? null : text
}

function formatDateString(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getBeijingMonthRange(monthOffset = 0, beijingTime = getBeijingTimeString()) {
  const [year, month] = beijingTime.slice(0, 10).split('-').map(Number)
  const monthDate = new Date(year, (month - 1) + monthOffset, 1)
  const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
  const end = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0)

  return {
    monthKey: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
    startDate: formatDateString(start),
    endDate: formatDateString(end)
  }
}

function buildLatestSaleJoin({ phoneAlias = 'p', joinType = 'LEFT JOIN', alias = 'latest_sale' } = {}) {
  return `
    ${joinType} (
      SELECT s.phone_id, s.store_id, s.operator_id, s.sale_type, s.sale_time, s.id
      FROM sales s
      INNER JOIN (
        SELECT phone_id, MAX(id) AS max_id
        FROM sales
        GROUP BY phone_id
      ) latest_sales ON latest_sales.max_id = s.id
    ) ${alias} ON ${alias}.phone_id = ${phoneAlias}.id
  `
}

function buildStoreFilterClause(storeId, { phoneAlias = 'p', saleAlias = 'latest_sale' } = {}) {
  const normalizedStoreId = parseOptionalInt(storeId)
  if (!normalizedStoreId) return { storeId: null, clause: '', params: [] }

  return {
    storeId: normalizedStoreId,
    clause: `AND COALESCE(${saleAlias}.store_id, ${phoneAlias}.store_id) = ?`,
    params: [normalizedStoreId]
  }
}

module.exports = {
  parseOptionalInt,
  hasValidQueryValue,
  parseOptionalDate,
  formatDateString,
  getBeijingMonthRange,
  buildLatestSaleJoin,
  buildStoreFilterClause
}
