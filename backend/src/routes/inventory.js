const express = require('express');
const router = express.Router();
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth');
const ApiResponse = require('../utils/response');
const { getDatabase, isConnected } = require('../config/database');
const { normalizeDateTime } = require('../utils/time');
const { generateMemberNumber } = require('../utils/member-number');
const log = require('../utils/log');

const mockInventory = [
  {
    id: 1,
    phone_id: 1,
    phone_imei: '4901542032375185',
    model_name: 'iPhone 15 Pro',
    brand_name: 'Apple',
    store_id: 1,
    store_name: '总店',
    current_stock: 5,
    available_stock: 5,
    reserved_stock: 0,
    min_stock_level: 3,
    max_stock_level: 20,
    reorder_point: 5,
    unit_cost: 7500.00,
    total_value: 37500.00,
    last_stock_in: '2024-01-15T10:30:00Z',
    last_stock_out: null,
    stock_status: 'normal', // normal, low, overstock, out_of_stock
    notes: '库存充足',
    Inventorytime: '2024-01-15T10:30:00Z',
    salestime: null
  },
  {
    id: 2,
    phone_id: 2,
    phone_imei: '4901542032375186',
    model_name: 'iPhone 15 Pro',
    brand_name: 'Apple',
    store_id: 1,
    store_name: '总店',
    current_stock: 3,
    available_stock: 3,
    reserved_stock: 0,
    min_stock_level: 2,
    max_stock_level: 15,
    reorder_point: 4,
    unit_cost: 9200.00,
    total_value: 27600.00,
    last_stock_in: '2024-01-15T10:31:00Z',
    last_stock_out: null,
    stock_status: 'normal',
    notes: '库存正常',
    Inventorytime: '2024-01-15T10:31:00Z',
    salestime: null
  },
  {
    id: 3,
    phone_id: 4,
    phone_imei: '4901542032375188',
    model_name: 'Galaxy S24 Ultra',
    brand_name: 'Samsung',
    store_id: 1,
    store_name: '总店',
    current_stock: 1,
    available_stock: 1,
    reserved_stock: 0,
    min_stock_level: 2,
    max_stock_level: 10,
    reorder_point: 3,
    unit_cost: 11000.00,
    total_value: 11000.00,
    last_stock_in: '2024-01-20T11:45:00Z',
    last_stock_out: null,
    stock_status: 'low',
    notes: '库存偏低，建议补货',
    Inventorytime: '2024-01-20T11:45:00Z',
    salestime: null
  },
  {
    id: 4,
    phone_id: 5,
    phone_imei: '4901542032375189',
    model_name: 'Xiaomi 14 Pro',
    brand_name: 'Xiaomi',
    store_id: 2,
    store_name: '分店A',
    current_stock: 0,
    available_stock: 0,
    reserved_stock: 0,
    min_stock_level: 3,
    max_stock_level: 15,
    reorder_point: 5,
    unit_cost: 4300.00,
    total_value: 0.00,
    last_stock_in: '2024-01-22T16:30:00Z',
    last_stock_out: '2024-01-23T14:20:00Z',
    stock_status: 'out_of_stock',
    notes: '缺货，急需补货',
    Inventorytime: '2024-01-22T16:30:00Z',
    salestime: '2024-01-28T14:20:00Z'
  }
];

// 模拟库存变动记录
const mockStockMovements = [
  {
    id: 1,
    inventory_id: 1,
    movement_type: 'stock_in',
    quantity: 5,
    reference_type: 'purchase',
    reference_id: 'PO20240115001',
    reason: '采购入库',
    operator_id: 1,
    operator_name: '张三',
    movement_date: '2024-01-15T10:30:00Z',
    Inventorytime: '2024-01-15T10:30:00Z'
  },
  {
    id: 2,
    inventory_id: 2,
    movement_type: 'stock_in',
    quantity: 3,
    reference_type: 'purchase',
    reference_id: 'PO20240115002',
    reason: '采购入库',
    operator_id: 1,
    operator_name: '张三',
    movement_date: '2024-01-15T10:31:00Z',
    Inventorytime: '2024-01-15T10:31:00Z'
  },
  {
    id: 3,
    inventory_id: 4,
    movement_type: 'stock_out',
    quantity: 1,
    reference_type: 'sale',
    reference_id: 'SO20240123001',
    reason: '销售出库',
    operator_id: 2,
    operator_name: '李四',
    movement_date: '2024-01-23T14:20:00Z',
    Inventorytime: '2024-01-23T14:20:00Z'
  }
];

