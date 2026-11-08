'use strict'

const StoreRepository = require('../repositories/store.repository')
const BaseService = require('../core/base/base.service')
const { isConnected } = require('../config/database')
const { isSuperAdmin } = require('../middleware/unified-auth')
const { PAGINATION } = require('../config/constants')
const ReferenceOrderingService = require('./reference-ordering.service')
const XLSX = require('xlsx')

class StoreManagementService extends BaseService {
  constructor({ repository = new StoreRepository(), databaseConnected = isConnected, superAdminCheck = isSuperAdmin } = {}) {
    super()
    this.repository = repository
    this.connected = databaseConnected
    this.superAdminCheck = superAdminCheck
    this.ordering = new ReferenceOrderingService({ repository, domain: 'stores' })
  }

  ensureConnected() { if (!this.connected()) throw this.createError('数据库未连接', 500, 'DATABASE_UNAVAILABLE') }

  validateId(id) { if (!id || isNaN(parseInt(id))) throw this.createError('无效的店铺ID', 400, 'INVALID_ID') }

  format(row) {
    return { id: Number(row.id), name: String(row.name || ''), address: String(row.location || ''), phone: String(row.phone || ''),
      manager: String(row.manager_name || ''), manager_id: row.manager_id ? Number(row.manager_id) : null,
      status: Number(row.status) || 0, sort_order: Number(row.sort_order) || 0,
      created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
      updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null }
  }

  async selectStoreById(id) {
    const row = await this.repository.selectManagementStore(id)
    return row ? this.format(row) : null
  }

  async resolveManagerAssignment(rawManagerId, fallbackPhone = '') {
    const phone = String(fallbackPhone || '').trim()
    if (rawManagerId === undefined || rawManagerId === null || rawManagerId === '') return { manager_id: null, phone }
    const managerId = Number.parseInt(rawManagerId, 10)
    if (!Number.isInteger(managerId) || managerId <= 0) throw this.createError('请选择有效的门店负责人', 400, 'INVALID_MANAGER')
    const employee = await this.repository.selectActiveManager(managerId)
    if (!employee) throw this.createError('所选负责人不存在或已停用，请重新选择', 400, 'INVALID_MANAGER')
    return { manager_id: managerId, phone: String(employee.phone || '').trim() }
  }

  async list(query = {}, actor) {
    this.ensureConnected()
    const { name, status, all = false, strict_scope = false } = query
    if (all === 'true' || all === true) {
      const strictStoreScope = strict_scope === 'true' || strict_scope === true
      let storeIds
      if (strictStoreScope && !this.superAdminCheck(actor)) {
        storeIds = Array.isArray(actor?.store_ids) ? actor.store_ids.map(Number).filter(id => Number.isInteger(id) && id > 0) : []
        if (storeIds.length === 0) return []
      }
      return (await this.repository.listManagementOptions({ name, storeIds })).map(row => ({ id: parseInt(row.id), name: String(row.name || ''), sort_order: parseInt(row.sort_order) || 0 }))
    }
    const page = Math.max(1, Number.parseInt(query.page, 10) || PAGINATION.DEFAULT_PAGE)
    const pageSize = Math.min(1000, Math.max(1, Number.parseInt(query.page_size, 10) || PAGINATION.DEFAULT_LIMIT))
    let parsedStatus
    if (status !== undefined && status !== null && status !== '') {
      parsedStatus = parseInt(status)
      if (isNaN(parsedStatus)) throw this.createError('无效的状态值', 400, 'INVALID_STATUS')
    }
    const result = await this.repository.listManagementStores({ name, status: parsedStatus, limit: pageSize, offset: Math.max(0, (page - 1) * pageSize) })
    return { data: result.rows.map(row => this.format(row)), pagination: { page, page_size: pageSize, total: result.total,
      total_pages: Math.ceil(result.total / pageSize), has_next: page * pageSize < result.total, has_prev: page > 1 } }
  }

