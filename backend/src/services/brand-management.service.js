'use strict'

const { isConnected } = require('../config/database')
const { PAGINATION } = require('../config/constants')
const BrandRepository = require('../repositories/brand.repository')

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
      status: String(query.status ?? '').trim()
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
      suggest: query.suggest
    })
    const brands = result.brands.map(row => ({
      id: parseInt(row.id),
      name: String(row.name || '').trim(),
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
    const unavailable = this.ensureConnected()
    if (unavailable) return unavailable
    const name = body.name.trim()
    const status = body.status === undefined ? 1 : parseInt(body.status)
    const sortOrder = body.sort_order === undefined ? 0 : parseInt(body.sort_order)
    const result = await this.repository.createManagementBrand({
      name,
      status,
      sortOrder
    })
    if (result.type === 'duplicate') return result
    return {
      type: 'created',
      data: { id: result.id, name, status, sort_order: sortOrder }
    }
  }

  async update(id, body = {}) {
    const unavailable = this.ensureConnected()
    if (unavailable) return unavailable
    if (!body.name || body.name.trim() === '') return { type: 'empty-name' }
    const name = body.name.trim()
    const update = {
      id,
      name,
      status: parseInt(body.status) || 0,
      sortOrder: parseInt(body.sort_order) || 0
    }
    const result = await this.repository.updateManagementBrand(update)
    if (result.type !== 'updated') return result
    return { ...result, data: { id: parseInt(id), name, status: update.status, sort_order: update.sortOrder } }
  }

  async reorder(items) {
    const unavailable = this.ensureConnected()
    if (unavailable) return unavailable
    if (!Array.isArray(items) || items.length === 0) return { type: 'invalid-items' }
    await this.repository.reorderManagementBrands(items)
    return { type: 'success' }
  }

  async remove(id) {
    const unavailable = this.ensureConnected()
    if (unavailable) return unavailable
    return this.repository.deleteManagementBrand(id)
  }

  async suggest(query = {}) {
    const unavailable = this.ensureConnected()
    if (unavailable) return unavailable
    const name = query.name
    if (!name || name.trim() === '') return { type: 'success', data: [] }
    return { type: 'success', data: await this.repository.getManagementSuggestions(name) }
  }
}

module.exports = BrandManagementService
