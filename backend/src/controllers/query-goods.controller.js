'use strict'

const QueryGoodsService = require('../services/query-goods.service')
const FieldAccessService = require('../services/field-access.service')
const log = require('../utils/log')

const financialKeys = ['total_price', 'period_amount', 'profit', 'points_awarded', 'points_used', 'deduction_amount',
  'base_refund_amount', 'points_recovery_amount', 'points_compensation_amount', 'gift_charge_amount', 'refund_amount', 'collection_amount', 'settlement_offset_amount',
  'replacement_amount', 'additional_amount', 'exchange_credit_amount', 'gift_return_unit_price', 'gift_return_total', 'gift_agreement_state',
  'points_delta', 'points_award_returned', 'points_redemption_returned', 'settlement_method', 'settlement_channel']
const responseKeys = {
  'stats.monthly_sales': ['sale'], 'stats.monthly_gifts': ['gift'],
  'stats.customer_visits': ['customer_visits'], 'stats.monthly_best_sellers': ['monthly_best_sellers'],
  'basic_info.sequence': ['sale_no', 'order_no', 'linked_phone_invoice'],
  'basic_info.name': ['name', 'accessory_id'], 'basic_info.barcode': ['barcode'],
  'basic_info.category': ['category'], 'basic_info.brand_name': ['brand_name'],
  'basic_info.specifications': ['product_model'], 'basic_info.color_name': ['color_name'],
  'basic_info.unit': ['unit'], 'basic_info.batch_no': ['stock_in_id', 'batch_no'],
  'basic_info.supplier_name': ['supplier_name'], 'basic_info.serial_number': ['serial_numbers'],
  // 未退赠品扣款是用途派生事实；隐藏用途时同步隐藏数量和完整资金组，避免反推及残缺回执。
  'basic_info.serial_tracking': ['serial_tracking'], 'basic_info.usage_type': ['sale_type', 'usage_type',
    'quantity', 'period_quantity', 'returned_quantity', 'remaining_quantity', 'gift_charge_quantity', ...financialKeys],
  'stock_info.distribution': ['store_id', 'store_name'],
  'stock_info.total_quantity': ['quantity', 'period_quantity', 'returned_quantity', 'remaining_quantity', 'gift_charge_quantity', 'purchase_cost', ...financialKeys],
  'price_info.unit_price': ['unit_price', ...financialKeys],
  'price_info.total_price': financialKeys,
  'price_info.purchase_cost': ['purchase_cost', 'profit'], 'price_info.profit': ['profit'],
  'customer_info.customer_name': ['customer_name'], 'customer_info.customer_phone': ['customer_phone'],
  'operator_info.operator_name': ['operator_name', 'operator_id', 'inventory_operator_name'],
  'time_info.created_at': ['sale_time', 'business_time', 'created_at'], 'time_info.inventory_time': ['inventory_time'], 'other_info.remarks': ['remarks', 'return_reason']
}
const searchKeys = ['sale_no', 'order_no', 'linked_phone_invoice', 'name', 'barcode', 'category', 'brand_name', 'product_model',
  'color_name', 'unit', 'serial_number', 'customer_name', 'customer_phone', 'operator_name', 'remarks']
const queryFields = {
  store_id: 'stock_info.distribution', sale_type: 'basic_info.usage_type', sale_operator_id: 'operator_info.operator_name',
  brand_id: 'basic_info.brand_name', product_name: 'basic_info.name', category_id: 'basic_info.category',
  start_date: 'time_info.created_at', end_date: 'time_info.created_at'
}

const orderMoney = ['unit_price', 'total_amount', 'gross_amount', 'points_used', 'deduction_amount', 'points_awarded',
  'gift_return_unit_price', 'gift_return_total', 'gift_agreement_state']
