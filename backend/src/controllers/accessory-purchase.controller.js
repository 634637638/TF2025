'use strict'

const Service = require('../services/accessory-purchase.service')
const FieldAccessService = require('../services/field-access.service')
const ApiResponse = require('../utils/response')
const log = require('../utils/log')

const responseKeys = {
  'purchase.batch_no': ['batch_no'], 'purchase.name': ['name', 'accessory_id'],
  'purchase.category': ['category'], 'purchase.quantity': ['quantity', 'total_quantity'],
  'purchase.unit': ['unit'], 'purchase.inventory_time': ['inventory_time'],
  'purchase.inventory_operator': ['inventory_operator_name'],
  'payment.supplier_name': ['supplier_id', 'supplier_name'], 'payment.store_name': ['store_id', 'store_name', 'distribution'],
  'payment.brand_name': ['brand_name'], 'payment.model_name': ['product_model'], 'payment.color_name': ['color_name'],
  'payment.purchase_cost': ['purchase_cost', 'total_amount', 'paid_amount', 'unpaid_amount', 'amount'],
  'payment.payment_status': ['payment_status', 'action', 'latest_event_id', 'paid_amount', 'unpaid_amount', 'payment_batch_id'],
  'payment.payment_time': ['payment_time', 'created_at'], 'payment.payment_method': ['payment_method'],
  'payment.payment_operator': ['operator_id', 'operator_name', 'payment_operator_name'],
  'payment.remarks': ['remarks', 'payment_remarks']
}
const fields = new FieldAccessService({ moduleKey: 'payments_supplierphonepaymentsview', responseKeys, strict: true })
const returnFields = new FieldAccessService({ moduleKey: 'payments_supplierphonepaymentsview', responseKeys, strict: true })
const inventoryFields = new FieldAccessService({ moduleKey: 'accessories_accessoriesview', strict: true, responseKeys: {
  'stock_info.distribution': ['store_id', 'store_name'], 'stock_info.total_quantity': ['quantity', 'current_quantity'],
  'price_info.purchase_cost': ['purchase_cost'], 'basic_info.usage_type': ['usage_type'],
  'basic_info.serial_tracking': ['serial_tracking'], 'basic_info.serial_number': ['serials']
} })

