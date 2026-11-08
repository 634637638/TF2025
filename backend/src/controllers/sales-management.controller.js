'use strict'

const ApiResponse = require('../utils/response')
const ShopPublicService = require('../services/shop-public.service')
const log = require('../utils/log')

class SalesManagementController {
  constructor({ service = new ShopPublicService(), logger = log, now = Date.now } = {}) {
    this.service = service
    this.logger = logger
    this.now = now
  }

  async statistics(req, res) {
    try {
      this.logger.debug('[SalesManagement] 收到统计请求:', req.query, req.path)
      const { status, customer_name, customer_phone, order_number, start_date, end_date } = req.query
      const stats = await this.service.getH5OrderStatistics({
        status, customer_name, customer_phone, order_number, start_date, end_date
      })
      return ApiResponse.success(res, stats, '获取统计数据成功')
    } catch (error) {
      this.logger.error('获取统计数据失败:', error)
      return ApiResponse.error(res, error.message || '获取统计数据失败', 500)
    }
  }

  async list(req, res) {
    try {
      this.logger.debug('[SalesManagement] 收到订单列表请求:', req.query, req.path)
      const {
        page = 1, status, customer_name, customer_phone, order_number,
        start_date, end_date, sort = 'created_at', order = 'desc'
      } = req.query
      const page_size = Math.min(100, Math.max(1, parseInt(req.query.page_size) || 20))
      const result = await this.service.getH5OrdersList({
        page: parseInt(page), page_size, status, customer_name,
        customer_phone, order_number, start_date, end_date, sort, order
      })
      return res.status(200).json({
        success: true,
        message: '获取订单列表成功',
        data: result.data,
        pagination: {
          page: result.page,
          page_size: result.page_size,
          total: result.total,
          total_pages: result.total_pages,
          has_next: result.has_next,
          has_prev: result.has_prev
        },
        timestamp: new Date(this.now()).toISOString()
      })
    } catch (error) {
      this.logger.error('获取订单列表失败:', error)
      return ApiResponse.error(res, error.message || '获取订单列表失败', 500)
    }
  }

  async detail(req, res) {
    try {
      const order = await this.service.getH5OrderDetail(req.params.id)
      if (!order) return ApiResponse.notFound(res, '订单不存在')
      return ApiResponse.success(res, order, '获取订单详情成功')
    } catch (error) {
      this.logger.error('获取订单详情失败:', error)
      return ApiResponse.error(res, error.message || '获取订单详情失败', 500)
    }
  }

  async confirm(req, res) {
    try {
      const result = await this.service.confirmH5Order(req.params.id, req.user.id, req.body.remarks)
      if (!result) return ApiResponse.notFound(res, '订单不存在')
      return ApiResponse.success(res, result, '订单审核通过成功')
    } catch (error) {
      this.logger.error('审核订单失败:', error)
      return ApiResponse.error(res, error.message || '审核订单失败', 500)
    }
  }

  async reject(req, res) {
    try {
      const { reason } = req.body
      if (!reason) return ApiResponse.badRequest(res, '请提供拒绝原因')
      const result = await this.service.rejectH5Order(req.params.id, req.user.id, reason)
      if (!result) return ApiResponse.notFound(res, '订单不存在')
      return ApiResponse.success(res, result, '订单已拒绝')
    } catch (error) {
      this.logger.error('拒绝订单失败:', error)
      return ApiResponse.error(res, error.message || '拒绝订单失败', 500)
    }
  }

  async ship(req, res) {
    try {
      const { tracking_number, shipping_company, remarks } = req.body
      const result = await this.service.shipH5Order(req.params.id, {
        tracking_number, shipping_company, remarks, shipped_by: req.user.id
      })
      if (!result) return ApiResponse.notFound(res, '订单不存在')
      return ApiResponse.success(res, result, '订单发货成功')
    } catch (error) {
      this.logger.error('订单发货失败:', error)
      return ApiResponse.error(res, error.message || '订单发货失败', 500)
    }
  }

  async complete(req, res) {
    try {
      const result = await this.service.completeH5Order(req.params.id, req.user.id, req.body.remarks)
      if (!result) return ApiResponse.notFound(res, '订单不存在')
      return ApiResponse.success(res, result, '订单已完成')
    } catch (error) {
      this.logger.error('完成订单失败:', error)
      return ApiResponse.error(res, error.message || '完成订单失败', 500)
    }
  }

  async cancel(req, res) {
    try {
      const result = await this.service.cancelH5Order(req.params.id, req.user.id, req.body.reason)
      if (!result) return ApiResponse.notFound(res, '订单不存在')
      return ApiResponse.success(res, result, '订单已取消')
    } catch (error) {
      this.logger.error('取消订单失败:', error)
      return ApiResponse.error(res, error.message || '取消订单失败', 500)
    }
  }
}

module.exports = SalesManagementController