const orderTotals = ['total_amount', 'final_amount', 'paid_amount', 'deduction_amount', 'points_used', 'points_awarded']
const orderGoodsKeys = {
  ...responseKeys,
  'basic_info.sequence': ['sale_no', 'linked_phone_sale_no', 'order_no'],
  'basic_info.usage_type': ['sale_type', 'quantity', ...orderMoney],
  'stock_info.total_quantity': ['quantity', ...orderMoney],
  'price_info.unit_price': orderMoney,
  'price_info.total_price': orderMoney
}
// 综合查询的权威字段ID；兼容既有展示别名，但不依赖别名代替正式权限。
const orderPhoneKeys = {
  'basic_info.brand': ['brand_name'], 'basic_info.model': ['name'],
  'basic_info.color': ['color_name'], 'basic_info.memory': ['memory'],
  'basic_info.imei': ['imei'], 'basic_info.serial_number': ['serial_numbers'],
  'basic_info.sale_price': orderMoney,
  'customer_info.customer_name': ['customer_name'], 'customer_info.customer_phone': ['customer_phone'],
  'store_info.store_name': ['store_name'], 'time_info.sale_time': ['sale_time'],
  'operator_info.sale_operator': ['operator_name'], 'operator_info.sale_operator_name': ['operator_name'],
  'other_info.remarks': ['remarks'], 'basic_info.remarks': ['remarks']
}
const hiddenKeys = (permissions, map) => new Set((permissions.hiddenFields || []).flatMap(field => map[field] || []))

