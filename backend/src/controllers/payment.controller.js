const log = require('../utils/log');
/**
 * 供应商打款控制器
 * 处理供应商付款相关业务逻辑
 */
const paymentService = require('../services/payment.service');
const { validationResult } = require('express-validator');

class PaymentController {
  /**
   * 创建付款申请
   * POST /api/payments
   */
  async createPayment(req, res) {
    try {
      // 验证请求参数
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

      const { supplier_id, settlement_id, payment_amount, payment_method, notes } = req.body;
      const operator_id = req.user?.id || null;

      // 创建付款记录
      const payment = await paymentService.createPayment({
        supplier_id,
        settlement_id,
        payment_amount,
        payment_method,
        notes,
        operator_id
      });

      res.json({
        success: true,
        data: payment,
        message: '付款申请创建成功'
      });
    } catch (error) {
      log.error('创建付款申请失败:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'CREATE_PAYMENT_ERROR',
          message: error.message || '创建付款申请失败'
        }
      });
    }
  }

  /**
   * 审批付款申请
   * PUT /api/payments/:id/approve
   */
  async approvePayment(req, res) {
    try {
      const { id } = req.params;
      const { status, approval_notes } = req.body;
      const approver_id = req.user?.id || null;

      // 验证审批状态
      if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_STATUS',
            message: '无效的审批状态'
          }
        });
      }

      const payment = await paymentService.approvePayment(id, {
        status,
        approver_id,
        approval_notes
      });

      res.json({
        success: true,
        data: payment,
        message: status === 'approved' ? '付款申请已通过' : '付款申请已拒绝'
      });
    } catch (error) {
      log.error('审批付款申请失败:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'APPROVE_PAYMENT_ERROR',
          message: error.message || '审批付款申请失败'
        }
      });
    }
  }

  /**
   * 确认付款完成
   * PUT /api/payments/:id/confirm
   */
  async confirmPayment(req, res) {
    try {
      const { id } = req.params;
      const { transaction_id, payment_account, actual_payment_date } = req.body;
      const operator_id = req.user?.id || null;

      const payment = await paymentService.confirmPayment(id, {
        transaction_id,
        payment_account,
        actual_payment_date,
        operator_id
      });

      res.json({
        success: true,
        data: payment,
        message: '付款确认成功'
      });
    } catch (error) {
      log.error('确认付款失败:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'CONFIRM_PAYMENT_ERROR',
          message: error.message || '确认付款失败'
        }
      });
    }
  }

  /**
   * 取消付款
   * PUT /api/payments/:id/cancel
   */
  async cancelPayment(req, res) {
    try {
      const { id } = req.params;
      const { cancel_reason } = req.body;
      const operator_id = req.user?.id || null;

      const payment = await paymentService.cancelPayment(id, {
        cancel_reason,
        operator_id
      });

      res.json({
        success: true,
        data: payment,
        message: '付款已取消'
      });
    } catch (error) {
      log.error('取消付款失败:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'CANCEL_PAYMENT_ERROR',
          message: error.message || '取消付款失败'
        }
      });
    }
  }

  /**
   * 获取付款记录列表
   * GET /api/payments
   */
  async getPayments(req, res) {
    try {
      const filters = {
        page: req.query.page,
        limit: req.query.limit,
        supplier_id: req.query.supplier_id,
        settlement_id: req.query.settlement_id,
        status: req.query.status,
        payment_method: req.query.payment_method,
        start_date: req.query.start_date,
        end_date: req.query.end_date
      };

      const result = await paymentService.getPayments(filters);

      res.json({
        success: true,
        data: result.payments,
        pagination: result.pagination,
        message: '获取付款记录成功'
      });
    } catch (error) {
      log.error('获取付款记录失败:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'GET_PAYMENTS_ERROR',
          message: error.message || '获取付款记录失败'
        }
      });
    }
  }

  /**
   * 获取付款详情
   * GET /api/payments/:id
   */
  async getPaymentById(req, res) {
    try {
      const { id } = req.params;
      const payment = await paymentService.getPaymentById(id);

      if (!payment) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'PAYMENT_NOT_FOUND',
            message: '付款记录不存在'
          }
        });
      }

      res.json({
        success: true,
        data: payment,
        message: '获取付款详情成功'
      });
    } catch (error) {
      log.error('获取付款详情失败:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'GET_PAYMENT_ERROR',
          message: error.message || '获取付款详情失败'
        }
      });
    }
  }

  /**
   * 获取供应商付款历史
   * GET /api/payments/supplier/:supplier_id
   */
  async getSupplierPaymentHistory(req, res) {
    try {
      const { supplier_id } = req.params;
      const { page = 1, limit = 20 } = req.query;

      const result = await paymentService.getSupplierPaymentHistory(supplier_id, {
        page: parseInt(page),
        limit: parseInt(limit)
      });

      res.json({
        success: true,
        data: result.payments,
        pagination: result.pagination,
        message: '获取供应商付款历史成功'
      });
    } catch (error) {
      log.error('获取供应商付款历史失败:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'GET_PAYMENT_HISTORY_ERROR',
          message: error.message || '获取供应商付款历史失败'
        }
      });
    }
  }

  /**
   * 获取付款统计数据
   * GET /api/payments/statistics
   */
  async getPaymentStatistics(req, res) {
    try {
      const { supplier_id, start_date, end_date } = req.query;
      const statistics = await paymentService.getPaymentStatistics({
        supplier_id,
        start_date,
        end_date
      });

      res.json({
        success: true,
        data: statistics,
        message: '获取付款统计成功'
      });
    } catch (error) {
      log.error('获取付款统计失败:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'GET_STATISTICS_ERROR',
          message: error.message || '获取付款统计失败'
        }
      });
    }
  }

  /**
   * 导出付款记录
   * GET /api/payments/export
   */
  async exportPayments(req, res) {
    try {
      const filters = {
        supplier_id: req.query.supplier_id,
        status: req.query.status,
        payment_method: req.query.payment_method,
        start_date: req.query.start_date,
        end_date: req.query.end_date
      };

      const data = await paymentService.exportPayments(filters);

      res.json({
        success: true,
        data: data,
        message: '导出付款记录成功'
      });
    } catch (error) {
      log.error('导出付款记录失败:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'EXPORT_ERROR',
          message: error.message || '导出付款记录失败'
        }
      });
    }
  }
}

module.exports = new PaymentController();
