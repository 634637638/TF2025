'use strict'

const { isConnected } = require('../config/database')
const { PAGINATION } = require('../config/constants')
const BrandRepository = require('../repositories/brand.repository')
const { parseReferenceInput, parseReferenceId, parseReferenceOrder } = require('../utils/reference-options')

const normalizeScope = (value, fallback) => {
  const scope = value === undefined ? fallback : value
  if (!['phone', 'accessory', 'both', 'all'].includes(scope)) {
    const error = new Error('业务范围必须为手机、配件或两者')
    error.statusCode = 400
    throw error
  }
  return scope
}

class BrandManagementService {
  constructor({ repository = new BrandRepository(), connected = isConnected } = {}) {
    this.repository = repository
    this.connected = connected
  }

  ensureConnected() {
    if (!this.connected()) return { type: 'unavailable' }
  }

  async getStats(query = {}) {
    const unavailable = this.ensureConnected()
    if (unavailable) return unavailable
    const stats = await this.repository.getManagementStats({
      name: String(query.name || '').trim(),
      status: String(query.status ?? '').trim(),
      businessScope: normalizeScope(query.business_scope, 'all')
    })
    return {
      type: 'success',
      data: {
        total: Number(stats.total) || 0,
        active: Number(stats.active) || 0,
        inactive: Number(stats.inactive) || 0,
        related_phones: Number(stats.related_phones) || 0
      }
    }
  }

  async list(query = {}) {
    const unavailable = this.ensureConnected()
    if (unavailable) return unavailable
    const pageSize = parseInt(query.page_size) || PAGINATION.DEFAULT_LIMIT
    const page = parseInt(query.page) || PAGINATION.DEFAULT_PAGE
    const returnAll = query.all === 'true' || query.all === true
    const result = await this.repository.listManagement({
      name: query.name,
      status: query.status,
      pageSize,
      offset: (page - 1) * pageSize,
      returnAll,
      suggest: query.suggest,
      businessScope: normalizeScope(query.business_scope, 'phone')
    })
    const brands = result.brands.map(row => ({
      id: parseInt(row.id),
      name: String(row.name || '').trim(),
      business_scope: row.business_scope || 'both',
      status: parseInt(row.status) || 0,
      sort_order: parseInt(row.sort_order) || 0,
      created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
      updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null
    }))
    if (returnAll || (!query.page && !query.page_size)) return { type: 'success', data: brands }
    const total = parseInt(result.total) || 0
    const totalPages = Math.ceil(total / pageSize)
    return {
      type: 'success',
      data: {
        data: brands,
        pagination: {
          page,
          page_size: pageSize,
          total,
          total_pages: totalPages,
          has_next: page < totalPages,
          has_prev: page > 1
        },
        ...(query.suggest === 'true' ? { suggestions: result.suggestions } : {})
      }
    }
  }

  async create(body = {}) {
    body = parseReferenceInput(body, { required: true })
    const unavailable = this.ensureConnected()
    if (unavailable) return unavailable
    const name = body.name.trim()
    const status = body.status ?? 1
    const sortOrder = body.sort_order ?? 0
    const businessScope = normalizeScope(body.business_scope, 'both')
    if (businessScope === 'all') return { type: 'invalid-scope' }
    const result = await this.repository.createManagementBrand({
      name,
      status,
      sortOrder,
      businessScope
    })
    if (result.type === 'duplicate') return result
    return {
      type: 'created',
      data: { id: result.id, name, status, sort_order: sortOrder, business_scope: businessScope }
    }
  }

  async update(id, body = {}) {
    id = parseReferenceId(id)
    body = parseReferenceInput(body, { required: true, message: '品牌名称不能为空或格式不正确' })
    const unavailable = this.ensureConnected()
    if (unavailable) return unavailable
    if (!body.name || body.name.trim() === '') return { type: 'empty-name' }
    const name = body.name.trim()
    const businessScope = body.business_scope === undefined ? undefined : normalizeScope(body.business_scope)
    if (businessScope === 'all') return { type: 'invalid-scope' }
    const update = {
      id,
      name,
      status: body.status ?? 0,
      sortOrder: body.sort_order ?? 0,
      businessScope
    }
    const result = await this.repository.updateManagementBrand(update)
    if (result.type !== 'updated') return result
    return { ...result, data: { id: parseInt(id), name, status: update.status, sort_order: update.sortOrder, ...(businessScope === undefined ? {} : { business_scope: businessScope }) } }
  }

  async reorder(items) {
    const unavailable = this.ensureConnected()
    if (unavailable) return unavailable
    if (!Array.isArray(items) || items.length === 0) return { type: 'invalid-items' }
    items = parseReferenceOrder(items)
    await this.repository.reorderManagementBrands(items)
    return { type: 'success' }
  }

  async remove(id) {
    id = parseReferenceId(id)
    const unavailable = this.ensureConnected()
    if (unavailable) return unavailable
    return this.repository.deleteManagementBrand(id)
  }

  async suggest(query = {}) {
    const unavailable = this.ensureConnected()
    if (unavailable) return unavailable
    const name = query.name
    if (!name || name.trim() === '') return { type: 'success', data: [] }
    return { type: 'success', data: await this.repository.getManagementSuggestions(name, normalizeScope(query.business_scope, 'phone')) }
  }
}

module.exports = BrandManagementService
