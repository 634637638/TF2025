/**
 * 供应商数据访问层
 * 封装所有数据库操作
 */
const { executeQuery } = require('../config/database');
const BaseRepository = require('./base.repository');

class SupplierRepository extends BaseRepository {
  constructor() {
    super('suppliers');
  }

  /**
   * 获取供应商列表（带分页和过滤）
   */
  async getSuppliersWithPagination(filters = {}, options = {}) {
    const {
      page = 1,
      limit = 10,
      name,
      status
    } = filters;

    const validLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 100);
    const validPage = Math.max(parseInt(page) || 1, 1);
    const offset = (validPage - 1) * validLimit;

    // 构建查询条件
    const whereConditions = [];
    const params = [];

    if (name) {
      whereConditions.push('s.name LIKE ?');
      params.push(`%${name}%`);
    }

    if (status !== undefined) {
      whereConditions.push('s.status = ?');
      params.push(parseInt(status));
    }

    const whereClause = whereConditions.length > 0 ? whereConditions.join(' AND ') : '';

    // 排序
    const orderBy = options.orderBy || 's.created_at DESC';

    // 查询数据
    const dataQuery = `
      SELECT
        s.id,
        s.name,
        s.contact,
        s.phone,
        s.address,
        s.bank_info,
        s.tax_number,
        s.status,
        s.remarks,
        s.created_at,
        s.updated_at,
        COALESCE(a.accessory_count, 0) as accessory_count,
        COALESCE(p.phone_count, 0) as phone_count,
        COALESCE(a.total_cost, 0) as accessory_total_cost,
        COALESCE(p.total_cost, 0) as phone_total_cost,
        COALESCE(a.total_cost, 0) + COALESCE(p.total_cost, 0) as total_cost
      FROM ${this.tableName} s
      LEFT JOIN (
        SELECT supplier_id, COUNT(*) as accessory_count, SUM(cost) as total_cost
        FROM accessories GROUP BY supplier_id
      ) a ON s.id = a.supplier_id
      LEFT JOIN (
        SELECT supplier_id, COUNT(*) as phone_count, SUM(cost) as total_cost
        FROM phones GROUP BY supplier_id
      ) p ON s.id = p.supplier_id
      ${whereClause ? `WHERE ${whereClause}` : ''}
      ORDER BY ${orderBy}
      LIMIT ${validLimit} OFFSET ${offset}
    `;

    const [suppliers] = await this.executeQuery(dataQuery, params);

    // 格式化数据
    const formattedSuppliers = suppliers.map(row => ({
      id: parseInt(row.id),
      name: String(row.name || '').trim(),
      contact: String(row.contact || '').trim(),
      phone: String(row.phone || '').trim(),
      address: String(row.address || '').trim(),
      bank_info: String(row.bank_info || '').trim(),
      tax_number: String(row.tax_number || '').trim(),
      status: parseInt(row.status) || 0,
      remarks: String(row.remarks || '').trim(),
      created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
      updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
      stats: {
        accessory_count: parseInt(row.accessory_count) || 0,
        phone_count: parseInt(row.phone_count) || 0,
        accessory_total_cost: parseFloat(row.accessory_total_cost) || 0,
        phone_total_cost: parseFloat(row.phone_total_cost) || 0,
        total_cost: parseFloat(row.total_cost) || 0
      }
    }));

    // 查询总数
    const countQuery = `
      SELECT COUNT(*) as total FROM ${this.tableName} s
      ${whereClause ? `WHERE ${whereClause}` : ''}
    `;
    const [countResult] = await this.executeQuery(countQuery, params);
    const total = countResult[0].total;

