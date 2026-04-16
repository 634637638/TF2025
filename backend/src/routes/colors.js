const express = require('express');
const router = express.Router();
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth');
const { devPermissionCheck } = require('../middleware/dev-permission');
const ApiResponse = require('../utils/response');
const { getDatabase, isConnected } = require('../config/database');
const log = require('../utils/log');

// 模拟颜色数据
const mockColors = [
  {
    id: 1,
    name: '深空黑色',
    english_name: 'Space Black',
    hex_code: '#1C1C1E',
    rgb: '28, 28, 30',
    category: 'black',
    is_premium: false,
    description: '经典的深空黑色，沉稳大气',
    brand_id: null, // null表示通用颜色，可用于所有品牌
    brand_name: null,
    is_active: true,
    sort_order: 1,
    created_at: '2023-01-15T10:00:00Z',
    updated_at: '2023-01-15T10:00:00Z'
  },
  {
    id: 2,
    name: '钛金属',
    english_name: 'Titanium',
    hex_code: '#8E8E93',
    rgb: '142, 142, 147',
    category: 'gray',
    is_premium: true,
    description: '高端钛金属质感，轻量耐用',
    brand_id: 15,
    brand_name: '苹果',
    is_active: true,
    sort_order: 2,
    created_at: '2023-01-15T10:01:00Z',
    updated_at: '2023-01-15T10:01:00Z'
  },
  {
    id: 3,
    name: '粉红色',
    english_name: 'Pink',
    hex_code: '#FF3B30',
    rgb: '255, 59, 48',
    category: 'red',
    is_premium: false,
    description: '青春活力的粉红色',
    brand_id: null,
    brand_name: null,
    is_active: true,
    sort_order: 3,
    created_at: '2023-01-15T10:02:00Z',
    updated_at: '2023-01-15T10:02:00Z'
  },
  {
    id: 4,
    name: '钛紫色',
    english_name: 'Titanium Violet',
    hex_code: '#5856D6',
    rgb: '88, 86, 214',
    category: 'purple',
    is_premium: true,
    description: '三星独有的钛紫色',
    brand_id: 20,
    brand_name: '三星',
    is_active: true,
    sort_order: 4,
    created_at: '2023-01-15T10:03:00Z',
    updated_at: '2023-01-15T10:03:00Z'
  },
  {
    id: 5,
    name: '陶瓷白',
    english_name: 'Ceramic White',
    hex_code: '#F2F2F7',
    rgb: '242, 242, 247',
    category: 'white',
    is_premium: true,
    description: '温润如玉的陶瓷质感白色',
    brand_id: 17,
    brand_name: '小米',
    is_active: true,
    sort_order: 5,
    created_at: '2023-01-15T10:04:00Z',
    updated_at: '2023-01-15T10:04:00Z'
  },
  {
    id: 6,
    name: '银色',
    english_name: 'Silver',
    hex_code: '#E5E5EA',
    rgb: '229, 229, 234',
    category: 'white',
    is_premium: false,
    description: '经典银色，简洁优雅',
    brand_id: null,
    brand_name: null,
    is_active: true,
    sort_order: 6,
    created_at: '2023-01-15T10:05:00Z',
    updated_at: '2023-01-15T10:05:00Z'
  },
  {
    id: 7,
    name: '金色',
    english_name: 'Gold',
    hex_code: '#FF9500',
    rgb: '255, 149, 0',
    category: 'yellow',
    is_premium: true,
    description: '奢华金色，尊贵典雅',
    brand_id: null,
    brand_name: null,
    is_active: true,
    sort_order: 7,
    created_at: '2023-01-15T10:06:00Z',
    updated_at: '2023-01-15T10:06:00Z'
  },
  {
    id: 8,
    name: '深空蓝色',
    english_name: 'Deep Blue',
    hex_code: '#007AFF',
    rgb: '0, 122, 255',
    category: 'blue',
    is_premium: false,
    description: '深邃的蓝色，科技感十足',
    brand_id: null,
    brand_name: null,
    is_active: true,
    sort_order: 8,
    created_at: '2023-01-15T10:07:00Z',
    updated_at: '2023-01-15T10:07:00Z'
  }
];

