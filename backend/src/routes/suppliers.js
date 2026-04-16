const express = require('express');
const router = express.Router();
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth');
const { getDatabase, isConnected } = require('../config/database');
const ApiResponse = require('../utils/response');
const { validateQueryParams } = require('../middleware/database-security');
const log = require('../utils/log');

router.use(unifiedAuth);

// 数据库迁移端点 - 必须在所有路由之前定义
router.get('/migrate-sort-order', requirePermission('permissions:admin'), async (req, res) => {
  try {
    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500);
    }

    const pool = getDatabase();

    // 检查字段是否存在
    const [columns] = await pool.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'suppliers' AND COLUMN_NAME = 'sort_order'
    `);

    if (columns.length === 0) {
      // 字段不存在，添加字段
      await pool.execute(`
        ALTER TABLE suppliers
        ADD COLUMN sort_order INT DEFAULT 0 COMMENT '排序顺序'
      `);
      log.debug('✅ suppliers 表 sort_order 字段添加成功');
    } else {
      log.debug('ℹ️ suppliers 表已有 sort_order 字段，跳过');
    }

    // 初始化现有数据的 sort_order
    const [suppliersWithoutOrder] = await pool.execute(`
      SELECT id FROM suppliers WHERE sort_order IS NULL OR sort_order = 0
    `);

    let updatedCount = 0;
    if (suppliersWithoutOrder.length > 0) {
      log.debug(`初始化 ${suppliersWithoutOrder.length} 条记录的 sort_order 值...`);
      for (const supplier of suppliersWithoutOrder) {
        await pool.execute(`
          UPDATE suppliers SET sort_order = ? WHERE id = ?
        `, [supplier.id, supplier.id]);
        updatedCount++;
      }
      log.debug(`✅ 更新了 ${updatedCount} 条记录`);
    }

    ApiResponse.success(res, {
      message: `迁移完成，更新了 ${updatedCount} 条记录`,
      updatedCount
    }, '数据库迁移成功');
  } catch (error) {
    log.error('迁移失败:', error);
    ApiResponse.error(res, '迁移失败: ' + error.message, 500);
  }
});

// 获取供应商列表
router.get('/',
  requirePermission('suppliers:view'),
  validateQueryParams({
    allowedSortFields: ['id', 'name', 'sort_order', 'created_at'],
    defaultSortField: 'sort_order',
    defaultSortDirection: 'ASC',  // 默认升序，从小到大
    maxLimit: 10000,  // 提高限制以支持获取所有供应商
    defaultLimit: 10000  // 默认返回所有供应商，不分页
  }),
  async (req, res) => {
  try {
    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500);
    }
    
    const pool = getDatabase();

    // 🔒 使用验证后的安全参数
    const { name, status, limit, offset, sort, order } = req.validatedQuery;

    // 构建基础查询
    let query = 'SELECT * FROM suppliers';
    let params = [];
    const whereConditions = [];

    // 添加搜索条件
    if (name) {
      whereConditions.push('name LIKE ?');
      params.push(`%${name}%`);
    }

    if (status !== undefined && status !== null && status !== '') {
      whereConditions.push('status = ?');
      params.push(parseInt(status));
    }

    // 添加WHERE子句
    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ');
    }

    // 添加排序和分页
    query += ` ORDER BY ${sort} ${order}`;

    // 只有在明确传递了 limit 时才添加 LIMIT
    if (limit && limit !== 'undefined' && limit !== '') {
      const finalLimit = Math.max(1, parseInt(limit));
      const finalOffset = Math.max(0, parseInt(offset) || 0);
      query += ` LIMIT ${finalLimit} OFFSET ${finalOffset}`;
    }

    log.debug('🔍 Suppliers查询SQL:', query); // 触发重启
    log.debug('🔍 Suppliers查询参数:', params);

    const [suppliers] = await pool.execute(query, params);
    
    const formattedSuppliers = suppliers.map(row => ({
      id: parseInt(row.id),
      name: String(row.name || ''),
      contact: String(row.contact || ''),
      phone: String(row.phone || ''),
      address: String(row.address || ''),
      bank_info: String(row.bank_info || ''),
      tax_number: String(row.tax_number || ''),
      status: parseInt(row.status) || 0,
      sort_order: parseInt(row.sort_order || 0),
      remarks: String(row.remarks || ''),
      created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
      updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null
    }));
    
    // 获取总数
    let countQuery = 'SELECT COUNT(*) as total FROM suppliers';
    const countParams = [];
    const countConditions = [];
    
    if (name) {
      countConditions.push(' name LIKE ?');
      countParams.push(`%${name}%`);
    }
    
    if (status !== undefined && status !== null && status !== '') {
      countConditions.push(' status = ?');
      countParams.push(parseInt(status));
    }
    
    if (countConditions.length > 0) {
      countQuery += ' WHERE' + countConditions.join(' AND');
    }
    
    const [countResult] = await pool.execute(countQuery, countParams);
    const total = countResult[0].total;
    
    ApiResponse.paginated(res, formattedSuppliers, {
      page: parseInt(req.validatedQuery.page) || 1,
      limit: parseInt(req.validatedQuery.limit) || 10000,
      total: parseInt(total) || 0
    });
    
  } catch (error) {
    log.error('获取供应商列表失败:', error);
    ApiResponse.error(res, '获取供应商列表失败', 500);
  }
});

// 创建供应商
router.post('/', requirePermission('suppliers:create'), async (req, res) => {
  try {
    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500);
    }

    const { name, contact, phone, address, bank_info, tax_number, status = 1, sort_order = 0, remarks } = req.body;

    if (!name || name.trim() === '') {
      return ApiResponse.error(res, '供应商名称不能为空', 400);
    }

    const pool = getDatabase();

    // 检查供应商名称是否已存在
    const [existingSuppliers] = await pool.execute(
      'SELECT id FROM suppliers WHERE name = ?',
      [name.trim()]
    );

    if (existingSuppliers.length > 0) {
      log.debug('❌ 供应商名称已存在:', name);
      return ApiResponse.error(res, `供应商名称"${name}"已存在，请使用其他名称`, 409);
    }

    const [result] = await pool.execute(`
      INSERT INTO suppliers (name, contact, phone, address, bank_info, tax_number, status, sort_order, remarks)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [name.trim(), contact || null, phone || null, address || null, bank_info || null, tax_number || null, status, sort_order, remarks || null]);

    ApiResponse.success(res, { id: result.insertId }, '供应商创建成功');

  } catch (error) {
    log.error('创建供应商失败:', error);
    ApiResponse.error(res, '创建供应商失败', 500);
  }
});