// 获取库存列表
router.get('/list', unifiedAuth, requirePermission('inventory:view'), async (req, res) => {
  let connection;
  try {
    const { getDatabase } = require('../config/database');
    const pool = getDatabase();

    if (!pool) {
      return ApiResponse.error(res, '数据库连接池未初始化', 500);
    }

    connection = await pool.getConnection();

    const {
      page = 1,
      limit = 20,
      store_id,
      supplier_id,
      operator_id,
      status,
      search,
      brand,
      model,
      color,
      memory,
      is_new,
      date,
      date_start,
      date_end
    } = req.query;

    const validLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 100);
    const validPage = Math.max(parseInt(page) || 1, 1);
    const offset = (validPage - 1) * validLimit;

    // 构建WHERE条件
    let whereConditions = ['p.status = "in_stock"'];
    let queryParams = [];

    // 店铺筛选
    if (store_id) {
      whereConditions.push('p.store_id = ?');
      queryParams.push(parseInt(store_id));
    }

    // 供应商筛选
    if (supplier_id) {
      whereConditions.push('p.supplier_id = ?');
      queryParams.push(parseInt(supplier_id));
    }

    // 入库员筛选
    if (operator_id) {
      whereConditions.push('p.inventory_operator_id = ?');
      queryParams.push(parseInt(operator_id));
    }

    // 状态筛选
    if (status) {
      whereConditions.push('p.status = ?');
      queryParams.push(status);
    }

    // 品牌筛选
    if (brand) {
      whereConditions.push('b.name = ?');
      queryParams.push(brand);
    }

    // 型号筛选
    if (model) {
      whereConditions.push('m.name = ?');
      queryParams.push(model);
    }

    // 颜色筛选
    if (color) {
      whereConditions.push('co.name = ?');
      queryParams.push(color);
    }

    // 内存筛选
    if (memory) {
      whereConditions.push('mem.size = ?');
      queryParams.push(memory);
    }

    // 成色筛选
    if (is_new !== undefined && is_new !== null && is_new !== '') {
      const isNewValue = is_new === 'true' || is_new === true || is_new === '1';
      whereConditions.push('p.is_new = ?');
      queryParams.push(isNewValue ? 1 : 0);
    }

    // 日期范围筛选
    if (date) {
      log.debug('🗓️ 处理日期筛选:', date);

      // 支持多种日期格式：YYYY-MM-DD 或 YYYY-MM-DD - YYYY-MM-DD
      if (date.includes(' - ')) {
        // 日期范围格式：YYYY-MM-DD - YYYY-MM-DD
        const [startDate, endDate] = date.split(' - ').map(d => d.trim());
        if (startDate) {
          whereConditions.push('DATE(p.Inventorytime) >= ?');
          queryParams.push(startDate);
        }
        if (endDate) {
          whereConditions.push('DATE(p.Inventorytime) <= ?');
          queryParams.push(endDate);
        }
        log.debug(`📅 日期范围筛选: ${startDate} 到 ${endDate}`);
      } else if (date.includes('-')) {
        // 单个日期格式：YYYY-MM-DD
        whereConditions.push('DATE(p.Inventorytime) = ?');
        queryParams.push(date);
        log.debug(`📅 单日筛选: ${date}`);
      }
    } else if (date_start || date_end) {
      // 新的日期范围筛选
      log.debug(`🔍 接收到日期参数: date_start='${date_start}', date_end='${date_end}'`);
      if (date_start && date_end) {
        // 同时有开始和结束日期
        whereConditions.push('DATE(p.Inventorytime) BETWEEN ? AND ?');
        queryParams.push(date_start, date_end);
        log.debug(`🔍 日期范围筛选: ${date_start} - ${date_end}`);
      } else if (date_start) {
        // 只有开始日期
        whereConditions.push('DATE(p.Inventorytime) >= ?');
        queryParams.push(date_start);
        log.debug(`🔍 日期筛选: 从 ${date_start} 开始`);
      } else if (date_end) {
        // 只有结束日期
        whereConditions.push('DATE(p.Inventorytime) <= ?');
        queryParams.push(date_end);
        log.debug(`🔍 日期筛选: 到 ${date_end} 结束`);
      }
    }

    // 智能搜索功能 - 支持所有字段的智能识别
    if (search) {
      const searchStr = search.trim();

      // IMEI 精确匹配 (15位数字)
      if (/^\d{15}$/.test(searchStr)) {
        whereConditions.push('p.imei = ?');
        queryParams.push(searchStr);
      }
      // 序列号精确匹配 (字母数字组合)
      else if (/^[A-Za-z0-9]{8,}$/.test(searchStr)) {
        whereConditions.push('UPPER(p.serial_number) LIKE ?');
        queryParams.push(`%${searchStr.toUpperCase()}%`);
      }
      // 内存规格匹配 (如 256GB, 512GB, 1TB)
      else if (/^(\d+[Gg][Bb]|1[Tt][Bb])$/.test(searchStr)) {
        whereConditions.push('UPPER(mem.size) LIKE ?');
        queryParams.push(`%${searchStr.toUpperCase()}%`);
      }
      // 状态匹配 (英文状态)
      else if (['available', 'sold', 'reserved', 'repair', 'lost'].includes(searchStr.toLowerCase())) {
        whereConditions.push('p.status = ?');
        queryParams.push(searchStr.toLowerCase());
      }
      // 状态匹配 (中文状态)
      else if (['可用', '已售', '预定', '维修', '丢失', '在库'].includes(searchStr)) {
        const statusMap = {
          '可用': 'available',
          '已售': 'sold',
          '预定': 'reserved',
          '维修': 'repair',
          '丢失': 'lost',
          '在库': 'available'
        };
        whereConditions.push('p.status = ?');
        queryParams.push(statusMap[searchStr]);
      }
      // 成色匹配
      else if (['new', 'used', '全新', '二手'].includes(searchStr.toLowerCase())) {
        const isNew = ['new', '全新'].includes(searchStr.toLowerCase());
        whereConditions.push('p.is_new = ?');
        queryParams.push(isNew ? 1 : 0);
      }
      // 质量等级匹配
      else if (/^[A-C]$/.test(searchStr.toUpperCase())) {
        whereConditions.push('UPPER(p.quality_grade) = ?');
        queryParams.push(searchStr.toUpperCase());
      }
      // 日期格式匹配 (YYYY-MM-DD)
      else if (/^\d{4}-\d{2}-\d{2}$/.test(searchStr)) {
        whereConditions.push('(DATE(p.Inventorytime) = ? OR DATE(p.salestime) = ?)');
        queryParams.push(searchStr, searchStr);
      }
      // 价格相关匹配 (纯数字，可能查询价格、IMEI部分、序列号等)
      else if (/^\d+$/.test(searchStr)) {
        // 对于数字搜索，同时匹配多个可能的字段
        whereConditions.push(`(
          p.imei LIKE ? OR
          p.serial_number LIKE ? OR
          p.purchase_number LIKE ? OR
          p.sale_price = ? OR
          p.purchase_cost = ? OR
          CAST(p.id AS CHAR) LIKE ?
        )`);
        const searchTerm = `%${searchStr}%`;
        const price = parseFloat(searchStr);
        queryParams.push(searchTerm, searchTerm, searchTerm, price, price, searchTerm);
      }
      // 其他情况进行全字段模糊搜索
      else {
        whereConditions.push(`(
          p.imei LIKE ? OR
          p.serial_number LIKE ? OR
          b.name LIKE ? OR
          m.name LIKE ? OR
          co.name LIKE ? OR
          mem.size LIKE ? OR
          p.status LIKE ? OR
          p.quality_grade LIKE ? OR
          p.remarks LIKE ? OR
          st.name LIKE ? OR
          s.name LIKE ? OR
          p.purchase_number LIKE ?
        )`);
        const searchTerm = `%${searchStr}%`;
        queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
      }
    }

    const whereClause = whereConditions.join(' AND ');

    // 使用完整的查询，包含操作员信息、备注
    const dataQuery = `
      SELECT
        p.id,
        p.imei,
        p.serial_number,
        m.name as model,
        b.name as brand,
        co.name as color,
        mem.size as memory,
        p.quality_grade as phone_condition,
        p.purchase_cost as purchase_price,
        p.sale_price as selling_price,
        p.store_id,
        p.supplier_id,
        p.status,
        p.is_new,
        p.is_preordered,
        p.Inventorytime,
        p.salestime,
        p.remarks,
        s.name as supplier_name,
        st.name as store_name,
        p.purchase_number as purchase_number,
        p.inventory_operator_id,
        inv_op.name as inventory_operator_name
      FROM phones p
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN colors co ON p.color_id = co.id
      LEFT JOIN memories mem ON p.memory_id = mem.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN stores st ON p.store_id = st.id
      LEFT JOIN users inv_op ON p.inventory_operator_id = inv_op.id
      WHERE ${whereClause}
      ORDER BY p.Inventorytime DESC
      LIMIT ${validLimit} OFFSET ${offset}
    `;

    log.debug('🔍 查询条件:', whereConditions);
    log.debug('🔍 查询参数:', queryParams);
    log.debug('🔍 SQL查询:', dataQuery);

    const [dataResult] = await connection.execute(dataQuery, queryParams);
    log.debug(`✅ 查询成功，找到 ${dataResult.length} 条记录`);
    // 打印第一条记录的原始数据用于调试
    if (dataResult.length > 0) {
      log.debug('🔍 第一条记录原始数据:', JSON.stringify(dataResult[0], null, 2));
    }

    // 计数查询
    const countQuery = `
      SELECT COUNT(*) as total
      FROM phones p
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN colors co ON p.color_id = co.id
      LEFT JOIN memories mem ON p.memory_id = mem.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN stores st ON p.store_id = st.id
      WHERE ${whereClause}
    `;

    const [countResult] = await connection.execute(countQuery, queryParams);
    const total = countResult[0].total;
    log.debug(`✅ 总数: ${total}`);

    // 格式化返回数据
    const formattedData = dataResult.map(item => ({
      id: item.id,
      imei: item.imei || '',
      serial_number: item.serial_number || '',
      model: item.model || '',
      brand: item.brand || '',
      color: item.color || '',
      memory: item.memory || '',
      phone_condition: item.phone_condition || '',
      condition: item.phone_condition || '',
      purchase_price: parseFloat(item.purchase_price) || 0,
      purchase_cost: parseFloat(item.purchase_price) || 0,
      sale_price: parseFloat(item.selling_price) || 0,
      supplier_id: item.supplier_id,
      supplier_name: item.supplier_name || '未知供应商',
      store_id: item.store_id,
      store_name: item.store_name || '未知店铺',
      purchase_number: item.purchase_number || '',
      inventory_operator_id: item.inventory_operator_id,
      inventory_operator_name: item.inventory_operator_name || '未设置',
      remarks: item.remarks || '',
      status: item.status,
      is_preordered: item.is_preordered === 1,
      is_new: item.is_new,
      Inventorytime: item.Inventorytime,
      salestime: item.salestime,
      created_at: item.Inventorytime
    }));

    const result = {
      success: true,
      data: formattedData,
      pagination: {
        current: validPage,
        pageSize: validLimit,
        total: total,
        totalPages: Math.ceil(total / validLimit)
      }
    };

    ApiResponse.success(res, result);

  } catch (error) {
    log.error('获取库存列表失败:', error);
    ApiResponse.serverError(res, '获取库存列表失败', error);
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// 获取库存统计信息
router.get('/stats/overview', unifiedAuth, requirePermission('inventory:view'), async (req, res) => {
  try {
    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500);
    }

    const { store_id } = req.query;
    const pool = getDatabase();

    // 构建查询条件 - 库存统计只统计在库状态的数据
    let whereConditions = ['p.status = ?'];
    let queryParams = ['in_stock'];

    if (store_id) {
      whereConditions.push('p.store_id = ?');
      queryParams.push(parseInt(store_id));
    }

    const whereCondition = 'WHERE ' + whereConditions.join(' AND ');

    // 获取基本统计
    const statsQuery = `
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN p.is_new = 1 THEN 1 END) as new_count,
        COUNT(CASE WHEN p.is_new = 0 THEN 1 END) as used_count,
        COALESCE(SUM(p.purchase_cost), 0) as total_value
      FROM phones p
      ${whereCondition}
    `;

    const [statsResult] = await pool.execute(statsQuery, queryParams);
    const stats = statsResult[0];

    // 按门店统计
    const storeStatsQuery = `
      SELECT
        s.name as store_name,
        COUNT(*) as count
      FROM phones p
      LEFT JOIN stores s ON p.store_id = s.id
      ${whereCondition}
      ${store_id ? '' : 'GROUP BY p.store_id, s.name'}
      ORDER BY count DESC
    `;

    const [storeResult] = await pool.execute(storeStatsQuery, queryParams);

    // 按品牌统计
    const brandStatsQuery = `
      SELECT
        b.name as brand_name,
        COUNT(*) as count
      FROM phones p
      LEFT JOIN brands b ON p.brand_id = b.id
      ${whereCondition}
      ${store_id ? '' : 'GROUP BY b.name'}
      ORDER BY count DESC
      LIMIT 10
    `;

    const [brandResult] = await pool.execute(brandStatsQuery, queryParams);

    // 构建响应数据
    const response = {
      total: parseInt(stats.total) || 0,
      new_count: parseInt(stats.new_count) || 0,
      used_count: parseInt(stats.used_count) || 0,
      total_value: parseFloat(stats.total_value) || 0,
      by_store: storeResult.reduce((acc, row) => {
        acc[row.store_name || '未知店铺'] = row.count;
        return acc;
      }, {}),
      by_brand: brandResult.reduce((acc, row) => {
        acc[row.brand_name || '未知品牌'] = row.count;
        return acc;
      }, {})
    };

    ApiResponse.success(res, response);

  } catch (error) {
    log.error('获取库存统计失败:', error);
    ApiResponse.serverError(res, '获取库存统计失败', error);
  }
});