// 获取颜色列表
router.get('/', unifiedAuth, devPermissionCheck('colors:view'), async (req, res) => {
  try {
    log.debug('获取颜色列表请求，参数:', req.query);

    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500);
    }

    const pool = getDatabase();
    const {
      page = 1,
      limit = 10000,  // 提高默认限制以支持获取所有数据
      brand_id,
      category,
      is_premium,
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

    // 先检查colors表是否存在
    try {
      await pool.execute('SELECT 1 FROM colors LIMIT 1');
    } catch (tableError) {
      log.error('colors表不存在或无权限访问:', tableError);
      // 如果表不存在，返回空结果而不是错误
      return ApiResponse.success(res, {
        colors: [],
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: 0,
          pages: 0
        }
      });
    }

    // 使用简单的查询方式，避免复杂的JOIN和参数问题
    let baseQuery = 'SELECT * FROM colors';
    let baseCountQuery = 'SELECT COUNT(*) as total FROM colors';

    // 构建WHERE条件
    const conditions = [];
    const queryParams = [];

    // 品牌筛选（null表示通用颜色）
    if (brand_id !== undefined) {
      if (brand_id === 'null' || brand_id === '') {
        conditions.push('brand_id IS NULL');
      } else {
        conditions.push('brand_id = ?');
        queryParams.push(brand_id);
      }
    }

    // 类别筛选
    if (category) {
      conditions.push('category = ?');
      queryParams.push(category);
    }

    // 是否高端筛选
    if (is_premium !== undefined) {
      const premiumFilter = is_premium === 'true' ? 1 : 0;
      conditions.push('is_premium = ?');
      queryParams.push(premiumFilter);
    }

    // 状态筛选
    let statusFilter = null;
    if (is_active !== undefined) {
      statusFilter = is_active === 'true' ? 1 : 0;
    } else if (status !== undefined) {
      statusFilter = status === 'true' ? 1 : 0;
    }
    if (statusFilter !== null) {
      conditions.push('status = ?');
      queryParams.push(statusFilter);
    }

    // 搜索 - 优先使用name参数，如果没有则使用search参数
    const searchTerm = name || search;
    if (searchTerm) {
      conditions.push('name LIKE ?');
      queryParams.push(`%${searchTerm}%`);
    }

    // 添加WHERE子句
    if (conditions.length > 0) {
      baseQuery += ' WHERE ' + conditions.join(' AND ');
      baseCountQuery += ' WHERE ' + conditions.join(' AND ');
    }

    // 排序
    const validSortColumns = ['id', 'name', 'created_at', 'updated_at', 'sort_order', 'category'];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'sort_order';
    const sortDirection = sortOrder === 'desc' ? 'DESC' : 'ASC';
    baseQuery += ` ORDER BY ${sortColumn} ${sortDirection}`;

    // 分页
    const finalQuery = `${baseQuery} LIMIT ${limitNum} OFFSET ${offset}`;

    log.debug('执行SQL查询:', finalQuery);
    log.debug('查询参数:', queryParams);

    // 执行查询
    const [colors] = await pool.execute(finalQuery, queryParams);
    const [countResult] = await pool.execute(baseCountQuery, queryParams);
    const total = countResult[0].total;

    log.debug(`查询结果: ${colors.length} 条记录，总数: ${total}`);

    ApiResponse.success(res, {
      colors: colors,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    log.error('获取颜色列表失败:', error);
    log.error('错误详情:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
    ApiResponse.serverError(res, '获取颜色列表失败', error);
  }
});

// 获取单个颜色详情
router.get('/:id', unifiedAuth, requirePermission('colors:view'), (req, res) => {
  try {
    const { id } = req.params;
    const color = mockColors.find(c => c.id === parseInt(id));

    if (!color) {
      return ApiResponse.notFound(res, '颜色不存在');
    }

    ApiResponse.success(res, color);
  } catch (error) {
    log.error('获取颜色详情失败:', error);
    ApiResponse.serverError(res, '获取颜色详情失败', error);
  }
});

// 创建颜色
router.post('/', unifiedAuth, requirePermission('colors:create'), async (req, res) => {
  try {
    log.debug('创建颜色请求，数据:', req.body);

    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500);
    }

    const pool = getDatabase();
    const {
      name,
      status,
      sort_order
    } = req.body;

    // 验证必需字段 - 只验证数据库中实际存在的字段
    if (!name) {
      return ApiResponse.badRequest(res, '颜色名称不能为空');
    }

    // 检查颜色名称是否重复
    const [existingColors] = await pool.execute(
      'SELECT id FROM colors WHERE name = ?',
      [name]
    );
    if (existingColors.length > 0) {
      return ApiResponse.badRequest(res, '颜色名称已存在');
    }

    // 插入新颜色
    const insertQuery = `
      INSERT INTO colors (
        name, status, sort_order, created_at, updated_at
      ) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;

    const insertValues = [
      name,
      status || 1,
      sort_order || 0
    ];

    log.debug('执行插入SQL:', insertQuery);
    log.debug('插入参数:', insertValues);

    const [result] = await pool.execute(insertQuery, insertValues);

    // 获取新创建的颜色
    const [newColors] = await pool.execute('SELECT * FROM colors WHERE id = ?', [result.insertId]);
    const newColor = newColors[0];

    ApiResponse.created(res, '颜色创建成功', newColor);
  } catch (error) {
    log.error('创建颜色失败:', error);
    log.error('错误详情:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
    ApiResponse.serverError(res, '创建颜色失败', error);
  }
});

// 更新颜色
router.put('/:id', unifiedAuth, requirePermission('colors:edit'), async (req, res) => {
  try {
    const { id } = req.params;

    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500);
    }

    const pool = getDatabase();
    const {
      name,
      status,
      sort_order
    } = req.body;

    // 检查颜色是否存在
    const [existingColors] = await pool.execute('SELECT id FROM colors WHERE id = ?', [id]);
    if (existingColors.length === 0) {
      return ApiResponse.notFound(res, '颜色不存在');
    }

    // 检查颜色名称是否重复（排除当前颜色）
    if (name) {
      const [duplicateCheck] = await pool.execute(
        'SELECT id FROM colors WHERE name = ? AND id != ?',
        [name, id]
      );
      if (duplicateCheck.length > 0) {
        return ApiResponse.badRequest(res, '颜色名称已存在');
      }
    }

    // 构建更新字段 - 只使用数据库中实际存在的字段
    const updateFields = [];
    const updateValues = [];

    if (name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(name);
    }

    // 处理status字段（使用正确的字段名）
    if (status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(parseInt(status));
    }

    if (sort_order !== undefined) {
      updateFields.push('sort_order = ?');
      updateValues.push(parseInt(sort_order));
    }

    if (updateFields.length === 0) {
      return ApiResponse.badRequest(res, '没有提供要更新的字段');
    }

    // 添加更新时间
    updateFields.push('updated_at = NOW()');
    updateValues.push(id); // 为WHERE子句添加id

    // 执行更新
    const updateQuery = `UPDATE colors SET ${updateFields.join(', ')} WHERE id = ?`;
    await pool.execute(updateQuery, updateValues);

    // 获取更新后的颜色信息
    const [updatedColor] = await pool.execute('SELECT * FROM colors WHERE id = ?', [id]);

    ApiResponse.success(res, updatedColor[0], '颜色更新成功');
  } catch (error) {
    log.error('更新颜色失败:', error);
    ApiResponse.serverError(res, '更新颜色失败', error);
  }
});

// 删除颜色
router.delete('/:id', unifiedAuth, requirePermission('colors:delete'), async (req, res) => {
  try {
    log.debug('删除颜色请求，ID:', req.params.id);

    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500);
    }

    const { id } = req.params;
    const pool = getDatabase();

    // 检查颜色是否存在
    const [existingColors] = await pool.execute('SELECT * FROM colors WHERE id = ?', [parseInt(id)]);
    if (existingColors.length === 0) {
      return ApiResponse.notFound(res, '颜色不存在');
    }

    // 删除颜色
    await pool.execute('DELETE FROM colors WHERE id = ?', [parseInt(id)]);

    ApiResponse.success(res, existingColors[0], '颜色删除成功');
  } catch (error) {
    log.error('删除颜色失败:', error);
    log.error('错误详情:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
    ApiResponse.serverError(res, '删除颜色失败', error);
  }
});

// 获取颜色统计信息
router.get('/stats/overview', unifiedAuth, requirePermission('colors:view'), (req, res) => {
  try {
    const { brand_id } = req.query;

    let colorsForStats = [...mockColors];
    if (brand_id !== undefined) {
      if (brand_id === 'null' || brand_id === '') {
        colorsForStats = colorsForStats.filter(color => color.brand_id === null);
      } else {
        colorsForStats = colorsForStats.filter(color => color.brand_id === parseInt(brand_id));
      }
    }

    const stats = {
      total: colorsForStats.length,
      active: colorsForStats.filter(c => c.is_active).length,
      inactive: colorsForStats.filter(c => !c.is_active).length,
      premium: colorsForStats.filter(c => c.is_premium).length,
      standard: colorsForStats.filter(c => !c.is_premium).length,
      byCategory: {},
      byBrand: {},
      genericColors: colorsForStats.filter(c => c.brand_id === null).length,
      brandSpecific: colorsForStats.filter(c => c.brand_id !== null).length
    };

    // 按类别统计
    colorsForStats.forEach(color => {
      stats.byCategory[color.category] = (stats.byCategory[color.category] || 0) + 1;
      if (color.brand_id) {
        stats.byBrand[color.brand_name || `品牌${color.brand_id}`] =
          (stats.byBrand[color.brand_name || `品牌${color.brand_id}`] || 0) + 1;
      }
    });

    ApiResponse.success(res, stats);
  } catch (error) {
    log.error('获取颜色统计失败:', error);
    ApiResponse.serverError(res, '获取颜色统计失败', error);
  }
});

// 切换颜色状态
router.patch('/:id/toggle', unifiedAuth, requirePermission('colors:edit'), (req, res) => {
  try {
    const { id } = req.params;
    const colorIndex = mockColors.findIndex(c => c.id === parseInt(id));

    if (colorIndex === -1) {
      return ApiResponse.notFound(res, '颜色不存在');
    }

    mockColors[colorIndex].is_active = !mockColors[colorIndex].is_active;
    mockColors[colorIndex].updated_at = new Date().toISOString();

    const statusText = mockColors[colorIndex].is_active ? '启用' : '禁用';
    ApiResponse.success(res, mockColors[colorIndex], `颜色${statusText}成功`);
  } catch (error) {
    log.error('切换颜色状态失败:', error);
    ApiResponse.serverError(res, '切换颜色状态失败', error);
  }
});

// 获取颜色类别列表
router.get('/categories/list', unifiedAuth, requirePermission('colors:view'), (req, res) => {
  try {
    const categories = [
      { value: 'black', label: '黑色系' },
      { value: 'white', label: '白色系' },
      { value: 'gray', label: '灰色系' },
      { value: 'blue', label: '蓝色系' },
      { value: 'red', label: '红色系' },
      { value: 'green', label: '绿色系' },
      { value: 'yellow', label: '黄色系' },
      { value: 'purple', label: '紫色系' },
      { value: 'orange', label: '橙色系' },
      { value: 'brown', label: '棕色系' },
      { value: 'other', label: '其他' }
    ];

    ApiResponse.success(res, categories);
  } catch (error) {
    log.error('获取颜色类别失败:', error);
    ApiResponse.serverError(res, '获取颜色类别失败', error);
  }
});

// 批量更新排序
router.put('/batch/reorder', unifiedAuth, requirePermission('colors:edit'), async (req, res) => {
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
            'UPDATE colors SET sort_order = ? WHERE id = ?',
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

module.exports = router;
