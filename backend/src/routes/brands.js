const express = require('express');
const router = express.Router();
const { getDatabase, isConnected } = require('../config/database');
const ApiResponse = require('../utils/response');
const { cacheMiddleware } = require('../middleware/cache');
const { validateBody, validateQuery } = require('../middleware/validation');
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth');
const log = require('../utils/log');

// 获取品牌列表 - 增强搜索功能
router.get('/', unifiedAuth, requirePermission('brands:view'), validateQuery({
  name: { type: 'string', required: false, maxLength: 100 },
  status: { type: 'number', required: false, integer: true },
  page: { type: 'number', required: false, min: 1, integer: true },
  limit: { type: 'number', required: false, min: 1, max: 10000, integer: true },
  suggest: { type: 'enum', required: false, allowedValues: ['true', 'false'] }
}), cacheMiddleware({ ttl: 10 * 1000 }), async (req, res) => {
  try {
    log.debug('收到获取品牌列表请求');

    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500);
    }

    const pool = getDatabase();
    const { name, status, page = 1, limit = 10000, suggest = false } = req.query;  // 提高默认限制
    const limitNum = parseInt(limit) || 10000;  // 提高默认限制
    const pageNum = parseInt(page) || 1;
    const offset = (pageNum - 1) * limitNum;

    let query = 'SELECT * FROM brands';
    const params = [];
    const conditions = [];

    // 增强的搜索功能
    if (name) {
      const searchTerms = name.trim();

      if (suggest === 'true') {
        conditions.push(`(
          name LIKE ? OR
          name LIKE ? OR
          name LIKE ? OR
          LOWER(name) LIKE LOWER(?)
          )`);
        params.push(
          `${searchTerms}%`,
          `%${searchTerms}%`,
          `%${searchTerms}`,
          `%${searchTerms}%`
          );
      } else {
        conditions.push(`(
          name LIKE ? OR
          LOWER(name) LIKE LOWER(?)
          )`);
        params.push(
          `%${searchTerms}%`,
          `%${searchTerms}%`
          );
      }
    }

    if (status !== undefined && status !== null && status !== '') {
      conditions.push(' status = ?');
      params.push(parseInt(status));
    }

    if (conditions.length > 0) {
      query += ' WHERE' + conditions.join(' AND');
    }

    // 搜索建议模式使用不同的排序
    if (suggest === 'true') {
      query += ` ORDER BY
        CASE
          WHEN name LIKE ? THEN 1
          WHEN LOWER(name) LIKE LOWER(?) THEN 2
          ELSE 3
        END,
        sort_order ASC,
        id DESC
        LIMIT ? OFFSET ?`;
      params.unshift(`${name}%`, `%${name}%`);
      params.push(limitNum, offset);
    } else {
      query += ' ORDER BY sort_order ASC, id DESC LIMIT ? OFFSET ?';
      params.push(limitNum, offset);
    }

    // 使用pool.format来处理参数，避免LIMIT/OFFSET参数问题
    const formattedQuery = pool.format(query, params);
    const [brands] = await pool.execute(formattedQuery);

    const formattedBrands = brands.map(row => ({
      id: parseInt(row.id),
      name: String(row.name || '').trim(),
      status: parseInt(row.status) || 0,
      sort_order: parseInt(row.sort_order) || 0,
      created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
      updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null
    }));

    // 获取总数
    let countQuery = 'SELECT COUNT(*) as total FROM brands';
    const countParams = [];

    if (name) {
      const searchTerms = name.trim();
      if (suggest === 'true') {
        countQuery += ` WHERE (
          name LIKE ? OR
          name LIKE ? OR
          name LIKE ? OR
          LOWER(name) LIKE LOWER(?)
          )`;
        countParams.push(
          `${searchTerms}%`,
          `%${searchTerms}%`,
          `%${searchTerms}`,
          `%${searchTerms}%`
          );
      } else {
        countQuery += ` WHERE (
          name LIKE ? OR
          LOWER(name) LIKE LOWER(?)
          )`;
        countParams.push(
          `%${searchTerms}%`,
          `%${searchTerms}%`
          );
      }
    }

    if (status !== undefined && status !== null && status !== '') {
      const statusCondition = ' status = ?';
      if (countParams.length > 0) {
        countQuery += ' AND' + statusCondition;
      } else {
        countQuery += ' WHERE' + statusCondition;
      }
      countParams.push(parseInt(status));
    }

    const [countResult] = await pool.execute(countQuery, countParams);
    const total = countResult[0].total;

    // 判断是否需要分页信息 - 如果没有分页参数，直接返回品牌列表
    if (!req.query.page && !req.query.limit) {
      ApiResponse.success(res, formattedBrands);
    } else {
      const responseData = {
        data: formattedBrands,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: parseInt(total) || 0,
          pages: Math.ceil(parseInt(total) / limitNum)
        }
      };

      // 如果是搜索建议，添加额外的搜索建议信息
      if (suggest === 'true') {
        const [suggestions] = await pool.execute(`
          SELECT DISTINCT name,
            CASE
              WHEN name LIKE ? THEN 1
              WHEN LOWER(name) LIKE LOWER(?) THEN 2
              ELSE 3
            END as relevance_score
          FROM brands
          WHERE (name LIKE ? OR LOWER(name) LIKE LOWER(?))
          ORDER BY relevance_score, sort_order ASC
          LIMIT 5
        `, [`${name}%`, `%${name}%`, `%${name}%`, `%${name}%`]);

        responseData.suggestions = suggestions.map(s => s.name);
      }

      ApiResponse.success(res, responseData);
    }

  } catch (error) {
    log.error('获取品牌列表失败:', error);
    ApiResponse.error(res, '获取品牌列表失败', 500);
  }
});