/**
 * 获取库存统计数据
 * 注意：此路由必须放在 /:id 路由之前，否则 'stats' 会被当作 id 参数处理
 */
router.get('/stats', unifiedAuth, requirePermission('inventory:view'), async (req, res) => {
  try {
    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500);
    }

    const pool = getDatabase();

    // 获取总数（在库的商品）
    const [totalResult] = await pool.execute('SELECT COUNT(*) as total FROM phones WHERE status = ?', ['in_stock']);
    const total = totalResult[0].total;

    // 获取全新机数量（在库且全新）
    const [inStockResult] = await pool.execute('SELECT COUNT(*) as inStock FROM phones WHERE status = ? AND is_new = 1', ['in_stock']);
    const inStock = inStockResult[0].inStock;

    // 获取二手机数量（在库且二手）
    const [soldResult] = await pool.execute('SELECT COUNT(*) as sold FROM phones WHERE status = ? AND is_new = 0', ['in_stock']);
    const sold = soldResult[0].sold;

    // 获取库存总值（在库商品的采购价格总和）
    const [valueResult] = await pool.execute(`
      SELECT COALESCE(SUM(purchase_cost), 0) as totalValue
      FROM phones
      WHERE status = 'in_stock'
    `);
    const totalValue = parseFloat(valueResult[0].totalValue) || 0;

    log.debug('📊 库存统计数据:', {
      总数: total,
      全新机: inStock,
      二手机: sold,
      总值: totalValue
    });

    ApiResponse.success(res, {
      total,
      inStock,
      sold,
      totalValue
    }, '获取统计数据成功');

  } catch (error) {
    log.error('获取库存统计数据失败:', error);
    ApiResponse.serverError(res, '获取统计数据失败', error);
  }
});

// 获取单个库存详情
router.get('/:id', unifiedAuth, requirePermission('inventory:view'), async (req, res) => {
  let connection;
  try {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return ApiResponse.badRequest(res, '无效的商品ID');
    }

    const { getDatabase } = require('../config/database');
    const pool = getDatabase();

    if (!pool) {
      return ApiResponse.serverError(res, '数据库连接池未初始化');
    }

    connection = await pool.getConnection();

    log.debug(`正在获取商品详情，ID: ${id}`);

    // 从phones表中获取商品详情，包含关联数据
    const query = `
      SELECT
        p.*,
        s.name as supplier_name,
        st.name as store_name,
        u.username as operator_name
      FROM phones p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN stores st ON p.store_id = st.id
        WHERE p.id = ?
    `;

    const [rows] = await connection.execute(query, [parseInt(id)]);

    if (rows.length === 0) {
      return ApiResponse.notFound(res, '商品不存在');
    }

    const item = rows[0];

    // 转换为前端期望的格式
    const responseData = {
      id: item.id,
      brand_id: item.brand_id || null,
      model_id: item.model_id || null,
      color_id: item.color_id || null,
      memory_id: item.memory_id || null,
      brand: item.brand || '',
      imei: item.imei || '',
      serial_number: item.serial_number || '',
      purchase_price: item.purchase_cost || 0,
      price: item.sale_price || 0,
      supplier_id: item.supplier_id || null,
      store_id: item.store_id || null,
      Inventorytime: item.Inventorytime,
      condition: item.quality_grade === 'A' ? 'new' : 'used',
      quality_grade: item.quality_grade,
      purchase_remarks: item.purchase_remarks || '',
      is_new: item.is_new,
      status: item.status,
      salestime: item.salestime,
      supplier_name: item.supplier_name || '',
      store_name: item.store_name || '',
      operator_name: item.operator_name || ''
    };

    // 调试日志 - 详细显示原始数据和转换后的数据
    log.debug(`=== 调试信息 - 商品ID: ${id} ===`);
    log.debug('原始数据库数据:');
    log.debug('  item.purchase_cost:', item.purchase_cost);
    log.debug('转换后的响应数据:');
    log.debug('  responseData.purchase_price:', responseData.purchase_price);
    log.debug('  responseData.price:', responseData.price);
    log.debug('========================');

    log.debug('获取到的商品详情:', responseData);
    ApiResponse.success(res, responseData);

  } catch (error) {
    log.error('获取商品详情失败:', error);
    ApiResponse.serverError(res, '获取商品详情失败', error);
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// 获取库存变动记录
router.get('/:id/movements', unifiedAuth, requirePermission('inventory:view'), (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20, movement_type, start_date, end_date } = req.query;

    let movements = mockStockMovements.filter(m => m.inventory_id === parseInt(id));

    // 类型筛选
    if (movement_type) {
      movements = movements.filter(m => m.movement_type === movement_type);
    }

    // 日期筛选
    if (start_date) {
      const startDate = new Date(start_date);
      movements = movements.filter(m => new Date(m.movement_date) >= startDate);
    }

    if (end_date) {
      const endDate = new Date(end_date);
      endDate.setHours(23, 59, 59, 999);
      movements = movements.filter(m => new Date(m.movement_date) <= endDate);
    }

    // 按时间倒序排序
    movements.sort((a, b) => new Date(b.movement_date) - new Date(a.movement_date));

    // 分页
    const total = movements.length;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const paginatedMovements = movements.slice(offset, offset + parseInt(limit));

    ApiResponse.success(res, {
      movements: paginatedMovements,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    log.error('获取库存变动记录失败:', error);
    ApiResponse.serverError(res, '获取库存变动记录失败', error);
  }
});

// 库存入库
router.post('/:id/stock-in', unifiedAuth, requirePermission('inventory:create'), (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, reference_type, reference_id, reason } = req.body;

    if (!quantity || parseInt(quantity) <= 0) {
      return ApiResponse.badRequest(res, '入库数量必须大于0');
    }

    const inventoryIndex = mockInventory.findIndex(i => i.id === parseInt(id));
    if (inventoryIndex === -1) {
      return ApiResponse.notFound(res, '库存记录不存在');
    }

    // 更新库存
    const quantityNum = parseInt(quantity);
    mockInventory[inventoryIndex].current_stock += quantityNum;
    mockInventory[inventoryIndex].available_stock += quantityNum;
    mockInventory[inventoryIndex].total_value += quantityNum * mockInventory[inventoryIndex].unit_cost;
    mockInventory[inventoryIndex].last_stock_in = new Date().toISOString();
    // No updated_at field needed - using Inventorytime and salestime

    // 重新计算库存状态
    const inventory = mockInventory[inventoryIndex];
    if (inventory.current_stock === 0) {
      inventory.stock_status = 'out_of_stock';
    } else if (inventory.current_stock <= inventory.min_stock_level) {
      inventory.stock_status = 'low';
    } else if (inventory.current_stock >= inventory.max_stock_level) {
      inventory.stock_status = 'overstock';
    } else {
      inventory.stock_status = 'normal';
    }

    // 创建库存变动记录
    const movement = {
      id: Math.max(...mockStockMovements.map(m => m.id)) + 1,
      inventory_id: parseInt(id),
      movement_type: 'stock_in',
      quantity: quantityNum,
      reference_type: reference_type || 'manual',
      reference_id: reference_id || '',
      reason: reason || '手动入库',
      operator_id: 1, // 应该从token获取
      operator_name: '当前用户',
      movement_date: new Date().toISOString(),
      Inventorytime: new Date().toISOString()
    };

    mockStockMovements.push(movement);

    ApiResponse.success(res, {
      inventory: mockInventory[inventoryIndex],
      movement
    }, '入库成功');
  } catch (error) {
    log.error('库存入库失败:', error);
    ApiResponse.serverError(res, '库存入库失败', error);
  }
});