// 更新供应商
router.put('/:id', requirePermission('suppliers:edit'), async (req, res) => {
  try {
    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500);
    }

    const { id } = req.params;
    const { name, contact, phone, address, bank_info, tax_number, status, sort_order, remarks } = req.body;

    if (!name || name.trim() === '') {
      return ApiResponse.error(res, '供应商名称不能为空', 400);
    }

    const pool = getDatabase();

    // 获取当前供应商的name值
    const [currentSupplier] = await pool.execute('SELECT name FROM suppliers WHERE id = ?', [parseInt(id)]);
    const currentName = currentSupplier[0]?.name;

    // 如果name有变化，检查是否与其他记录重复
    if (name && name !== currentName) {
      const [duplicateCheck] = await pool.execute(
        'SELECT id FROM suppliers WHERE name = ? AND id != ?',
        [name.trim(), parseInt(id)]
      );

      if (duplicateCheck.length > 0) {
        log.debug('❌ 供应商名称已存在:', name);
        return ApiResponse.error(res, `供应商名称"${name}"已存在，请使用其他名称`, 409);
      }
    }

    const [result] = await pool.execute(`
      UPDATE suppliers
      SET name = ?, contact = ?, phone = ?, address = ?, bank_info = ?, tax_number = ?, status = ?, sort_order = ?, remarks = ?
      WHERE id = ?
    `, [name.trim(), contact || null, phone || null, address || null, bank_info || null, tax_number || null, status, sort_order || 0, remarks || null, id]);

    if (result.affectedRows === 0) {
      return ApiResponse.error(res, '供应商不存在', 404);
    }

    ApiResponse.success(res, null, '供应商更新成功');

  } catch (error) {
    log.error('更新供应商失败:', error);
    ApiResponse.error(res, '更新供应商失败', 500);
  }
});