class QueryGoodsController {
  constructor({ service = new QueryGoodsService(), access, phoneAccess, masking, logger = log } = {}) {
    this.orderGoodsAccess = new FieldAccessService({ moduleKey: 'query_queryview', fieldScope: 'goods', responseKeys: orderGoodsKeys, masking, strict: true })
    this.phoneAccess = phoneAccess || new FieldAccessService({ moduleKey: 'query_queryview', responseKeys: orderPhoneKeys, masking, strict: true })
    Object.assign(this, { service, logger, access: access || new FieldAccessService({ moduleKey: 'query_queryview', fieldScope: 'goods', responseKeys, masking, strict: true }) })
  }
  async read(req, res, mode) {
    try {
      const permissions = await this.access.getPermissions(req.user.id)
      if (mode === 'orderGoods' || mode === 'orderPhone') {
        const result = await this.service.originalOrder(req.user, mode === 'orderPhone' ? req.params.saleId : req.params.id,
          mode === 'orderPhone' ? 'phone' : 'goods')
        const phonePermissions = result.items.some(row => row.item_type === 'phone' || row.linked_phone_sale_no !== null)
          ? await this.phoneAccess.getPermissions(req.user.id) : { hiddenFields: [] }
        const goodsBlocked = hiddenKeys(permissions, orderGoodsKeys), phoneBlocked = hiddenKeys(phonePermissions, orderPhoneKeys)
        const items = result.items.map(row => row.item_type === 'phone' ? this.phoneAccess.maskPayload(row, phonePermissions)
          : this.orderGoodsAccess.maskPayload(row, permissions))
        const { items: _items, ...header } = result
        const data = this.orderGoodsAccess.maskPayload(this.phoneAccess.maskPayload(header, phonePermissions), permissions)
        if (goodsBlocked.has('sale_no')) items.forEach(row => { row.sale_no = null; row.linked_phone_sale_no = null })
        if (goodsBlocked.has('total_amount') || phoneBlocked.has('total_amount')) orderTotals.forEach(key => { data[key] = null })
        return res.json({ success: true, data: { ...data, items } })
      }
      const hidden = new Set(permissions.hiddenFields || [])
      if (mode === 'customerHistory' && ['customer_info.customer_name', 'customer_info.customer_phone'].some(field => hidden.has(field))) {
        return res.status(403).json({ success: false, message: '客户关联字段已隐藏，不能定向查询商品记录', code: 'FIELD_PERMISSION_DENIED' })
      }
      if (mode === 'list' && Object.entries(queryFields).some(([key, field]) => req.query[key] !== undefined && hidden.has(field))) {
        return res.status(403).json({ success: false, message: '不能使用已隐藏的筛选字段', code: 'FIELD_PERMISSION_DENIED' })
      }
      const salesStatsVisible = !['basic_info.usage_type', 'stock_info.total_quantity', 'time_info.created_at'].some(field => hidden.has(field))
      const canViewSalesStat = !hidden.has('stats.monthly_sales') || !hidden.has('stats.monthly_gifts')
      const result = mode === 'detail' ? await this.service.detail(req.user, req.params.id)
        : mode === 'phoneReceipt' ? await this.service.phoneReceipt(req.user, req.params.saleId)
          : mode === 'aftersales' ? await this.service.aftersales(req.user, req.params.id, req.query)
            : mode === 'customerHistory' ? await this.service.customerHistory(req.user, req.params.customerId, req.query)
              // 关键词只用于定位记录，结果仍由统一字段脱敏处理，隐藏字段不能因此回显。
              : await this.service.list(req.user, req.query, searchKeys, {
                includeSummary: salesStatsVisible && canViewSalesStat,
                includeCustomerVisits: !hidden.has('stats.customer_visits') && !hidden.has('time_info.created_at'),
                includeBestSellers: !hidden.has('stats.monthly_best_sellers') && salesStatsVisible && !hidden.has('basic_info.name')
              })
      return res.json({ success: true, data: this.access.maskPayload(result, permissions) })
    } catch (error) {
      if (error.statusCode >= 400 && error.statusCode < 500) return res.status(error.statusCode).json({ success: false, message: error.message, code: error.code })
      this.logger.error('商品销售查询失败:', { requestId: req.requestId, error })
      return res.status(500).json({ success: false, message: '读取商品销售记录失败，请稍后重试', code: 'INTERNAL_ERROR', request_id: req.requestId || null })
    }
  }
  list(req, res) { return this.read(req, res, 'list') }
  async filterOptions(req, res) {
    try {
      const permissions = await this.access.getPermissions(req.user.id)
      const options = await this.service.filterOptions(req.user)
      return res.json({ success: true, data: {
        brands: permissions.hiddenFields?.includes('basic_info.brand_name') ? [] : options.brands,
        categories: permissions.hiddenFields?.includes('basic_info.category') ? [] : options.categories
      } })
    } catch (error) {
      if (error.statusCode >= 400 && error.statusCode < 500) return res.status(error.statusCode).json({ success: false, message: error.message, code: error.code })
      this.logger.error('商品筛选选项读取失败:', { requestId: req.requestId, error })
      return res.status(500).json({ success: false, message: '读取商品筛选选项失败，请稍后重试', code: 'INTERNAL_ERROR', request_id: req.requestId || null })
    }
  }
  async productNameOptions(req, res) {
    try {
      const permissions = await this.access.getPermissions(req.user.id)
      if (permissions.hiddenFields?.includes('basic_info.name')) {
        return res.status(403).json({ success: false, message: '商品名称字段已隐藏，不能检索名称选项', code: 'FIELD_PERMISSION_DENIED' })
      }
      if (req.query.store_id !== undefined && permissions.hiddenFields?.includes('stock_info.distribution')) {
        return res.status(403).json({ success: false, message: '销售门店字段已隐藏，不能按门店检索名称选项', code: 'FIELD_PERMISSION_DENIED' })
      }
      const names = await this.service.productNameOptions(req.user, req.query)
      return res.json({ success: true, data: names })
    } catch (error) {
      if (error.statusCode >= 400 && error.statusCode < 500) return res.status(error.statusCode).json({ success: false, message: error.message, code: error.code })
      this.logger.error('商品名称选项读取失败:', { requestId: req.requestId, error })
      return res.status(500).json({ success: false, message: '读取商品名称选项失败，请稍后重试', code: 'INTERNAL_ERROR', request_id: req.requestId || null })
    }
  }
  detail(req, res) { return this.read(req, res, 'detail') }
  phoneReceipt(req, res) { return this.read(req, res, 'phoneReceipt') }
  goodsOrder(req, res) { return this.read(req, res, 'orderGoods') }
  phoneOrder(req, res) { return this.read(req, res, 'orderPhone') }
  aftersales(req, res) { return this.read(req, res, 'aftersales') }
  customerHistory(req, res) { return this.read(req, res, 'customerHistory') }
}
module.exports = QueryGoodsController
