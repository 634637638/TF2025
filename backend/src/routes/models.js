const express = require('express');
const router = express.Router();
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth');
const ApiResponse = require('../utils/response');
const { getDatabase, isConnected } = require('../config/database');
const log = require('../utils/log');

// 获取型号列表
router.get('/', unifiedAuth, requirePermission('models:view'), async (req, res) => {
  try {
    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500);
    }

    const pool = getDatabase();
    const {
      page = 1,
      limit = 10000,  // 提高默认限制以支持获取所有数据
      brand_id,
      series,
      is_active,
      search,
      name,
      status,
      sortBy = 'sort_order',
      sortOrder = 'asc'
    } = req.query;

    const limitNum = parseInt(limit) || 10000;  // 提高默认限制
    const pageNum = parseInt(page) || 1;
    const offset = (pageNum - 1) * limitNum;

    // 先检查models表是否存在
    try {
      await pool.execute('SELECT 1 FROM models LIMIT 1');
    } catch (tableError) {
      log.error('models表不存在或无权限访问:', tableError);
      return ApiResponse.error(res, 'models表不存在或无权限访问', 500);
    }

    // 使用JOIN查询，直接关联品牌表
    let baseQuery = `
      SELECT
        m.*,
        b.name as brand_name
      FROM models m
      LEFT JOIN brands b ON m.brand_id = b.id
    `;
    let baseCountQuery = `
      SELECT COUNT(*) as total
      FROM models m
      LEFT JOIN brands b ON m.brand_id = b.id
    `;

    // 构建WHERE条件
    const conditions = [];
    const queryParams = [];

    if (brand_id) {
      conditions.push('m.brand_id = ?');
      queryParams.push(brand_id);
    }

    if (series) {
      conditions.push('m.series LIKE ?');
      queryParams.push(`%${series}%`);
    }

    // 状态筛选
    let statusFilter = null;
    if (is_active !== undefined) {
      statusFilter = is_active === 'true' ? 1 : 0;
    } else if (status !== undefined && status !== '') {
      statusFilter = parseInt(status) === 1 ? 1 : 0;
    }
    if (statusFilter !== null) {
      conditions.push('m.status = ?');
      queryParams.push(statusFilter);
    }

    // 搜索（使用表别名 m. 避免与 brands.name 冲突）
    const searchTerm = search || name;
    if (searchTerm) {
      conditions.push('m.name LIKE ?');
      queryParams.push(`%${searchTerm}%`);
    }

    // 添加WHERE子句
    if (conditions.length > 0) {
      baseQuery += ' WHERE ' + conditions.join(' AND ');
      baseCountQuery += ' WHERE ' + conditions.join(' AND ');
    }

    // 排序（使用表别名 m. 避免歧义）
    const validSortColumns = ['id', 'name', 'sort_order', 'created_at', 'updated_at', 'brand_id'];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'sort_order';
    const sortDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';
    baseQuery += ` ORDER BY m.${sortColumn} ${sortDirection}`;

    // 分页
    const finalQuery = `${baseQuery} LIMIT ${limitNum} OFFSET ${offset}`;

    // 执行查询
    const [models] = await pool.execute(finalQuery, queryParams);
    const [countResult] = await pool.execute(baseCountQuery, queryParams);
    const total = countResult[0].total;

    ApiResponse.success(res, {
      models: models,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    log.error('获取型号列表失败:', error);
    log.error('错误详情:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
    ApiResponse.serverError(res, '获取型号列表失败', error);
  }
});

// 根据品牌ID获取型号列表
router.get('/brand/:brandId', unifiedAuth, requirePermission('models:view'), async (req, res) => {
  try {
    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500);
    }

    const { brandId } = req.params;
    const pool = getDatabase();
    const {
      page = 1,
      limit = 10000,  // 提高默认限制以支持获取所有数据
      search,
      name,
      status,
      sortBy = 'id',
      sortOrder = 'desc'
    } = req.query;

    const limitNum = parseInt(limit) || 10000;  // 提高默认限制
    const pageNum = parseInt(page) || 1;
    const offset = (pageNum - 1) * limitNum;

    // 先检查models表是否存在
    try {
      await pool.execute('SELECT 1 FROM models LIMIT 1');
    } catch (tableError) {
      log.error('models表不存在或无权限访问:', tableError);
      return ApiResponse.error(res, 'models表不存在或无权限访问', 500);
    }

    // 构建WHERE条件
    const conditions = ['m.brand_id = ?'];
    const queryParams = [parseInt(brandId)];

    // 状态筛选
    let statusFilter = null;
    if (status !== undefined && status !== '') {
      statusFilter = parseInt(status) === 1 ? 1 : 0;
      conditions.push('m.status = ?');
      queryParams.push(statusFilter);
    }

    // 搜索
    const searchTerm = search || name;
    if (searchTerm) {
      conditions.push('m.name LIKE ?');
      queryParams.push(`%${searchTerm}%`);
    }

    // 构建查询
    let baseQuery = 'SELECT m.* FROM models m WHERE ' + conditions.join(' AND ');
    let baseCountQuery = 'SELECT COUNT(*) as total FROM models m WHERE ' + conditions.join(' AND ');

    // 排序
    const validSortColumns = ['id', 'name', 'sort_order', 'created_at', 'updated_at'];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'sort_order';
    const sortDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';
    baseQuery += ` ORDER BY m.${sortColumn} ${sortDirection}`;

    // 分页
    const finalQuery = `${baseQuery} LIMIT ${limitNum} OFFSET ${offset}`;

    // 执行查询
    const [models] = await pool.execute(finalQuery, queryParams);
    const [countResult] = await pool.execute(baseCountQuery, queryParams);
    const total = countResult[0].total;

    ApiResponse.success(res, {
      models: models,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    log.error('根据品牌ID获取型号列表失败:', error);
    log.error('错误详情:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
    ApiResponse.serverError(res, '获取型号列表失败', error);
  }
});

// 获取单个型号详情
router.get('/:id', unifiedAuth, requirePermission('models:view'), async (req, res) => {
  try {
    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500);
    }

    const { id } = req.params;
    const pool = getDatabase();

    const [models] = await pool.execute('SELECT * FROM models WHERE id = ?', [parseInt(id)]);

    if (models.length === 0) {
      return ApiResponse.notFound(res, '型号不存在');
    }

    ApiResponse.success(res, models[0]);
  } catch (error) {
    log.error('获取型号详情失败:', error);
    log.error('错误详情:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
    ApiResponse.serverError(res, '获取型号详情失败', error);
  }
});

// 创建型号
router.post('/', unifiedAuth, requirePermission('models:create'), async (req, res) => {
  try {
    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500);
    }

    const pool = getDatabase();
    const {
      brand_id,
      name,
      status,
      sort_order
    } = req.body;

    // 验证必需字段
    if (!brand_id || !name) {
      return ApiResponse.badRequest(res, '品牌ID和型号名称不能为空');
    }

    // 检查型号名称是否重复
    const [existingModels] = await pool.execute(
      'SELECT id FROM models WHERE name = ? AND brand_id = ?',
      [name, parseInt(brand_id)]
    );
    if (existingModels.length > 0) {
      return ApiResponse.badRequest(res, '该品牌下已存在相同型号名称');
    }

    // 插入新型号
    const insertQuery = `
      INSERT INTO models (
        brand_id, name, status, sort_order, created_at, updated_at
      ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;

    const insertValues = [
      parseInt(brand_id),
      name,
      status || 1,
      sort_order || 0
    ];

    const [result] = await pool.execute(insertQuery, insertValues);

    // 获取新创建的型号
    const [newModels] = await pool.execute('SELECT * FROM models WHERE id = ?', [result.insertId]);
    const newModel = newModels[0];

    ApiResponse.created(res, '型号创建成功', newModel);
  } catch (error) {
    log.error('创建型号失败:', error);
    log.error('错误详情:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
    ApiResponse.serverError(res, '创建型号失败', error);
  }
});

// 更新型号
router.put('/:id', unifiedAuth, requirePermission('models:edit'), async (req, res) => {
  try {
    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500);
    }

    const { id } = req.params;
    const pool = getDatabase();

    // 检查型号是否存在
    const [existingModels] = await pool.execute('SELECT * FROM models WHERE id = ?', [parseInt(id)]);
    if (existingModels.length === 0) {
      return ApiResponse.notFound(res, '型号不存在');
    }

    const {
      brand_id,
      name,
      status,
      sort_order
    } = req.body;

    // 检查型号名称是否重复（排除当前型号）
    if (name && brand_id) {
      const [duplicateModels] = await pool.execute(
        'SELECT id FROM models WHERE name = ? AND brand_id = ? AND id != ?',
        [name, parseInt(brand_id), parseInt(id)]
      );
      if (duplicateModels.length > 0) {
        return ApiResponse.badRequest(res, '该品牌下已存在相同型号名称');
      }
    }

    // 构建更新字段
    const updateFields = [];
    const updateValues = [];

    if (brand_id !== undefined) {
      updateFields.push('brand_id = ?');
      updateValues.push(parseInt(brand_id));
    }
    if (name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(name);
    }
    // 注意：models表只有字段：id, brand_id, name, status, sort_order, created_at, updated_at
    // 以下字段在表中不存在，已注释掉以避免错误
    // if (series !== undefined) {
    //   updateFields.push('series = ?');
    //   updateValues.push(series);
    // }
    // if (release_date !== undefined) {
    //   updateFields.push('release_date = ?');
    //   updateValues.push(release_date);
    // }
    // if (base_price !== undefined) {
    //   updateFields.push('base_price = ?');
    //   updateValues.push(parseFloat(base_price));
    // }
    // if (screen_size !== undefined) {
    //   updateFields.push('screen_size = ?');
    //   updateValues.push(screen_size ? parseFloat(screen_size) : null);
    // }
    // if (processor !== undefined) {
    //   updateFields.push('processor = ?');
    //   updateValues.push(processor);
    // }
    // if (ram !== undefined) {
    //   updateFields.push('ram = ?');
    //   updateValues.push(ram);
    // }
    // if (storage_options !== undefined) {
    //   updateFields.push('storage_options = ?');
    //   updateValues.push(JSON.stringify(storage_options || []));
    // }
    // if (color_options !== undefined) {
    //   updateFields.push('color_options = ?');
    //   updateValues.push(JSON.stringify(color_options || []));
    // }
    // if (features !== undefined) {
    //   updateFields.push('features = ?');
    //   updateValues.push(JSON.stringify(features || []));
    // }
    // if (description !== undefined) {
    //   updateFields.push('description = ?');
    //   updateValues.push(description);
    // }
    // if (is_active !== undefined) {
    //   updateFields.push('status = ?');
    //   updateValues.push(is_active ? 1 : 0);
    // }

    // 处理status字段（使用正确的字段名）
    if (status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(parseInt(status));
    }

    if (updateFields.length === 0) {
      return ApiResponse.badRequest(res, '没有要更新的字段');
    }

    // 添加更新时间
    updateFields.push('updated_at = CURRENT_TIMESTAMP');

    // 添加ID到WHERE条件
    updateValues.push(parseInt(id));

    const updateQuery = `UPDATE models SET ${updateFields.join(', ')} WHERE id = ?`;

    await pool.execute(updateQuery, updateValues);

    // 获取更新后的数据
    const [updatedModels] = await pool.execute('SELECT * FROM models WHERE id = ?', [parseInt(id)]);
    const updatedModel = updatedModels[0];

    ApiResponse.success(res, updatedModel, '型号更新成功');
  } catch (error) {
    log.error('更新型号失败:', error);
    log.error('错误详情:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
    ApiResponse.serverError(res, '更新型号失败', error);
  }
});

// 删除型号
router.delete('/:id', unifiedAuth, requirePermission('models:delete'), async (req, res) => {
  try {
    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500);
    }

    const { id } = req.params;
    const pool = getDatabase();

    // 检查型号是否存在
    const [existingModels] = await pool.execute('SELECT * FROM models WHERE id = ?', [parseInt(id)]);
    if (existingModels.length === 0) {
      return ApiResponse.notFound(res, '型号不存在');
    }

    // 删除型号
    await pool.execute('DELETE FROM models WHERE id = ?', [parseInt(id)]);

    ApiResponse.success(res, existingModels[0], '型号删除成功');
  } catch (error) {
    log.error('删除型号失败:', error);
    log.error('错误详情:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
    ApiResponse.serverError(res, '删除型号失败', error);
  }
});

// 获取型号统计信息
router.get('/stats/overview', unifiedAuth, requirePermission('models:view'), async (req, res) => {
  try {
    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500);
    }

    const { brand_id } = req.query;
    const pool = getDatabase();

    let query = 'SELECT * FROM models';
    let queryParams = [];

    if (brand_id) {
      query += ' WHERE brand_id = ?';
      queryParams.push(parseInt(brand_id));
    }

    const [models] = await pool.execute(query, queryParams);

    const stats = {
      total: models.length,
      active: models.filter(m => m.status === 1).length,
      inactive: models.filter(m => m.status === 0).length,
      byBrand: {},
      bySeries: {},
      avgBasePrice: models.length > 0
        ? models.reduce((sum, m) => sum + (m.base_price || 0), 0) / models.length
        : 0,
      newestModel: models.length > 0
        ? models.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0].name
        : null
    };

    // 按品牌统计（需要JOIN brands表获取品牌名称）
    for (const model of models) {
      try {
        const [brandResult] = await pool.execute('SELECT name FROM brands WHERE id = ?', [model.brand_id]);
        const brandName = brandResult.length > 0 ? brandResult[0].name : `品牌${model.brand_id}`;
        stats.byBrand[brandName] = (stats.byBrand[brandName] || 0) + 1;

        if (model.series) {
          stats.bySeries[model.series] = (stats.bySeries[model.series] || 0) + 1;
        }
      } catch (brandError) {
        log.error('获取品牌名称失败:', brandError);
        stats.byBrand[`品牌${model.brand_id}`] = (stats.byBrand[`品牌${model.brand_id}`] || 0) + 1;
      }
    }

    ApiResponse.success(res, stats);
  } catch (error) {
    log.error('获取型号统计失败:', error);
    log.error('错误详情:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
    ApiResponse.serverError(res, '获取型号统计失败', error);
  }
});

// 切换型号状态
router.patch('/:id/toggle', unifiedAuth, requirePermission('models:edit'), async (req, res) => {
  try {
    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500);
    }

    const { id } = req.params;
    const pool = getDatabase();

    // 检查型号是否存在
    const [existingModels] = await pool.execute('SELECT * FROM models WHERE id = ?', [parseInt(id)]);
    if (existingModels.length === 0) {
      return ApiResponse.notFound(res, '型号不存在');
    }

    const currentModel = existingModels[0];
    const newStatus = currentModel.status === 1 ? 0 : 1;

    // 更新状态
    await pool.execute(
      'UPDATE models SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newStatus, parseInt(id)]
    );

    // 获取更新后的数据
    const [updatedModels] = await pool.execute('SELECT * FROM models WHERE id = ?', [parseInt(id)]);
    const updatedModel = updatedModels[0];

    const statusText = newStatus === 1 ? '启用' : '禁用';
    ApiResponse.success(res, updatedModel, `型号${statusText}成功`);
  } catch (error) {
    log.error('切换型号状态失败:', error);
    log.error('错误详情:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
    ApiResponse.serverError(res, '切换型号状态失败', error);
  }
});

// 批量更新排序
router.put('/batch/reorder', unifiedAuth, requirePermission('models:edit'), async (req, res) => {
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
            'UPDATE models SET sort_order = ? WHERE id = ?',
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

module.exports = router;
