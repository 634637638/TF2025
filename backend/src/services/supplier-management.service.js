'use strict'

const BaseService = require('../core/base/base.service')
const SupplierManagementRepository = require('../repositories/supplier-management.repository')
const SupplierOrderingService = require('./supplier-ordering.service')
const { isConnected } = require('../config/database')
const { normalizeReferencePagination, buildPagination, parseReferenceInput, parseReferenceOrder } = require('../utils/reference-options')
const { parseInput } = require('../middleware/validation')
const { isIntegerInput } = require('../utils/input-values')
const AccessoryPurchaseRepository = require('../repositories/accessory-purchase.repository')
const FieldAccessService = require('./field-access.service')
const { hasUnifiedPermission } = require('../middleware/unified-auth')
const { resolveStoreScope } = require('../utils/store-scope')

const DEFAULT_PAGE_SIZE = 100
const MAX_PAGE_SIZE = 10000

const parseSupplierId = value => {
  return isIntegerInput(value) && Number(value) > 0 ? Number(value) : null
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
  business_scope: row.business_scope || 'both',
  status: Number(row.status) === 1 ? 1 : 0,
  sort_order: Number(row.sort_order) || 0,
  remarks: normalizeNullableString(row.remarks),
  created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
  updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null
})

const parseStatus = value => {
  if (value === undefined || value === null || value === '') return null
  if (!isIntegerInput(value)) return undefined
  const parsed = Number(value)
  return parsed === 0 || parsed === 1 ? parsed : undefined
}

const parseBusinessScope = value => ['phone', 'accessory', 'both'].includes(value) ? value : undefined

const parseSupplierInput = body => parseInput(parseReferenceInput(body, { required: true, message: '供应商名称不能为空或格式不正确' }), {
  contact: { type: 'string', maxLength: 50, label: '联系人' },
  phone: { type: 'string', maxLength: 20, label: '联系电话' },
  address: { type: 'string', maxLength: 200, multiline: true, label: '地址' },
  bank_info: { type: 'string', maxLength: 200, multiline: true, label: '银行信息' },
  tax_number: { type: 'string', maxLength: 50, label: '税号' },
  remarks: { type: 'string', maxLength: 500, multiline: true, label: '备注' }
})

class SupplierManagementService extends BaseService {
  constructor({ database, connected = isConnected, orderingService = new SupplierOrderingService({ database }), repository = new SupplierManagementRepository({ database }),
    purchases = new AccessoryPurchaseRepository(), permissionCheck = hasUnifiedPermission,
    purchaseFields = new FieldAccessService({ moduleKey: 'payments_supplierphonepaymentsview', strict: true }),
    inventoryFields = new FieldAccessService({ moduleKey: 'inventory_inventoryview', strict: true }) } = {}) {
    super()
    this.repository = repository
    this.connected = connected
    this.orderingService = orderingService
    Object.assign(this, { purchases, permissionCheck, purchaseFields, inventoryFields })
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
    const normalizedItems = parseReferenceOrder(items)
    
    const result = await this.orderingService.reorder(normalizedItems)
    return result
  }

