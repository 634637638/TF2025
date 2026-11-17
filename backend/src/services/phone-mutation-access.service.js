'use strict'

const { hasUnifiedPermission } = require('../middleware/unified-auth')
const { resolveStoreScope, assertStoreInScope } = require('../utils/store-scope')
const { normalizePhoneStatus } = require('../utils/phone-status')
const FieldAccessService = require('./field-access.service')

const commonFields = {
  brand_id: 'brand', model_id: 'model', color_id: 'color', memory_id: 'memory',
  imei: 'imei', serial_number: 'serial_number', condition: 'is_new', status: 'status'
}
const queryFields = {
  ...Object.fromEntries(Object.entries(commonFields).map(([key, field]) => [key, `basic_info.${field}`])),
  purchase_cost: 'basic_info.purchase_cost', sale_price: 'basic_info.sale_price',
  payment_method: 'basic_info.sale_price', payment_channel: 'basic_info.sale_price',
  store_id: 'store_info.store_name', supplier_id: 'supplier_info.supplier_name',
  inventory_time: 'time_info.inventory_time', sale_time: 'time_info.sale_time',
  customer_id: 'customer_info.customer_name', customer_name: 'customer_info.customer_name',
  customer_phone: 'customer_info.customer_phone', apple_id: 'customer_info.apple_id',
  purchase_operator_id: 'operator_info.inventory_operator', sale_operator_id: 'operator_info.sale_operator',
  remarks: 'other_info.remarks'
}
const inventoryFields = {
  ...Object.fromEntries(Object.entries(commonFields).map(([key, field]) => [key, `basic.${field}`])),
  purchase_cost: 'price_info.purchase_cost', store_id: 'store_info.store_name',
  supplier_id: 'supplier_info.supplier_name', inventory_time: 'time_info.inventory_time',
  purchase_operator_id: 'operator_info.inventory_operator_name', remarks: 'other_info.remarks'
}
const salesFields = {
  ...Object.fromEntries(Object.entries(commonFields).map(([key, field]) => [key, `sale.${field === 'is_new' || field === 'status' ? 'condition' : field}`])),
  purchase_cost: 'sale.purchase_cost', sale_price: 'sale.sale_price', store_id: 'sale.store_id',
  supplier_id: 'sale.supplier_id', inventory_time: 'sale.inventory_time', sale_time: 'sale.sale_time',
  customer_id: 'sale.customer_name', customer_name: 'sale.customer_name', customer_phone: 'sale.customer_phone',
  apple_id: 'sale.customer_apple_id', sale_operator_id: 'sale.operator_id',
  payment_method: 'sale.payment_method', payment_channel: 'sale.payment_method', remarks: 'sale.remarks'
}
const forbidden = (message, code = 'INSUFFICIENT_PERMISSIONS') => {
  throw Object.assign(new Error(message), { status: 403, statusCode: 403, code })
}

/** 同一手机写入口按原记录状态、实际动作、字段和原/目标门店逐项核验。 */
class PhoneMutationAccessService {
  constructor({ permissionCheck = hasUnifiedPermission, fields = moduleKey => new FieldAccessService({ moduleKey, strict: true }) } = {}) {
    this.permissionCheck = permissionCheck
    this.fields = fields
  }

  async authorize(actor, phone, action, body = {}, allowedSources) {
    const scope = resolveStoreScope(actor)
    assertStoreInScope(scope, phone.store_id)
    if (body.store_id !== undefined) assertStoreInScope(scope, body.store_id)
    const status = normalizePhoneStatus(phone.status)
    const transaction = ['sold', 'peer_transfer', 'supplier_proxy'].includes(status)
    const sources = [
      ['query', 'query_queryview', queryFields],
      ...(!transaction ? [['inventory', 'inventory_inventoryview', inventoryFields], ['phones', 'inventory_inventoryview', inventoryFields]] : []),
      ...(transaction ? [['sales-editphoneview', 'sales_salesview', salesFields]] : [])
    ]
    let deniedField = false
    for (const [alias, moduleKey, fieldMap] of sources) {
      if (allowedSources && !allowedSources.includes(alias)) continue
      if (!await this.permissionCheck(actor, `${alias}:${action}`)) continue
      if (action === 'delete') return scope
      const changed = Object.fromEntries(Object.entries(body).filter(([key, value]) => {
        const current = key === 'condition' ? (Number(phone.is_new) === 1 ? 'new' : 'used') : phone[key]
        return String(value ?? '') !== String(current ?? '')
      }))
      if (Object.keys(changed).some(key => !Object.hasOwn(fieldMap, key))) continue
      if (await this.fields(moduleKey).getDeniedWrite(actor.id, changed, fieldMap)) { deniedField = true; continue }
      return scope
    }
    forbidden(deniedField ? '不能修改已隐藏、只读或未授权的手机字段' : '无权操作该状态的手机或所提交字段', deniedField ? 'FIELD_PERMISSION_DENIED' : undefined)
  }
}

module.exports = PhoneMutationAccessService
