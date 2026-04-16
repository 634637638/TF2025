const express = require('express');
const router = express.Router();
const ApiResponse = require('../utils/response');
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth');
const { getDatabase, isConnected } = require('../config/database');
const { cacheMiddleware, clearCache } = require('../middleware/cache');
const XLSX = require('xlsx');
const { LEGACY_USER_ROLE_SQL_LIST } = require('../services/accessControl.service');
const log = require('../utils/log');

// 获取店铺列表
router.get('/', unifiedAuth, requirePermission('stores:view'), cacheMiddleware({ ttl: 30000 }), async (req, res) => {
  try {
    const { name, status, page = 1, limit = 10000, all = false } = req.query;

    // 检查数据库连接状态
    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500);
    }

    const pool = getDatabase();

    // 如果请求所有数据，用于下拉选择
    if (all === 'true' || all === true) {
      let query = 'SELECT id, name FROM stores WHERE status = 1 ORDER BY name';
      const params = [];

      if (name) {
        query = 'SELECT id, name FROM stores WHERE status = 1 AND name LIKE ? ORDER BY name';
        params.push(`%${name}%`);
      }

      const [stores] = await pool.execute(query, params);

      const formattedStores = stores.map(row => ({
        id: parseInt(row.id),
        name: String(row.name || '')
      }));
      ApiResponse.success(res, formattedStores);
      return;
    }

    // 原有的分页逻辑
    const offset = (parseInt(page) - 1) * (parseInt(limit) || 10);

    let query = `
      SELECT s.*, u.name as manager_name
      FROM stores s
      LEFT JOIN users u ON s.manager_id = u.id
    `;
    const params = [];
    const conditions = [];

    if (name) {
      conditions.push(' s.name LIKE ?');
      params.push(`%${name}%`);
    }

    if (status !== undefined && status !== null && status !== '') {
      conditions.push(' s.status = ?');
      const statusValue = parseInt(status);
      if (!isNaN(statusValue)) {
        params.push(statusValue);
      } else {
        return ApiResponse.error(res, '无效的状态值', 400);
      }
    }

    if (conditions.length > 0) {
      query += ' WHERE' + conditions.join(' AND');
    }

    // 🔒 安全加固：WHERE条件使用参数化查询，但分页使用直接数值防止MySQL2参数绑定错误
    const finalLimit = Math.max(1, parseInt(limit) || 10);
    const finalOffset = Math.max(0, parseInt(offset) || 0);
    // 按照 sort_order 排序，如果没有则按 id 降序
    query += ` ORDER BY s.sort_order ASC, s.id DESC LIMIT ${finalLimit} OFFSET ${finalOffset}`;

    const [stores] = await pool.execute(query, params);

    // 获取总数 - 修复：添加表别名 s
    let countQuery = 'SELECT COUNT(*) as total FROM stores s';
    // 复制查询参数，确保COUNT查询使用相同的参数
    const countParams = [...params];

    if (conditions.length > 0) {
      countQuery += ' WHERE' + conditions.join(' AND');
    }

    const [countResult] = await pool.execute(countQuery, countParams);
    const total = countResult[0].total;

    const formattedStores = stores.map(row => ({
      id: parseInt(row.id),
      name: String(row.name || ''),
      address: String(row.location || ''),
      phone: String(row.phone || ''),
      manager: String(row.manager_name || ''),  // 显示管理员姓名而不是ID
      manager_id: parseInt(row.manager_id) || null,  // 保留manager_id用于编辑
      status: parseInt(row.status) || 0,
      sort_order: parseInt(row.sort_order) || 0,  // 添加排序字段
      created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
      updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null
    }));

    // 返回带有分页信息的响应
    const response = {
      data: formattedStores,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / parseInt(limit)),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    };

    ApiResponse.success(res, response);
  } catch (error) {
    log.error('获取店铺列表失败:', error);
    ApiResponse.error(res, '获取店铺列表失败', 500);
  }
});

