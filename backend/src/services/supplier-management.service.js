'use strict'

const BaseService = require('../core/base/base.service')
const SupplierManagementRepository = require('../repositories/supplier-management.repository')
const SupplierOrderingService = require('./supplier-ordering.service')
const { isConnected } = require('../config/database')
const { normalizeReferencePagination, buildPagination } = require('../utils/reference-options')

const DEFAULT_PAGE_SIZE = 100
const MAX_PAGE_SIZE = 10000

const parseSupplierId = value => {
  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

const normalizeNullableString = value => value === null || value === undefined ? null : String(value).trim()

const formatSupplier = row => ({
  id: Number(row.id),
  name: String(row.name || '').trim(),
  contact: normalizeNullableString(row.contact),
  phone: normalizeNullableString(row.phone),
  address: normalizeNullableString(row.address),
  bank_info: normalizeNullableString(row.bank_info),
  tax_number: normalizeNullableString(row.tax_number),
  status: Number(row.status) === 1 ? 1 : 0,
  sort_order: Number(row.sort_order) || 0,
  remarks: normalizeNullableString(row.remarks),
  created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
  updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null
})

const parseStatus = value => {
  if (value === undefined || value === null || value === '') return null
  const parsed = Number(value)
  return parsed === 0 || parsed === 1 ? parsed : undefined
}

class SupplierManagementService extends BaseService {
  constructor({ database, connected = isConnected, orderingService = new SupplierOrderingService({ database }), repository = new SupplierManagementRepository({ database }) } = {}) {
    super()
    this.repository = repository
    this.connected = connected
    this.orderingService = orderingService
  }

  async list(query) {
    if (!this.connected()) throw this.createError('数据库未连接', 500)
    const {
      page = 1,
      page_size = DEFAULT_PAGE_SIZE,
      all = false,
      name,
      status,
      sort_by,
      sort_order
    } = query
    const { page: pageNum, page_size: pageSizeNum, offset } = normalizeReferencePagination({
      page,
      page_size,
      defaultPage: 1,
      defaultPageSize: DEFAULT_PAGE_SIZE,
      maxPageSize: MAX_PAGE_SIZE
    })
    const statusValue = parseStatus(status)
    if (statusValue === undefined) throw this.createError('供应商状态只能是0或1', 400)

    const filters = { name: normalizeNullableString(name), status: statusValue }
    if (all === 'true' || all === true) {
      const [supplierRows] = await this.repository.list(filters, { all: true, sort_by, sort_order })
      return { rows: supplierRows.map(formatSupplier), all: true }
    }

    const [[supplierRows], [countRows]] = await Promise.all([
      this.repository.list(filters, { page_size: pageSizeNum, offset, sort_by, sort_order }),
      this.repository.count(filters)
    ])
    const total = Number(countRows[0]?.total) || 0
    const pagination = buildPagination(pageNum, pageSizeNum, total)
    return { rows: supplierRows.map(formatSupplier), pagination, all: false }
  }

  async stats(query) {
    if (!this.connected()) throw this.createError('数据库未连接', 500)
    const normalizedName = normalizeNullableString(query.name)
    const statusValue = parseStatus(query.status)
    if (statusValue === undefined) throw this.createError('供应商状态只能是0或1', 400)
    const filters = { name: normalizedName, status: statusValue }
    const [rows] = await this.repository.stats(filters)
    const row = rows[0] || {}
    return {
      total: Number(row.total) || 0,
      active: Number(row.active) || 0,
      inactive: Number(row.inactive) || 0,
      phone_completion: Number(row.phone_completion) || 0
    }
  }

  async export(query) {
    if (!this.connected()) throw this.createError('数据库未连接', 500)
    const { name, status } = query
    const statusValue = parseStatus(status)
    if (statusValue === undefined) throw this.createError('供应商状态只能是0或1', 400)
    const filters = { name: normalizeNullableString(name), status: statusValue }
    const [suppliers] = await this.repository.exportRows(filters)
    const csvHeaders = [
      'ID', '供应商名称', '联系人', '联系电话', '地址', '银行信息',
      '税号', '状态', '排序', '备注', '创建时间', '更新时间'
    ]
    const escapeCsvValue = value => value === null || value === undefined ? '""' : `"${String(value).replace(/"/g, '""')}"`
    const csvRows = suppliers.map(row => ([
      row.id, row.name, row.contact, row.phone, row.address, row.bank_info,
      row.tax_number, Number(row.status) === 1 ? '启用' : '禁用', row.sort_order,
      row.remarks, row.created_at, row.updated_at
    ].map(escapeCsvValue).join(',')))
    const csvContent = `\ufeff${csvHeaders.join(',')}\n${csvRows.join('\n')}`
    return { filename: `suppliers_${Date.now()}.csv`, content: csvContent }
  }

  async reorder(body) {

    if (!this.connected()) throw this.createError('数据库未连接', 500)
    const { items } = body
    if (!Array.isArray(items) || items.length === 0) throw this.createError('请提供有效的排序数据', 400)
    const normalizedItems = items.map(item => ({
      id: parseSupplierId(item?.id),
      sort_order: Number.parseInt(item?.sort_order, 10)
    }))
    if (normalizedItems.some(item => item.id === null || !Number.isInteger(item.sort_order) || item.sort_order < 0)) {
      throw this.createError('排序数据包含无效字段', 400)
    }
    
    const result = await this.orderingService.reorder(normalizedItems)
    return result
  }

  async create(body) {
    if (!this.connected()) throw this.createError('数据库未连接', 500)
    const {
      name, contact, phone, address, bank_info, tax_number,
      status = 1, sort_order = 0, remarks
    } = body
    const normalizedName = normalizeNullableString(name)
    const statusValue = parseStatus(status)
    const sortOrderValue = Number.parseInt(sort_order, 10)
    if (!normalizedName) throw this.createError('供应商名称不能为空', 400)
    if (statusValue === undefined || statusValue === null) throw this.createError('供应商状态只能是0或1', 400)
    if (!Number.isInteger(sortOrderValue) || sortOrderValue < 0) throw this.createError('排序值必须是非负整数', 400)
    const [existingSuppliers] = await this.repository.findDuplicate(normalizedName)
    if (existingSuppliers.length > 0) throw this.createError(`供应商名称"${normalizedName}"已存在，请使用其他名称`, 409)
    const [result] = await this.repository.create([
      normalizedName,
      normalizeNullableString(contact),
      normalizeNullableString(phone),
      normalizeNullableString(address),
      normalizeNullableString(bank_info),
      normalizeNullableString(tax_number),
      statusValue,
      sortOrderValue,
      normalizeNullableString(remarks)
    ])
    return { id: Number(result.insertId) }
  }

  async update(id, body) {
    if (!this.connected()) throw this.createError('数据库未连接', 500)
    const supplierId = parseSupplierId(id)
    if (supplierId === null) throw this.createError('无效的供应商ID', 400)
    const {
      name, contact, phone, address, bank_info, tax_number,
      status, sort_order, remarks
    } = body
    const normalizedName = normalizeNullableString(name)
    const statusValue = parseStatus(status)
    const sortOrderValue = Number.parseInt(sort_order, 10)
    if (!normalizedName) throw this.createError('供应商名称不能为空', 400)
    if (statusValue === undefined || statusValue === null) throw this.createError('供应商状态只能是0或1', 400)
    if (!Number.isInteger(sortOrderValue) || sortOrderValue < 0) throw this.createError('排序值必须是非负整数', 400)
    const [duplicateRows] = await this.repository.findDuplicate(normalizedName, supplierId)
    if (duplicateRows.length > 0) throw this.createError(`供应商名称"${normalizedName}"已存在，请使用其他名称`, 409)
    const [result] = await this.repository.update([
      normalizedName,
      normalizeNullableString(contact),
      normalizeNullableString(phone),
      normalizeNullableString(address),
      normalizeNullableString(bank_info),
      normalizeNullableString(tax_number),
      statusValue,
      sortOrderValue,
      normalizeNullableString(remarks),
      supplierId
    ])
    if (result.affectedRows === 0) throw this.createError('供应商不存在', 404)
    return null
  }

  async remove(id) {
    if (!this.connected()) throw this.createError('数据库未连接', 500)
    const supplierId = parseSupplierId(id)
    if (supplierId === null) throw this.createError('无效的供应商ID', 400)
    const [[accessoryRows], [phoneRows]] = await Promise.all([
      this.repository.countAccessories(supplierId),
      this.repository.countPhones(supplierId)
    ])
    const accessory_count = Number(accessoryRows[0]?.count) || 0
    const phone_count = Number(phoneRows[0]?.count) || 0
    if (accessory_count > 0 || phone_count > 0) {
      const details = []
      if (accessory_count > 0) details.push(`${accessory_count}个配件`)
      if (phone_count > 0) details.push(`${phone_count}个手机`)
      throw this.createError(`该供应商下还有关联的商品，无法删除（${details.join('，')}）`, 409)
    }
    const [result] = await this.repository.remove(supplierId)
    if (result.affectedRows === 0) throw this.createError('供应商不存在', 404)
    return null
  }

  async detail(id) {
    if (!this.connected()) throw this.createError('数据库未连接', 500)
    const supplierId = parseSupplierId(id)
    if (supplierId === null) throw this.createError('无效的供应商ID', 400)
    const [[supplierRows], [accessoryStats], [phoneStats]] = await Promise.all([
      this.repository.findById(supplierId),
      this.repository.accessoryStats(supplierId),
      this.repository.phoneStats(supplierId)
    ])
    if (supplierRows.length === 0) throw this.createError('供应商不存在', 404)
    return {
      ...formatSupplier(supplierRows[0]),
      stats: {
        accessories_count: Number(accessoryStats[0]?.count) || 0,
        accessories_total_cost: Number(accessoryStats[0]?.total_cost) || 0,
        phones_count: Number(phoneStats[0]?.count) || 0,
        phones_total_cost: Number(phoneStats[0]?.total_cost) || 0
      }
    }
  }
}

module.exports = SupplierManagementService
