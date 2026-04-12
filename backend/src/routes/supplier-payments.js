/**
 * 供应商打款路由
 * 用于管理供应商手机的打款状态
 */
const express = require('express');
const router = express.Router();
const supplierPaymentController = require('../controllers/supplier-payment.controller');
const { body, query, validationResult } = require('express-validator');
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth');

/**
 * 验证请求参数的中间件
 */
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: '参数验证失败',
        details: errors.array()
      }
    });
  }
  next();
};

/**
 * @route   GET /api/supplier-payments/statistics
 * @desc    获取供应商应付打款统计（按供应商分组）
 * @access  Private
 */
router.get('/statistics',
  unifiedAuth,
  requirePermission('supplier-payments:view'),
  [
    query('supplier_id').optional().isInt(),
  ],
  validateRequest,
  supplierPaymentController.getStatistics
);

/**
 * @route   GET /api/supplier-payments/summary-statistics
 * @desc    获取汇总统计（用于卡片显示，不分组）
 * @access  Private
 */
router.get('/summary-statistics',
  unifiedAuth,
  requirePermission('supplier-payments:view'),
  [
    query('sale_status').optional().isIn(['sold', 'stock', 'all']),
  ],
  validateRequest,
  supplierPaymentController.getSummaryStatistics
);

/**
 * @route   GET /api/supplier-payments/phones
 * @desc    获取供应商手机列表（支持筛选）
 * @access  Private
 */
router.get('/phones',
  unifiedAuth,
  requirePermission('supplier-payments:view'),
  [
    query('supplier_id').optional().isInt(),
    query('store_id').optional().isInt(),
    query('payment_status').optional().isIn(['unpaid', 'paid', 'all']),
    query('sale_status').optional().isIn(['sold', 'stock', 'all']),
    query('keyword').optional().isString(),
    query('start_date').optional().isString(),
    query('end_date').optional().isString(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 200 }),
  ],
  validateRequest,
  supplierPaymentController.getPhones
);

/**
 * @route   GET /api/supplier-payments/phones/export
 * @desc    导出供应商手机列表
 * @access  Private
 */
router.get('/phones/export',
  unifiedAuth,
  requirePermission('supplier-payments:export'),
  [
    query('supplier_id').optional().isInt(),
    query('store_id').optional().isInt(),
    query('payment_status').optional().isIn(['unpaid', 'paid', 'all']),
    query('sale_status').optional().isIn(['sold', 'stock', 'all']),
    query('keyword').optional().isString(),
    query('start_date').optional().isString(),
    query('end_date').optional().isString()
  ],
  validateRequest,
  supplierPaymentController.exportPhones
);

/**
 * @route   POST /api/supplier-payments/batch-payment
 * @desc    批量打款
 * @access  Private
 */
router.post('/batch-payment',
  unifiedAuth,
  requirePermission('supplier-payments:create'),
  [
    body('phone_ids').isArray({ min: 1 }),
    body('phone_ids.*').isInt(),
    body('payment_method').isIn(['bank_transfer', 'cash', 'alipay', 'wechat', 'other']),
    body('payment_time').optional().custom((value) => {
      if (!value) return true;
      // 支持多种日期格式：ISO8601 或 YYYY-MM-DD HH:mm:ss
      const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
      const dateTimeRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
      if (iso8601Regex.test(value) || dateTimeRegex.test(value)) {
        // 验证是否为有效日期
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return true;
        }
      }
      throw new Error('无效的日期格式，请使用 YYYY-MM-DD HH:mm:ss 或 ISO8601 格式');
    }),
  ],
  validateRequest,
  supplierPaymentController.batchPayment
);

/**
 * @route   GET /api/supplier-payments/batch-details
 * @desc    获取打款批次详情
 * @access  Private
 */
router.get('/batch-details',
  unifiedAuth,
  requirePermission('supplier-payments:view'),
  [
    query('supplier_id').isInt(),
    query('payment_time').isString(),
  ],
  validateRequest,
  supplierPaymentController.getPaymentBatchDetails
);

/**
 * @route   POST /api/supplier-payments/batch-cancel
 * @desc    批量取消打款
 * @access  Private
 */
router.post('/batch-cancel',
  unifiedAuth,
  requirePermission('supplier-payments:edit'),
  [
    body('phone_ids').isArray({ min: 1 }),
    body('phone_ids.*').isInt(),
  ],
  validateRequest,
  supplierPaymentController.batchCancelPayment
);

/**
 * @route   POST /api/supplier-payments/:id/payment
 * @desc    单个手机打款
 * @access  Private
 */
router.post('/:id/payment',
  unifiedAuth,
  requirePermission('supplier-payments:create'),
  [
    body('payment_method').isIn(['bank_transfer', 'cash', 'alipay', 'wechat', 'other']),
    body('payment_time').optional().custom((value) => {
      if (!value) return true;
      // 支持多种日期格式：ISO8601 或 YYYY-MM-DD HH:mm:ss
      const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
      const dateTimeRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
      if (iso8601Regex.test(value) || dateTimeRegex.test(value)) {
        // 验证是否为有效日期
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return true;
        }
      }
      throw new Error('无效的日期格式，请使用 YYYY-MM-DD HH:mm:ss 或 ISO8601 格式');
    }),
  ],
  validateRequest,
  supplierPaymentController.singlePayment
);

/**
 * @route   PUT /api/supplier-payments/:id
 * @desc    更新打款信息
 * @access  Private
 */
router.put('/:id',
  unifiedAuth,
  requirePermission('supplier-payments:edit'),
  [
    body('payment_method').optional().custom((value) => {
      // 允许 null 或者有效的支付方式
      if (value === null) return true;
      if (['bank_transfer', 'cash', 'alipay', 'wechat', 'other'].includes(value)) return true;
      throw new Error('无效的支付方式');
    }),
    body('payment_time').optional().custom((value) => {
      // 允许 null 或者有效的 ISO8601 日期
      if (value === null) return true;
      if (!isNaN(Date.parse(value))) return true;
      throw new Error('无效的日期格式');
    }),
  ],
  validateRequest,
  supplierPaymentController.updatePayment
);

module.exports = router;