// 创建品牌
router.post('/', unifiedAuth, requirePermission('brands:create'), validateBody({
  name: { type: 'string', required: true, minLength: 1, maxLength: 100 },
  status: { type: 'number', required: false, integer: true, min: 0, max: 1 },
  sort_order: { type: 'number', required: false, integer: true, min: 0 }
}), async (req, res) => {
  try {
    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500);
    }

    const { name, status = 1, sort_order = 0 } = req.body;

    const pool = getDatabase();

    // 检查品牌名称是否已存在
    const [existingBrands] = await pool.execute(
      'SELECT id FROM brands WHERE name = ?',
      [name.trim()]
    );

    if (existingBrands.length > 0) {
      return ApiResponse.error(res, '品牌名称已存在', 400);
    }

    const [result] = await pool.execute(
      'INSERT INTO brands (name, status, sort_order, created_at) VALUES (?, ?, ?, NOW())',
      [name.trim(), parseInt(status), parseInt(sort_order)]
    );

    ApiResponse.success(res, {
      id: result.insertId,
      name: name.trim(),
      status: parseInt(status),
      sort_order: parseInt(sort_order)
    }, '品牌创建成功');

  } catch (error) {
    log.error('创建品牌失败:', error);
    ApiResponse.error(res, '创建品牌失败', 500);
  }
});

// 更新品牌
router.put('/:id', unifiedAuth, requirePermission('brands:edit'), async (req, res) => {
  try {
    log.debug('🔧 开始更新品牌, 参数:', {
      id: req.params.id,
      body: req.body
    });

    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500);
    }

    const { id } = req.params;
    const { name, status, sort_order } = req.body;

    log.debug('📝 更新品牌数据:', { id, name, status, sort_order });

    if (!name || name.trim() === '') {
      return ApiResponse.error(res, '品牌名称不能为空', 400);
    }

    const pool = getDatabase();

    // 检查品牌名称是否已被其他品牌使用
    const [existingBrands] = await pool.execute(
      'SELECT id FROM brands WHERE name = ? AND id != ?',
      [name.trim(), id]
    );

    if (existingBrands.length > 0) {
      return ApiResponse.error(res, '品牌名称已存在', 400);
    }

    // 准备更新数据
    const updateData = {
      name: name.trim(),
      status: parseInt(status) || 0,
      sort_order: parseInt(sort_order) || 0
    };

    log.debug('💾 执行SQL更新, 数据:', updateData);

    const [result] = await pool.execute(
      'UPDATE brands SET name = ?, status = ?, sort_order = ?, updated_at = NOW() WHERE id = ?',
      [updateData.name, updateData.status, updateData.sort_order, id]
    );

    log.debug('✅ SQL执行结果:', { affectedRows: result.affectedRows, changedRows: result.changedRows });

    if (result.affectedRows === 0) {
      return ApiResponse.error(res, '品牌不存在', 404);
    }

    ApiResponse.success(res, {
      id: parseInt(id),
      ...updateData
    }, '品牌更新成功');

  } catch (error) {
    log.error('❌ 更新品牌失败, 详细错误:', {
      message: error.message,
      code: error.code,
      sqlMessage: error.sqlMessage,
      sqlState: error.sqlState,
      stack: error.stack
    });
    ApiResponse.error(res, '更新品牌失败: ' + error.message, 500);
  }
});

