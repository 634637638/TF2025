'use strict'

const SalesCheckoutService = require('../services/sales-checkout.service')
const FieldAccessService = require('../services/field-access.service')
const log = require('../utils/log')
const { hasUnifiedPermission } = require('../middleware/unified-auth')

const phoneFields = new FieldAccessService({ moduleKey: 'sales_salesview', strict: true })
const queryGoodsFields = new FieldAccessService({ moduleKey: 'query_queryview', fieldScope: 'goods', strict: true })
const goodsFields = new FieldAccessService({ moduleKey: 'accessories_accessoriesview', strict: true })
const phoneMap = { store_id: 'sale.store_id', operator_id: 'sale.operator_id', sale_time: 'sale.sale_time', remarks: 'sale.remarks' }
const customerMap = { name: 'sale.customer_name', phone: 'sale.customer_phone', apple_id: 'sale.customer_apple_id' }
const goodsMap = { accessory_id: 'basic_info.name', quantity: 'stock_info.total_quantity', unit_price: 'price_info.unit_price',
  redeem_points: 'price_info.unit_price', gift_return_unit_price: 'price_info.unit_price', serial_numbers: 'basic_info.serial_number', sale_type: 'basic_info.usage_type' }

class SalesCheckoutController {
  constructor({ service = new SalesCheckoutService({ autoFilm: true }), phoneAccess = phoneFields, goodsAccess = goodsFields, queryGoodsAccess = queryGoodsFields,
    customerAccess = new FieldAccessService({ moduleKey: 'customers_customersview', strict: true }),
    queryAccess = new FieldAccessService({ moduleKey: 'query_queryview', strict: true }),
    filmAccess = new FieldAccessService({ moduleKey: 'accessories_accessoriesview', strict: true }), permissionCheck = hasUnifiedPermission, logger = log } = {}) {
    Object.assign(this, { service, phoneAccess, goodsAccess, queryGoodsAccess, customerAccess, filmAccess, queryAccess, permissionCheck, logger })
  }
  async filmQuote(req, res) {
    if (!req.body?.film_service) return res.status(400).json({ success: false, message: '请提供当前手机贴膜资料', code: 'FILM_SERVICE_INVALID' })
    return this.quote(req, res)
  }
  async filmCheckout(req, res) {
    if (!req.body?.film_service) return res.status(400).json({ success: false, message: '请提供当前手机贴膜资料', code: 'FILM_SERVICE_INVALID' })
    return this.checkout(req, res)
  }
  queryGoodsSummary(req, res) { return this.readCustomerSummary(req, res, this.queryGoodsAccess) }
  customerSummary(req, res) { return this.readCustomerSummary(req, res) }
  async filmCustomerSummary(req, res) {
    try {
      const customer = await this.customerAccess.getPermissions(req.user.id)
      const data = await this.service.customerSummary({ ...req.query, context: 'film' }, req.user)
      if (customer.hiddenFields?.includes('customer.member_number')) data.member_number = null
      if (customer.hiddenFields?.includes('customer.points')) { data.points = null; data.available_points = null }
      if (customer.hiddenFields?.includes('customer.balance')) data.balance = null
      return res.json({ success: true, data })
    } catch (error) {
      if (error.statusCode >= 400 && error.statusCode < 500) return res.status(error.statusCode).json({ success: false, message: error.message, code: error.code || 'CHECKOUT_INVALID' })
      this.logger.error('读取贴膜客户积分资料失败:', { requestId: req.requestId, error })
      return res.status(500).json({ success: false, message: '客户积分资料读取失败，请重试', code: 'INTERNAL_ERROR' })
    }
  }
  queryGoodsQuote(req, res) { return this.runQuote(req, res, this.queryGoodsAccess) }
  queryGoodsCheckout(req, res) { return this.runCheckout(req, res, this.queryGoodsAccess) }

  async resolveGoodsAccess(req) {
    if (req.body?.film_service !== undefined || await this.permissionCheck(req.user, 'accessories:view')) return this.goodsAccess
    return this.queryGoodsAccess
  }

