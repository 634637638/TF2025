'use strict'

const BaseService = require('../core/base/base.service')

const SEARCHABLE_FIELDS = [
  ['basic_info.order_no', 'r.order_no'],
  ['customer_info.customer_name', 'c.name'],
  ['customer_info.customer_phone', 'c.phone'],
  ['device_info.phone_model', 'r.phone_model'],
  ['device_info.imei', 'r.imei'],
  ['device_info.serial_number', 'r.serial_number']
]

const requestError = (message, statusCode, code) => Object.assign(new Error(message), { statusCode, code })

class RepairReadService extends BaseService {
  constructor({ repository, getHiddenFields, validStatuses, parseId, normalizeRepairRow, maskRepairItem, maskRepairList } = {}) {
    super()
    if (!repository) throw new TypeError('RepairReadService requires repository')
    if (typeof getHiddenFields !== 'function') throw new TypeError('RepairReadService requires getHiddenFields')
    if (!(validStatuses instanceof Set)) throw new TypeError('RepairReadService requires validStatuses')
    for (const [name, dependency] of Object.entries({ parseId, normalizeRepairRow, maskRepairItem, maskRepairList })) {
      if (typeof dependency !== 'function') throw new TypeError(`RepairReadService requires ${name}`)
    }
    this.repository = repository
    this.getHiddenFields = getHiddenFields
    this.validStatuses = validStatuses
    this.parseId = parseId
    this.normalizeRepairRow = normalizeRepairRow
    this.maskRepairItem = maskRepairItem
    this.maskRepairList = maskRepairList
  }

  async getList(req) {
    const userId = this.getActorId(req.user)
    await this.repository.ensureReady()
    const hiddenFields = await this.getHiddenFields(req)
    const page = Math.max(1, Number.parseInt(String(req.query.page || 1), 10) || 1)
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(String(req.query.page_size || 20), 10) || 20))
    const search = String(req.query.search || '').trim()
    const status = String(req.query.status || '').trim()
    if (status && status !== 'all' && hiddenFields.has('status_info.status')) {
      throw requestError('不能使用已隐藏的状态筛选字段', 403, 'FIELD_PERMISSION_DENIED')
    }
    if (status && status !== 'all' && !this.validStatuses.has(status)) {
      throw requestError('维修状态无效', 400, 'BAD_REQUEST')
    }

    const conditions = []
    const params = []
    if (status && status !== 'all') {
      conditions.push('r.status = ?')
      params.push(status)
    }
    if (search) {
      const searchableColumns = SEARCHABLE_FIELDS.filter(([fieldId]) => !hiddenFields.has(fieldId))
      if (searchableColumns.length === 0) {
        throw requestError('没有可用的维修搜索字段', 403, 'FIELD_PERMISSION_DENIED')
      }
      conditions.push(`(${searchableColumns.map(([, column]) => `${column} LIKE ?`).join(' OR ')})`)
      const pattern = `%${search}%`
      params.push(...searchableColumns.map(() => pattern))
    }

    const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : ''
    const { rows, total } = await this.repository.getList(where, params, pageSize, (page - 1) * pageSize)
    const totalPages = Math.ceil(total / pageSize)
    return {
      records: await this.maskRepairList(rows.map(row => this.normalizeRepairRow(row, userId)), req),
      pagination: {
        page,
        page_size: pageSize,
        total,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_prev: page > 1
      }
    }
  }

  async getStats(req) {
    await this.repository.ensureReady()
    const hiddenFields = await this.getHiddenFields(req)
    const search = String(req.query.search || '').trim()
    const status = String(req.query.status || '').trim()
    if (status && status !== 'all' && hiddenFields.has('status_info.status')) {
      throw requestError('不能使用已隐藏的状态筛选字段', 403, 'FIELD_PERMISSION_DENIED')
    }
    if (status && status !== 'all' && !this.validStatuses.has(status)) {
      throw requestError('维修状态无效', 400, 'BAD_REQUEST')
    }

    const conditions = []
    const params = []
    if (status && status !== 'all') {
      conditions.push('r.status = ?')
      params.push(status)
    }
    if (search) {
      const searchableColumns = SEARCHABLE_FIELDS.filter(([fieldId]) => !hiddenFields.has(fieldId))
      if (searchableColumns.length === 0) {
        throw requestError('没有可用的维修搜索字段', 403, 'FIELD_PERMISSION_DENIED')
      }
      const pattern = `%${search}%`
      conditions.push(`(${searchableColumns.map(([, column]) => `${column} LIKE ?`).join(' OR ')})`)
      params.push(...searchableColumns.map(() => pattern))
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const rows = await this.repository.getStatistics(where, params)
    if (!rows.length) throw new Error('维修统计查询未返回结果')
    return this.maskRepairItem({
      pending: Number(rows[0].pending),
      processing: Number(rows[0].processing),
      completed: Number(rows[0].completed),
      monthly_revenue: Number(rows[0].monthly_revenue)
    }, req)
  }

  async getDetail(idValue, req) {
    const userId = this.getActorId(req.user)
    const id = this.parseId(idValue)
    if (!id) throw requestError('维修单编号无效', 400, 'BAD_REQUEST')
    const row = await this.repository.getDetail(id)
    if (!row) return null
    return this.maskRepairItem(this.normalizeRepairRow(row, userId), req)
  }
}

module.exports = RepairReadService