// 批量更新排序
router.put('/batch/reorder', unifiedAuth, requirePermission('brands:edit'), async (req, res) => {
  try {
    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500);
    }

    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return ApiResponse.error(res, '请提供有效的排序数据', 400);
    }

    const pool = getDatabase();

    // 使用事务批量更新
    await pool.query('START TRANSACTION');

    try {
      for (const item of items) {
        if (item.id !== undefined && item.sort_order !== undefined) {
          await pool.execute(
            'UPDATE brands SET sort_order = ? WHERE id = ?',
            [item.sort_order, item.id]
          );
        }
      }

      await pool.query('COMMIT');
      ApiResponse.success(res, null, '排序更新成功');

    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    log.error('批量更新排序失败:', error);
    ApiResponse.error(res, '批量更新排序失败', 500);
  }
});

// 删除品牌
router.delete('/:id', unifiedAuth, requirePermission('brands:delete'), async (req, res) => {
  try {
    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500);
    }

    const { id } = req.params;
    const pool = getDatabase();

    // 检查是否有关联的型号
    const [models] = await pool.execute('SELECT COUNT(*) as count FROM models WHERE brand_id = ?', [id]);

    if (models[0].count > 0) {
      return ApiResponse.error(res, '该品牌下还有关联的型号，无法删除', 400);
    }

    const [result] = await pool.execute('DELETE FROM brands WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return ApiResponse.error(res, '品牌不存在', 404);
    }

    ApiResponse.success(res, null, '品牌删除成功');

  } catch (error) {
    log.error('删除品牌失败:', error);
    ApiResponse.error(res, '删除品牌失败', 500);
  }
});

// 获取品牌搜索建议
router.get('/suggest', unifiedAuth, requirePermission('brands:view'), async (req, res) => {
  try {
    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500);
    }

    const { name } = req.query;
    if (!name || name.trim() === '') {
      return ApiResponse.success(res, []);
    }

    const pool = getDatabase();
    const [suggestions] = await pool.execute(`
      SELECT DISTINCT name,
        CASE
          WHEN name LIKE ? THEN 1
          WHEN LOWER(name) LIKE LOWER(?) THEN 2
          ELSE 3
        END as relevance_score
      FROM brands
      WHERE (name LIKE ? OR LOWER(name) LIKE LOWER(?))
      ORDER BY relevance_score, sort_order ASC
      LIMIT 10
    `, [`${name}%`, `%${name}%`, `%${name}%`, `%${name}%`]);

    ApiResponse.success(res, suggestions.map(s => s.name));

  } catch (error) {
    log.error('获取品牌搜索建议失败:', error);
    ApiResponse.error(res, '获取品牌搜索建议失败', 500);
  }
});

// 获取品牌下的型号列表
// 支持 brandId 为品牌ID（数字）或品牌名称（字符串）
router.get('/:brandId/models', unifiedAuth, requirePermission('brands:view'), async (req, res) => {
  try {
    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500);
    }

    const { brandId } = req.params;
    const pool = getDatabase();

    // 判断 brandId 是数字ID还是品牌名称
    const isNumericId = /^\d+$/.test(brandId);

    let query, params;

    if (isNumericId) {
      // 使用品牌ID查询
      query = `
        SELECT m.*, b.name as brand_name
        FROM models m
        LEFT JOIN brands b ON m.brand_id = b.id
        WHERE m.brand_id = ?
        ORDER BY m.sort_order ASC, m.id DESC
      `;
      params = [parseInt(brandId)];
    } else {
      // 使用品牌名称查询
      query = `
        SELECT m.*, b.name as brand_name
        FROM models m
        LEFT JOIN brands b ON m.brand_id = b.id
        WHERE b.name = ?
        ORDER BY m.sort_order ASC, m.id DESC
      `;
      params = [decodeURIComponent(brandId)];
    }

    const [models] = await pool.execute(query, params);

    const formattedModels = models.map(row => ({
      id: row.id ? parseInt(row.id) : 0,
      brand_id: row.brand_id ? parseInt(row.brand_id) : 0,
      brand_name: String(row.brand_name || '未知品牌').trim(),
      name: String(row.name || '').trim(),
      status: row.status ? parseInt(row.status) : 0,
      sort_order: row.sort_order ? parseInt(row.sort_order) : 0,
      created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
      updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null
    }));

    ApiResponse.success(res, formattedModels);

  } catch (error) {
    log.error('获取品牌型号列表失败:', error);
    ApiResponse.error(res, '获取品牌型号列表失败', 500);
  }
});

module.exports = router;
