'use strict'

const BaseService = require('../core/base/base.service')
const ColorRepository = require('../repositories/color.repository')
const MemoryRepository = require('../repositories/memory.repository')
const { isConnected } = require('../config/database')
const { PAGINATION } = require('../config/constants')
const { normalizeReferencePagination, buildPagination } = require('./reference-options.service')
const ReferenceOrderingService = require('./reference-ordering.service')

const MEMORY_FORMAT_ERROR = '内存规格格式不正确！\n正确格式示例：\n• 纯存储：64GB、128GB、256GB、512GB\n• 组合格式：6+128GB、8+256GB、12+512GB\n• 不能包含中文或特殊字符（除+号外）'

class ReferenceManagementService extends BaseService {
  constructor({ domain, repository, connected = isConnected }) {
    super()
    if (!['colors', 'memories'].includes(domain)) throw new TypeError('不支持的基础资料类型')
    this.domain = domain
    this.field = domain === 'colors' ? 'name' : 'size'
    this.label = domain === 'colors' ? '颜色' : '内存规格'
    this.repository = repository || (domain === 'colors' ? new ColorRepository() : new MemoryRepository())
    this.connected = connected
    this.ordering = new ReferenceOrderingService({ repository: this.repository, domain })
  }

  ensureConnected() {
    if (!this.connected()) throw this.createError('数据库未连接', 500, 'DATABASE_UNAVAILABLE')
  }

  format(row) {
    const result = {
      id: Number(row.id),
      [this.field]: String(row[this.field] || '').trim(),
      status: Number(row.status) || 0,
      sort_order: Number(row.sort_order) || 0,
      created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
      updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null
    }
    if (this.field === 'size') {
      const size = result.size
      const storage = size.includes('+') ? size.split('+').pop() : size
      const match = String(storage || '').match(/^(\d+)([A-Za-z]+)?$/)
      Object.assign(result, {
        storage_size: match ? Number(match[1]) : null,
        storage_unit: match?.[2] ? match[2].toUpperCase() : null,
        is_combo: size.includes('+')
      })
    }
    return result
  }

  validateLabel(value) {
    const trimmed = value.trim()
    if (this.field === 'size' && !/^(\d+[a-zA-Z]+|\d+\+\d+[a-zA-Z]*)$/.test(trimmed)) {
      throw this.createError(MEMORY_FORMAT_ERROR, 400, 'INVALID_MEMORY')
    }
    return trimmed
  }

  async list(query = {}) {
    this.ensureConnected()
    const pagination = normalizeReferencePagination({
      page: query.page,
      page_size: query.page_size,
      defaultPage: PAGINATION.DEFAULT_PAGE,
      defaultPageSize: PAGINATION.DEFAULT_LIMIT,
      maxPageSize: PAGINATION.MAX_LIMIT
    })
    const returnAll = query.all === 'true' || query.all === true
    const result = await this.repository.listManagement({
      keyword: query[this.field], storageUnit: query.storage_unit, status: query.status,
      sortBy: query.sort_by, descending: String(query.sort_order || '').toLowerCase() === 'desc',
      returnAll, limit: pagination.page_size, offset: pagination.offset
    })
    const rows = result.rows.map(row => this.format(row))
    return returnAll ? rows : { [this.domain]: rows, pagination: buildPagination(pagination.page, pagination.page_size, result.total) }
  }

  async get(id) {
    this.ensureConnected()
    const row = await this.repository.getManagementRecord(parseInt(id))
    if (!row) throw this.createError(`${this.label}不存在`, 404, 'NOT_FOUND')
    return this.format(row)
  }

  async create(body) {
    this.ensureConnected()
    const value = body[this.field]
    if (!value) throw this.createError(this.field === 'name' ? '颜色名称不能为空' : '内存规格不能为空', 400, 'EMPTY_NAME')
    const label = this.validateLabel(value)
    if (await this.repository.hasManagementDuplicate(label)) {
      throw this.createError(this.field === 'name' ? '颜色名称已存在' : '该内存规格已存在', 400, 'DUPLICATE')
    }
    const id = await this.repository.insertManagementRecord({
      label, status: body.status !== undefined ? parseInt(body.status) : 1,
      sortOrder: this.field === 'size' ? (body.sort_order ? parseInt(body.sort_order) : 0) : (body.sort_order !== undefined ? parseInt(body.sort_order) : 0)
    })
    return this.format(await this.repository.getManagementRecord(id))
  }

  async update(id, body) {
    this.ensureConnected()
    const value = body[this.field]
    const label = value !== undefined ? this.validateLabel(value) : undefined
    if (!(await this.repository.existsManagementId(id))) throw this.createError(`${this.label}不存在`, 404, 'NOT_FOUND')
    const changes = {}
    if (this.field === 'size') {
      const current = await this.repository.currentManagementLabel(id)
      if (label !== undefined && label !== current) {
        if (await this.repository.hasManagementDuplicate(label, id)) throw this.createError(`已有存在${label}内存，请勿重复提交`, 409, 'DUPLICATE')
        changes.size = label
      }
      if (body.sort_order !== undefined) changes.sort_order = parseInt(body.sort_order)
      if (body.status !== undefined) changes.status = parseInt(body.status)
    } else {
      if (value && await this.repository.hasManagementDuplicate(label, id)) throw this.createError('颜色名称已存在', 400, 'DUPLICATE')
      if (label !== undefined) changes.name = label
      if (body.status !== undefined) changes.status = parseInt(body.status)
      if (body.sort_order !== undefined) changes.sort_order = parseInt(body.sort_order)
    }
    if (Object.keys(changes).length === 0) throw this.createError('没有提供要更新的字段', 400, 'EMPTY_UPDATE')
    await this.repository.updateManagementRecord(id, changes)
    return this.format(await this.repository.getManagementRecord(id))
  }

  async remove(id) {
    this.ensureConnected()
    const parsedId = parseInt(id)
    const row = await this.repository.getManagementRecord(parsedId)
    if (!row) throw this.createError(`${this.label}不存在`, 404, 'NOT_FOUND')
    await this.repository.removeManagementRecord(parsedId)
    return this.format(row)
  }

  async stats(query = {}) {
    this.ensureConnected()
    const row = await this.repository.getManagementStats({
      keyword: String(query[this.field] || '').trim(), status: String(query.status ?? '').trim(),
      storageUnit: String(query.storage_unit || '').trim()
    })
    return Object.fromEntries(['total', 'active', 'inactive', 'related_phones'].map(field => [field, Number(row[field]) || 0]))
  }

  async toggle(id) {
    this.ensureConnected()
    const parsedId = parseInt(id)
    const row = await this.repository.getManagementRecord(parsedId)
    if (!row) throw this.createError(`${this.label}不存在`, 404, 'NOT_FOUND')
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

module.exports = ReferenceManagementService
