/**
 * 供应商付款服务层
 * 处理付款业务逻辑
 */
const paymentRepository = require('../repositories/payment.repository');
const supplierRepository = require('../repositories/supplier.repository');
const { getDatabase } = require('../config/database');

// 辅助函数：执行查询
async function executeQuery(sql, params) {
  const db = getDatabase();
  const [rows] = await db.execute(sql, params);
  return rows;
}

class PaymentService {
  /**
   * 创建付款记录
   */
  async createPayment(paymentData) {
    const {
      supplier_id,
      settlement_id,
      payment_amount,
      payment_method = 'bank_transfer',
      notes,
      operator_id
    } = paymentData;

    // 验证供应商是否存在
    const supplier = await supplierRepository.getSupplierById(supplier_id);
    if (!supplier) {
      throw new Error('供应商不存在');
    }

    // 如果关联对账单,验证对账单状态
    if (settlement_id) {
      const [settlements] = await executeQuery(
        'SELECT * FROM supplier_settlements WHERE id = ? AND status = "confirmed"',
        [settlement_id]
      );

      if (settlements.length === 0) {
        throw new Error('对账单不存在或未确认,无法创建付款');
      }

      const settlement = settlements[0];

      // 检查付款金额是否超出来结算金额
      if (parseFloat(payment_amount) > parseFloat(settlement.remaining_amount)) {
        throw new Error(`付款金额不能超过未结算金额 ¥${settlement.remaining_amount}`);
      }
    }

    // 生成付款编号
    const payment_no = await this.generatePaymentNo();

    // 创建付款记录
    const paymentId = await paymentRepository.create({
      payment_no,
      settlement_id,
      supplier_id,
      payment_amount,
      payment_method,
      payment_date: new Date().toISOString().split('T')[0],
      status: 'pending',
      notes,
      operator_id
    });

    // 获取完整的付款记录
    const payment = await paymentRepository.findById(paymentId);

    return payment;
  }

  /**
   * 审批付款申请
   */
  async approvePayment(paymentId, { status, approver_id, approval_notes }) {
    // 获取付款记录
    const payment = await paymentRepository.findById(paymentId);
    if (!payment) {
      throw new Error('付款记录不存在');
    }

    // 检查状态是否可以审批
    if (payment.status !== 'pending') {
      throw new Error('只能审批待处理的付款申请');
    }

    // 更新付款状态
    const updateData = {
      status: status === 'approved' ? 'approved' : 'rejected',
      approver_id,
      approval_time: new Date(),
      approval_notes
    };

    await paymentRepository.update(paymentId, updateData);

    // 如果拒绝,更新对账单状态
    if (status === 'rejected' && payment.settlement_id) {
      await executeQuery(
        'UPDATE supplier_settlements SET status = "confirmed" WHERE id = ?',
        [payment.settlement_id]
      );
    }

    return await paymentRepository.findById(paymentId);
  }

  /**
   * 确认付款完成
   */
  async confirmPayment(paymentId, { transaction_id, payment_account, actual_payment_date, operator_id }) {
    // 获取付款记录
    const payment = await paymentRepository.findById(paymentId);
    if (!payment) {
      throw new Error('付款记录不存在');
    }

    // 检查状态
    if (payment.status !== 'approved') {
      throw new Error('只能确认已审批的付款');
    }

    // 开始事务
    const connection = await executeQuery('START TRANSACTION');

    try {
      // 更新付款状态为已完成
      await paymentRepository.update(paymentId, {
        status: 'completed',
        transaction_id,
        payment_account,
        payment_date: actual_payment_date || payment.payment_date,
        operator_id
      });

      // 如果关联对账单,更新对账单的已结算金额
      if (payment.settlement_id) {
        await executeQuery(
          `UPDATE supplier_settlements
           SET settled_amount = settled_amount + ?,
               pay_time = NOW(),
               status = CASE
                 WHEN remaining_amount <= ? THEN 'paid'
                 ELSE 'confirmed'
               END
           WHERE id = ?`,
          [payment.payment_amount, payment.payment_amount, payment.settlement_id]
        );
      }

      // 更新供应商账户余额
      await executeQuery(
        `UPDATE suppliers
         SET current_balance = current_balance + ?
         WHERE id = ?`,
        [payment.payment_amount, payment.supplier_id]
      );

      // 记录账户流水
      await executeQuery(
        `INSERT INTO supplier_accounts (
           supplier_id, type, amount, balance_before, balance_after,
           description, operator_id, created_at
         )
         SELECT ?, 'payment', ?,
           current_balance - ?,
           current_balance,
           ?, ?, NOW()
         FROM suppliers WHERE id = ?`,
        [
          payment.supplier_id,
          payment.payment_amount,
          payment.payment_amount,
          `付款 ${payment.payment_no}`,
          operator_id,
          payment.supplier_id
        ]
      );

      await executeQuery('COMMIT');

      return await paymentRepository.findById(paymentId);
    } catch (error) {
      await executeQuery('ROLLBACK');
      throw error;
    }
  }

