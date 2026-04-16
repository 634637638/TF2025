const express = require('express');
const router = express.Router();
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth');
const { devPermissionCheck } = require('../middleware/dev-permission');
const ApiResponse = require('../utils/response');
const { getDatabase, isConnected } = require('../config/database');
const log = require('../utils/log');


// 获取内存规格列表
router.get('/', unifiedAuth, devPermissionCheck('memories:view'), async (req, res) => {
  try {
    log.debug('获取内存规格列表请求，参数:', req.query);

    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500);
    }

    const pool = getDatabase();
    const {
      page = 1,
      limit = 10000,  // 提高默认限制以支持获取所有数据
      storage_unit,
      is_active,
      search,
      sortBy = 'sort_order',
      sortOrder = 'asc'
    } = req.query;

    const limitNum = parseInt(limit) || 10000;  // 提高默认限制
    const pageNum = parseInt(page) || 1;
    const offset = (pageNum - 1) * limitNum;

    // 先检查memories表是否存在
    try {
      await pool.execute('SELECT 1 FROM memories LIMIT 1');
    } catch (tableError) {
      log.error('memories表不存在或无权限访问:', tableError);
      // 如果表不存在，返回空结果而不是错误
      return ApiResponse.success(res, {
        memories: [],
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: 0,
          pages: 0
        }
      });
    }

    // 使用简单的查询方式，避免复杂的JOIN和参数问题
    let baseQuery = 'SELECT * FROM memories';
    let baseCountQuery = 'SELECT COUNT(*) as total FROM memories';

    // 构建WHERE条件
    const conditions = [];
    const queryParams = [];

    // 存储单位筛选（从size字段中提取）
    if (storage_unit) {
      conditions.push('size LIKE ?');
      queryParams.push(`%${storage_unit}`);
    }

    // 状态筛选
    let statusFilter = null;
    if (is_active !== undefined) {
      statusFilter = is_active === 'true' ? 1 : 0;
    }
    if (statusFilter !== null) {
      conditions.push('status = ?');
      queryParams.push(statusFilter);
    }

    // 搜索（基于size字段）
    if (search) {
      conditions.push('size LIKE ?');
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm);
    }

    // 添加WHERE子句
    if (conditions.length > 0) {
      baseQuery += ' WHERE ' + conditions.join(' AND ');
      baseCountQuery += ' WHERE ' + conditions.join(' AND ');
    }

    // 排序
    const validSortColumns = ['id', 'size', 'created_at', 'updated_at', 'sort_order', 'status'];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'sort_order';
    const sortDirection = sortOrder === 'desc' ? 'DESC' : 'ASC';
    baseQuery += ` ORDER BY ${sortColumn} ${sortDirection}`;

    // 分页
    const finalQuery = `${baseQuery} LIMIT ${limitNum} OFFSET ${offset}`;

    log.debug('执行SQL查询:', finalQuery);
    log.debug('查询参数:', queryParams);

    // 执行查询
    const [memories] = await pool.execute(finalQuery, queryParams);
    const [countResult] = await pool.execute(baseCountQuery, queryParams);
    const total = countResult[0].total;

    log.debug(`查询结果: ${memories.length} 条记录，总数: ${total}`);

    // 转换数据格式以匹配前端期望的结构
    const formattedMemories = memories.map(memory => {
      const sizeValue = memory.size || '';

      // 解析size字段，支持两种格式：
      // 1. 纯存储格式：如 "64GB"、"128GB"、"256GB"、"6+128" 等
      // 2. 组合格式：如 "6+128GB"、"8+256GB" 等
      let storageSize = null;
      let storageUnit = 'GB';
      let isCombo = false;

      if (sizeValue) {
        // 检查是否是组合格式（包含+号）
        if (sizeValue.includes('+')) {
          isCombo = true;
          // 对于组合格式，提取存储部分（+后面的部分）
          const parts = sizeValue.split('+');
          if (parts.length >= 2) {
            const storagePart = parts[1];
            const storageMatch = storagePart.match(/^(\d+)([A-Z]*)$/);
            if (storageMatch) {
              storageSize = parseInt(storageMatch[1]);
              storageUnit = storageMatch[2] || 'GB';
            } else {
              // 如果没有单位，默认为GB
              storageSize = parseInt(storagePart) || null;
              storageUnit = 'GB';
            }
          }
        } else {
          // 纯存储格式
          const sizeMatch = sizeValue.match(/^(\d+)([A-Z]+)$/);
          if (sizeMatch) {
            storageSize = parseInt(sizeMatch[1]);
            storageUnit = sizeMatch[2];
          } else {
            // 如果没有单位，可能是纯数字或"6+128"格式
            const numberMatch = sizeValue.match(/^(\d+)$/);
            if (numberMatch) {
              storageSize = parseInt(numberMatch[1]);
              storageUnit = 'GB';
            } else {
              // 尝试解析"6+128"格式
              const comboMatch = sizeValue.match(/^(\d+)\+(\d+)$/);
              if (comboMatch) {
                isCombo = true;
                storageSize = parseInt(comboMatch[2]);
                storageUnit = 'GB';
              }
            }
          }
        }
      }

      // 计算价格倍数（基于存储大小和是否为组合格式）
      let priceMultiplier = 1.0;
      if (storageSize) {
        if (isCombo) {
          // 组合格式的价格倍数更高
          if (storageUnit === 'TB') {
            priceMultiplier = storageSize * 2.5;
          } else {
            // GB存储价格递增，组合格式有额外加成
            if (storageSize <= 64) priceMultiplier = 1.2;
            else if (storageSize <= 128) priceMultiplier = 1.3;
            else if (storageSize <= 256) priceMultiplier = 1.4;
            else if (storageSize <= 512) priceMultiplier = 1.6;
            else priceMultiplier = 2.2;
          }
        } else {
          // 纯存储格式
          if (storageUnit === 'TB') {
            priceMultiplier = storageSize * 2.0; // TB存储更贵
          } else {
            // GB存储价格递增
            if (storageSize <= 32) priceMultiplier = 0.8;
            else if (storageSize <= 64) priceMultiplier = 1.0;
            else if (storageSize <= 128) priceMultiplier = 1.1;
            else if (storageSize <= 256) priceMultiplier = 1.25;
            else if (storageSize <= 512) priceMultiplier = 1.5;
            else priceMultiplier = 2.0;
          }
        }
      }

      // 构建显示名称和描述
      let display_name = sizeValue || '未命名';
      let description = '';

      if (isCombo) {
        description = `${sizeValue} 内存+存储组合`;
      } else {
        description = `${sizeValue} 存储空间`;
      }

      return {
        id: memory.id,
        name: sizeValue || '未命名规格',
        size: sizeValue, // 保持原始值
        storage_size: storageSize,
        storage_unit: storageUnit,
        display_name: display_name,
        description: description,
        price_multiplier: priceMultiplier,
        is_combo: isCombo, // 新增字段标识是否为组合格式
        status: memory.status || 1,
        is_active: Boolean(memory.status),
        sort_order: memory.sort_order || memory.id,
        created_at: memory.created_at,
        updated_at: memory.updated_at
      };
    });

    ApiResponse.success(res, {
      memories: formattedMemories,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    log.error('获取内存规格列表失败:', error);
    log.error('错误详情:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
    ApiResponse.serverError(res, '获取内存规格列表失败', error);
  }
});

