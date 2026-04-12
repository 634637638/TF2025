/**
 * 销售管理API路由 - 后台管理
 * 功能：管理H5订单、审核支付、发货等
 */

const express = require('express');
const router = express.Router();
const ApiResponse = require('../utils/response');
const ShopPublicService = require('../services/shop-public.service');
const ShopService = require('../services/shop.service');
const { unifiedAuth, requireAnyPermission } = require('../middleware/unified-auth');
const log = require('../utils/log');

const shopPublicService = new ShopPublicService();
const shopService = new ShopService();

const H5_ORDER_VIEW_PERMISSIONS = [
  'h5-orders:view',
  'h5-admin:view',
  'sales:view'
];
const H5_ORDER_EDIT_PERMISSIONS = [
  'h5-orders:edit',
  'h5-admin:edit',
  'sales:edit'
];

router.use(unifiedAuth);

/**
 * 获取订单统计数据
 * GET /api/sales-management/h5-orders/statistics
 * 注意：这个路由要放在 /h5-orders/:id 之前，否则会被匹配到
 */
router.get('/h5-orders/statistics', requireAnyPermission(H5_ORDER_VIEW_PERMISSIONS), async (req, res) => {
  try {
    log.debug('[SalesManagement] 收到统计请求:', req.query, req.path);
    const { start_date, end_date } = req.query;

    const stats = await shopPublicService.getH5OrderStatistics({
      start_date,
      end_date
    });

    ApiResponse.success(res, stats, '获取统计数据成功');
  } catch (error) {
    log.error('获取统计数据失败:', error);
    ApiResponse.error(res, error.message || '获取统计数据失败', 500);
  }
});

/**
 * 获取所有H5订单列表
 * GET /api/sales-management/h5-orders
 */
router.get('/h5-orders', requireAnyPermission(H5_ORDER_VIEW_PERMISSIONS), async (req, res) => {
  try {
    log.debug('[SalesManagement] 收到订单列表请求:', req.query, req.path);
    const {
      page = 1,
      limit = 20,
      status,
      customer_name,
      customer_phone,
      order_number,
      start_date,
      end_date,
      sort = 'created_at',
      order = 'desc'
    } = req.query;

    const result = await shopPublicService.getH5OrdersList({
      page: parseInt(page),
      limit: parseInt(limit),
      status,
      customer_name,
      customer_phone,
      order_number,
      start_date,
      end_date,
      sort,
      order
    });

    ApiResponse.paginated(res, result.data, {
      page: result.page,
      limit: result.limit,
      total: result.total
    }, '获取订单列表成功');
  } catch (error) {
    log.error('获取订单列表失败:', error);
    ApiResponse.error(res, error.message || '获取订单列表失败', 500);
  }
});

/**
 * 获取订单详情
 * GET /api/sales-management/h5-orders/:id
 */
router.get('/h5-orders/:id', requireAnyPermission(H5_ORDER_VIEW_PERMISSIONS), async (req, res) => {
  try {
    const { id } = req.params;

    const order = await shopPublicService.getH5OrderDetail(id);

    if (!order) {
      return ApiResponse.notFound(res, '订单不存在');
    }

    ApiResponse.success(res, order, '获取订单详情成功');
  } catch (error) {
    log.error('获取订单详情失败:', error);
    ApiResponse.error(res, error.message || '获取订单详情失败', 500);
  }
});

/**
 * 审核通过订单（支付确认）
 * PUT /api/sales-management/h5-orders/:id/confirm
 * 将订单状态从 paid 改为 confirmed，并锁定库存
 */
router.put('/h5-orders/:id/confirm', requireAnyPermission(H5_ORDER_EDIT_PERMISSIONS), async (req, res) => {
  try {
    const { id } = req.params;
    const { remarks } = req.body;

    const result = await shopPublicService.confirmH5Order(id, req.user.id, remarks);

    if (!result) {
      return ApiResponse.notFound(res, '订单不存在');
    }

    ApiResponse.success(res, result, '订单审核通过成功');
  } catch (error) {
    log.error('审核订单失败:', error);
    ApiResponse.error(res, error.message || '审核订单失败', 500);
  }
});

/**
 * 拒绝订单（支付审核不通过）
 * PUT /api/sales-management/h5-orders/:id/reject
 * 将订单状态从 paid 改回 pending，释放预留
 */
router.put('/h5-orders/:id/reject', requireAnyPermission(H5_ORDER_EDIT_PERMISSIONS), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return ApiResponse.badRequest(res, '请提供拒绝原因');
    }

    const result = await shopPublicService.rejectH5Order(id, req.user.id, reason);

    if (!result) {
      return ApiResponse.notFound(res, '订单不存在');
    }

    ApiResponse.success(res, result, '订单已拒绝');
  } catch (error) {
    log.error('拒绝订单失败:', error);
    ApiResponse.error(res, error.message || '拒绝订单失败', 500);
  }
});

/**
 * 订单发货
 * PUT /api/sales-management/h5-orders/:id/ship
 * 将订单状态从 confirmed 改为 shipped
 */
router.put('/h5-orders/:id/ship', requireAnyPermission(H5_ORDER_EDIT_PERMISSIONS), async (req, res) => {
  try {
    const { id } = req.params;
    const { tracking_number, shipping_company, remarks } = req.body;

    const result = await shopPublicService.shipH5Order(id, {
      tracking_number,
      shipping_company,
      remarks,
      shipped_by: req.user.id
    });

    if (!result) {
      return ApiResponse.notFound(res, '订单不存在');
    }

    ApiResponse.success(res, result, '订单发货成功');
  } catch (error) {
    log.error('订单发货失败:', error);
    ApiResponse.error(res, error.message || '订单发货失败', 500);
  }
});

/**
 * 订单完成
 * PUT /api/sales-management/h5-orders/:id/complete
 * 将订单状态从 shipped 改为 completed
 */
router.put('/h5-orders/:id/complete', requireAnyPermission(H5_ORDER_EDIT_PERMISSIONS), async (req, res) => {
  try {
    const { id } = req.params;
    const { remarks } = req.body;

    const result = await shopPublicService.completeH5Order(id, req.user.id, remarks);

    if (!result) {
      return ApiResponse.notFound(res, '订单不存在');
    }

    ApiResponse.success(res, result, '订单已完成');
  } catch (error) {
    log.error('完成订单失败:', error);
    ApiResponse.error(res, error.message || '完成订单失败', 500);
  }
});

/**
 * 取消订单
 * PUT /api/sales-management/h5-orders/:id/cancel
 */
router.put('/h5-orders/:id/cancel', requireAnyPermission(H5_ORDER_EDIT_PERMISSIONS), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const result = await shopPublicService.cancelH5Order(id, req.user.id, reason);

    if (!result) {
      return ApiResponse.notFound(res, '订单不存在');
    }

    ApiResponse.success(res, result, '订单已取消');
  } catch (error) {
    log.error('取消订单失败:', error);
    ApiResponse.error(res, error.message || '取消订单失败', 500);
  }
});

module.exports = router;