  /**
   * 取消付款
   */
  async cancelPayment(paymentId, { cancel_reason, operator_id }) {
    // 获取付款记录
    const payment = await paymentRepository.findById(paymentId);
    if (!payment) {
      throw new Error('付款记录不存在');
    }

    // 检查状态
    if (!['pending', 'approved'].includes(payment.status)) {
      throw new Error('只能取消待处理或已审批的付款');
    }

    // 更新状态
    await paymentRepository.update(paymentId, {
      status: 'cancelled',
      notes: `${payment.notes || ''}\n取消原因: ${cancel_reason}`.trim()
    });

    // 如果关联对账单,更新对账单状态
    if (payment.settlement_id) {
      await executeQuery(
        'UPDATE supplier_settlements SET status = "confirmed" WHERE id = ?',
        [payment.settlement_id]
      );
    }

    return await paymentRepository.findById(paymentId);
  }

  /**
   * 获取付款记录列表
   */
  async getPayments(filters) {
    return await paymentRepository.getPaymentsWithPagination(filters);
  }

  /**
   * 获取付款详情
   */
  async getPaymentById(paymentId) {
    const payment = await paymentRepository.findById(paymentId);

    if (!payment) {
      return null;
    }

    // 获取关联的对账单信息
    if (payment.settlement_id) {
      const [settlements] = await executeQuery(
        'SELECT * FROM supplier_settlements WHERE id = ?',
        [payment.settlement_id]
      );

      if (settlements.length > 0) {
        payment.settlement = settlements[0];
      }
    }

    // 获取供应商信息
    const supplier = await supplierRepository.getSupplierById(payment.supplier_id);
    if (supplier) {
      payment.supplier = {
        id: supplier.id,
        name: supplier.name,
        contact: supplier.contact,
        phone: supplier.phone,
        bank_info: supplier.bank_info
      };
    }

    return payment;
  }

  /**
   * 获取供应商付款历史
   */
  async getSupplierPaymentHistory(supplierId, options = {}) {
    const { page = 1, limit = 20 } = options;

    return await paymentRepository.getPaymentsWithPagination({
      supplier_id: supplierId,
      page,
      limit,
      orderBy: 'sp.created_at DESC'
    });
  }

