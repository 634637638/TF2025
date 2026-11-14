'use strict'

const { validId, moneyCents } = require('./sale-input')
const { validateImei } = require('./imei')
const { normalizeDateTime } = require('./time')

/** 快速合单只接受采购设备事实，交易、门店、人员及客户统一取共同结算头。 */
const normalizeQuickCheckoutPhone = value => {
  const invalid = message => { throw Object.assign(new Error(message), { statusCode: 400, code: 'CHECKOUT_INVALID' }) }
  const keys = ['brand_id', 'model_id', 'color_id', 'memory_id', 'supplier_id', 'is_new', 'imei', 'serial_number', 'purchase_cost', 'sale_price', 'inventory_time']
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) invalid('快速出库设备字段无效')
  if (!['brand_id', 'model_id', 'color_id', 'memory_id', 'supplier_id'].every(key => validId(value[key]))) invalid('请选择有效的品牌、型号、颜色、内存和供应商')
  if (![0, 1, '0', '1'].includes(value.is_new)) invalid('请选择有效的设备成色')
  if (typeof value.serial_number !== 'string' || !/^[A-Za-z0-9]{4,50}$/.test(value.serial_number.trim())) invalid('请输入有效的设备序列号')
  if (typeof value.imei !== 'string') invalid('请输入有效的IMEI')
  const identifier = validateImei(value.imei, value.serial_number)
  if (!identifier.valid) invalid(identifier.reason)
  const cost = value.purchase_cost === null ? null : moneyCents(value.purchase_cost)
  const price = moneyCents(value.sale_price)
  if (value.purchase_cost !== null && cost === null || price === null || !price) invalid('采购成本或销售价格无效')
  const inventoryTime = value.inventory_time && normalizeDateTime(value.inventory_time, false)
  if (!inventoryTime) invalid('请选择有效的入库日期')
  return { ...Object.fromEntries(['brand_id', 'model_id', 'color_id', 'memory_id', 'supplier_id'].map(key => [key, Number(value[key])])),
    is_new: Number(value.is_new), imei: identifier.normalizedImei, serial_number: identifier.normalizedSerialNumber,
    purchase_cost: cost === null ? null : cost / 100, sale_price: price / 100, inventory_time: inventoryTime }
}

module.exports = { normalizeQuickCheckoutPhone }