// 库存出库
router.post('/:id/stock-out', unifiedAuth, requirePermission('inventory:edit'), (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, reference_type, reference_id, reason } = req.body;

    if (!quantity || parseInt(quantity) <= 0) {
      return ApiResponse.badRequest(res, '出库数量必须大于0');
    }

    const inventoryIndex = mockInventory.findIndex(i => i.id === parseInt(id));
    if (inventoryIndex === -1) {
      return ApiResponse.notFound(res, '库存记录不存在');
    }

    const quantityNum = parseInt(quantity);
    const inventory = mockInventory[inventoryIndex];

    // 检查可用库存
    if (inventory.available_stock < quantityNum) {
      return ApiResponse.badRequest(res, '可用库存不足');
    }

    // 更新库存
    inventory.current_stock -= quantityNum;
    inventory.available_stock -= quantityNum;
    inventory.total_value -= quantityNum * inventory.unit_cost;
    inventory.last_stock_out = new Date().toISOString();
    // No updated_at field needed - inventory time tracked in Inventorytime/salestime

    // 重新计算库存状态
    if (inventory.current_stock === 0) {
      inventory.stock_status = 'out_of_stock';
    } else if (inventory.current_stock <= inventory.min_stock_level) {
      inventory.stock_status = 'low';
    } else if (inventory.current_stock >= inventory.max_stock_level) {
      inventory.stock_status = 'overstock';
    } else {
      inventory.stock_status = 'normal';
    }

    // 创建库存变动记录
    const movement = {
      id: Math.max(...mockStockMovements.map(m => m.id)) + 1,
      inventory_id: parseInt(id),
      movement_type: 'stock_out',
      quantity: quantityNum,
      reference_type: reference_type || 'manual',
      reference_id: reference_id || '',
      reason: reason || '手动出库',
      operator_id: 1, // 应该从token获取
      operator_name: '当前用户',
      movement_date: new Date().toISOString(),
      Inventorytime: new Date().toISOString()
    };

    mockStockMovements.push(movement);

    ApiResponse.success(res, {
      inventory: mockInventory[inventoryIndex],
      movement
    }, '出库成功');
  } catch (error) {
    log.error('库存出库失败:', error);
    ApiResponse.serverError(res, '库存出库失败', error);
  }
});

// 库存预留
router.post('/:id/reserve', unifiedAuth, requirePermission('inventory:edit'), (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, reference_type, reference_id, reason } = req.body;

    if (!quantity || parseInt(quantity) <= 0) {
      return ApiResponse.badRequest(res, '预留数量必须大于0');
    }

    const inventoryIndex = mockInventory.findIndex(i => i.id === parseInt(id));
    if (inventoryIndex === -1) {
      return ApiResponse.notFound(res, '库存记录不存在');
    }

    const quantityNum = parseInt(quantity);
    const inventory = mockInventory[inventoryIndex];

    // 检查可用库存
    if (inventory.available_stock < quantityNum) {
      return ApiResponse.badRequest(res, '可用库存不足，无法预留');
    }

    // 更新库存
    inventory.available_stock -= quantityNum;
    inventory.reserved_stock += quantityNum;
    // No updated_at field needed - inventory time tracked in Inventorytime/salestime

    // 创建库存变动记录
    const movement = {
      id: Math.max(...mockStockMovements.map(m => m.id)) + 1,
      inventory_id: parseInt(id),
      movement_type: 'reserve',
      quantity: quantityNum,
      reference_type: reference_type || 'manual',
      reference_id: reference_id || '',
      reason: reason || '手动预留',
      operator_id: 1, // 应该从token获取
      operator_name: '当前用户',
      movement_date: new Date().toISOString(),
      Inventorytime: new Date().toISOString()
    };

    mockStockMovements.push(movement);

    ApiResponse.success(res, {
      inventory: mockInventory[inventoryIndex],
      movement
    }, '预留成功');
  } catch (error) {
    log.error('库存预留失败:', error);
    ApiResponse.serverError(res, '库存预留失败', error);
  }
});

// 取消预留
router.post('/:id/unreserve', unifiedAuth, requirePermission('inventory:edit'), (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, reference_type, reference_id, reason } = req.body;

    if (!quantity || parseInt(quantity) <= 0) {
      return ApiResponse.badRequest(res, '取消预留数量必须大于0');
    }

    const inventoryIndex = mockInventory.findIndex(i => i.id === parseInt(id));
    if (inventoryIndex === -1) {
      return ApiResponse.notFound(res, '库存记录不存在');
    }

    const quantityNum = parseInt(quantity);
    const inventory = mockInventory[inventoryIndex];

    // 检查预留库存
    if (inventory.reserved_stock < quantityNum) {
      return ApiResponse.badRequest(res, '预留库存不足，无法取消预留');
    }

    // 更新库存
    inventory.available_stock += quantityNum;
    inventory.reserved_stock -= quantityNum;
    // No updated_at field needed - inventory time tracked in Inventorytime/salestime

    // 创建库存变动记录
    const movement = {
      id: Math.max(...mockStockMovements.map(m => m.id)) + 1,
      inventory_id: parseInt(id),
      movement_type: 'unreserve',
      quantity: quantityNum,
      reference_type: reference_type || 'manual',
      reference_id: reference_id || '',
      reason: reason || '取消预留',
      operator_id: 1, // 应该从token获取
      operator_name: '当前用户',
      movement_date: new Date().toISOString(),
      Inventorytime: new Date().toISOString()
    };

    mockStockMovements.push(movement);

    ApiResponse.success(res, {
      inventory: mockInventory[inventoryIndex],
      movement
    }, '取消预留成功');
  } catch (error) {
    log.error('取消库存预留失败:', error);
    ApiResponse.serverError(res, '取消库存预留失败', error);
  }
});

// 库存调整
router.put('/:id/adjust', unifiedAuth, requirePermission('inventory:edit'), (req, res) => {
  try {
    const { id } = req.params;
    const { current_stock, reason } = req.body;

    if (current_stock === undefined || current_stock < 0) {
      return ApiResponse.badRequest(res, '库存数量不能小于0');
    }

    const inventoryIndex = mockInventory.findIndex(i => i.id === parseInt(id));
    if (inventoryIndex === -1) {
      return ApiResponse.notFound(res, '库存记录不存在');
    }

    const inventory = mockInventory[inventoryIndex];
    const oldStock = inventory.current_stock;
    const newStock = parseInt(current_stock);
    const difference = newStock - oldStock;

    // 更新库存
    inventory.current_stock = newStock;
    inventory.available_stock = newStock - inventory.reserved_stock;
    inventory.total_value = newStock * inventory.unit_cost;
    // No updated_at field needed - inventory time tracked in Inventorytime/salestime

    // 重新计算库存状态
    if (inventory.current_stock === 0) {
      inventory.stock_status = 'out_of_stock';
    } else if (inventory.current_stock <= inventory.min_stock_level) {
      inventory.stock_status = 'low';
    } else if (inventory.current_stock >= inventory.max_stock_level) {
      inventory.stock_status = 'overstock';
    } else {
      inventory.stock_status = 'normal';
    }

    // 创建库存变动记录
    const movement = {
      id: Math.max(...mockStockMovements.map(m => m.id)) + 1,
      inventory_id: parseInt(id),
      movement_type: 'adjust',
      quantity: difference,
      reference_type: 'manual',
      reference_id: '',
      reason: reason || '库存调整',
      operator_id: 1, // 应该从token获取
      operator_name: '当前用户',
      movement_date: new Date().toISOString(),
      Inventorytime: new Date().toISOString()
    };

    mockStockMovements.push(movement);

    ApiResponse.success(res, {
      inventory: mockInventory[inventoryIndex],
      movement,
      adjustment: {
        old_stock: oldStock,
        new_stock: newStock,
        difference
      }
    }, '库存调整成功');
  } catch (error) {
    log.error('库存调整失败:', error);
    ApiResponse.serverError(res, '库存调整失败', error);
  }
});

