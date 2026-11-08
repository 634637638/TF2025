'use strict'

const { isConnected } = require('../config/database')
const AnalyticsHighValueCustomersRepository = require('../repositories/analytics-high-value-customers.repository')

const hasValidQueryValue = value => (
  value !== undefined && value !== null && value !== '' && value !== 'undefined' && value !== 'null'
)

const parseOptionalDate = value => {
  if (!hasValidQueryValue(value)) return null
  const text = String(value).trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null
  const parsed = new Date(`${text}T00:00:00Z`)
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text ? null : text
}

const invalid = message => Object.assign(new Error(message), { statusCode: 400 })

class AnalyticsHighValueCustomersService {
  constructor({ repository = new AnalyticsHighValueCustomersRepository(), connected = isConnected } = {}) {
    this.repository = repository
    this.connected = connected
  }

  async list({ page, pageSize, search, startDate: requestedStartDate, endDate: requestedEndDate, requestedStoreId, storeId }) {
    if (!Number.isSafeInteger(page) || page < 1) throw invalid('页码无效')
    if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) throw invalid('每页数量必须为 1-100')

    const startDate = parseOptionalDate(requestedStartDate)
    const endDate = parseOptionalDate(requestedEndDate)
    if (hasValidQueryValue(requestedStartDate) && !startDate) throw invalid('开始日期格式无效')
    if (hasValidQueryValue(requestedEndDate) && !endDate) throw invalid('结束日期格式无效')
    if (hasValidQueryValue(requestedStoreId) && (!storeId || storeId <= 0)) throw invalid('门店编号无效')
    if (startDate && endDate && startDate > endDate) throw invalid('开始日期不能晚于结束日期')
    if (!this.connected()) throw Object.assign(new Error('数据库连接失败'), { statusCode: 500 })

    const result = await this.repository.list({
      pageSize,
      offset: (page - 1) * pageSize,
      search: String(search ?? '').trim(),
      startDate,
      endDate,
      storeId
    })
    const totalNumber = Number(result.total) || 0
    const totalPages = Math.ceil(totalNumber / pageSize)
    return {
      customers: result.customers,
      pagination: {
        page,
        page_size: pageSize,
        total: result.total,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_prev: page > 1
      }
    }
  }
}

module.exports = AnalyticsHighValueCustomersService
