'use strict'

const { listTemplateReferenceOptions } = require('./reference-options.service')
const PreorderReadRepository = require('../repositories/preorder-read.repository')
const { PREORDER_STATUS_LABELS } = require('../config/preorder-response.constants')

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const REFERENCE_FILTERS = ['store_id', 'brand_id', 'model_id', 'color_id', 'memory_id']

const normalizeOptionalQueryValue = (value) => {
  if (value === undefined || value === null) return null
  const normalizedValue = String(value).trim()
  return normalizedValue === '' || normalizedValue === 'null' || normalizedValue === 'undefined'
    ? null
    : normalizedValue
}

const isValidDateOnly = (value) => {
  if (!DATE_ONLY_PATTERN.test(String(value || ''))) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

class PreorderReadService {
  constructor({
    repository = new PreorderReadRepository(),
    listReferenceOptions = listTemplateReferenceOptions
  } = {}) {
    this.repository = repository
    this.listReferenceOptions = listReferenceOptions
  }

  async getStats() {
    const row = await this.repository.getStats()
    return {
      pending_count: parseInt(row?.pending_count) || 0,
      matched_count: parseInt(row?.matched_count) || 0,
      delivered_count: parseInt(row?.delivered_count) || 0,
      cancelled_count: parseInt(row?.cancelled_count) || 0
    }
  }

  async getById(id) {
    return this.repository.getById(id)
  }

  async list(query = {}) {
    const page = query.page && query.page !== 'undefined' ? query.page : 1
    const pageSize = query.page_size ?? 20
    const filters = Object.fromEntries([
      'status', 'customer_id', ...REFERENCE_FILTERS, 'search', 'start_date', 'end_date'
    ].map(key => [key, normalizeOptionalQueryValue(query[key])]))

    if ((filters.start_date && !isValidDateOnly(filters.start_date)) ||
      (filters.end_date && !isValidDateOnly(filters.end_date))) {
      return { error: '日期格式必须为 YYYY-MM-DD' }
    }
    if (filters.start_date && filters.end_date && filters.start_date > filters.end_date) {
      return { error: '开始日期不能晚于结束日期' }
    }

    if (filters.status && !Object.hasOwn(PREORDER_STATUS_LABELS, filters.status)) {
      return { error: '预定状态无效' }
    }

    for (const field of REFERENCE_FILTERS) {
      const value = filters[field]
      if (!value) continue
      const parsedValue = Number.parseInt(String(value), 10)
      if (!Number.isSafeInteger(parsedValue) || parsedValue < 1) {
        return { error: `${field} 编号无效` }
      }
      filters[field] = parsedValue
    }

    const parsedPage = Math.min(100000, Math.max(1, parseInt(page, 10) || 1))
    const parsedPageSize = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20))
    const result = await this.repository.list({ filters, page: parsedPage, pageSize: parsedPageSize })
    const total = parseInt(result.total) || 0
    return {
      records: result.records,
      pagination: {
        page: parsedPage,
        page_size: parsedPageSize,
        total,
        total_pages: Math.ceil(total / parsedPageSize),
        has_next: parsedPage * parsedPageSize < total,
        has_prev: parsedPage > 1
      }
    }
  }

  async getOptions() {
    const [stores, brands, models, colors, memories] = await Promise.all([
      this.repository.getStores(),
      this.listReferenceOptions('brands'),
      this.listReferenceOptions('models'),
      this.listReferenceOptions('colors'),
      this.listReferenceOptions('memories')
    ])
    return { stores, brands, models, colors, memories }
  }

  async getMatchablePreorders(filters) {
    return this.repository.getMatchablePreorders(filters)
  }

  async getMatchablePhones(id) {
    return this.repository.withConnection(async connection => {
      const preorder = await this.repository.getPreorderForMatching(connection, id)
      if (!preorder) return { error: 'not_found' }
      if (!['pending', 'arrived'].includes(preorder.status)) return { error: 'invalid_status' }

      const phones = await this.repository.getCandidatePhones(connection, preorder)
      return { phones }
    })
  }
}

module.exports = PreorderReadService
