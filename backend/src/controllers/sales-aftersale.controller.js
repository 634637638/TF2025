'use strict'

const SalesAftersaleService = require('../services/sales-aftersale.service')
const SalesGoodsReturnService = require('../services/sales-goods-return.service')
const SalesGoodsExchangeService = require('../services/sales-goods-exchange.service')
const SalesPhoneReturnService = require('../services/sales-phone-return.service')
const FieldAccessService = require('../services/field-access.service')
const log = require('../utils/log')

const phoneResponseKeys = {
  'basic_info.sale_price': ['total_amount', 'points_awarded']
}
const goodsResponseKeys = {
  'basic_info.usage_type': ['sale_type', 'gift_return_unit_price', 'gift_return_total', 'remaining_gift_return_total', 'gift_agreement_state'],
  'basic_info.name': ['name', 'accessory_id'], 'basic_info.serial_number': ['serial_numbers', 'available_serial_numbers'],
  'basic_info.unit': ['unit'],
  'stock_info.total_quantity': ['quantity', 'returned_quantity', 'remaining_quantity', 'total_amount', 'points_awarded', 'points_used', 'deduction_amount', 'gross_amount', 'gift_return_total', 'remaining_gift_return_total'],
  'price_info.total_price': ['total_amount', 'points_awarded', 'points_used', 'deduction_amount', 'gross_amount', 'gift_return_total', 'remaining_gift_return_total'],
  'price_info.unit_price': ['unit_price', 'total_amount', 'points_awarded', 'points_used', 'deduction_amount', 'gross_amount', 'gift_return_unit_price', 'gift_return_total', 'remaining_gift_return_total', 'gift_agreement_state']
}

class SalesAftersaleController {
  constructor({ service = new SalesAftersaleService(), goodsReturns = new SalesGoodsReturnService(), goodsExchanges = new SalesGoodsExchangeService(), phoneReturns = new SalesPhoneReturnService(), phoneAccess, goodsAccess, masking, logger = log } = {}) {
    Object.assign(this, { service, goodsReturns, goodsExchanges, phoneReturns, logger,
      phoneAccess: phoneAccess || new FieldAccessService({ moduleKey: 'query_queryview', responseKeys: phoneResponseKeys, masking, strict: true }),
      goodsAccess: goodsAccess || new FieldAccessService({ moduleKey: 'query_queryview', fieldScope: 'goods', responseKeys: goodsResponseKeys, masking, strict: true }) })
  }

  async goodsReturn(req, res, mode, exchange = false) {
    const label = exchange ? '换货' : '退货', service = exchange ? this.goodsExchanges : this.goodsReturns
    try {
      // 金额及数量的衍生汇总可反推原价；办理前完整核验必要字段，不能先写入再脱敏。
      const permissions = await this.goodsAccess.getPermissions(req.user.id)
      const required = ['basic_info.name', 'basic_info.usage_type', 'stock_info.distribution', 'stock_info.total_quantity',
        'price_info.unit_price', 'price_info.total_price', 'time_info.created_at', 'other_info.remarks']
      if (exchange) required.push('operator_info.operator_name')
      if (mode === 'context' || req.body?.serial_numbers?.length || req.body?.replacement?.serial_numbers?.length) required.push('basic_info.serial_number')
      if (required.some(field => permissions.hiddenFields?.includes(field))) {
        return res.status(403).json({ success: false, message: `缺少商品${label}必要字段权限`, code: 'FIELD_PERMISSION_DENIED' })
      }
      const data = mode === 'context' ? await service.context(req.params.orderId, req.params.itemId, req.user)
        : await service[mode](req.params.orderId, req.params.itemId, req.body || {}, req.user)
      return res.json({ success: true, message: mode === 'submit' ? `商品${label}已记录` : `${label}核对完成，提交时会重新核验`, data })
    } catch (error) {
      if (error.statusCode >= 400 && error.statusCode < 500) return res.status(error.statusCode).json({ success: false, message: error.message, code: error.code || 'CHECKOUT_RETURN_INVALID' })
      this.logger.error(`商品${label}办理失败:`, { requestId: req.requestId, error })
      return res.status(500).json({ success: false, message: `商品${label}办理失败，请核对售后单后重试`, code: 'INTERNAL_ERROR', request_id: req.requestId || null })
    }
  }
  goodsReturnContext(req, res) { return this.goodsReturn(req, res, 'context') }
  quoteGoodsReturn(req, res) { return this.goodsReturn(req, res, 'quote') }
  submitGoodsReturn(req, res) { return this.goodsReturn(req, res, 'submit') }
  goodsExchangeContext(req, res) { return this.goodsReturn(req, res, 'context', true) }
  quoteGoodsExchange(req, res) { return this.goodsReturn(req, res, 'quote', true) }
  submitGoodsExchange(req, res) { return this.goodsReturn(req, res, 'submit', true) }

