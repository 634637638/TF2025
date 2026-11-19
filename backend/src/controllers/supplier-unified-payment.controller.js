'use strict'

const Service = require('../services/supplier-unified-payment.service')
const FieldAccessService = require('../services/field-access.service')
const ApiResponse = require('../utils/response')
const log = require('../utils/log')
const fields = new FieldAccessService({ moduleKey: 'payments_supplierphonepaymentsview', strict: true, responseKeys: {
  'payment.supplier_name': ['supplier_id', 'supplier_name', 'phone_supplier_id', 'accessory_supplier_id'], 'payment.store_name': ['store_id', 'store_name', 'phone_store_id', 'accessory_store_id', 'phone_store_name', 'accessory_store_name'],
  'payment.brand_name': ['brand_name', 'accessory_brand_name'], 'payment.model_name': ['model_name', 'product_model', 'accessory_model_name'], 'payment.purchase_cost': ['purchase_cost', 'total_amount', 'amount', 'expected_amount', 'actual_amount', 'phone_purchase_cost', 'accessory_purchase_cost', 'accessory_total_amount'],
  'payment.imei': ['imei'], 'payment.serial_number': ['serial_number'], 'payment.color_name': ['color_name', 'accessory_color_name'],
  'payment.memory_name': ['memory_name'], 'payment.sale_time': ['sale_time', 'phone_sale_time'], 'payment.sale_price': ['sale_price', 'phone_sale_price'],
  'payment.payment_status': ['status', 'phone_status', 'payment_batch_id', 'phone_count', 'accessory_count', 'line_count', 'legacy_phone_batch'], 'payment.payment_method': ['payment_method', 'phone_payment_method', 'accessory_payment_method'],
  'payment.payment_time': ['payment_time', 'created_at', 'phone_payment_time', 'accessory_payment_time'], 'payment.payment_operator': ['operator_name', 'phone_payment_operator_name', 'accessory_payment_operator_name'], 'payment.remarks': ['remarks', 'external_reference', 'phone_payment_remarks', 'accessory_payment_remarks'],
  'purchase.batch_no': ['batch_no'], 'purchase.name': ['name', 'accessory_name'], 'purchase.quantity': ['quantity', 'accessory_quantity'],
  'purchase.unit': ['unit', 'accessory_unit']
} })

class SupplierUnifiedPaymentController {
  constructor({ service = new Service(), fieldAccess = fields } = {}) { this.service = service; this.fieldAccess = fieldAccess }
  fail(res, error) {
    if (error?.code === 'ER_NO_SUCH_TABLE' || error?.code === 'ER_BAD_FIELD_ERROR') return ApiResponse.error(res, '供应商合并打款结构未就绪，请先执行数据库迁移', 409, 'SUPPLIER_PAYMENT_BATCH_NOT_READY')
    if (error.statusCode >= 400 && error.statusCode < 500) return ApiResponse.error(res, error.message, error.statusCode, error.code)
    log.error('供应商合并打款失败:', error)
    return ApiResponse.error(res, '供应商合并打款失败，请稍后重试', 500)
  }
  async assertFields(userId) {
    const permissions = await this.fieldAccess.getPermissions(userId)
    const required = ['payment.supplier_name', 'payment.purchase_cost', 'payment.payment_status', 'payment.payment_method', 'payment.payment_time', 'payment.remarks', 'system_info.operations']
    if (required.some(field => permissions.hiddenFields?.includes(field))) throw Object.assign(new Error('无权查看合并打款所需的供应商、金额、状态或付款字段'), { statusCode: 403, code: 'FIELD_PERMISSION_DENIED' })
    return permissions
  }
  async options(req, res) {
    try {
      const permissions = await this.fieldAccess.getPermissions(req.user.id)
      if (permissions.hiddenFields?.includes('payment.supplier_name') || permissions.hiddenFields?.includes('payment.purchase_cost') || permissions.hiddenFields?.includes('payment.payment_status')) {
        throw Object.assign(new Error('无权查看合并打款供应商、金额或状态'), { statusCode: 403, code: 'FIELD_PERMISSION_DENIED' })
      }
      return ApiResponse.success(res, this.fieldAccess.maskPayload(await this.service.options(req.user, req.query.supplier_id), permissions))
    }
    catch (error) { return this.fail(res, error) }
  }
  async create(req, res) {
    try {
      await this.assertFields(req.user.id)
      return ApiResponse.success(res, await this.service.create(req.user, req.body), '供应商合并打款成功')
    }
    catch (error) { return this.fail(res, error) }
  }
  async history(req, res) {
    try { const permissions = await this.assertFields(req.user.id); const result = await this.service.history(req.user, req.query); return ApiResponse.success(res, { ...result, rows: this.fieldAccess.maskPayload(result.rows, permissions) }) }
    catch (error) { return this.fail(res, error) }
  }
  async details(req, res) {
    try { const permissions = await this.assertFields(req.user.id); return ApiResponse.success(res, this.fieldAccess.maskPayload(await this.service.details(req.user, req.params.id), permissions)) }
    catch (error) { return this.fail(res, error) }
  }
  async cancel(req, res) {
    try { await this.assertFields(req.user.id); return ApiResponse.success(res, await this.service.cancel(req.user, req.params.id, req.body), '供应商打款批次已全部撤销') }
    catch (error) { return this.fail(res, error) }
  }
}

module.exports = SupplierUnifiedPaymentController