// 批量更新排序
router.put('/batch/reorder', requirePermission('suppliers:edit'), async (req, res) => {
  try {
    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500);
    }

    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return ApiResponse.error(res, '请提供有效的排序数据', 400);
    }

    const pool = getDatabase();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      for (const item of items) {
        if (item.id !== undefined && item.sort_order !== undefined) {
          await connection.execute(
            'UPDATE suppliers SET sort_order = ? WHERE id = ?',
            [item.sort_order, item.id]
          );
        }
      }

      await connection.commit();
      ApiResponse.success(res, null, '排序更新成功');

    } catch (error) {
      await connection.rollback();
      log.error('批量更新排序失败:', error);
      ApiResponse.error(res, '批量更新排序失败', 500);
    } finally {
      connection.release();
    }
  } catch (error) {
    log.error('批量更新排序失败:', error);
    ApiResponse.error(res, '批量更新排序失败', 500);
  }
});

// 导出供应商
router.get('/export', requirePermission('suppliers:export'), async (req, res) => {
  try {
    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500);
    }

    const pool = getDatabase();
    const { name, status } = req.query;
    const whereConditions = [];
    const params = [];

    if (name) {
      whereConditions.push('name LIKE ?');
      params.push(`%${String(name).trim()}%`);
    }

    if (status !== undefined && status !== null && status !== '') {
      whereConditions.push('status = ?');
      params.push(parseInt(status));
    }

    let query = `
      SELECT id, name, contact, phone, address, bank_info, tax_number, status, sort_order, remarks, created_at, updated_at
      FROM suppliers
    `;

    if (whereConditions.length > 0) {
      query += ` WHERE ${whereConditions.join(' AND ')} `;
    }

    query += ' ORDER BY sort_order ASC, id DESC';

    const [suppliers] = await pool.execute(query, params);

    const csvHeaders = [
      'ID',
      '供应商名称',
      '联系人',
      '联系电话',
      '地址',
      '银行信息',
      '税号',
      '状态',
      '排序',
      '备注',
      '创建时间',
      '更新时间'
    ];

    const escapeCsvValue = (value) => {
      if (value === null || value === undefined) {
        return '""';
      }

      const stringValue = String(value).replace(/"/g, '""');
      return `"${stringValue}"`;
    };

    const csvRows = suppliers.map((row) => ([
      row.id,
      row.name,
      row.contact,
      row.phone,
      row.address,
      row.bank_info,
      row.tax_number,
      Number(row.status) === 1 ? '启用' : '禁用',
      row.sort_order,
      row.remarks,
      row.created_at,
      row.updated_at
    ].map(escapeCsvValue).join(',')));

    const csvContent = `\ufeff${csvHeaders.join(',')}\n${csvRows.join('\n')}`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="suppliers_${Date.now()}.csv"`);
    return res.status(200).send(csvContent);
  } catch (error) {
    log.error('导出供应商失败:', error);
    return ApiResponse.error(res, '导出供应商失败', 500);
  }
});

// 删除供应商
router.delete('/:id', requirePermission('suppliers:delete'), async (req, res) => {
  try {
    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500);
    }

    const { id } = req.params;
    const pool = getDatabase();

    log.debug('🗑️ 删除供应商，ID:', id);

    let accessoryCount = 0;
    let phoneCount = 0;
    let hasAccessoriesTable = false;

    // 检查是否有关联的配件（使用try-catch，因为accessories表可能不存在）
    try {
      const [accessories] = await pool.execute('SELECT COUNT(*) as count FROM accessories WHERE supplier_id = ?', [id]);
      accessoryCount = accessories[0].count;
      hasAccessoriesTable = true;
      log.debug('配件数量:', accessoryCount);
    } catch (accError) {
      log.debug('ℹ️ accessories表不存在或查询失败，跳过配件检查');
      // 继续执行，配件数量为0
    }

    // 检查是否有关联的手机
    try {
      const [phones] = await pool.execute('SELECT COUNT(*) as count FROM phones WHERE supplier_id = ?', [id]);
      phoneCount = phones[0].count;
      log.debug('手机数量:', phoneCount);
    } catch (phoneError) {
      log.debug('ℹ️ phones表查询失败:', phoneError.message);
    }

    // 如果有关联数据，不允许删除
    if (accessoryCount > 0 || phoneCount > 0) {
      log.debug('❌ 供应商有关联数据，无法删除');
      let errorMsg = '该供应商下还有关联的商品，无法删除';
      const details = [];
      if (hasAccessoriesTable && accessoryCount > 0) {
        details.push(`${accessoryCount}个配件`);
      }
      if (phoneCount > 0) {
        details.push(`${phoneCount}个手机`);
      }
      if (details.length > 0) {
        errorMsg += `（${details.join('，')}）`;
      }
      return ApiResponse.error(res, errorMsg, 400);
    }

    const [result] = await pool.execute('DELETE FROM suppliers WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      log.debug('❌ 供应商不存在');
      return ApiResponse.error(res, '供应商不存在', 404);
    }

    log.debug('✅ 供应商删除成功，ID:', id);
    ApiResponse.success(res, null, '供应商删除成功');

  } catch (error) {
    log.error('删除供应商失败:', error);
    ApiResponse.error(res, '删除供应商失败: ' + error.message, 500);
  }
});

// 获取供应商详情
router.get('/:id', requirePermission('suppliers:view'), async (req, res) => {
  try {
    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500);
    }

    const { id } = req.params;
    const pool = getDatabase();

    // 验证 id 参数
    if (!id || isNaN(parseInt(id))) {
      return ApiResponse.error(res, '无效的供应商ID', 400);
    }

    const [suppliers] = await pool.execute('SELECT * FROM suppliers WHERE id = ?', [id]);

    if (suppliers.length === 0) {
      return ApiResponse.error(res, '供应商不存在', 404);
    }

    const supplier = suppliers[0];

    // 获取账户流水（如果表存在）
    let accounts = [];
    try {
      const [accountsResult] = await pool.execute(`
        SELECT sa.*, u.name as operator_name
        FROM supplier_accounts sa
        LEFT JOIN users u ON sa.operator_id = u.id
        WHERE sa.supplier_id = ?
        ORDER BY sa.created_at DESC
        LIMIT 50
      `, [id]);

      accounts = accountsResult.map(row => ({
        id: parseInt(row.id),
        type: row.type,
        amount: parseFloat(row.amount || 0),
        balance_before: parseFloat(row.balance_before || 0),
        balance_after: parseFloat(row.balance_after || 0),
        remarks: String(row.remarks || ''),
        related_inventory_ids: row.related_inventory_ids,
        operator_name: String(row.operator_name || ''),
        created_at: row.created_at ? new Date(row.created_at).toISOString() : null
      }));
    } catch (accountError) {
      log.warn('获取账户流水失败（表可能不存在）:', accountError.message);
      // 继续执行，账户流数据为空数组
    }

    // 获取关联商品统计（如果表存在）
    let accessoryStats = [{ count: 0, total_cost: 0 }];
    let phoneStats = [{ count: 0, total_cost: 0 }];

    try {
      [accessoryStats] = await pool.execute(
        'SELECT COUNT(*) as count, 0 as total_cost FROM accessories WHERE supplier_id = ?',
        [id]
      );
    } catch (accError) {
      log.warn('获取配件统计失败（表可能不存在）:', accError.message);
    }

    try {
      [phoneStats] = await pool.execute(
        'SELECT COUNT(*) as count, 0 as total_cost FROM phones WHERE supplier_id = ?',
        [id]
      );
    } catch (phoneError) {
      log.warn('获取手机统计失败（表可能不存在）:', phoneError.message);
    }

    return ApiResponse.success(res, {
      id: parseInt(supplier.id),
      name: String(supplier.name || ''),
      contact: String(supplier.contact || ''),
      phone: String(supplier.phone || ''),
      address: String(supplier.address || ''),
      bank_info: String(supplier.bank_info || ''),
      tax_number: String(supplier.tax_number || ''),
      status: parseInt(supplier.status) || 0,
      sort_order: parseInt(supplier.sort_order || 0),
      remarks: String(supplier.remarks || ''),
      created_at: supplier.created_at ? new Date(supplier.created_at).toISOString() : null,
      updated_at: supplier.updated_at ? new Date(supplier.updated_at).toISOString() : null,
      accounts: accounts,
      stats: {
        accessories_count: accessoryStats[0]?.count || 0,
        accessories_total_cost: parseFloat(accessoryStats[0]?.total_cost) || 0,
        phones_count: phoneStats[0]?.count || 0,
        phones_total_cost: parseFloat(phoneStats[0]?.total_cost) || 0
      }
    });

  } catch (error) {
    log.error('获取供应商详情失败:', error);
    return ApiResponse.error(res, '获取供应商详情失败: ' + (error.message || '未知错误'), 500);
  }
});

module.exports = router;
