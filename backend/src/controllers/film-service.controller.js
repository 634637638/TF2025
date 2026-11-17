'use strict'

const FilmService = require('../services/film-service.service')
const FieldAccessService = require('../services/field-access.service')
const log = require('../utils/log')

const responseKeys = {
  'stock_info.distribution': ['store_id', 'store_name'],
  'stock_info.total_quantity': ['quantity', 'film_quantity', 'device_film_quantity', 'total_amount', 'serial_quantity'],
  'basic_info.model_name': ['model_id', 'phone_model_name'],
  'basic_info.barcode': ['barcode'], 'basic_info.brand_name': ['brand_name'],
  'basic_info.specifications': ['product_model'], 'basic_info.color_name': ['color_name'],
  'basic_info.unit': ['unit'], 'basic_info.category': ['category'],
  'basic_info.serial_number': ['serial_number', 'serial_quantity'],
  'price_info.sale_price': ['sale_price'],
  'basic_info.name': ['name'], 'basic_info.usage_type': ['sale_type', 'total_amount', 'free_count', 'paid_count'],
  'basic_info.sequence': ['order_id', 'order_no'],
  'price_info.total_price': ['total_amount'], 'price_info.unit_price': ['total_amount', 'sale_price'],
  'operator_info.operator_name': ['operator_id', 'operator_name'],
  'time_info.created_at': ['business_time', 'created_at']
}

class FilmServiceController {
  constructor({ service = new FilmService(), access, queryAccess = new FieldAccessService({ moduleKey: 'query_queryview', strict: true }), logger = log } = {}) {
    Object.assign(this, { service, logger, queryAccess, access: access || new FieldAccessService({
      moduleKey: 'accessories_accessoriesview', responseKeys, strict: true }) })
  }

  async products(req, res) {
    try {
      const permissions = await this.access.getPermissions(req.user.id)
      const queryPermissions = await this.queryAccess.getPermissions(req.user.id)
      const hidden = new Set(permissions.hiddenFields || [])
      if (['basic_info.model', 'customer_info.customer_name'].some(field => queryPermissions.hiddenFields?.includes(field)) ||
        ['basic_info.name', 'basic_info.category', 'basic_info.usage_type', 'stock_info.distribution', 'stock_info.total_quantity',
          'customer_info.customer_name'].some(field => hidden.has(field))) {
        return res.status(403).json({ success: false, message: '缺少贴膜商品或客户字段权限', code: 'FIELD_PERMISSION_DENIED' })
      }
      const searchFields = [['basic_info.name', 'name'], ['basic_info.barcode', 'barcode'], ['basic_info.category', 'category'],
        ['basic_info.brand_name', 'brand_name'], ['basic_info.specifications', 'product_model'], ['basic_info.serial_number', 'serial_number']]
        .filter(([field]) => !hidden.has(field)).map(([, key]) => key)
      const data = await this.service.productOptions(req.user, req.params.customerId, req.query, searchFields)
      return res.json({ success: true, data: this.access.maskPayload(data, permissions) })
    } catch (error) {
      if (error.statusCode >= 400 && error.statusCode < 500) return res.status(error.statusCode).json({ success: false, message: error.message, code: error.code })
      this.logger.error('贴膜商品查询失败:', { requestId: req.requestId, error })
      return res.status(500).json({ success: false, message: '读取贴膜商品失败，请稍后重试', code: 'INTERNAL_ERROR' })
    }
  }

  async context(req, res) {
    try {
      const permissions = await this.access.getPermissions(req.user.id)
      const hasPhoneContext = req.query?.phone_id !== undefined
      if (permissions.hiddenFields?.includes('customer_info.customer_name') ||
        !hasPhoneContext && permissions.hiddenFields?.includes('customer_info.customer_phone')) {
        return res.status(403).json({ success: false, message: '无权按客户查看贴膜记录', code: 'FIELD_PERMISSION_DENIED' })
      }
      if (permissions.hiddenFields?.includes('basic_info.usage_type') && req.query?.sale_type !== undefined && req.query.sale_type !== 'all') {
        return res.status(403).json({ success: false, message: '无权按收费或免费筛选贴膜记录', code: 'FIELD_PERMISSION_DENIED' })
      }
      if (req.query?.phone_id !== undefined) {
        const queryPermissions = await this.queryAccess.getPermissions(req.user.id)
        if (['basic_info.model', 'customer_info.customer_name'].some(field => queryPermissions.hiddenFields?.includes(field))) return res.status(403).json({ success: false, message: '无权读取当前手机型号或客户关联', code: 'FIELD_PERMISSION_DENIED' })
      }
      const data = await this.service.context(req.user, req.params.customerId, req.query)
      return res.json({ success: true, data: this.access.maskPayload(data, permissions) })
    } catch (error) {
      if (error.statusCode >= 400 && error.statusCode < 500) return res.status(error.statusCode).json({ success: false, message: error.message, code: error.code })
      this.logger.error('客户贴膜服务查询失败:', { requestId: req.requestId, error })
      return res.status(500).json({ success: false, message: '读取贴膜服务失败，请稍后重试', code: 'INTERNAL_ERROR' })
    }
  }
}

module.exports = FilmServiceController
