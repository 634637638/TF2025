/**
 * 供应商付款数据访问层
 * 封装所有数据库操作
 */
const BaseRepository = require('./base.repository');

class PaymentRepository extends BaseRepository {
  constructor() {
    super('supplier_payments');
  }

  /**
   * 创建付款记录
   */
  async create(paymentData) {
    const {
      payment_no,
      settlement_id,
      supplier_id,
      payment_amount,
      payment_method,
      payment_date,
      status,
      notes,
      operator_id
    } = paymentData;

    const query = `
      INSERT INTO ${this.tableName} (
        payment_no, settlement_id, supplier_id, payment_amount,
        payment_method, payment_date, status, notes, operator_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      payment_no,
      settlement_id || null,
      supplier_id,
      payment_amount,
      payment_method,
      payment_date,
      status || 'pending',
      notes || null,
      operator_id || null
    ];

    const db = this.getConnection();
    const [result] = await db.execute(query, params);
    return result.insertId;
  }

  /**
   * 更新付款记录
   */
  async update(id, updateData) {
    const setClauses = [];
    const params = [];

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        setClauses.push(`${key} = ?`);
        params.push(updateData[key]);
      }
    });

    if (setClauses.length === 0) {
      return false;
    }

    params.push(id);

    const query = `
      UPDATE ${this.tableName}
      SET ${setClauses.join(', ')}, updated_at = NOW()
      WHERE id = ?
    `;

    const db = this.getConnection();
    const [result] = await db.execute(query, params);
    return result.affectedRows > 0;
  }

  /**
   * 根据ID获取付款记录
   */
  async findById(id) {
    const query = `
      SELECT
        sp.*,
        operator.username as operator_name,
        approver.username as approver_name
      FROM ${this.tableName} sp
      LEFT JOIN users operator ON sp.operator_id = operator.id
      LEFT JOIN users approver ON sp.approver_id = approver.id
      WHERE sp.id = ?
    `;

    const payments = await this.executeQuery(query, [id]);

    if (payments.length === 0) {
      return null;
    }

    const payment = payments[0];

    // 格式化返回数据
    return {
      id: parseInt(payment.id),
      payment_no: String(payment.payment_no),
      settlement_id: payment.settlement_id ? parseInt(payment.settlement_id) : null,
      supplier_id: parseInt(payment.supplier_id),
      payment_amount: parseFloat(payment.payment_amount),
      payment_method: String(payment.payment_method),
      payment_account: payment.payment_account,
      transaction_id: payment.transaction_id,
      payment_date: payment.payment_date,
      status: String(payment.status),
      notes: payment.notes,
      operator_id: payment.operator_id ? parseInt(payment.operator_id) : null,
      operator_name: payment.operator_name,
      approver_id: payment.approver_id ? parseInt(payment.approver_id) : null,
      approver_name: payment.approver_name,
      approval_time: payment.approval_time,
      approval_notes: payment.approval_notes,
      created_at: payment.created_at,
      updated_at: payment.updated_at
    };
  }

  /**
   * 获取付款记录列表(带分页)
   */
  async getPaymentsWithPagination(filters = {}) {
    const {
      page = 1,
      limit = 10,
      supplier_id,
      settlement_id,
      status,
      payment_method,
      start_date,
      end_date,
      orderBy = 'sp.created_at DESC'
    } = filters;

    const validLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 100);
    const validPage = Math.max(parseInt(page) || 1, 1);
    const offset = (validPage - 1) * validLimit;

    // 构建查询条件
    const whereConditions = [];
    const params = [];

    if (supplier_id) {
      whereConditions.push('sp.supplier_id = ?');
      params.push(parseInt(supplier_id));
    }

    if (settlement_id) {
      whereConditions.push('sp.settlement_id = ?');
      params.push(parseInt(settlement_id));
    }

    if (status) {
      whereConditions.push('sp.status = ?');
      params.push(status);
    }

    if (payment_method) {
      whereConditions.push('sp.payment_method = ?');
      params.push(payment_method);
    }

    if (start_date) {
      whereConditions.push('sp.payment_date >= ?');
      params.push(start_date);
    }

    if (end_date) {
      whereConditions.push('sp.payment_date <= ?');
      params.push(end_date);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // 查询数据
    const dataQuery = `
      SELECT
        sp.id,
        sp.payment_no,
        sp.settlement_id,
        sp.supplier_id,
        sp.payment_amount,
        sp.payment_method,
        sp.payment_account,
        sp.transaction_id,
        sp.payment_date,
        sp.status,
        sp.notes,
        sp.operator_id,
        operator.username as operator_name,
        sp.approver_id,
        approver.username as approver_name,
        sp.approval_time,
        sp.approval_notes,
        sp.created_at,
        sp.updated_at,
        s.name as supplier_name,
        s.contact as supplier_contact,
        s.phone as supplier_phone,
        s.bank_info as supplier_bank_info,
        ss.settlement_no
      FROM ${this.tableName} sp
      LEFT JOIN suppliers s ON sp.supplier_id = s.id
      LEFT JOIN users operator ON sp.operator_id = operator.id
      LEFT JOIN users approver ON sp.approver_id = approver.id
      LEFT JOIN supplier_settlements ss ON sp.settlement_id = ss.id
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ${validLimit} OFFSET ${offset}
    `;

    const payments = await this.executeQuery(dataQuery, params);

    // 格式化数据
    const formattedPayments = payments.map(row => ({
      id: parseInt(row.id),
      payment_no: String(row.payment_no),
      settlement_id: row.settlement_id ? parseInt(row.settlement_id) : null,
      settlement_no: row.settlement_no,
      supplier_id: parseInt(row.supplier_id),
      supplier_name: row.supplier_name,
      supplier_contact: row.supplier_contact,
      supplier_phone: row.supplier_phone,
      supplier_bank_info: row.supplier_bank_info,
      payment_amount: parseFloat(row.payment_amount),
      payment_method: String(row.payment_method),
      payment_account: row.payment_account,
      transaction_id: row.transaction_id,
      payment_date: row.payment_date,
      status: String(row.status),
      notes: row.notes,
      operator_id: row.operator_id ? parseInt(row.operator_id) : null,
      operator_name: row.operator_name,
      approver_id: row.approver_id ? parseInt(row.approver_id) : null,
      approver_name: row.approver_name,
      approval_time: row.approval_time,
      approval_notes: row.approval_notes,
      created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
      updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null
    }));

    // 查询总数
    const countQuery = `
      SELECT COUNT(*) as total
      FROM ${this.tableName} sp
      ${whereClause}
    `;
    const countResult = await this.executeQuery(countQuery, params);
    const total = countResult[0].total;

    return {
      payments: formattedPayments,
      pagination: {
        page: validPage,
        limit: validLimit,
        total: total,
        totalPages: Math.ceil(total / validLimit),
        hasNextPage: validPage < Math.ceil(total / validLimit),
        hasPrevPage: validPage > 1
      }
    };
  }

  /**
   * 导出付款记录
   */
  async exportPayments(filters = {}) {
    const { supplier_id, status, payment_method, start_date, end_date } = filters;

    const whereConditions = [];
    const params = [];

    if (supplier_id) {
      whereConditions.push('sp.supplier_id = ?');
      params.push(parseInt(supplier_id));
    }

    if (status) {
      whereConditions.push('sp.status = ?');
      params.push(status);
    }

    if (payment_method) {
      whereConditions.push('sp.payment_method = ?');
      params.push(payment_method);
    }

    if (start_date) {
      whereConditions.push('sp.payment_date >= ?');
      params.push(start_date);
    }

    if (end_date) {
      whereConditions.push('sp.payment_date <= ?');
      params.push(end_date);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const query = `
      SELECT
        sp.payment_no,
        sp.settlement_id,
        sp.supplier_id,
        sp.payment_amount,
        sp.payment_method,
        sp.payment_account,
        sp.transaction_id,
        sp.payment_date,
        sp.status,
        sp.notes,
        sp.created_at,
        s.name as supplier_name,
        ss.settlement_no
      FROM ${this.tableName} sp
      LEFT JOIN suppliers s ON sp.supplier_id = s.id
      LEFT JOIN supplier_settlements ss ON sp.settlement_id = ss.id
      ${whereClause}
      ORDER BY sp.created_at DESC
    `;

    const payments = await this.executeQuery(query, params);

    return payments;
  }

  /**
   * 获取供应商付款统计
   */
  async getSupplierPaymentStats(supplierId) {
    const query = `
      SELECT
        COUNT(*) as total_count,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN payment_amount ELSE 0 END), 0) as total_paid_amount
      FROM ${this.tableName}
      WHERE supplier_id = ?
    `;

    const result = await this.executeQuery(query, [parseInt(supplierId)]);
    return result[0];
  }
}

module.exports = new PaymentRepository();
