'use strict'

const FilmService = require('../services/film-service.service')
const FieldAccessService = require('../services/field-access.service')
const log = require('../utils/log')

const responseKeys = {
  'stock_info.distribution': ['store_id', 'store_name'],
  'stock_info.total_quantity': ['quantity', 'film_quantity', 'total_amount'],
  'basic_info.name': ['name'], 'basic_info.usage_type': ['sale_type', 'total_amount'],
  'basic_info.sequence': ['order_id', 'order_no'],
  'price_info.total_price': ['total_amount'], 'price_info.unit_price': ['total_amount'],
  'operator_info.operator_name': ['operator_id', 'operator_name'],
  'time_info.created_at': ['business_time', 'created_at']
}

class FilmServiceController {
  constructor({ service = new FilmService(), access, logger = log } = {}) {
    Object.assign(this, { service, logger, access: access || new FieldAccessService({
      moduleKey: 'accessories_accessoriesview', responseKeys, strict: true }) })
  }

  async context(req, res) {
    try {
      const permissions = await this.access.getPermissions(req.user.id)
      if (['customer_info.customer_name', 'customer_info.customer_phone'].some(key => permissions.hiddenFields?.includes(key))) {
        return res.status(403).json({ success: false, message: '无权按客户查看贴膜记录', code: 'FIELD_PERMISSION_DENIED' })
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