    return {
      suppliers: formattedSuppliers,
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
   * 根据ID获取供应商详情
   */
  async getSupplierById(id) {
    const supplierQuery = `
      SELECT * FROM ${this.tableName} WHERE id = ?
    `;
    const [suppliers] = await this.executeQuery(supplierQuery, [id]);

    if (suppliers.length === 0) {
      return null;
    }

    const supplier = suppliers[0];

    // 获取供应商账户信息
    const accountsQuery = `
      SELECT
        sa.*,
        operator.username as operator_name
      FROM supplier_accounts sa
      LEFT JOIN users operator ON sa.operator_id = operator.id
      WHERE sa.supplier_id = ?
      ORDER BY sa.created_at DESC
    `;
    const [accounts] = await this.executeQuery(accountsQuery, [id]);

    // 获取商品统计
    const [accessoryStats] = await this.executeQuery(
      'SELECT COUNT(*) as count, SUM(cost) as total_cost FROM accessories WHERE supplier_id = ?',
      [id]
    );
    const [phoneStats] = await this.executeQuery(
      'SELECT COUNT(*) as count, SUM(cost) as total_cost FROM phones WHERE supplier_id = ?',
      [id]
    );

    return {
      id: parseInt(supplier.id),
      name: String(supplier.name || '').trim(),
      contact: String(supplier.contact || '').trim(),
      phone: String(supplier.phone || '').trim(),
      address: String(supplier.address || '').trim(),
      bank_info: String(supplier.bank_info || '').trim(),
      tax_number: String(supplier.tax_number || '').trim(),
      status: parseInt(supplier.status) || 0,
      remarks: String(supplier.remarks || '').trim(),
      created_at: supplier.created_at ? new Date(supplier.created_at).toISOString() : null,
      updated_at: supplier.updated_at ? new Date(supplier.updated_at).toISOString() : null,
      accounts: accounts.map(account => ({
        id: parseInt(account.id),
        type: String(account.type),
        amount: parseFloat(account.amount),
        balance_before: parseFloat(account.balance_before),
        balance_after: parseFloat(account.balance_after),
        description: String(account.description || '').trim(),
        operator_name: account.operator_name ? String(account.operator_name).trim() : null,
        created_at: account.created_at ? new Date(account.created_at).toISOString() : null
      })),
      stats: {
        accessory_count: parseInt(accessoryStats[0].count) || 0,
        phone_count: parseInt(phoneStats[0].count) || 0,
        accessory_total_cost: parseFloat(accessoryStats[0].total_cost) || 0,
        phone_total_cost: parseFloat(phoneStats[0].total_cost) || 0
      }
    };
  }

  /**
   * 创建供应商
   */
  async createSupplier(supplierData) {
    const {
      name,
      contact,
      phone,
      address,
      bank_info,
      tax_number,
      status = 1,
      remarks
    } = supplierData;

    const query = `
      INSERT INTO ${this.tableName} (
        name, contact, phone, address, bank_info, tax_number, status, remarks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      name,
      contact || null,
      phone || null,
      address || null,
      bank_info || null,
      tax_number || null,
      parseInt(status) || 1,
      remarks || null
    ];

    const [result] = await this.executeQuery(query, params);
    return result.insertId;
  }

  /**
   * 更新供应商
   */
  async updateSupplier(id, supplierData) {
    const {
      name,
      contact,
      phone,
      address,
      bank_info,
      tax_number,
      status,
      remarks
    } = supplierData;

    const query = `
      UPDATE ${this.tableName} SET
        name = ?, contact = ?, phone = ?, address = ?,
        bank_info = ?, tax_number = ?, status = ?, remarks = ?,
        updated_at = NOW()
      WHERE id = ?
    `;

    const params = [
      name,
      contact || null,
      phone || null,
      address || null,
      bank_info || null,
      tax_number || null,
      parseInt(status) || 0,
      remarks || null,
      parseInt(id)
    ];

    const [result] = await this.executeQuery(query, params);
    return result.affectedRows > 0;
  }

  /**
   * 删除供应商
   */
  async deleteSupplier(id) {
    // 检查是否有关联商品
    const [accessories] = await this.executeQuery(
      'SELECT COUNT(*) as count FROM accessories WHERE supplier_id = ?',
      [id]
    );
    const [phones] = await this.executeQuery(
      'SELECT COUNT(*) as count FROM phones WHERE supplier_id = ?',
      [id]
    );

    if (accessories[0].count > 0 || phones[0].count > 0) {
      return {
        canDelete: false,
        reason: '该供应商下还有关联的商品，无法删除',
        accessoryCount: accessories[0].count,
        phoneCount: phones[0].count
      };
    }

    const [result] = await this.executeQuery(
      `DELETE FROM ${this.tableName} WHERE id = ?`,
      [id]
    );

    return {
      canDelete: true,
      deleted: result.affectedRows > 0
    };
  }

  /**
   * 批量更新供应商状态
   */
  async batchUpdateStatus(ids, status) {
    const placeholders = ids.map(() => '?').join(',');
    const query = `
      UPDATE ${this.tableName}
      SET status = ?, updated_at = NOW()
      WHERE id IN (${placeholders})
    `;

    const params = [parseInt(status), ...ids.map(id => parseInt(id))];
    const [result] = await this.executeQuery(query, params);
    return result.affectedRows;
  }

  /**
   * 搜索供应商
   */
  async searchSuppliers(keyword, filters = {}) {
    const { page = 1, limit = 20, status } = filters;
    const validLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
    const validPage = Math.max(parseInt(page) || 1, 1);
    const offset = (validPage - 1) * validLimit;

    const whereConditions = [
      '(s.name LIKE ? OR s.contact LIKE ? OR s.phone LIKE ? OR s.address LIKE ?)'
    ];
    const params = [
      `%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`
    ];

    if (status !== undefined) {
      whereConditions.push('s.status = ?');
      params.push(parseInt(status));
    }

    const whereClause = whereConditions.join(' AND ');

    const query = `
      SELECT
        s.*,
        COALESCE(a.accessory_count, 0) as accessory_count,
        COALESCE(p.phone_count, 0) as phone_count
      FROM ${this.tableName} s
      LEFT JOIN (
        SELECT supplier_id, COUNT(*) as accessory_count
        FROM accessories GROUP BY supplier_id
      ) a ON s.id = a.supplier_id
      LEFT JOIN (
        SELECT supplier_id, COUNT(*) as phone_count
        FROM phones GROUP BY supplier_id
      ) p ON s.id = p.supplier_id
      WHERE ${whereClause}
      ORDER BY s.name
      LIMIT ${validLimit} OFFSET ${offset}
    `;

    const [suppliers] = await this.executeQuery(query, params);

    // 查询总数
    const countQuery = `
      SELECT COUNT(*) as total FROM ${this.tableName} s
      WHERE ${whereClause}
    `;
    const [countResult] = await this.executeQuery(countQuery, params);
    const total = countResult[0].total;

    return {
      suppliers: suppliers.map(row => ({
        id: parseInt(row.id),
        name: String(row.name || '').trim(),
        contact: String(row.contact || '').trim(),
        phone: String(row.phone || '').trim(),
        address: String(row.address || '').trim(),
        status: parseInt(row.status) || 0,
        stats: {
          accessory_count: parseInt(row.accessory_count) || 0,
          phone_count: parseInt(row.phone_count) || 0
        }
      })),
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
   * 检查供应商名称是否可用
   */
  async checkNameAvailability(name, excludeId = null) {
    let query = `SELECT id FROM ${this.tableName} WHERE name = ?`;
    let params = [name];

    if (excludeId) {
      query += ' AND id != ?';
      params.push(parseInt(excludeId));
    }

    const [result] = await this.executeQuery(query, params);
    return result.length === 0;
  }

  /**
   * 获取供应商统计信息
   */
  async getSupplierStats() {
    const [totalStats] = await this.executeQuery(`
      SELECT
        COUNT(*) as total_suppliers,
        COUNT(CASE WHEN status = 1 THEN 1 END) as active_suppliers,
        COUNT(CASE WHEN status = 0 THEN 1 END) as inactive_suppliers
      FROM ${this.tableName}
    `);

    const [productStats] = await this.executeQuery(`
      SELECT
        COUNT(DISTINCT s.id) as suppliers_with_products
      FROM ${this.tableName} s
      LEFT JOIN accessories a ON s.id = a.supplier_id
      LEFT JOIN phones p ON s.id = p.supplier_id
      WHERE a.id IS NOT NULL OR p.id IS NOT NULL
    `);

    return {
      total_suppliers: parseInt(totalStats[0].total_suppliers) || 0,
      active_suppliers: parseInt(totalStats[0].active_suppliers) || 0,
      inactive_suppliers: parseInt(totalStats[0].inactive_suppliers) || 0,
      suppliers_with_products: parseInt(productStats[0].suppliers_with_products) || 0
    };
  }

  /**
   * 获取活跃供应商
   */
  async getActiveSuppliers() {
    const query = `
      SELECT id, name, contact, phone
      FROM ${this.tableName}
      WHERE status = 1
      ORDER BY name
    `;

    const [suppliers] = await this.executeQuery(query);
    return suppliers.map(row => ({
      id: parseInt(row.id),
      name: String(row.name || '').trim(),
      contact: String(row.contact || '').trim(),
      phone: String(row.phone || '').trim()
    }));
  }

  /**
   * 导出供应商数据
   */
  async exportSuppliers(filters = {}) {
    const { name, status } = filters;

    const whereConditions = [];
    const params = [];

    if (name) {
      whereConditions.push('s.name LIKE ?');
      params.push(`%${name}%`);
    }

    if (status !== undefined) {
      whereConditions.push('s.status = ?');
      params.push(parseInt(status));
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const query = `
      SELECT
        s.id,
        s.name,
        s.contact,
        s.phone,
        s.address,
        s.bank_info,
        s.tax_number,
        s.status,
        s.remarks,
        s.created_at,
        s.updated_at,
        COALESCE(a.accessory_count, 0) as accessory_count,
        COALESCE(p.phone_count, 0) as phone_count,
        COALESCE(a.total_cost, 0) + COALESCE(p.total_cost, 0) as total_cost
      FROM ${this.tableName} s
      LEFT JOIN (
        SELECT supplier_id, COUNT(*) as accessory_count, SUM(cost) as total_cost
        FROM accessories GROUP BY supplier_id
      ) a ON s.id = a.supplier_id
      LEFT JOIN (
        SELECT supplier_id, COUNT(*) as phone_count, SUM(cost) as total_cost
        FROM phones GROUP BY supplier_id
      ) p ON s.id = p.supplier_id
      ${whereClause}
      ORDER BY s.created_at DESC
    `;

    const [suppliers] = await this.executeQuery(query, params);

    return suppliers.map(row => ({
      ID: parseInt(row.id),
      供应商名称: String(row.name || '').trim(),
      联系人: String(row.contact || '').trim(),
      联系电话: String(row.phone || '').trim(),
      地址: String(row.address || '').trim(),
      银行信息: String(row.bank_info || '').trim(),
      税号: String(row.tax_number || '').trim(),
      状态: parseInt(row.status) === 1 ? '启用' : '禁用',
      备注: String(row.remarks || '').trim(),
      配件数量: parseInt(row.accessory_count) || 0,
      手机数量: parseInt(row.phone_count) || 0,
      总成本: parseFloat(row.total_cost) || 0,
      创建时间: row.created_at ? new Date(row.created_at).toLocaleString() : '',
      更新时间: row.updated_at ? new Date(row.updated_at).toLocaleString() : ''
    }));
  }
}

module.exports = SupplierRepository;