// 获取单个内存规格详情
router.get('/:id', unifiedAuth, requirePermission('memories:view'), async (req, res) => {
  try {
    log.debug('获取内存规格详情请求，ID:', req.params.id);

    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500);
    }

    const { id } = req.params;
    const pool = getDatabase();

    const [memories] = await pool.execute('SELECT * FROM memories WHERE id = ?', [parseInt(id)]);

    if (memories.length === 0) {
      return ApiResponse.notFound(res, '内存规格不存在');
    }

    ApiResponse.success(res, memories[0]);
  } catch (error) {
    log.error('获取内存规格详情失败:', error);
    log.error('错误详情:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
    ApiResponse.serverError(res, '获取内存规格详情失败', error);
  }
});

// 创建内存规格
router.post('/', unifiedAuth, requirePermission('memories:create'), async (req, res) => {
  try {
    log.debug('创建内存规格请求，数据:', req.body);

    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500);
    }

    const pool = getDatabase();
    const {
      size, // 前端发送的字段，如 "6+128GB" 或 "64GB"
      sort_order,
      status
    } = req.body;

    // 验证必需字段
    if (!size) {
      return ApiResponse.badRequest(res, '内存规格不能为空');
    }

    // 验证格式：支持数字+字母格式，如 "64GB"、"8+128GB"、"6+256GB" 等
    // 更严格的验证：必须是数字开头，后面跟着字母，中间可以有+号连接
    const validFormat = /^(\d+[a-zA-Z]+|\d+\+\d+[a-zA-Z]*)$/;
    const trimmedSize = size.trim();

    if (!validFormat.test(trimmedSize)) {
      return ApiResponse.badRequest(res,
        '内存规格格式不正确！\n' +
        '正确格式示例：\n' +
        '• 纯存储：64GB、128GB、256GB、512GB\n' +
        '• 组合格式：6+128GB、8+256GB、12+512GB\n' +
        '• 不能包含中文或特殊字符（除+号外）'
      );
    }

    // 额外检查：确保不包含中文字符
    if (/[\u4e00-\u9fa5]/.test(trimmedSize)) {
      return ApiResponse.badRequest(res, '内存规格不能包含中文字符，请使用如：64GB、8+128GB 等格式');
    }

    // 检查是否有无效的字符（只允许数字、字母、+号）
    if (!/^[0-9a-zA-Z+]+$/.test(trimmedSize)) {
      return ApiResponse.badRequest(res, '内存规格包含无效字符，只能使用数字、字母和+号');
    }

    // 先检查memories表是否存在
    try {
      await pool.execute('SELECT 1 FROM memories LIMIT 1');
    } catch (tableError) {
      log.error('memories表不存在或无权限访问:', tableError);
      return ApiResponse.error(res, 'memories表不存在或无权限访问', 500);
    }

    // 检查规格是否重复
    const [existingMemories] = await pool.execute(
      'SELECT id FROM memories WHERE size = ?',
      [size]
    );
    if (existingMemories.length > 0) {
      return ApiResponse.badRequest(res, '该内存规格已存在');
    }

    // 插入新内存规格
    const insertQuery = `
      INSERT INTO memories (
        size, sort_order, status, created_at, updated_at
      ) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;

    const insertValues = [
      size,
      sort_order ? parseInt(sort_order) : 0,
      status !== undefined ? parseInt(status) : 1
    ];

    log.debug('执行插入SQL:', insertQuery);
    log.debug('插入参数:', insertValues);

    const [result] = await pool.execute(insertQuery, insertValues);

    // 获取新创建的内存规格
    const [newMemories] = await pool.execute('SELECT * FROM memories WHERE id = ?', [result.insertId]);
    const newMemory = newMemories[0];

    ApiResponse.created(res, '内存规格创建成功', newMemory);
  } catch (error) {
    log.error('创建内存规格失败:', error);
    log.error('错误详情:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
    ApiResponse.serverError(res, '创建内存规格失败', error);
  }
});

// 更新内存规格
router.put('/:id', unifiedAuth, requirePermission('memories:edit'), async (req, res) => {
  try {
    const { id } = req.params;

    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500);
    }

    const pool = getDatabase();
    const {
      size, // 前端发送的字段，如 "6+128GB" 或 "64GB"
      sort_order,
      status
    } = req.body;

    // 如果提供了size字段，验证格式
    if (size !== undefined) {
      // 更严格的验证：必须是数字开头，后面跟着字母，中间可以有+号连接
      const validFormat = /^(\d+[a-zA-Z]+|\d+\+\d+[a-zA-Z]*)$/;
      const trimmedSize = size.trim();

      if (!validFormat.test(trimmedSize)) {
        return ApiResponse.badRequest(res,
          '内存规格格式不正确！\n' +
          '正确格式示例：\n' +
          '• 纯存储：64GB、128GB、256GB、512GB\n' +
          '• 组合格式：6+128GB、8+256GB、12+512GB\n' +
          '• 不能包含中文或特殊字符（除+号外）'
        );
      }

      // 额外检查：确保不包含中文字符
      if (/[\u4e00-\u9fa5]/.test(trimmedSize)) {
        return ApiResponse.badRequest(res, '内存规格不能包含中文字符，请使用如：64GB、8+128GB 等格式');
      }

      // 检查是否有无效的字符（只允许数字、字母、+号）
      if (!/^[0-9a-zA-Z+]+$/.test(trimmedSize)) {
        return ApiResponse.badRequest(res, '内存规格包含无效字符，只能使用数字、字母和+号');
      }
    }

    // 检查内存是否存在
    const [existingMemories] = await pool.execute('SELECT id FROM memories WHERE id = ?', [id]);
    if (existingMemories.length === 0) {
      return ApiResponse.notFound(res, '内存规格不存在');
    }

    // 获取当前内存的size值，用于后续比较
    const [currentMemory] = await pool.execute('SELECT size FROM memories WHERE id = ?', [id]);
    const currentSize = currentMemory[0]?.size;

    // 构建更新字段
    const updateFields = [];
    const updateValues = [];

    // 如果size有变化，检查是否与其他记录重复
    if (size !== undefined && size !== currentSize) {
      const [duplicateCheck] = await pool.execute(
        'SELECT id FROM memories WHERE size = ? AND id != ?',
        [size, id]
      );

      if (duplicateCheck.length > 0) {
        return ApiResponse.error(res, `已有存在${size}内存，请勿重复提交`, 409);
      }

      updateFields.push('size = ?');
      updateValues.push(size);
    }

    if (sort_order !== undefined) {
      updateFields.push('sort_order = ?');
      updateValues.push(parseInt(sort_order));
    }

    if (status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(parseInt(status));
    }

    if (updateFields.length === 0) {
      return ApiResponse.badRequest(res, '没有提供要更新的字段');
    }

    // 添加更新时间
    updateFields.push('updated_at = NOW()');
    updateValues.push(id); // 为WHERE子句添加id

    // 执行更新
    const updateQuery = `UPDATE memories SET ${updateFields.join(', ')} WHERE id = ?`;
    await pool.execute(updateQuery, updateValues);

    // 获取更新后的内存规格信息
    const [updatedMemory] = await pool.execute('SELECT * FROM memories WHERE id = ?', [id]);

    return ApiResponse.success(res, updatedMemory[0], '内存规格更新成功');
  } catch (error) {
    log.error('更新内存规格失败:', error);

    // 检查是否是唯一索引冲突错误
    if (error.code === 'ER_DUP_ENTRY' || error.code === 'DUPLICATE_ENTRY' || error.errno === 1062) {
      return ApiResponse.error(res, `已有存在该内存规格，请勿重复提交`, 409);
    }

    ApiResponse.serverError(res, '更新内存规格失败', error);
  }
});

// 删除内存规格
router.delete('/:id', unifiedAuth, requirePermission('memories:delete'), async (req, res) => {
  try {
    log.debug('删除内存规格请求，ID:', req.params.id);

    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500);
    }

    const { id } = req.params;
    const pool = getDatabase();

    // 检查内存规格是否存在
    const [existingMemories] = await pool.execute('SELECT * FROM memories WHERE id = ?', [parseInt(id)]);
    if (existingMemories.length === 0) {
      return ApiResponse.notFound(res, '内存规格不存在');
    }

    // 删除内存规格
    await pool.execute('DELETE FROM memories WHERE id = ?', [parseInt(id)]);

    ApiResponse.success(res, existingMemories[0], '内存规格删除成功');
  } catch (error) {
    log.error('删除内存规格失败:', error);
    log.error('错误详情:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
    ApiResponse.serverError(res, '删除内存规格失败', error);
  }
});

// 获取内存规格统计信息
router.get('/stats/overview', unifiedAuth, requirePermission('memories:view'), async (req, res) => {
  try {
    log.debug('获取内存规格统计信息请求，参数:', req.query);

    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500);
    }

    const pool = getDatabase();

    const [memories] = await pool.execute('SELECT * FROM memories');

    const stats = {
      total: memories.length,
      active: memories.filter(m => m.status === 1).length,
      inactive: memories.filter(m => m.status === 0).length,
      bySize: {},
      avgSortOrder: memories.length > 0
        ? memories.reduce((sum, m) => sum + (m.sort_order || 0), 0) / memories.length
        : 0,
      newestMemory: memories.length > 0
        ? memories.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0].name
        : null
    };

    // 按容量统计
    memories.forEach(memory => {
      const size = memory.size || '未知';
      stats.bySize[size] = (stats.bySize[size] || 0) + 1;
    });

    ApiResponse.success(res, stats);
  } catch (error) {
    log.error('获取内存规格统计失败:', error);
    log.error('错误详情:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
    ApiResponse.serverError(res, '获取内存规格统计失败', error);
  }
});

// 切换内存规格状态
router.patch('/:id/toggle', unifiedAuth, requirePermission('memories:edit'), async (req, res) => {
  try {
    log.debug('切换内存规格状态请求，ID:', req.params.id);

    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500);
    }

    const { id } = req.params;
    const pool = getDatabase();

    // 检查内存规格是否存在
    const [existingMemories] = await pool.execute('SELECT * FROM memories WHERE id = ?', [parseInt(id)]);
    if (existingMemories.length === 0) {
      return ApiResponse.notFound(res, '内存规格不存在');
    }

    const currentMemory = existingMemories[0];
    const newStatus = currentMemory.status === 1 ? 0 : 1;

    // 更新状态
    await pool.execute(
      'UPDATE memories SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newStatus, parseInt(id)]
    );

    // 获取更新后的数据
    const [updatedMemories] = await pool.execute('SELECT * FROM memories WHERE id = ?', [parseInt(id)]);
    const updatedMemory = updatedMemories[0];

    const statusText = newStatus === 1 ? '启用' : '禁用';
    ApiResponse.success(res, updatedMemory, `内存规格${statusText}成功`);
  } catch (error) {
    log.error('切换内存规格状态失败:', error);
    log.error('错误详情:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
    ApiResponse.serverError(res, '切换内存规格状态失败', error);
  }
});

// 获取存储单位列表
router.get('/units/list', unifiedAuth, requirePermission('memories:view'), (req, res) => {
  try {
    const units = [
      { value: 'GB', label: 'GB (吉字节)', description: '吉字节，常用存储单位' },
      { value: 'TB', label: 'TB (太字节)', description: '太字节，大容量存储单位' }
    ];

    ApiResponse.success(res, units);
  } catch (error) {
    log.error('获取存储单位列表失败:', error);
    ApiResponse.serverError(res, '获取存储单位列表失败', error);
  }
});

// 批量更新排序
router.put('/batch/reorder', unifiedAuth, requirePermission('memories:edit'), async (req, res) => {
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
            'UPDATE memories SET sort_order = ? WHERE id = ?',
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

// 临时公开路由：添加缺失的内存规格（用于初始化）
router.post('/init-missing', async (req, res) => {
  try {
    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500);
    }

    const pool = getDatabase();

    // 定义需要添加的内存规格（使用正确格式：1TB, 2TB）
    const missingMemories = [
      { size: '16GB', sort_order: 16 },
      { size: '32GB', sort_order: 32 },
      { size: '64GB', sort_order: 64 },
      { size: '1TB', sort_order: 1024 },
      { size: '2TB', sort_order: 2048 }
    ];

    let addedCount = 0;
    for (const mem of missingMemories) {
      const [existing] = await pool.query('SELECT id FROM memories WHERE size = ?', [mem.size]);
      if (existing.length === 0) {
        await pool.query(
          'INSERT INTO memories (size, sort_order, status, created_at) VALUES (?, ?, 1, NOW())',
          [mem.size, mem.sort_order]
        );
        addedCount++;
        log.debug('✅ 添加内存规格:', mem.size);
      } else {
        log.debug('ℹ️  内存规格已存在:', mem.size);
      }
    }

    const [allMemories] = await pool.query('SELECT size, id FROM memories ORDER BY sort_order');

    return ApiResponse.success(res, {
      added: addedCount,
      total: allMemories.length,
      memories: allMemories
    }, `成功添加 ${addedCount} 个内存规格`);

  } catch (error) {
    log.error('添加内存规格失败:', error);
    return ApiResponse.error(res, '添加失败: ' + error.message, 500);
  }
});

module.exports = router;
