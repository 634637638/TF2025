/**
 * 供应商打款路由
 * 用于管理供应商手机的打款状态
 */
const express = require('express')
const router = express.Router()
const supplierPaymentController = require('../controllers/supplier-payment.controller')
const { body, param, query, validationResult } = require('express-validator')
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth')
const ApiResponse = require('../utils/response')

const validateDate = value => {
  if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(value)) {
    throw new Error('日期格式必须为 YYYY-MM-DD')
  }
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error('日期无效')
  }
  return true
}

const validatePaymentTime = value => {
  if (value === null) return true
  if (!value) return true
  const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
  const dateTimeRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/
  if ((iso8601Regex.test(value) || dateTimeRegex.test(value)) && !Number.isNaN(Date.parse(value))) {
    return true
  }
  throw new Error('无效的日期格式，请使用 YYYY-MM-DD HH:mm:ss 或 ISO8601 格式')
}

/**
 * 验证请求参数的中间件
 */
const validateRequest = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return ApiResponse.badRequest(res, errors.array()[0]?.msg || '参数验证失败')
  }
  next()
}

/**
 * @route   GET /api/supplier-payments/statistics
 * @desc    获取供应商应付打款统计（按供应商分组）
 * @access  Private
 */
router.get('/statistics',
  unifiedAuth,
  requirePermission('supplier-payments:view'),
  [
    query('supplier_id').optional().isInt({ min: 1 }),
    query('sale_status').optional().isIn(['sold', 'stock', 'all'])
  ],
  validateRequest,
  supplierPaymentController.getStatistics
)

/**
 * @route   GET /api/supplier-payments/summary-statistics
 * @desc    获取汇总统计（用于卡片显示，不分组）
 * @access  Private
 */
router.get('/summary-statistics',
  unifiedAuth,
  requirePermission('supplier-payments:view'),
  [
    query('sale_status').optional().isIn(['sold', 'stock', 'all'])
  ],
  validateRequest,
  supplierPaymentController.getSummaryStatistics
)

/**
 * @route   GET /api/supplier-payments/phones
 * @desc    获取供应商手机列表（支持筛选）
 * @access  Private
 */
router.get('/phones',
  unifiedAuth,
  requirePermission('supplier-payments:view'),
  [
    query('supplier_id').optional().isInt({ min: 1 }),
    query('store_id').optional().isInt({ min: 1 }),
    query('payment_status').optional().isIn(['unpaid', 'paid', 'all']),
    query('sale_status').optional().isIn(['sold', 'stock', 'all']),
    query('keyword').optional().isString(),
    query('start_date').optional().custom(validateDate),
    query('end_date').optional().custom(validateDate),
    query('page').optional().isInt({ min: 1 }),
    query('page_size').optional().isInt({ min: 1, max: 200 })
  ],
  validateRequest,
  supplierPaymentController.getPhones
)

/**
 * @route   GET /api/supplier-payments/phones/export
 * @desc    导出供应商手机列表
 * @access  Private
 */
router.get('/phones/export',
  unifiedAuth,
  requirePermission('supplier-payments:export'),
  [
    query('supplier_id').optional().isInt({ min: 1 }),
    query('store_id').optional().isInt({ min: 1 }),
    query('payment_status').optional().isIn(['unpaid', 'paid', 'all']),
    query('sale_status').optional().isIn(['sold', 'stock', 'all']),
    query('keyword').optional().isString(),
    query('start_date').optional().custom(validateDate),
    query('end_date').optional().custom(validateDate)
  ],
  validateRequest,
  supplierPaymentController.exportPhones
)

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
    body('phone_ids.*').isInt({ min: 1 }),
    body('payment_method').isIn(['bank_transfer', 'cash', 'alipay', 'wechat', 'other']),
    body('payment_time').optional().custom(validatePaymentTime),
    body('payment_remarks').optional().isString().isLength({ max: 1000 })
  ],
  validateRequest,
  supplierPaymentController.batchPayment
)

/**
 * @route   GET /api/supplier-payments/batch-details
 * @desc    获取打款批次详情
 * @access  Private
 */
router.get('/batch-details',
  unifiedAuth,
  requirePermission('supplier-payments:view'),
  [
    query('supplier_id').isInt({ min: 1 }),
    query('payment_time').isString()
  ],
  validateRequest,
  supplierPaymentController.getPaymentBatchDetails
)

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
    body('phone_ids.*').isInt({ min: 1 })
  ],
  validateRequest,
  supplierPaymentController.batchCancelPayment
)

/**
 * @route   POST /api/supplier-payments/:id/payment
 * @desc    单个手机打款
 * @access  Private
 */
router.post('/:id/payment',
  unifiedAuth,
  requirePermission('supplier-payments:create'),
  [
    param('id').isInt({ min: 1 }),
    body('payment_method').isIn(['bank_transfer', 'cash', 'alipay', 'wechat', 'other']),
    body('payment_time').optional().custom(validatePaymentTime),
    body('payment_remarks').optional().isString().isLength({ max: 1000 })
  ],
  validateRequest,
  supplierPaymentController.singlePayment
)

/**
 * @route   PUT /api/supplier-payments/:id
 * @desc    更新打款信息
 * @access  Private
 */
router.put('/:id',
  unifiedAuth,
  requirePermission('supplier-payments:edit'),
  [
    param('id').isInt({ min: 1 }),
    body('payment_method').optional().custom((value) => {
      // 允许 null 或者有效的支付方式
      if (value === null) return true
      if (['bank_transfer', 'cash', 'alipay', 'wechat', 'other'].includes(value)) return true
      throw new Error('无效的支付方式')
    }),
    body('payment_time').optional().custom(validatePaymentTime),
    body('payment_remarks').optional().isString().isLength({ max: 1000 })
  ],
  validateRequest,
  supplierPaymentController.updatePayment
)

module.exports = router
