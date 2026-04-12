/**
 * 供应商付款路由
 * 定义付款相关API端点
 */
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
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

router.use(unifiedAuth);

/**
 * @route   POST /api/payments
 * @desc    创建付款申请
 * @access  Private
 * @permission supplier-payments:create
 */
router.post('/',
  requirePermission('supplier-payments:create'),
  [
    body('supplier_id').notEmpty().withMessage('供应商ID不能为空'),
    body('payment_amount').isFloat({ min: 0.01 }).withMessage('付款金额必须大于0'),
    body('payment_method').optional().isIn(['cash', 'bank_transfer', 'alipay', 'wechat', 'other'])
  ],
  validateRequest,
  paymentController.createPayment
);

/**
 * @route   PUT /api/payments/:id/approve
 * @desc    审批付款申请
 * @access  Private
 * @permission supplier-payments:approve
 */
router.put('/:id/approve',
  requirePermission('supplier-payments:approve'),
  [
    body('status').isIn(['approved', 'rejected']).withMessage('无效的审批状态')
  ],
  validateRequest,
  paymentController.approvePayment
);

/**
 * @route   PUT /api/payments/:id/confirm
 * @desc    确认付款完成
 * @access  Private
 * @permission supplier-payments:edit
 */
router.put('/:id/confirm',
  requirePermission('supplier-payments:edit'),
  [
    body('transaction_id').optional(),
    body('payment_account').optional(),
    body('actual_payment_date').optional().isISO8601().withMessage('无效的日期格式')
  ],
  validateRequest,
  paymentController.confirmPayment
);

/**
 * @route   PUT /api/payments/:id/cancel
 * @desc    取消付款
 * @access  Private
 * @permission supplier-payments:edit
 */
router.put('/:id/cancel',
  requirePermission('supplier-payments:edit'),
  [
    body('cancel_reason').optional()
  ],
  validateRequest,
  paymentController.cancelPayment
);

/**
 * @route   GET /api/payments
 * @desc    获取付款记录列表
 * @access  Private
 * @permission supplier-payments:view
 */
router.get('/',
  requirePermission('supplier-payments:view'),
  [
    query('page').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1 }),
    query('limit').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1, max: 100 }),
    query('supplier_id').optional({ nullable: true, checkFalsy: true }).isInt(),
    query('settlement_id').optional({ nullable: true, checkFalsy: true }).isInt(),
    query('status').optional({ nullable: true, checkFalsy: true }).isIn(['pending', 'approved', 'completed', 'failed', 'cancelled']),
    query('payment_method').optional({ nullable: true, checkFalsy: true }).isIn(['cash', 'bank_transfer', 'alipay', 'wechat', 'other'])
  ],
  validateRequest,
  paymentController.getPayments
);

/**
 * @route   GET /api/payments/statistics
 * @desc    获取付款统计数据
 * @access  Private
 * @permission supplier-payments:view
 */
router.get('/statistics',
  requirePermission('supplier-payments:view'),
  paymentController.getPaymentStatistics
);

/**
 * @route   GET /api/payments/export
 * @desc    导出付款记录
 * @access  Private
 * @permission supplier-payments:export
 */
router.get('/export',
  requirePermission('supplier-payments:export'),
  paymentController.exportPayments
);

/**
 * @route   GET /api/payments/supplier/:supplier_id
 * @desc    获取供应商付款历史
 * @access  Private
 * @permission supplier-payments:view
 */
router.get('/supplier/:supplier_id',
  requirePermission('supplier-payments:view'),
  paymentController.getSupplierPaymentHistory
);

/**
 * @route   GET /api/payments/:id
 * @desc    获取付款详情
 * @access  Private
 * @permission supplier-payments:view
 */
router.get('/:id',
  requirePermission('supplier-payments:view'),
  paymentController.getPaymentById
);

module.exports = router;