// 新增：创建入库记录（直接入库到phones表）
router.post('/stock-in', unifiedAuth, requirePermission('inventory:create'), async (req, res) => {
  let connection;
  try {
    const {
      product_type,
      product_id,
      quantity,
      unit_cost,
      store_id,
      supplier_id,
      operation_type,
      reason,
      note,
      reference_type,
      reference_id,
      imei,
      serial_number,
      is_new = 1,
      Inventorytime
    } = req.body;

    // 数据验证
    if (!product_type || !['phone', 'accessory'].includes(product_type)) {
      return ApiResponse.badRequest(res, '商品类型无效');
    }

    if (!product_id || product_id <= 0) {
      return ApiResponse.badRequest(res, '商品ID无效');
    }

    if (!quantity || quantity <= 0 || quantity > 9999) {
      return ApiResponse.badRequest(res, '入库数量无效');
    }

    if (unit_cost === undefined || unit_cost < 0 || unit_cost > 999999) {
      return ApiResponse.badRequest(res, '单价无效');
    }

    if (!store_id || store_id <= 0) {
      return ApiResponse.badRequest(res, '门店ID无效');
    }

    if (!operation_type || !['in', 'out', 'adjust'].includes(operation_type)) {
      return ApiResponse.badRequest(res, '操作类型无效');
    }

    // 手机特有验证
    if (product_type === 'phone' && !imei) {
      return ApiResponse.badRequest(res, '手机商品必须提供IMEI号');
    }

    // 从连接池获取连接（用于事务操作）
    const pool = getDatabase();
    const connection = await pool.getConnection();

    // 计算总价
    const total_cost = quantity * unit_cost;
    // 生成入库单号（使用北京时间：PO + 年份 + 时分秒6位）
    const now = new Date();
    const beijingTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    const year = beijingTime.getUTCFullYear();
    const hours = String(beijingTime.getUTCHours()).padStart(2, '0');
    const minutes = String(beijingTime.getUTCMinutes()).padStart(2, '0');
    const seconds = String(beijingTime.getUTCSeconds()).padStart(2, '0');
    const purchase_number = `PO${year}${hours}${minutes}${seconds}`;

    // 开始事务
    await connection.beginTransaction();

    try {
      // 如果是入库操作，将数据插入到phones表
      if (operation_type === 'in' && product_type === 'phone') {
        // 检查IMEI是否已存在
        const [existingPhones] = await connection.execute(
          'SELECT id FROM phones WHERE imei = ?',
          [imei]
        );

        if (existingPhones.length > 0) {
          await connection.rollback();
          return ApiResponse.badRequest(res, '该IMEI号已存在');
        }

        // 插入phones表 - 使用新的字段结构
        const [insertResult] = await connection.execute(
          `INSERT INTO phones (
            purchase_number, imei, serial_number,
            purchase_cost, sale_price, is_new, supplier_id, store_id, status, Inventorytime,
            remarks, salestime
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            purchase_number,
            imei,
            serial_number || '',
            unit_cost, // purchase_cost: 实际采购成本价
            unit_cost * 1.2, // sale_price: 建议销售价(成本价的1.2倍)
            is_new,
            supplier_id || null,
            store_id,
            'in_stock', // 入库时状态为在库
            Inventorytime || new Date().toISOString().slice(0, 19).replace('T', ' '),
            reason || '',
            salestime || null
          ]
        );

        // 创建入库记录（用于记录管理）
        const newRecord = {
          id: insertResult.insertId,
          product_type,
          product_id,
          product_name: `${brand || ''} ${model || ''}`.trim(),
          quantity,
          unit_cost,
          total_cost,
          store_id,
          store_name: `门店${store_id}`,
          supplier_id,
          supplier_name: supplier_id ? `供应商${supplier_id}` : null,
          operation_type,
          operator_id: req.user?.id || 1,
          operator_name: req.user?.username || '当前用户',
          reason: reason || '',
          note: note || '',
          is_settled: 0,
          reference_type: reference_type || 'purchase',
          reference_id: reference_id || purchase_number,
          imei: product_type === 'phone' ? imei : null,
          serial_number: serial_number || '',
          Inventorytime: new Date().toISOString(),
          salestime: null
        };

        // 提交事务
        await connection.commit();

        ApiResponse.success(res, newRecord, '手机入库成功');

      } else {
        // 其他类型的入库（配件等），返回不支持
        await connection.rollback();
        return ApiResponse.badRequest(res, '暂不支持此类型的入库操作');
      }

    } catch (dbError) {
      await connection.rollback();
      throw dbError;
    }

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    log.error('创建入库记录失败:', error);
    ApiResponse.serverError(res, '创建入库记录失败', error);
  } finally {
    if (connection) {
      connection.release(); // 释放连接回连接池
    }
  }
});

// 更新库存商品信息
router.put('/:id', unifiedAuth, requirePermission('inventory:edit'), async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!id || isNaN(id)) {
      return ApiResponse.badRequest(res, '无效的商品ID');
    }

    const { getDatabase } = require('../config/database');
    const pool = getDatabase();

    if (!pool) {
      return ApiResponse.serverError(res, '数据库连接池未初始化');
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    log.debug(`开始更新库存商品，ID: ${id}`, updateData);

    // 检查商品是否存在
    const [existingItems] = await connection.execute(
      'SELECT id, imei, status FROM phones WHERE id = ?',
      [id]
    );

    if (existingItems.length === 0) {
      await connection.rollback();
      return ApiResponse.notFound(res, '商品不存在');
    }

    const item = existingItems[0];
    log.debug(`找到商品: ${item.brand || ''} ${item.model || ''} (${item.imei || '无IMEI'})`);

    // 检查IMEI冲突（如果要更新的IMEI与现有其他商品冲突）
    if (updateData.imei && updateData.imei !== item.imei) {
      const [imeiConflict] = await connection.execute(
        'SELECT id FROM phones WHERE imei = ? AND id != ?',
        [updateData.imei, id]
      );

      if (imeiConflict.length > 0) {
        await connection.rollback();
        return ApiResponse.badRequest(res, '该IMEI号已被其他商品使用');
      }
    }

    // 构建更新字段
    const updateFields = [];
    const updateValues = [];

    // 控制字段是否包含在更新中
    let includeSupplier = true;
    let includeStore = true;

    // 品牌ID到名称转换
    let brandName = '';
    if (updateData.brand_id) {
      const [brandResult] = await connection.execute('SELECT name FROM brands WHERE id = ?', [updateData.brand_id]);
      if (brandResult.length > 0) {
        brandName = brandResult[0].name;
        log.debug(`✅ 品牌ID ${updateData.brand_id} 转换为名称: ${brandName}`);
      } else {
        log.debug(`⚠️ 品牌ID ${updateData.brand_id} 在数据库中不存在，跳过品牌字段更新`);
        includeBrand = false;
      }
    }

    // 型号ID到名称转换
    let modelName = '';
    if (updateData.model_id) {
      const [modelResult] = await connection.execute('SELECT name FROM models WHERE id = ?', [updateData.model_id]);
      if (modelResult.length > 0) {
        modelName = modelResult[0].name;
        log.debug(`✅ 型号ID ${updateData.model_id} 转换为名称: ${modelName}`);
      } else {
        log.debug(`⚠️ 型号ID ${updateData.model_id} 在数据库中不存在，跳过型号字段更新`);
        includeModel = false;
      }
    }

    // 颜色ID到名称转换
    let colorName = '';
    if (updateData.color_id) {
      const [colorResult] = await connection.execute('SELECT name FROM colors WHERE id = ?', [updateData.color_id]);
      if (colorResult.length > 0) {
        colorName = colorResult[0].name;
        log.debug(`✅ 颜色ID ${updateData.color_id} 转换为名称: ${colorName}`);
      } else {
        log.debug(`⚠️ 颜色ID ${updateData.color_id} 在数据库中不存在，跳过颜色字段更新`);
        includeColor = false;
      }
    }

    // 内存ID到名称转换 - 支持前端内存ID映射
    let memoryName = '';
    let actualMemoryId = null;
    if (updateData.memory_id) {
      // 前端发送的内存ID到数据库实际内存ID的映射
      const memoryIdMapping = {
        1: 1,   // 2GB
        2: 29,  // 4GB
        3: 30,  // 8GB
        4: 32,  // 16GB
        5: 22,  // 32GB
        6: 23,  // 64GB
        7: 24,  // 128GB
        8: 25,  // 256GB
        9: 26,  // 512GB
        10: 27, // 1TB
        11: 28  // 2TB
      };

      actualMemoryId = memoryIdMapping[updateData.memory_id];
      if (actualMemoryId) {
        const [memoryResult] = await connection.execute('SELECT size FROM memories WHERE id = ?', [actualMemoryId]);
        if (memoryResult.length > 0) {
          memoryName = memoryResult[0].size;
          log.debug(`✅ 前端内存ID ${updateData.memory_id} 映射到数据库ID ${actualMemoryId} -> "${memoryName}"`);
        } else {
          log.debug(`⚠️ 数据库内存ID ${actualMemoryId} 不存在，跳过内存字段更新`);
          includeMemory = false;
        }
      } else {
        log.debug(`⚠️ 前端内存ID ${updateData.memory_id} 无映射，跳过内存字段更新`);
        includeMemory = false;
      }
    }

    // 供应商ID验证（保持ID，因为phones表存储的是supplier_id）
    if (updateData.supplier_id) {
      const [supplierResult] = await connection.execute('SELECT id FROM suppliers WHERE id = ?', [updateData.supplier_id]);
      if (supplierResult.length === 0) {
        log.debug(`⚠️ 供应商ID ${updateData.supplier_id} 在数据库中不存在，跳过供应商字段更新`);
        includeSupplier = false;
      }
    }

    // 店铺ID验证（保持ID，因为phones表存储的是store_id）
    if (updateData.store_id) {
      const [storeResult] = await connection.execute('SELECT id FROM stores WHERE id = ?', [updateData.store_id]);
      if (storeResult.length === 0) {
        log.debug(`⚠️ 店铺ID ${updateData.store_id} 在数据库中不存在，跳过店铺字段更新`);
        includeStore = false;
      }
    }

    // 处理前端发送的字段映射
    const fieldMapping = {
      'imei': updateData.imei,
      'serial_number': updateData.serial_number,
      // 使用新的字段结构
      'purchase_cost': updateData.price,
      'sale_price': updateData.price * 1.2,
      ...(includeSupplier && { 'supplier_id': updateData.supplier_id }),
      ...(includeStore && { 'store_id': updateData.store_id }),
      'Inventorytime': updateData.Inventorytime,
      'is_new': updateData.is_new  // 使用前端发送的is_new字段
    };

    // 构建更新字段
    Object.keys(fieldMapping).forEach(field => {
      const value = fieldMapping[field];
      if (value !== undefined && value !== null) {
        // 特殊处理is_new字段转换
        if (field === 'is_new') {
          const qualityGrade = value === 1 ? 'A' : 'B';
          log.debug(`🔄 更新is_new字段: ${value} -> quality_grade: ${qualityGrade}`);
          updateFields.push(`quality_grade = ?`);
          updateFields.push(`is_new = ?`);
          updateValues.push(qualityGrade);
          updateValues.push(value);
        } else {
          updateFields.push(`${field} = ?`);
          updateValues.push(value);
        }
      }
    });

    if (updateFields.length === 0) {
      await connection.rollback();
      return ApiResponse.badRequest(res, '没有有效的更新字段');
    }

    // No updated_at field - using Inventorytime and salestime for time tracking

    // 添加WHERE条件的ID
    updateValues.push(id);

    // 执行更新
    const updateQuery = `UPDATE phones SET ${updateFields.join(', ')} WHERE id = ?`;
    log.debug('执行更新SQL:', updateQuery);
    log.debug('更新参数:', updateValues);

    const [updateResult] = await connection.execute(updateQuery, updateValues);

    if (updateResult.affectedRows === 0) {
      await connection.rollback();
      return ApiResponse.serverError(res, '更新失败，商品可能已被删除');
    }

    // 提交事务
    await connection.commit();

    log.debug(`成功更新库存商品，ID: ${id}`);

    // 返回更新后的商品信息
    const [updatedItems] = await connection.execute(
      'SELECT id, imei, serial_number, purchase_cost, quality_grade, Inventorytime, salestime FROM phones WHERE id = ?',
      [id]
    );

    ApiResponse.success(res, updatedItems[0], '商品信息更新成功');

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    log.error('更新库存商品失败:', error);
    ApiResponse.serverError(res, '更新商品失败', error);
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// 删除库存商品
router.delete('/:id', unifiedAuth, requirePermission('inventory:delete'), async (req, res) => {
  let connection;
  try {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return ApiResponse.badRequest(res, '无效的商品ID');
    }

    const { getDatabase } = require('../config/database');
    const pool = getDatabase();

    if (!pool) {
      return ApiResponse.serverError(res, '数据库连接池未初始化');
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    log.debug(`开始删除库存商品，ID: ${id}`);

    // 检查商品是否存在
    const [existingItems] = await connection.execute(
      'SELECT id, imei, status FROM phones WHERE id = ?',
      [id]
    );

    if (existingItems.length === 0) {
      await connection.rollback();
      return ApiResponse.notFound(res, '商品不存在');
    }

    const item = existingItems[0];
    log.debug(`找到商品: ${item.brand || ''} ${item.model || ''} (${item.imei || '无IMEI'})`);

    // 检查商品状态，只有 'in_stock' 状态的商品才能删除
    if (item.status !== 'in_stock') {
      await connection.rollback();
      return ApiResponse.badRequest(res, '只能删除库存状态为"在库"的商品');
    }

    // 检查外键约束 - 查看是否有关联的记录
    log.debug(`检查商品ID ${id}的外键关联...`);

    // 检查租借记录
    const [rentalRecords] = await connection.execute(
      'SELECT COUNT(*) as count FROM rentals WHERE phone_id = ?',
      [id]
    );

    // 检查销售记录
    const [saleRecords] = await connection.execute(
      'SELECT COUNT(*) as count FROM sales WHERE phone_id = ?',
      [id]
    );

    // 检查维修记录
    const [repairRecords] = await connection.execute(
      'SELECT COUNT(*) as count FROM repairs WHERE phone_id = ?',
      [id]
    );

    const rentalCount = rentalRecords[0].count;
    const saleCount = saleRecords[0].count;
    const repairCount = repairRecords[0].count;

    log.debug(`关联记录统计: 租借${rentalCount}, 销售${saleCount}, 维修${repairCount}`);

    // 如果有任何关联记录，提供详细的错误信息
    if (rentalCount > 0 || saleCount > 0 || repairCount > 0) {
      await connection.rollback();

      const relatedRecords = [];
      if (rentalCount > 0) relatedRecords.push(`租借记录(${rentalCount}条)`);
      if (saleCount > 0) relatedRecords.push(`销售记录(${saleCount}条)`);
      if (repairCount > 0) relatedRecords.push(`维修记录(${repairCount}条)`);

      const errorMessage = `无法删除商品：存在关联的${relatedRecords.join('、')}。请先处理这些关联记录后再删除商品。`;
      return ApiResponse.badRequest(res, errorMessage);
    }

    // 删除phones表中的记录
    const [deleteResult] = await connection.execute(
      'DELETE FROM phones WHERE id = ?',
      [id]
    );

    if (deleteResult.affectedRows === 0) {
      await connection.rollback();
      return ApiResponse.serverError(res, '删除失败，商品可能已被删除');
    }

    // 提交事务
    await connection.commit();

    log.debug(`成功删除库存商品，ID: ${id}`);

    ApiResponse.success(res, {
      id: parseInt(id),
      deleted: true,
      item: {
        id: item.id,
        imei: item.imei
      }
    }, '商品删除成功');

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    log.error('删除库存商品失败:', error);
    ApiResponse.serverError(res, '删除商品失败', error);
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// 快速出库接口 - 直接创建已销售记录，跳过入库流程
router.post('/quick-sale', unifiedAuth, requirePermission('inventory:create'), async (req, res) => {
  let connection;
  try {
    log.debug('🔍 快速出库API: 收到快速出库请求');
    log.debug('👤 用户信息:', req.user);
    log.debug('📦 请求数据:', JSON.stringify(req.body, null, 2));

    const pool = getDatabase();
    connection = await pool.getConnection();

    await connection.beginTransaction();

    const {
      // 设备信息 - 支持ID或名称
      brand,
      brand_id,
      model,
      model_id,
      color,
      color_id,
      memory,
      memory_id,
      is_new,
      imei,
      serial_number,
      // 供应商和店铺
      supplier_id,
      store_id,
      // 价格
      purchase_price,
      sale_price,
      // 客户信息
      customer_name,
      customer_phone,
      customer_idcard,
      // 入库和销售信息
      stock_in_date,
      stock_in_operator_id,
      sale_date,
      operator_id,
      payment_method,
      remarks
    } = req.body;

    // 验证必填字段 - 支持ID或名称
    const hasBrandId = brand_id && typeof brand_id === 'number';
    const hasBrandName = brand && typeof brand === 'string';
    const hasModelId = model_id && typeof model_id === 'number';
    const hasModelName = model && typeof model === 'string';
    const hasColorId = color_id && typeof color_id === 'number';
    const hasColorName = color && typeof color === 'string';
    const hasMemoryId = memory_id && typeof memory_id === 'number';
    const hasMemoryName = memory && typeof memory === 'string';

    if ((!hasBrandId && !hasBrandName) ||
        (!hasModelId && !hasModelName) ||
        (!hasColorId && !hasColorName) ||
        (!hasMemoryId && !hasMemoryName)) {
      throw new Error('设备信息不完整，需要提供品牌、型号、颜色、内存的ID或名称');
    }
    if (!imei || typeof imei !== 'string') {
      log.error('❌ IMEI验证失败:', { imei, type: typeof imei, length: imei?.length });
      throw new Error('IMEI必须是15位数字字符串');
    }
    if (imei.length !== 15) {
      log.error('❌ IMEI长度错误:', { imei, length: imei.length });
      throw new Error('IMEI必须是15位数字');
    }
    if (!/^\d{15}$/.test(imei)) {
      log.error('❌ IMEI格式错误:', { imei });
      throw new Error('IMEI必须为15位纯数字');
    }
    if (!serial_number) {
      throw new Error('序列号不能为空');
    }
    if (!supplier_id || !store_id) {
      throw new Error('供应商和店铺不能为空');
    }
    // 价格可以为0，但如果提供必须是有效数字
    if (purchase_price !== undefined && purchase_price !== null && purchase_price < 0) {
      throw new Error('入库价格不能为负数');
    }
    if (sale_price !== undefined && sale_price !== null && sale_price < 0) {
      throw new Error('销售价格不能为负数');
    }
    if (!customer_phone) {
      throw new Error('客户手机号不能为空');
    }

    // 1. 获取品牌ID - 支持直接ID或名称查询
    log.debug('🔍 查找品牌:', { brand, brand_id: req.body.brand_id });
    let finalBrandId;
    if (brand_id && typeof brand_id === 'number') {
      // 前端直接传品牌ID
      const [brandCheck] = await connection.execute(
        'SELECT id FROM brands WHERE id = ?',
        [brand_id]
      );
      if (brandCheck.length === 0) {
        log.error('❌ 品牌ID不存在:', brand_id);
        throw new Error('品牌ID不存在');
      }
      finalBrandId = brand_id;
      log.debug('✅ 使用品牌ID:', finalBrandId);
    } else if (brand && typeof brand === 'string') {
      // 前端传品牌名称 - 先精确匹配，再模糊匹配
      log.debug('🔍 尝试查找品牌:', brand);

      // 先精确匹配
      let [brands] = await connection.execute(
        'SELECT id, name FROM brands WHERE name = ?',
        [brand]
      );

      // 如果精确匹配失败，尝试模糊匹配（忽略大小写和空格）
      if (brands.length === 0) {
        log.debug('⚠️ 精确匹配失败，尝试模糊匹配:', brand);
        [brands] = await connection.execute(
          'SELECT id, name FROM brands WHERE TRIM(LOWER(name)) = TRIM(LOWER(?))',
          [brand]
        );
      }

      // 如果仍然失败，尝试 LIKE 模糊匹配
      if (brands.length === 0) {
        log.debug('⚠️ 模糊匹配失败，尝试 LIKE 匹配:', brand);
        [brands] = await connection.execute(
          'SELECT id, name FROM brands WHERE name LIKE ?',
          [`%${brand}%`]
        );
      }

      if (brands.length === 0) {
        // 获取所有可用品牌帮助调试
        const [allBrands] = await connection.execute('SELECT id, name FROM brands LIMIT 20');
        log.error('❌ 品牌不存在:', brand);
        log.error('📋 可用品牌列表:', allBrands.map(b => `${b.name}(ID:${b.id})`).join(', '));
        throw new Error(`品牌"${brand}"不存在，可用品牌: ${allBrands.map(b => b.name).join(', ')}`);
      }
      finalBrandId = brands[0].id;
      log.debug('✅ 品牌名称转ID:', finalBrandId, `(数据库名称: ${brands[0].name})`);
    } else {
      throw new Error('品牌参数无效，需要ID或名称');
    }

    // 2. 获取型号ID - 支持直接ID或名称查询
    log.debug('🔍 查找型号:', { model, model_id: req.body.model_id });
    let finalModelId;
    if (model_id && typeof model_id === 'number') {
      // 前端直接传型号ID
      const [modelCheck] = await connection.execute(
        'SELECT id FROM models WHERE id = ? AND brand_id = ?',
        [model_id, finalBrandId]
      );
      if (modelCheck.length === 0) {
        log.error('❌ 型号ID不存在或不匹配品牌:', { model_id, brandId: finalBrandId });
        throw new Error('型号ID不存在或不匹配品牌');
      }
      finalModelId = model_id;
      log.debug('✅ 使用型号ID:', finalModelId);
    } else if (model && typeof model === 'string') {
      // 前端传型号名称 - 支持模糊匹配
      log.debug('🔍 尝试查找型号:', { model, brandId: finalBrandId });

      // 先精确匹配
      let [models] = await connection.execute(
        'SELECT id, name FROM models WHERE name = ? AND brand_id = ?',
        [model, finalBrandId]
      );

      // 如果精确匹配失败，尝试模糊匹配
      if (models.length === 0) {
        log.debug('⚠️ 精确匹配失败，尝试模糊匹配');
        [models] = await connection.execute(
          'SELECT id, name FROM models WHERE TRIM(LOWER(name)) = TRIM(LOWER(?)) AND brand_id = ?',
          [model, finalBrandId]
        );
      }

      // 如果仍然失败，尝试 LIKE 匹配
      if (models.length === 0) {
        log.debug('⚠️ 模糊匹配失败，尝试 LIKE 匹配');
        [models] = await connection.execute(
          'SELECT id, name FROM models WHERE name LIKE ? AND brand_id = ?',
          [`%${model}%`, finalBrandId]
        );
      }

      if (models.length === 0) {
        // 获取该品牌下所有可用型号帮助调试
        const [allModels] = await connection.execute(
          'SELECT id, name FROM models WHERE brand_id = ? LIMIT 20',
          [finalBrandId]
        );
        log.error('❌ 型号不存在或品牌不匹配:', { model, brandId: finalBrandId });
        log.error('📋 该品牌可用型号:', allModels.map(m => m.name).join(', '));
        throw new Error(`型号"${model}"不存在，可用型号: ${allModels.map(m => m.name).join(', ')}`);
      }
      finalModelId = models[0].id;
      log.debug('✅ 型号名称转ID:', finalModelId, `(数据库名称: ${models[0].name})`);
    } else {
      throw new Error('型号参数无效，需要ID或名称');
    }

    // 3. 获取颜色ID - 支持直接ID或名称查询
    log.debug('🔍 查找颜色:', { color, color_id: req.body.color_id });
    let finalColorId;
    if (color_id && typeof color_id === 'number') {
      // 前端直接传颜色ID
      const [colorCheck] = await connection.execute(
        'SELECT id FROM colors WHERE id = ?',
        [color_id]
      );
      if (colorCheck.length === 0) {
        log.error('❌ 颜色ID不存在:', color_id);
        throw new Error('颜色ID不存在');
      }
      finalColorId = color_id;
      log.debug('✅ 使用颜色ID:', finalColorId);
    } else if (color && typeof color === 'string') {
      // 前端传颜色名称 - 支持模糊匹配
      log.debug('🔍 尝试查找颜色:', color);

      // 先精确匹配
      let [colors] = await connection.execute(
        'SELECT id, name FROM colors WHERE name = ?',
        [color]
      );

      // 如果精确匹配失败，尝试模糊匹配
      if (colors.length === 0) {
        [colors] = await connection.execute(
          'SELECT id, name FROM colors WHERE TRIM(LOWER(name)) = TRIM(LOWER(?))',
          [color]
        );
      }

      // 如果仍然失败，尝试 LIKE 匹配
      if (colors.length === 0) {
        [colors] = await connection.execute(
          'SELECT id, name FROM colors WHERE name LIKE ?',
          [`%${color}%`]
        );
      }

      if (colors.length === 0) {
        const [allColors] = await connection.execute('SELECT id, name FROM colors LIMIT 20');
        log.error('❌ 颜色不存在:', color);
        log.error('📋 可用颜色:', allColors.map(c => c.name).join(', '));
        throw new Error(`颜色"${color}"不存在，可用颜色: ${allColors.map(c => c.name).join(', ')}`);
      }
      finalColorId = colors[0].id;
      log.debug('✅ 颜色名称转ID:', finalColorId, `(数据库名称: ${colors[0].name})`);
    } else {
      throw new Error('颜色参数无效，需要ID或名称');
    }

    // 4. 获取内存ID - 支持直接ID或名称查询
    log.debug('🔍 查找内存:', { memory, memory_id: req.body.memory_id });
    let finalMemoryId;
    if (memory_id && typeof memory_id === 'number') {
      // 前端直接传内存ID
      const [memoryCheck] = await connection.execute(
        'SELECT id FROM memories WHERE id = ?',
        [memory_id]
      );
      if (memoryCheck.length === 0) {
        log.error('❌ 内存ID不存在:', memory_id);
        throw new Error('内存ID不存在');
      }
      finalMemoryId = memory_id;
      log.debug('✅ 使用内存ID:', finalMemoryId);
    } else if (memory && typeof memory === 'string') {
      // 前端传内存规格 - 支持模糊匹配
      log.debug('🔍 尝试查找内存:', memory);

      // 先精确匹配
      let [memories] = await connection.execute(
        'SELECT id, size FROM memories WHERE size = ?',
        [memory]
      );

      // 如果精确匹配失败，尝试模糊匹配
      if (memories.length === 0) {
        [memories] = await connection.execute(
          'SELECT id, size FROM memories WHERE TRIM(size) = TRIM(?)',
          [memory]
        );
      }

      // 如果仍然失败，尝试 LIKE 匹配
      if (memories.length === 0) {
        [memories] = await connection.execute(
          'SELECT id, size FROM memories WHERE size LIKE ?',
          [`%${memory}%`]
        );
      }

      if (memories.length === 0) {
        const [allMemories] = await connection.execute('SELECT id, size FROM memories LIMIT 20');
        log.error('❌ 内存不存在:', memory);
        log.error('📋 可用内存:', allMemories.map(m => m.size).join(', '));
        throw new Error(`内存"${memory}"不存在，可用内存: ${allMemories.map(m => m.size).join(', ')}`);
      }
      finalMemoryId = memories[0].id;
      log.debug('✅ 内存规格转ID:', finalMemoryId, `(数据库规格: ${memories[0].size})`);
    } else {
      throw new Error('内存参数无效，需要ID或规格');
    }

    // 5. 创建或获取客户记录（需要先创建客户，以便检查IMEI重复）
    let customer_id = null;
    const [existingCustomers] = await connection.execute(
      'SELECT id FROM customers WHERE phone = ?',
      [customer_phone]
    );
    if (existingCustomers.length > 0) {
      customer_id = existingCustomers[0].id;
      // 更新客户信息
      if (customer_name) {
        await connection.execute(
          'UPDATE customers SET name = COALESCE(?, name), id_card = COALESCE(?, id_card) WHERE id = ?',
          [customer_name, customer_idcard || null, customer_id]
        );
      }
    } else {
      // 创建新客户（自动生成会员号）
      const memberNumber = await generateMemberNumber({ connection });
      const [newCustomer] = await connection.execute(
        'INSERT INTO customers (name, phone, id_card, member_number, created_at) VALUES (?, ?, ?, ?, NOW())',
        [customer_name || '', customer_phone, customer_idcard || null, memberNumber]
      );
      customer_id = newCustomer.insertId;
      log.debug('✅ 创建新客户，ID:', customer_id, '会员号:', memberNumber);
    }

    // 6. 检查IMEI是否已存在（但允许不同客户拥有相同IMEI）
    // 只有当同一客户已拥有相同IMEI时才报错
    log.debug(`🔍 检查 IMEI ${imei} 和客户 ${customer_id} 的组合...`);
    const [existingPhones] = await connection.execute(
      `SELECT p.id, p.imei, s.customer_id
       FROM phones p
       LEFT JOIN sales s ON p.id = s.phone_id
       WHERE p.imei = ? AND s.customer_id = ?`,
      [imei, customer_id]
    );

    log.debug(`🔍 查询结果: 找到 ${existingPhones.length} 条记录`);
    if (existingPhones.length > 0) {
      log.debug(`❌ 该客户 ${customer_id} 已拥有 IMEI ${imei}`);
      await connection.rollback();
      return ApiResponse.error(res, '该客户已存在相同IMEI的手机', 400);
    }

    // 不同客户可以拥有相同IMEI的手机，这里记录日志
    const [allImeiPhones] = await connection.execute(
      'SELECT id FROM phones WHERE imei = ?',
      [imei]
    );
    if (allImeiPhones.length > 0) {
      log.debug(`ℹ️ IMEI ${imei} 已存在于其他客户，允许当前客户使用相同IMEI`);
    }

    // 7. 创建手机记录（直接设置为已销售状态）
    // 生成采购单号（快速出库使用 QS 开头）
    const purchase_number = `QS${Date.now()}`;

    const inventoryTimeStr = normalizeDateTime(stock_in_date, true);
    const saleTimeStr = normalizeDateTime(sale_date, true);

    const insertParams = [
      purchase_number,
      operator_id, // inventory_operator_id
      finalBrandId, finalModelId, finalColorId, finalMemoryId,
      imei, serial_number,
      purchase_price || null, sale_price || null,
      is_new !== undefined ? is_new : 1,
      supplier_id, store_id,
      'sold',
      is_new === 1 ? 'A' : 'B', // quality_grade: 全新为A，二手为B
      remarks || null,
      inventoryTimeStr, // Inventorytime (北京时间 YYYY-MM-DD HH:mm:ss)
      saleTimeStr, // salestime (北京时间 YYYY-MM-DD HH:mm:ss)
      operator_id // sale_operator_id: 销售员ID
    ];

    log.debug('📝 准备插入phones表，参数数量:', insertParams.length);
    log.debug('📝 插入参数:', insertParams);

    const [phoneResult] = await connection.execute(`
      INSERT INTO phones (
        purchase_number, inventory_operator_id, brand_id, model_id, color_id, memory_id,
        imei, serial_number, purchase_cost, sale_price, is_new, supplier_id, store_id, status,
        quality_grade, remarks, Inventorytime, salestime, sale_operator_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, insertParams);
    const phone_id = phoneResult.insertId;

    // 8. 创建销售记录（包含价格和成本、店铺信息）
    const [saleResult] = await connection.execute(`
      INSERT INTO sales (
        phone_id, customer_id, sale_type, operator_id, store_id,
        price, cost, payment_method, sale_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      phone_id,
      customer_id,
      'retail',
      operator_id,
      store_id,  // 🔥 添加店铺ID
      sale_price || 0,  // 🔥 添加销售价
      purchase_price || 0,  // 🔥 添加入库成本
      payment_method || '现金',
      saleTimeStr
    ]);
    const sale_id = saleResult.insertId;

    await connection.commit();

    log.debug('✅ 快速出库成功，phone_id:', phone_id, 'sale_id:', sale_id);

    ApiResponse.success(res, '快速出库成功', {
      phone_id,
      sale_id,
      imei,
      customer_name
    });

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    log.error('❌ 快速出库失败:', error);
    ApiResponse.serverError(res, error.message || '快速出库失败', error);
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// 添加根路由，重定向到 /list
router.get('/', unifiedAuth, (req, res) => {
  res.redirect(301, '/list');
});

module.exports = router;