class AccessoryPurchaseController {
  constructor({ service = new Service(), fieldAccess = fields, returnFieldAccess = returnFields, inventoryFieldAccess = inventoryFields } = {}) {
    this.service = service; this.fields = fieldAccess; this.returnFields = returnFieldAccess; this.inventoryFields = inventoryFieldAccess
  }
  async visible(req, ids) {
    const permissions = await this.fields.getPermissions(req.user.id)
    if (ids.some(id => permissions.hiddenFields?.includes(id))) throw Object.assign(new Error('无权使用已隐藏的采购字段'), { statusCode: 403, code: 'FIELD_PERMISSION_DENIED' })
    return permissions
  }
  fail(res, error) {
    if (error.statusCode >= 400 && error.statusCode < 500) return ApiResponse.error(res, error.message, error.statusCode, error.code)
    log.error('商品采购结算失败:', error)
    return ApiResponse.error(res, '商品采购结算失败，请稍后重试', 500)
  }
  async list(req, res) {
    try {
      const required = []
      if (req.query.keyword !== undefined) required.push('purchase.batch_no', 'purchase.name')
      if (req.query.product_name !== undefined) required.push('purchase.name')
      if (req.query.brand_name !== undefined) required.push('payment.brand_name')
      if (req.query.supplier_id !== undefined || req.query.supplier_name !== undefined) required.push('payment.supplier_name')
      if (req.query.store_id !== undefined || req.query.store_name !== undefined) required.push('payment.store_name')
      if (req.query.payment_status !== undefined) required.push('payment.payment_status')
      if (req.query.start_date !== undefined || req.query.end_date !== undefined) required.push('purchase.inventory_time')
      const permissions = await this.visible(req, required)
      const result = await this.service.list(req.user, req.query)
      return res.json({ success: true, data: this.fields.maskPayload(result.rows, permissions),
        summary: this.fields.maskPayload(result.summary, permissions), pagination: result.pagination })
    } catch (error) { return this.fail(res, error) }
  }
  async options(req, res) {
    try {
      const permissions = await this.fields.getPermissions(req.user.id)
      const result = await this.service.options(req.user)
      const hidden = permissions.hiddenFields || []
      return res.json({ success: true, data: {
        suppliers: hidden.includes('payment.supplier_name') ? [] : result.suppliers,
        brands: hidden.includes('payment.brand_name') ? [] : result.brands,
        products: hidden.includes('purchase.name') ? [] : result.products,
        stores: hidden.includes('payment.store_name') ? [] : result.stores
      } })
    } catch (error) { return this.fail(res, error) }
  }
  async history(req, res) {
    try {
      const permissions = await this.visible(req, ['payment.payment_status'])
      const result = await this.service.history(req.user, req.params.id, req.query)
      return res.json({ success: true, data: this.fields.maskPayload(result.rows, permissions), pagination: result.pagination })
    } catch (error) { return this.fail(res, error) }
  }
  async returnContext(req, res) {
    try {
      const { purchasePermissions, inventoryPermissions } = await this.returnPermissions(req)
      const includeSerials = !inventoryPermissions.hiddenFields?.includes('basic_info.serial_number')
      const { purchase, ...inventory } = await this.service.returnContext(req.user, req.params.id, req.query, { includeSerials })
      return ApiResponse.success(res, { purchase: this.returnFields.maskPayload(purchase, purchasePermissions),
        ...this.inventoryFields.maskPayload(inventory, inventoryPermissions) })
    } catch (error) { return this.fail(res, error) }
  }
  async returnPermissions(req, additional = []) {
    const purchasePermissions = await this.returnFields.getPermissions(req.user.id)
    const inventoryPermissions = await this.inventoryFields.getPermissions(req.user.id)
    if (['purchase.quantity', 'payment.supplier_name', 'payment.store_name', 'payment.purchase_cost', 'payment.payment_status']
      .some(field => purchasePermissions.hiddenFields?.includes(field)) ||
      ['stock_info.distribution', 'stock_info.total_quantity', ...additional].some(field => inventoryPermissions.hiddenFields?.includes(field))) {
      throw Object.assign(new Error('无权读取采购退供核对必要字段'), { statusCode: 403, code: 'FIELD_PERMISSION_DENIED' })
    }
    return { purchasePermissions, inventoryPermissions }
  }
  async quoteReturn(req, res) {
    try {
      if (Object.keys(req.query || {}).length) return ApiResponse.badRequest(res, '退供试算不接受查询参数')
      const required = ['price_info.purchase_cost', 'basic_info.usage_type', 'basic_info.serial_tracking']
      if (Array.isArray(req.body?.serial_ids) && req.body.serial_ids.length) required.push('basic_info.serial_number')
      await this.returnPermissions(req, required)
      return ApiResponse.success(res, await this.service.quoteReturn(req.user, req.params.id, req.body))
    } catch (error) { return this.fail(res, error) }
  }
  async record(req, res, action) {
    try {
      const required = ['payment.supplier_name', 'payment.purchase_cost', 'payment.payment_status', 'system_info.operations']
      if (action === 'pay') required.push('payment.payment_method', 'payment.payment_time')
      if (action === 'cancel' || req.body.remarks !== undefined) required.push('payment.remarks')
      const permissions = await this.visible(req, required)
      const result = await this.service.record(req.user, req.params.id, action, req.body)
      return res.json({ success: true, data: this.fields.maskPayload(result, permissions), message: action === 'pay' ? '商品采购打款已登记' : '商品采购打款登记已撤销' })
    } catch (error) { return this.fail(res, error) }
  }
  pay(req, res) { return this.record(req, res, 'pay') }
  cancel(req, res) { return this.record(req, res, 'cancel') }
}
module.exports = AccessoryPurchaseController