  async export(query = {}) {
    this.ensureConnected()
    const status = query.status !== undefined && query.status !== null && query.status !== '' ? parseInt(query.status, 10) : undefined
    const rows = (await this.repository.exportManagementStores({ name: query.name ? String(query.name).trim() : '', status })).map(row => ({
      ID: row.id, 门店名称: row.name || '', 地址: row.location || '', 电话: row.phone || '', 店长: row.manager_name || '',
      状态: Number(row.status) === 1 ? '正常' : '禁用', 排序: row.sort_order || 0, 创建时间: row.created_at || '', 更新时间: row.updated_at || ''
    }))
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), '门店管理')
    const date = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()).replace(/\//g, '-')
    return { filename: `门店管理_${date}.xlsx`, buffer: XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) }
  }

  async create(body) {
    const { name, address, phone, manager_id, status = 1, sort_order = 0 } = body
    if (!name || !name.trim()) throw this.createError('店铺名称不能为空', 400, 'INVALID_NAME')
    this.ensureConnected()
    const manager = await this.resolveManagerAssignment(manager_id, phone)
    if (await this.repository.hasManagementDuplicate(name.trim())) throw this.createError(`店铺名称"${name}"已存在，请使用其他名称`, 409, 'DUPLICATE')
    const id = await this.repository.createManagementStore([name.trim(), address || '', manager.phone, manager.manager_id, parseInt(status), parseInt(sort_order)])
    if (!id) throw this.createError('店铺创建失败', 500, 'CREATE_FAILED')
    return this.selectStoreById(id)
  }

  async update(id, body) {
    const { name, address, phone, manager_id, status, sort_order } = body
    this.validateId(id)
    if (!name || !name.trim()) throw this.createError('店铺名称不能为空', 400, 'INVALID_NAME')
    this.ensureConnected()
    const manager = await this.resolveManagerAssignment(manager_id, phone)
    const parsedId = parseInt(id)
    const currentName = await this.repository.currentManagementName(parsedId)
    if (name && name !== currentName && await this.repository.hasManagementDuplicate(name.trim(), parsedId)) {
      throw this.createError(`店铺名称"${name}"已存在，请使用其他名称`, 409, 'DUPLICATE')
    }
    const affected = await this.repository.updateManagementStore([name.trim(), address || '', manager.phone, manager.manager_id, parseInt(status), parseInt(sort_order) || 0, parsedId])
    if (!affected) throw this.createError('店铺不存在', 404, 'NOT_FOUND')
    return this.selectStoreById(parsedId)
  }

  async remove(id) {
    this.validateId(id)
    this.ensureConnected()
    if (!(await this.repository.removeManagementStore(parseInt(id)))) throw this.createError('店铺不存在', 404, 'NOT_FOUND')
  }

  async managers() {
    this.ensureConnected()
    return (await this.repository.listManagementManagers()).map(row => ({ id: Number(row.id), name: String(row.name || row.username || ''),
      username: String(row.username || ''), phone: String(row.phone || ''), role: String(row.roles || '') }))
  }

  async stats(query = {}) {
    this.ensureConnected()
    const row = await this.repository.getManagementStats({ name: String(query.name || '').trim(), status: String(query.status ?? '').trim() })
    return Object.fromEntries(['total', 'active', 'inactive', 'with_manager', 'with_phone', 'recent'].map(field => [field, parseInt(row[field]) || 0]))
  }

  async reorder(items) {
    if (!Array.isArray(items) || items.length === 0) throw this.createError('请提供有效的排序数据', 400, 'INVALID_ITEMS')
    this.ensureConnected()
    await this.ordering.reorder(items)
  }

  async get(id) {
    this.validateId(id)
    this.ensureConnected()
    const store = await this.selectStoreById(Number.parseInt(id, 10))
    if (!store) throw this.createError('店铺不存在', 404, 'NOT_FOUND')
    return store
  }
}

module.exports = StoreManagementService