router.get('/export', unifiedAuth, requirePermission('stores:export'), async (req, res) => {
  try {
    const { name, status } = req.query;

    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500);
    }

    const pool = getDatabase();
    let query = `
      SELECT
        s.id,
        s.name,
        s.location,
        s.phone,
        s.status,
        s.sort_order,
        s.created_at,
        s.updated_at,
        u.name as manager_name
      FROM stores s
      LEFT JOIN users u ON s.manager_id = u.id
    `;
    const params = [];
    const conditions = [];

    if (name) {
      conditions.push('s.name LIKE ?');
      params.push(`%${String(name).trim()}%`);
    }

    if (status !== undefined && status !== null && status !== '') {
      conditions.push('s.status = ?');
      params.push(parseInt(status, 10));
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' ORDER BY s.sort_order ASC, s.id DESC';

    const [stores] = await pool.execute(query, params);
    const rows = stores.map(row => ({
      ID: row.id,
      门店名称: row.name || '',
      地址: row.location || '',
      电话: row.phone || '',
      店长: row.manager_name || '',
      状态: Number(row.status) === 1 ? '正常' : '禁用',
      排序: row.sort_order || 0,
      创建时间: row.created_at || '',
      更新时间: row.updated_at || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    const beijingDate = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date()).replace(/\//g, '-');

    XLSX.utils.book_append_sheet(workbook, worksheet, '门店管理');

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(`门店管理_${beijingDate}.xlsx`)}`
    );

    return res.send(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
  } catch (error) {
    log.error('导出门店数据失败:', error);
    return ApiResponse.error(res, '导出门店数据失败', 500);
  }
});


// 创建店铺
router.post('/', unifiedAuth, requirePermission('stores:create'), async (req, res) => {
  try {
    const { name, address, phone, manager, status = 1, sort_order = 0 } = req.body;

    if (!name || !name.trim()) {
      return ApiResponse.error(res, '店铺名称不能为空', 400);
    }

    // 检查数据库连接状态
    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500);
    }

    const pool = getDatabase();

    // 检查店铺名称是否已存在
    const [existingStores] = await pool.execute(
      'SELECT id FROM stores WHERE name = ?',
      [name.trim()]
    );

    if (existingStores.length > 0) {
      return ApiResponse.error(res, `店铺名称"${name}"已存在，请使用其他名称`, 409);
    }

    const [result] = await pool.execute(
      'INSERT INTO stores (name, location, phone, manager_id, status, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
      [name.trim(), address || '', phone || '', manager || '', parseInt(status), parseInt(sort_order)]
    );

    if (result.insertId) {
      const [newStore] = await pool.execute('SELECT * FROM stores WHERE id = ?', [result.insertId]);

      const formattedStore = {
        id: parseInt(newStore[0].id),
        name: String(newStore[0].name || ''),
        address: String(newStore[0].location || ''),
        phone: String(newStore[0].phone || ''),
        manager: String(newStore[0].manager_id || ''),
        status: parseInt(newStore[0].status) || 0,
        created_at: newStore[0].created_at ? new Date(newStore[0].created_at).toISOString() : null,
        updated_at: newStore[0].updated_at ? new Date(newStore[0].updated_at).toISOString() : null
      };

      // 清除缓存
      clearCache('/stores');

      ApiResponse.created(res, '店铺创建成功', formattedStore);
    } else {
      ApiResponse.error(res, '店铺创建失败', 500);
    }
  } catch (error) {
    log.error('创建店铺失败:', error);
    ApiResponse.error(res, '创建店铺失败', 500);
  }
});

// 更新店铺
router.put('/:id', unifiedAuth, requirePermission('stores:edit'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, address, phone, manager, status, sort_order } = req.body;

    if (!id || isNaN(parseInt(id))) {
      return ApiResponse.error(res, '无效的店铺ID', 400);
    }

    if (!name || !name.trim()) {
      return ApiResponse.error(res, '店铺名称不能为空', 400);
    }

    // 检查数据库连接状态
    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500);
    }

    const pool = getDatabase();

    // 获取当前店铺的name值
    const [currentStore] = await pool.execute('SELECT name FROM stores WHERE id = ?', [parseInt(id)]);
    const currentName = currentStore[0]?.name;

    // 如果name有变化，检查是否与其他记录重复
    if (name && name !== currentName) {
      const [duplicateCheck] = await pool.execute(
        'SELECT id FROM stores WHERE name = ? AND id != ?',
        [name.trim(), parseInt(id)]
      );

      if (duplicateCheck.length > 0) {
        return ApiResponse.error(res, `店铺名称"${name}"已存在，请使用其他名称`, 409);
      }
    }

    const [result] = await pool.execute(
      'UPDATE stores SET name = ?, location = ?, phone = ?, manager_id = ?, status = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name.trim(), address || '', phone || '', manager || '', parseInt(status), parseInt(sort_order) || 0, parseInt(id)]
    );

    if (result.affectedRows > 0) {
      const [updatedStore] = await pool.execute('SELECT * FROM stores WHERE id = ?', [parseInt(id)]);

      const formattedStore = {
        id: parseInt(updatedStore[0].id),
        name: String(updatedStore[0].name || ''),
        address: String(updatedStore[0].location || ''),
        phone: String(updatedStore[0].phone || ''),
        manager: String(updatedStore[0].manager_id || ''),
        status: parseInt(updatedStore[0].status) || 0,
        created_at: updatedStore[0].created_at ? new Date(updatedStore[0].created_at).toISOString() : null,
        updated_at: updatedStore[0].updated_at ? new Date(updatedStore[0].updated_at).toISOString() : null
      };

      // 清除缓存
      clearCache('/stores');

      ApiResponse.success(res, formattedStore, '店铺修改成功');
    } else {
      ApiResponse.notFound(res, '店铺不存在');
    }
  } catch (error) {
    log.error('更新店铺失败:', error);
    ApiResponse.error(res, '更新店铺失败', 500);
  }
});

// 删除店铺
router.delete('/:id', unifiedAuth, requirePermission('stores:delete'), async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return ApiResponse.error(res, '无效的店铺ID', 400);
    }

    // 检查数据库连接状态
    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500);
    }

    const pool = getDatabase();
    const [result] = await pool.execute('DELETE FROM stores WHERE id = ?', [parseInt(id)]);

    if (result.affectedRows > 0) {
      // 清除缓存
      clearCache('/stores');

      ApiResponse.success(res, '店铺删除成功');
    } else {
      ApiResponse.notFound(res, '店铺不存在');
    }
  } catch (error) {
    log.error('删除店铺失败:', error);
    ApiResponse.error(res, '删除店铺失败', 500);
  }
});

// 获取管理员列表
router.get('/managers', unifiedAuth, requirePermission('stores:view'), async (req, res) => {
  try {
    // 检查数据库连接状态
    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500);
    }

    const pool = getDatabase();
    const [managers] = await pool.execute(`
      SELECT id, name, username
      FROM users
      WHERE status = 1 AND role IN (${LEGACY_USER_ROLE_SQL_LIST})
      ORDER BY name
    `);

    ApiResponse.success(res, managers);
  } catch (error) {
    log.error('获取管理员列表失败:', error);
    ApiResponse.error(res, '获取管理员列表失败', 500);
  }
});

// 获取店铺统计信息
router.get('/stats', unifiedAuth, requirePermission('stores:view'), async (req, res) => {
  try {
    // 检查数据库连接状态
    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500);
    }

    const pool = getDatabase();

    // 总店铺数
    const [totalResult] = await pool.execute('SELECT COUNT(*) as total FROM stores');
    const total = totalResult[0].total;

    // 正常营业的店铺数
    const [activeResult] = await pool.execute('SELECT COUNT(*) as active FROM stores WHERE status = 1');
    const active = activeResult[0].active;

    // 禁用的店铺数
    const [inactiveResult] = await pool.execute('SELECT COUNT(*) as inactive FROM stores WHERE status = 0');
    const inactive = inactiveResult[0].inactive;

    // 有管理员的店铺数
    const [withManagerResult] = await pool.execute('SELECT COUNT(*) as with_manager FROM stores WHERE manager_id IS NOT NULL AND manager_id != ""');
    const withManager = withManagerResult[0].with_manager;

    // 最近创建的店铺（最近7天）
    const [recentResult] = await pool.execute(`
      SELECT COUNT(*) as recent FROM stores
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    `);
    const recent = recentResult[0].recent;

    const stats = {
      total: parseInt(total) || 0,
      active: parseInt(active) || 0,
      inactive: parseInt(inactive) || 0,
      withManager: parseInt(withManager) || 0,
      recent: parseInt(recent) || 0
    };

    ApiResponse.success(res, stats);
  } catch (error) {
    log.error('获取店铺统计信息失败:', error);
    ApiResponse.error(res, '获取店铺统计信息失败', 500);
  }
});

// 批量更新排序
router.put('/batch/reorder', unifiedAuth, requirePermission('stores:edit'), async (req, res) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return ApiResponse.error(res, '请提供有效的排序数据', 400);
    }

    // 检查数据库连接状态
    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500);
    }

    const pool = getDatabase();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      for (const item of items) {
        if (item.id !== undefined && item.sort_order !== undefined) {
          await connection.execute(
            'UPDATE stores SET sort_order = ? WHERE id = ?',
            [item.sort_order, item.id]
          );
        }
      }

      await connection.commit();

      // 清除缓存
      clearCache('/stores');

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

// 获取单个店铺详情 - 必须放在所有具体路由之后
router.get('/:id', unifiedAuth, requirePermission('stores:view'), async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return ApiResponse.error(res, '无效的店铺ID', 400);
    }

    // 检查数据库连接状态
    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500);
    }

    const pool = getDatabase();
    const [stores] = await pool.execute('SELECT * FROM stores WHERE id = ?', [parseInt(id)]);

    if (stores.length === 0) {
      return ApiResponse.notFound(res, '店铺不存在');
    }

    const store = stores[0];
    const formattedStore = {
      id: parseInt(store.id),
      name: String(store.name || ''),
      address: String(store.location || ''),
      phone: String(store.phone || ''),
      manager: String(store.manager_id || ''),
      status: parseInt(store.status) || 0,
      created_at: store.created_at ? new Date(store.created_at).toISOString() : null,
      updated_at: store.updated_at ? new Date(store.updated_at).toISOString() : null
    };

    ApiResponse.success(res, formattedStore);
  } catch (error) {
    log.error('获取店铺详情失败:', error);
    ApiResponse.error(res, '获取店铺详情失败', 500);
  }
});

module.exports = router;