  async readCustomerSummary(req, res, goodsAccess) {
    try {
      goodsAccess ||= await this.resolveGoodsAccess(req)
      const [phone, goods, customer] = await Promise.all([req.query.context === 'goods' ? Promise.resolve({}) : this.phoneAccess.getPermissions(req.user.id), goodsAccess.getPermissions(req.user.id), this.customerAccess.getPermissions(req.user.id)])
      if (['sale.customer_name', 'sale.customer_phone'].some(field => phone.hiddenFields?.includes(field)) ||
        ['customer_info.customer_name', 'customer_info.customer_phone'].some(field => goods.hiddenFields?.includes(field))) {
        return res.status(403).json({ success: false, message: '无权读取客户字段', code: 'FIELD_PERMISSION_DENIED' })
      }
      const data = await this.service.customerSummary(req.query, req.user)
      if (customer.hiddenFields?.includes('customer.member_number')) data.member_number = null
      if (customer.hiddenFields?.includes('customer.points')) { data.points = null; data.available_points = null }
      if (customer.hiddenFields?.includes('customer.balance')) data.balance = null
      return res.json({ success: true, data })
    } catch (error) {
      if (error.statusCode >= 400 && error.statusCode < 500) return res.status(error.statusCode).json({ success: false, message: error.message, code: error.code || 'CHECKOUT_INVALID' })
      this.logger.error('读取附加商品客户资料失败:', { requestId: req.requestId, error })
      return res.status(500).json({ success: false, message: '客户会员资料读取失败，请重试', code: 'INTERNAL_ERROR' })
    }
  }
  async enforceFields(req, goodsAccess = this.goodsAccess) {
    const body = req.body || {}, id = req.user.id
    if (body.film_service !== undefined) {
      const queryPermissions = await this.queryAccess.getPermissions(id)
      if (['basic_info.model', 'customer_info.customer_name'].some(field => queryPermissions.hiddenFields?.includes(field))) throw Object.assign(new Error('缺少当前手机型号或客户字段权限'), { statusCode: 403, code: 'FIELD_PERMISSION_DENIED' })
      const permissions = await this.filmAccess.getPermissions(id)
      const necessary = ['basic_info.name', 'basic_info.category', 'basic_info.usage_type', 'stock_info.distribution',
        'stock_info.total_quantity', 'price_info.unit_price', 'price_info.total_price',
        'customer_info.customer_name', 'time_info.created_at', 'operator_info.operator_name']
      if (necessary.some(field => permissions.hiddenFields?.includes(field))) {
        throw Object.assign(new Error('缺少办理贴膜所需字段权限'), { statusCode: 403, code: 'FIELD_PERMISSION_DENIED' })
      }
    }
    const denied = async (fields, value, map) => {
      if (await fields.getDeniedWrite(id, value, map)) throw Object.assign(new Error('不能使用已隐藏的结算字段'), { statusCode: 403, code: 'FIELD_PERMISSION_DENIED' })
    }
    if (Array.isArray(body.phones) && body.phones.length || body.quick_phone !== undefined) {
      await denied(this.phoneAccess, body, phoneMap)
      await denied(this.phoneAccess, body.customer_info, customerMap)
      await denied(this.phoneAccess, body.payment_info, { payment_method: 'sale.payment_method', payment_channel: 'sale.payment_method', transaction_no: 'sale.transaction_no' })
      for (const row of Array.isArray(body.phones) ? body.phones : []) await denied(this.phoneAccess, row, {
        sale_price: 'sale.sale_price', purchase_cost: 'sale.purchase_cost'
      })
      if (body.quick_phone !== undefined) await denied(this.phoneAccess, body.quick_phone, {
        brand_id: 'sale.brand', model_id: 'sale.model', color_id: 'sale.color', memory_id: 'sale.memory',
        supplier_id: 'sale.supplier_id', imei: 'sale.imei', serial_number: 'sale.serial_number', is_new: 'sale.condition',
        purchase_cost: 'sale.purchase_cost', sale_price: 'sale.sale_price', inventory_time: 'sale.inventory_time'
      })
    }
    if (Array.isArray(body.accessories) && body.accessories.length) {
      await denied(goodsAccess, body, { store_id: 'stock_info.distribution', remarks: 'other_info.remarks',
        operator_id: 'operator_info.operator_name', sale_time: 'time_info.created_at' })
      await denied(goodsAccess, body.customer_info, body.film_service !== undefined
        ? { name: 'customer_info.customer_name' }
        : { name: 'customer_info.customer_name', phone: 'customer_info.customer_phone' })
      for (const row of body.accessories) await denied(goodsAccess, row, goodsMap)
    }
  }
  quote(req, res) { return this.runQuote(req, res) }

  async runQuote(req, res, goodsAccess) {
    try {
      goodsAccess ||= await this.resolveGoodsAccess(req)
      await this.enforceFields(req, goodsAccess)
      if (await goodsAccess.getDeniedWrite(req.user.id, { total_amount: 0 }, { total_amount: 'price_info.total_price' })) {
        return res.status(403).json({ success: false, message: '无权查看结算汇总金额', code: 'FIELD_PERMISSION_DENIED' })
      }
      const data = await this.service.quote(req.body || {}, req.user)
      return res.json({ success: true, data })
    } catch (error) {
      if (error.statusCode >= 400 && error.statusCode < 500) return res.status(error.statusCode).json({ success: false, message: error.message, code: error.code || 'CHECKOUT_INVALID' })
      this.logger.error('结算积分试算失败:', { requestId: req.requestId, error })
      return res.status(500).json({ success: false, message: '积分试算失败，请稍后重试', code: 'INTERNAL_ERROR' })
    }
  }
  checkout(req, res) { return this.runCheckout(req, res) }

  async runCheckout(req, res, goodsAccess) {
    try {
      goodsAccess ||= await this.resolveGoodsAccess(req)
      await this.enforceFields(req, goodsAccess)
      const data = await this.service.checkout(req.body || {}, req.user)
      // 结果只回订单、销售关联及成交汇总，不把内部采购成本或资料快照交给客户端。
      return res.json({ success: true, message: '整单结算成功', data })
    } catch (error) {
      if (error.statusCode >= 400 && error.statusCode < 500) return res.status(error.statusCode).json({ success: false, message: error.message, code: error.code || 'CHECKOUT_INVALID' })
      this.logger.error('整单结算失败:', { requestId: req.requestId, error })
      return res.status(500).json({ success: false, message: '结算失败，请核对订单后重试', code: 'INTERNAL_ERROR', request_id: req.requestId || null })
    }
  }
}
module.exports = SalesCheckoutController