  /**
   * 获取付款统计数据
   */
  async getPaymentStatistics(filters = {}) {
    const { supplier_id, start_date, end_date } = filters;

    let whereClause = 'WHERE sp.status = "completed"';
    const params = [];

    if (supplier_id) {
      whereClause += ' AND sp.supplier_id = ?';
      params.push(supplier_id);
    }

    if (start_date) {
      whereClause += ' AND sp.payment_date >= ?';
      params.push(start_date);
    }

    if (end_date) {
      whereClause += ' AND sp.payment_date <= ?';
      params.push(end_date);
    }

    // 总付款金额和次数
    const totalStats = await executeQuery(
      `SELECT
        COUNT(*) as total_count,
        COALESCE(SUM(payment_amount), 0) as total_amount
       FROM supplier_payments sp
       ${whereClause}`,
      params
    );

    // 按付款方式统计
    const methodStats = await executeQuery(
      `SELECT
         payment_method,
         COUNT(*) as count,
         COALESCE(SUM(payment_amount), 0) as amount
       FROM supplier_payments sp
       ${whereClause}
       GROUP BY payment_method`,
      params
    );

    // 按供应商统计
    const supplierStats = await executeQuery(
      `SELECT
         sp.supplier_id,
         s.name as supplier_name,
         COUNT(*) as count,
         COALESCE(SUM(sp.payment_amount), 0) as amount
       FROM supplier_payments sp
       LEFT JOIN suppliers s ON sp.supplier_id = s.id
       ${whereClause}
       GROUP BY sp.supplier_id, s.name
       ORDER BY amount DESC`,
      params
    );

    // 按日期统计(最近30天)
    const dateStats = await executeQuery(
      `SELECT
         DATE(payment_date) as payment_date,
         COUNT(*) as count,
         COALESCE(SUM(payment_amount), 0) as amount
       FROM supplier_payments sp
       ${whereClause}
       GROUP BY DATE(payment_date)
       ORDER BY payment_date DESC
       LIMIT 30`,
      params
    );

    return {
      total: {
        count: parseInt(totalStats[0]?.total_count) || 0,
        amount: parseFloat(totalStats[0]?.total_amount) || 0
      },
      by_method: methodStats.map(stat => ({
        method: stat.payment_method,
        method_name: this.getPaymentMethodName(stat.payment_method),
        count: parseInt(stat.count) || 0,
        amount: parseFloat(stat.amount) || 0
      })),
      by_supplier: supplierStats.map(stat => ({
        supplier_id: parseInt(stat.supplier_id),
        supplier_name: stat.supplier_name,
        count: parseInt(stat.count) || 0,
        amount: parseFloat(stat.amount) || 0
      })),
      by_date: dateStats.map(stat => ({
        date: stat.payment_date,
        count: parseInt(stat.count) || 0,
        amount: parseFloat(stat.amount) || 0
      }))
    };
  }

  /**
   * 导出付款记录
   */
  async exportPayments(filters) {
    const payments = await paymentRepository.exportPayments(filters);

    return payments.map(payment => ({
      '付款编号': payment.payment_no,
      '供应商名称': payment.supplier_name,
      '对账编号': payment.settlement_no || '-',
      '付款金额': payment.payment_amount,
      '付款方式': this.getPaymentMethodName(payment.payment_method),
      '付款账户': payment.payment_account || '-',
      '交易流水号': payment.transaction_id || '-',
      '付款日期': payment.payment_date,
      '状态': this.getPaymentStatusName(payment.status),
      '备注': payment.notes || '-',
      '创建时间': payment.created_at
    }));
  }

  /**
   * 生成付款编号
   */
  async generatePaymentNo() {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `PAY${today}`;

    // 查询今天已有的付款数量
    const [result] = await executeQuery(
      `SELECT COUNT(*) as count FROM supplier_payments WHERE payment_no LIKE ?`,
      [`${prefix}%`]
    );

    const count = parseInt(result[0].count) + 1;
    const sequence = String(count).padStart(4, '0');

    return `${prefix}${sequence}`;
  }

  /**
   * 获取付款方式名称
   */
  getPaymentMethodName(method) {
    const methodMap = {
      'cash': '现金',
      'bank_transfer': '银行转账',
      'alipay': '支付宝',
      'wechat': '微信',
      'other': '其他'
    };
    return methodMap[method] || method;
  }

  /**
   * 获取付款状态名称
   */
  getPaymentStatusName(status) {
    const statusMap = {
      'pending': '待处理',
      'approved': '已审批',
      'completed': '已完成',
      'failed': '失败',
      'cancelled': '已取消'
    };
    return statusMap[status] || status;
  }
}

module.exports = new PaymentService();