  async create(body) {
    body = parseSupplierInput(body)
    if (!this.connected()) throw this.createError('数据库未连接', 500)
    const {
      name, contact, phone, address, bank_info, tax_number, business_scope = 'both',
      status = 1, sort_order = 0, remarks
    } = body
    const normalizedName = normalizeNullableString(name)
    const statusValue = parseStatus(status)
    const scopeValue = parseBusinessScope(business_scope)
    const sortOrderValue = sort_order
    if (!normalizedName) throw this.createError('供应商名称不能为空', 400)
    if (statusValue === undefined || statusValue === null) throw this.createError('供应商状态只能是0或1', 400)
    if (!scopeValue) throw this.createError('供应商业务范围无效', 400)
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
      scopeValue,
      statusValue,
      sortOrderValue,
      normalizeNullableString(remarks)
    ])
    return { id: Number(result.insertId) }
  }

  async update(id, body) {
    body = parseSupplierInput(body)
    if (!this.connected()) throw this.createError('数据库未连接', 500)
    const supplierId = parseSupplierId(id)
    if (supplierId === null) throw this.createError('无效的供应商ID', 400)
    const {
      name, contact, phone, address, bank_info, tax_number, business_scope = 'both',
      status, sort_order, remarks
    } = body
    const normalizedName = normalizeNullableString(name)
    const statusValue = parseStatus(status)
    const scopeValue = parseBusinessScope(business_scope)
    const sortOrderValue = sort_order
    if (!normalizedName) throw this.createError('供应商名称不能为空', 400)
    if (statusValue === undefined || statusValue === null) throw this.createError('供应商状态只能是0或1', 400)
    if (!scopeValue) throw this.createError('供应商业务范围无效', 400)
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
      scopeValue,
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
    return this.repository.withConnection(async connection => {
      let started = false
      try {
        await connection.beginTransaction()
        started = true
        const [rows] = await this.repository.findById(supplierId, connection, true)
        if (!rows.length) throw this.createError('供应商不存在', 404)
        const [accessoryRows] = await this.repository.countAccessories(supplierId, connection)
        const [phoneRows] = await this.repository.countPhones(supplierId, connection)
        const accessoryCount = Number(accessoryRows[0]?.count) || 0
        const phoneCount = Number(phoneRows[0]?.count) || 0
        if (accessoryCount > 0 || phoneCount > 0) {
          const details = []
          if (accessoryCount > 0) details.push(`${accessoryCount}个配件`)
          if (phoneCount > 0) details.push(`${phoneCount}个手机`)
          throw this.createError(`该供应商下还有关联的商品，无法删除（${details.join('，')}）`, 409)
        }
        if (await this.repository.hasAccessoryHistory(supplierId, connection)) throw this.createError('该供应商存在商品采购或付款历史，请停用并保留对账资料', 409)
        const [result] = await this.repository.remove(supplierId, connection)
        if (result.affectedRows === 0) throw this.createError('供应商不存在', 404)
        await connection.commit()
        started = false
        return null
      } catch (error) {
        if (started) {
          try { await connection.rollback() }
          catch (rollbackError) { connection.destroy(); throw rollbackError }
        } else connection.destroy()
        if (['ER_ROW_IS_REFERENCED', 'ER_ROW_IS_REFERENCED_2'].includes(error.code)) throw this.createError('该供应商已有业务关联，请停用并保留历史资料', 409)
        throw error
      }
    })
  }

  async detail(id, actor) {
    if (!this.connected()) throw this.createError('数据库未连接', 500)
    const supplierId = parseSupplierId(id)
    if (supplierId === null) throw this.createError('无效的供应商ID', 400)
    const actorId = this.getActorId(actor)
    const scope = resolveStoreScope(actor, null)
    const visible = async (permission, fields, required) => {
      if (!await this.permissionCheck(actor, permission)) return null
      const permissions = await fields.getPermissions(actorId)
      const hidden = new Set(permissions.hiddenFields || [])
      return required.some(field => hidden.has(field)) ? null : hidden
    }
    const purchaseHidden = await visible('supplier-payments:view', this.purchaseFields, ['payment.supplier_name', 'payment.store_name'])
    const phoneHidden = await visible('inventory:view', this.inventoryFields, ['supplier_info.supplier_name', 'store_info.store_name'])
    return this.repository.withConnection(async connection => {
      let started = false
      try {
        await connection.execute('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY')
        await connection.beginTransaction(); started = true
        const [rows] = await this.repository.findById(supplierId, connection)
        if (!rows.length) throw this.createError('供应商不存在', 404)
        const stats = { accessories_count: null, accessories_total_cost: null, phones_count: null, phones_total_cost: null }
        if (purchaseHidden && (!purchaseHidden.has('purchase.quantity') || !purchaseHidden.has('payment.purchase_cost'))) {
          const summary = await this.purchases.supplierSummary(supplierId, scope, connection)
          if (Number(summary.invalid_count) !== 0 || [summary.quantity, summary.total_cents].some(value => !isIntegerInput(value) || Number(value) < 0)) {
            throw this.createError('商品原采购数量或金额异常，请先核对采购单', 409, 'PURCHASE_AMOUNT_CONFLICT')
          }
          if (!purchaseHidden.has('purchase.quantity')) stats.accessories_count = Number(summary.quantity)
          if (!purchaseHidden.has('payment.purchase_cost')) stats.accessories_total_cost = Number(summary.total_cents) / 100
        }
        if (phoneHidden && (!phoneHidden.has('stats.total_phones') || !phoneHidden.has('price_info.purchase_cost') && !phoneHidden.has('stats.inventory_value'))) {
          const [[phones]] = await this.repository.phoneStats(supplierId, scope, connection)
          if (!isIntegerInput(phones.count) || Number(phones.count) < 0 || phones.total_cents !== null && (!isIntegerInput(phones.total_cents) || Number(phones.total_cents) < 0)) {
            throw this.createError('手机数量或成本异常，请先核对设备资料', 409)
          }
          if (!phoneHidden.has('stats.total_phones')) stats.phones_count = Number(phones.count)
          if (!phoneHidden.has('price_info.purchase_cost') && !phoneHidden.has('stats.inventory_value')) {
            stats.phones_total_cost = phones.total_cents === null ? null : Number(phones.total_cents) / 100
          }
        }
        return { ...formatSupplier(rows[0]), stats }
      } finally {
        if (!started) connection.destroy()
        else {
          try { await connection.rollback() }
          catch (error) { connection.destroy(); throw error }
        }
      }
    })
  }
}

module.exports = SupplierManagementService
