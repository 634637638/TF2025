'use strict'

const BaseService = require('../core/base/base.service')
const ModelRepository = require('../repositories/model.repository')
const { isConnected } = require('../config/database')
const { PAGINATION } = require('../config/constants')
const { normalizeReferencePagination, buildPagination, listModelsByBrand } = require('./reference-options.service')
const ReferenceOrderingService = require('./reference-ordering.service')

class ModelManagementService extends BaseService {
  constructor({ repository = new ModelRepository(), databaseConnected = isConnected, modelsByBrand = listModelsByBrand } = {}) {
    super()
    this.repository = repository
    this.connected = databaseConnected
    this.modelsByBrand = modelsByBrand
    this.ordering = new ReferenceOrderingService({ repository, domain: 'models' })
  }

  ensureConnected() {
    if (!this.connected()) throw this.createError('数据库未连接', 500, 'DATABASE_UNAVAILABLE')
  }

  format(row) {
    return {
      id: Number(row.id), brand_id: Number(row.brand_id),
      ...(row.brand_name !== undefined ? { brand_name: String(row.brand_name || '').trim() } : {}),
      name: String(row.name || '').trim(), status: Number(row.status) || 0, sort_order: Number(row.sort_order) || 0,
      created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
      updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null
    }
  }

  async list(query = {}) {
    this.ensureConnected()
    const { brand_id, name, include_id } = query
    const returnAll = query.all === 'true' || query.all === true
    if (returnAll && (query.active_only === 'true' || query.active_only === true)) {
      return (await this.modelsByBrand({ brand_id, name, include_id, activeOnly: true })).map(row => this.format(row))
    }
    const paging = normalizeReferencePagination({ page: query.page, page_size: query.page_size,
      defaultPage: PAGINATION.DEFAULT_PAGE, defaultPageSize: PAGINATION.DEFAULT_LIMIT, maxPageSize: PAGINATION.MAX_LIMIT })
    const result = await this.repository.listManagement({ brandId: brand_id, name, status: query.status,
      sortBy: query.sort_by, sortOrder: query.sort_order, returnAll, limit: paging.page_size, offset: paging.offset })
    const models = result.rows.map(row => this.format(row))
    return returnAll ? models : { models, pagination: buildPagination(paging.page, paging.page_size, result.total) }
  }

  async listByBrand(brandId, query = {}) {
    this.ensureConnected()
    const limit = Math.min(PAGINATION.MAX_LIMIT, Math.max(1, parseInt(query.page_size) || PAGINATION.DEFAULT_LIMIT))
    const page = parseInt(query.page) || 1
    const result = await this.repository.listManagement({ brandId, name: query.name, status: query.status,
      sortBy: query.sort_by, sortOrder: query.sort_order, byBrand: true, limit, offset: (page - 1) * limit })
    return { models: result.rows.map(row => this.format(row)), pagination: buildPagination(page, limit, result.total) }
  }

  async stats(query = {}) {
    this.ensureConnected()
    const rows = await this.repository.getManagementStats({ brandId: query.brand_id, name: String(query.name || '').trim(), status: query.status })
    const by_brand = {}
    for (const row of rows) {
      const name = String(row.brand_name || `品牌${row.brand_id}`)
      by_brand[name] = (by_brand[name] || 0) + 1
    }
    return { total: rows.length, active: rows.filter(row => Number(row.status) === 1).length,
      inactive: rows.filter(row => Number(row.status) === 0).length, related_brands: new Set(rows.map(row => Number(row.brand_id))).size,
      by_brand, newest_model: rows.length ? String(rows[0].name || '') : null }
  }

  async get(id) {
    this.ensureConnected()
    const row = await this.repository.getManagementRecord(parseInt(id))
    if (!row) throw this.createError('型号不存在', 404, 'NOT_FOUND')
    return this.format(row)
  }

  async create(body) {
    this.ensureConnected()
    const { brand_id, name, status, sort_order } = body
    if (!brand_id || !name) throw this.createError('品牌ID和型号名称不能为空', 400, 'INVALID_INPUT')
    if (await this.repository.hasManagementDuplicate(name, parseInt(brand_id))) throw this.createError('该品牌下已存在相同型号名称', 400, 'DUPLICATE')
    const id = await this.repository.insertManagementModel([parseInt(brand_id), name, status !== undefined ? parseInt(status) : 1, sort_order !== undefined ? parseInt(sort_order) : 0])
    return this.format(await this.repository.getManagementRecord(id))
  }

  async update(id, body) {
    this.ensureConnected()
    const parsedId = parseInt(id)
    const row = await this.repository.getManagementRecord(parsedId, { withBrand: false })
    if (!row) throw this.createError('型号不存在', 404, 'NOT_FOUND')
    if (body.name !== undefined || body.brand_id !== undefined) {
      const name = body.name !== undefined ? body.name : row.name
      const brandId = body.brand_id !== undefined ? parseInt(body.brand_id) : Number(row.brand_id)
      if (await this.repository.hasManagementDuplicate(name, brandId, parsedId)) throw this.createError('该品牌下已存在相同型号名称', 400, 'DUPLICATE')
    }
    const changes = {}
    for (const field of ['brand_id', 'name', 'status', 'sort_order']) {
      if (body[field] !== undefined) changes[field] = field === 'name' ? body[field] : parseInt(body[field])
    }
    if (Object.keys(changes).length === 0) throw this.createError('没有要更新的字段', 400, 'EMPTY_UPDATE')
    await this.repository.updateManagementModel(parsedId, changes)
    return this.format(await this.repository.getManagementRecord(parsedId))
  }

  async remove(id) {
    this.ensureConnected()
    const parsedId = parseInt(id)
    const row = await this.repository.getManagementRecord(parsedId, { withBrand: false })
    if (!row) throw this.createError('型号不存在', 404, 'NOT_FOUND')
    await this.repository.removeManagementModel(parsedId)
    return this.format(row)
  }

  async toggle(id) {
    this.ensureConnected()
    const parsedId = parseInt(id)
    const row = await this.repository.getManagementRecord(parsedId, { withBrand: false })
    if (!row) throw this.createError('型号不存在', 404, 'NOT_FOUND')
    const status = row.status === 1 ? 0 : 1
    await this.repository.toggleManagementStatus(parsedId, status)
    return { data: this.format(await this.repository.getManagementRecord(parsedId)), status }
  }

  async reorder(items) {
    this.ensureConnected()
    if (!Array.isArray(items) || items.length === 0) throw this.createError('请提供有效的排序数据', 400, 'INVALID_ITEMS')
    await this.ordering.reorder(items)
  }
}

module.exports = ModelManagementService