  async phoneReturn(req, res, mode) {
    try {
      const permissions = await this.phoneAccess.getPermissions(req.user.id)
      if (['basic_info.sale_price', 'store_info.store_name', 'time_info.sale_time', 'other_info.remarks']
        .some(field => permissions.hiddenFields?.includes(field))) {
        return res.status(403).json({ success: false, message: '缺少手机退货必要字段权限', code: 'FIELD_PERMISSION_DENIED' })
      }
      if (Array.isArray(req.body?.accessories) && req.body.accessories.length) {
        const goods = await this.goodsAccess.getPermissions(req.user.id)
        if (['basic_info.name', 'basic_info.usage_type', 'basic_info.serial_number', 'stock_info.distribution',
          'stock_info.total_quantity', 'price_info.unit_price', 'price_info.total_price', 'time_info.created_at', 'other_info.remarks']
          .some(field => goods.hiddenFields?.includes(field))) {
          return res.status(403).json({ success: false, message: '缺少关联商品退货必要字段权限', code: 'FIELD_PERMISSION_DENIED' })
        }
      }
      const data = await this.phoneReturns[mode](req.params.orderId, req.params.saleId, req.body || {}, req.user)
      return res.json({ success: true, message: mode === 'submit' ? '手机及关联商品售后已记录' : '售后试算完成，提交时会重新核验', data })
    } catch (error) {
      if (error.statusCode >= 400 && error.statusCode < 500) return res.status(error.statusCode).json({ success: false, message: error.message, code: error.code || 'CHECKOUT_RETURN_INVALID' })
      this.logger.error('手机共同售后办理失败:', { requestId: req.requestId, error })
      return res.status(500).json({ success: false, message: '手机售后办理失败，请核对原售后单后重试', code: 'INTERNAL_ERROR', request_id: req.requestId || null })
    }
  }
  quotePhoneReturn(req, res) { return this.phoneReturn(req, res, 'quote') }
  submitPhoneReturn(req, res) { return this.phoneReturn(req, res, 'submit') }

  async returnChecklist(req, res) {
    try {
      const permissions = await this.phoneAccess.getPermissions(req.user.id)
      if (permissions.hiddenFields?.includes('store_info.store_name')) {
        return res.status(403).json({ success: false, message: '无权查看原单门店', code: 'FIELD_PERMISSION_DENIED' })
      }
      const data = req.params.phoneId === undefined
        ? await this.service.returnChecklist(req.params.orderId, req.params.saleId, req.user)
        : await this.service.phoneReturnChecklist(req.params.phoneId, req.user)
      if (data.mode === 'standalone') return res.json({ success: true, data })
      const phone = this.phoneAccess.maskPayload(data.phone, permissions)
      const goodsPermissions = data.accessories.length ? await this.goodsAccess.getPermissions(req.user.id) : null
      if (goodsPermissions?.hiddenFields?.includes('stock_info.distribution')) {
        return res.status(403).json({ success: false, message: '无权查看关联商品门店', code: 'FIELD_PERMISSION_DENIED' })
      }
      const accessories = goodsPermissions ? this.goodsAccess.maskPayload(data.accessories, goodsPermissions) : []
      return res.json({ success: true, data: { ...data, phone, accessories } })
    } catch (error) {
      if (error.statusCode >= 400 && error.statusCode < 500) return res.status(error.statusCode).json({ success: false, message: error.message, code: error.code })
      this.logger.error('读取退货原单核对信息失败:', { requestId: req.requestId, error })
      return res.status(500).json({ success: false, message: '读取退货核对信息失败，请稍后重试', code: 'INTERNAL_ERROR', request_id: req.requestId || null })
    }
  }
}
module.exports = SalesAftersaleController
