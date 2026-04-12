const express = require('express');
const router = express.Router();
const { unifiedAuth, requirePermission, requireAnyPermission } = require('../middleware/unified-auth');
const ApiResponse = require('../utils/response');
const { cacheMiddleware, clearCache } = require('../middleware/cache');
const { generateMemberNumber } = require('../utils/member-number');
const log = require('../utils/log');

// 模拟手机数据
const mockPhones = [
  {
    id: 1,
    model_id: 1,
    model_name: 'iPhone 15 Pro',
    brand_id: 1,
    brand_name: 'Apple',
    color_id: 1,
    color_name: '深空黑色',
    memory_id: 1,
    memory_spec: '256GB',
    store_id: 1,
    store_name: '总店',
    imei: '4901542032375185',
    serial_number: 'FX7W1V8JK9QG',
    price: 8999.00,
    cost_price: 7500.00,
    sale_price: 8999.00,
    status: 'available',
    condition: 'new',
    stock_date: '2024-01-15',
    supplier_id: 1,
    supplier_name: '苹果官方',
    notes: '全新原装正品',
    images: [],
    created_at: '2024-01-15T10:30:00Z',
    updated_at: '2024-01-15T10:30:00Z'
  },
  {
    id: 2,
    model_id: 1,
    model_name: 'iPhone 15 Pro',
    brand_id: 1,
    brand_name: 'Apple',
    color_id: 2,
    color_name: '钛金属',
    memory_id: 2,
    memory_spec: '512GB',
    store_id: 1,
    store_name: '总店',
    imei: '4901542032375186',
    serial_number: 'FX7W1V8JK9QH',
    price: 10999.00,
    cost_price: 9200.00,
    sale_price: 10999.00,
    status: 'available',
    condition: 'new',
    stock_date: '2024-01-15T10:31:00Z',
    supplier_id: 1,
    supplier_name: '苹果官方',
    notes: '全新原装正品',
    images: [],
    created_at: '2024-01-15T10:31:00Z',
    updated_at: '2024-01-15T10:31:00Z'
  },
  {
    id: 3,
    model_id: 2,
    model_name: 'iPhone 15',
    brand_id: 1,
    brand_name: 'Apple',
    color_id: 3,
    color_name: '粉红色',
    memory_id: 1,
    memory_spec: '256GB',
    store_id: 2,
    store_name: '分店A',
    imei: '4901542032375187',
    serial_number: 'FX7W1V8JK9QI',
    price: 6999.00,
    cost_price: 5800.00,
    sale_price: 6999.00,
    status: 'sold',
    condition: 'new',
    stock_date: '2024-01-10T09:15:00Z',
    supplier_id: 1,
    supplier_name: '苹果官方',
    notes: '已售出',
    images: [],
    created_at: '2024-01-10T09:15:00Z',
    updated_at: '2024-01-18T14:20:00Z'
  },
  {
    id: 4,
    model_id: 3,
    model_name: 'Galaxy S24 Ultra',
    brand_id: 2,
    brand_name: 'Samsung',
    color_id: 4,
    color_name: '钛紫色',
    memory_id: 3,
    memory_spec: '1TB',
    store_id: 1,
    store_name: '总店',
    imei: '4901542032375188',
    serial_number: 'SM-S928BZNKXFA',
    price: 12999.00,
    cost_price: 11000.00,
    sale_price: 12999.00,
    status: 'available',
    condition: 'new',
    stock_date: '2024-01-20T11:45:00Z',
    supplier_id: 2,
    supplier_name: '三星官方',
    notes: '全新原装正品',
    images: [],
    created_at: '2024-01-20T11:45:00Z',
    updated_at: '2024-01-20T11:45:00Z'
  },
  {
    id: 5,
    model_id: 4,
    model_name: 'Xiaomi 14 Pro',
    brand_id: 3,
    brand_name: 'Xiaomi',
    color_id: 5,
    color_name: '陶瓷白',
    memory_id: 2,
    memory_spec: '512GB',
    store_id: 2,
    store_name: '分店A',
    imei: '4901542032375189',
    serial_number: '23127PN0CC',
    price: 5299.00,
    cost_price: 4300.00,
    sale_price: 5299.00,
    status: 'reserved',
    condition: 'new',
    stock_date: '2024-01-22T16:30:00Z',
    supplier_id: 3,
    supplier_name: '小米官方',
    notes: '客户预定',
    images: [],
    created_at: '2024-01-22T16:30:00Z',
    updated_at: '2024-01-23T10:15:00Z'
  }
];

// 测试搜索功能的接口
router.get('/search-test', unifiedAuth, requirePermission('inventory:view'), async (req, res) => {
  try {
    const { search } = req.query;
    log.debug('🔍 测试搜索功能，搜索词:', search);

    const pool = require('../config/database').getDatabase();
    const connection = await pool.getConnection();

    try {
      // 构建WHERE条件
      let whereConditions = [];
      let queryParams = [];
      let searchType = '';

      // 搜索功能 - 支持所有字段的智能识别
      if (search) {
        const searchStr = search.trim();

        // IMEI 精确匹配 (15位数字)
        if (/^\d{15}$/.test(searchStr)) {
          whereConditions.push('p.imei = ?');
          queryParams.push(searchStr);
          searchType = 'IMEI精确匹配';
        }
        // 序列号精确匹配 (字母数字组合)
        else if (/^[A-Za-z0-9]{8,}$/.test(searchStr)) {
          whereConditions.push('UPPER(p.serial_number) LIKE ?');
          queryParams.push(`%${searchStr.toUpperCase()}%`);
          searchType = '序列号匹配';
        }
        // 内存规格匹配 (如 256GB, 512GB, 1TB)
        else if (/^(\d+[Gg][Bb]|1[Tt][Bb])$/.test(searchStr)) {
          whereConditions.push('UPPER(mem.size) LIKE ?');
          queryParams.push(`%${searchStr.toUpperCase()}%`);
          searchType = '内存规格匹配';
        }
        // 状态匹配 (英文状态)
        else if (['available', 'sold', 'reserved', 'repair', 'lost'].includes(searchStr.toLowerCase())) {
          whereConditions.push('p.status = ?');
          queryParams.push(searchStr.toLowerCase());
          searchType = '状态匹配(英文)';
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
          searchType = '状态匹配(中文)';
        }
        // 成色匹配
        else if (['new', 'used', '全新', '二手'].includes(searchStr.toLowerCase())) {
          const isNew = ['new', '全新'].includes(searchStr.toLowerCase());
          whereConditions.push('p.is_new = ?');
          queryParams.push(isNew ? 1 : 0);
          searchType = '成色匹配';
        }
        // 质量等级匹配
        else if (/^[A-C]$/.test(searchStr.toUpperCase())) {
          whereConditions.push('UPPER(p.quality_grade) = ?');
          queryParams.push(searchStr.toUpperCase());
          searchType = '质量等级匹配';
        }
        // 日期格式匹配 (YYYY-MM-DD)
        else if (/^\d{4}-\d{2}-\d{2}$/.test(searchStr)) {
          whereConditions.push('(DATE(p.Inventorytime) = ? OR DATE(p.salestime) = ?)');
          queryParams.push(searchStr, searchStr);
          searchType = '日期匹配';
        }
        // 价格相关匹配 (纯数字，可能查询价格)
        else if (/^\d+$/.test(searchStr)) {
          const price = parseFloat(searchStr);
          whereConditions.push('(p.sale_price = ? OR p.purchase_cost = ?)');
          queryParams.push(price, price);
          searchType = '价格匹配';
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
          searchType = '全字段模糊搜索';
        }
      }

      // 构建SQL查询
      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      const query = `
        SELECT
          p.id,
          p.imei,
          p.serial_number,
          b.name as brand,
          m.name as model,
          co.name as color,
          mem.size as memory,
          p.status,
          p.is_new,
          p.quality_grade,
          p.sale_price,
          p.purchase_cost,
          p.remarks,
          st.name as store_name,
          s.name as supplier_name,
          DATE(p.Inventorytime) as inventory_date,
          DATE(p.salestime) as sale_date
        FROM phones p
        LEFT JOIN brands b ON p.brand_id = b.id
        LEFT JOIN models m ON p.model_id = m.id
        LEFT JOIN colors co ON p.color_id = co.id
        LEFT JOIN memories mem ON p.memory_id = mem.id
        LEFT JOIN stores st ON p.store_id = st.id
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        ${whereClause}
        ORDER BY p.Inventorytime DESC
        LIMIT 50
      `;

      log.debug('🔍 执行测试搜索SQL:', query);
      log.debug('🔍 查询参数:', queryParams);

      const [results] = await connection.execute(query, queryParams);

      connection.release();

      const responseData = {
        search_term: search,
        search_type: searchType,
        conditions: whereConditions,
        total_results: results.length,
        data: results
      };

      log.debug('✅ 搜索测试完成，找到', results.length, '条记录');
      ApiResponse.success(res, responseData, '搜索测试成功');

    } catch (dbError) {
      connection.release();
      throw dbError;
    }
  } catch (error) {
    log.error('搜索测试失败:', error);
    ApiResponse.serverError(res, '搜索测试失败', error);
  }
});

// 获取手机列表
router.get('/', unifiedAuth, requirePermission('inventory:view'), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10000,
      brand_id,
      model_id,
      store_id,
      status,
      condition,
      search,
      supplier_id,
      date
    } = req.query;

    // 从数据库查询手机列表
    const pool = require('../config/database').getDatabase();
    const connection = await pool.getConnection();

    try {
      // 构建WHERE条件
      let whereConditions = [];
      let queryParams = [];

      // 品牌筛选
      if (brand_id) {
        whereConditions.push('p.brand_id = ?');
        queryParams.push(parseInt(brand_id));
      }

      // 型号筛选
      if (model_id) {
        whereConditions.push('p.model_id = ?');
        queryParams.push(parseInt(model_id));
      }

      // 门店筛选
      if (store_id) {
        whereConditions.push('p.store_id = ?');
        queryParams.push(parseInt(store_id));
      }

      // 供应商筛选
      if (supplier_id) {
        whereConditions.push('p.supplier_id = ?');
        queryParams.push(parseInt(supplier_id));
      }

      // 状态筛选
      if (status) {
        whereConditions.push('p.status = ?');
        queryParams.push(status);
      }

      // 成色筛选 (is_new字段)
      if (condition) {
        whereConditions.push('p.is_new = ?');
        queryParams.push(condition === 'new' ? 1 : 0);
      }

      // 日期筛选
      if (date) {
        if (date.includes(',')) {
          // 日期范围
          const [startDate, endDate] = date.split(',');
          whereConditions.push('p.Inventorytime BETWEEN ? AND ?');
          queryParams.push(startDate.trim(), endDate.trim());
        } else {
          // 单个日期
          whereConditions.push('DATE(p.Inventorytime) = ?');
          queryParams.push(date);
        }
      }

      // 搜索功能 - 支持所有字段的智能识别
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
        // 价格相关匹配 (纯数字，可能查询价格)
        else if (/^\d+$/.test(searchStr)) {
          const price = parseFloat(searchStr);
          whereConditions.push('(p.sale_price = ? OR p.purchase_cost = ?)');
          queryParams.push(price, price);
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
            p.purchase_number LIKE ? OR
            DATE(p.Inventorytime) LIKE ? OR
            DATE(p.salestime) LIKE ?
          )`);
          const searchTerm = `%${searchStr}%`;
          queryParams.push(
            searchTerm, // imei
            searchTerm, // serial_number
            searchTerm, // brand
            searchTerm, // model
            searchTerm, // color
            searchTerm, // memory
            searchTerm, // status
            searchTerm, // quality_grade
            searchTerm, // remarks
            searchTerm, // store
            searchTerm, // supplier
            searchTerm, // purchase_number
            searchTerm, // inventory_time
            searchTerm  // sale_time
          );
        }
      }

      // 构建SQL查询
      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // 获取总数 - 需要包含所有JOIN
      const countQuery = `
        SELECT COUNT(*) as total
        FROM phones p
        LEFT JOIN brands b ON p.brand_id = b.id
        LEFT JOIN models m ON p.model_id = m.id
        LEFT JOIN colors co ON p.color_id = co.id
        LEFT JOIN memories mem ON p.memory_id = mem.id
        LEFT JOIN stores st ON p.store_id = st.id
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        ${whereClause}
      `;
      const [countResult] = await connection.execute(countQuery, queryParams);
      const total = countResult[0].total;

      // 分页查询
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const dataQuery = `
        SELECT p.id, p.imei, p.serial_number, p.brand_id, p.model_id, p.color_id, p.memory_id, p.sale_price, p.is_new, p.status, p.quality_grade, p.remarks, p.purchase_number, p.inventory_operator_id, p.sale_operator_id, p.supplier_id, p.store_id, p.Inventorytime, p.salestime,
               s.name as supplier_name,
               st.name as store_name,
               su.name as sale_operator_name,
               inv_u.name as inventory_operator_name,
               latest_sale.customer_id,
               c.name as customer_name,
               c.phone as customer_phone
        FROM phones p
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN colors co ON p.color_id = co.id
      LEFT JOIN memories mem ON p.memory_id = mem.id
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        LEFT JOIN stores st ON p.store_id = st.id
          LEFT JOIN users su ON p.sale_operator_id = su.id
          LEFT JOIN users inv_u ON p.inventory_operator_id = inv_u.id
          LEFT JOIN (
            SELECT
              s.customer_id,
              s.phone_id,
              ROW_NUMBER() OVER (PARTITION BY s.phone_id ORDER BY s.created_at DESC) as rn
            FROM sales s
          ) latest_sale ON p.id = latest_sale.phone_id AND latest_sale.rn = 1
        LEFT JOIN customers c ON latest_sale.customer_id = c.id
        ${whereClause}
        ORDER BY p.Inventorytime DESC
        LIMIT ? OFFSET ?
      `;

      const [phones] = await connection.execute(dataQuery, [...queryParams, parseInt(limit), offset]);

      // 处理返回数据格式
      const processedPhones = phones.map(phone => ({
        ...phone,
        purchase_price: phone.purchase_cost || phone.price, // 使用新的purchase_cost字段，如果没有则使用原price字段
        sale_price: phone.sale_price || phone.price // 使用新的sale_price字段，如果没有则使用原price字段
      }));

      // 释放连接
      connection.release();

      ApiResponse.success(res, {
        phones: processedPhones,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (dbError) {
      connection.release();
      throw dbError;
    }
  } catch (error) {
    log.error('获取手机列表失败:', error);
    ApiResponse.serverError(res, '获取手机列表失败', error);
  }
});

// 获取手机品牌列表
router.get('/brands', unifiedAuth, requirePermission('brands:view'), cacheMiddleware({ ttl: 1000 }), async (req, res) => {
  try {
    const { sold_only } = req.query;
    log.debug('🏷️ 品牌API调用参数:', { sold_only });

    const pool = require('../config/database').getDatabase();
    const connection = await pool.getConnection();

    try {
      // 确保brands表包含所有phones表中使用的品牌
      await syncBrandRecords(connection);

      // 查询brands表数据
      const query = 'SELECT DISTINCT name FROM brands WHERE name IS NOT NULL AND name != "" ORDER BY name';
      log.debug('🔍 执行品牌查询SQL:', query);
      const [brands] = await connection.execute(query);
      log.debug('📊 查询结果数量:', brands.length);
      log.debug('📊 查询结果数据:', brands);

      connection.release();

      const brandList = brands.map(item => item.name);
      log.debug('📤 返回给前端的品牌列表:', brandList);
      ApiResponse.success(res, brandList);
    } catch (dbError) {
      connection.release();
      log.error('❌ 品牌数据库查询失败:', dbError);
      throw dbError;
    }
  } catch (error) {
    log.error('❌ 获取品牌列表失败:', error);
    ApiResponse.serverError(res, '获取品牌列表失败', error);
  }
});

// 获取手机型号列表
router.get('/models', unifiedAuth, requirePermission('models:view'), cacheMiddleware({ ttl: 1 }), async (req, res) => {
  try {
    const { sold_only, brand } = req.query;
    log.debug('🔍 型号API调用参数:', { sold_only, brand });
    const pool = require('../config/database').getDatabase();
    const connection = await pool.getConnection();

    try {
      // 确保models表包含所有phones表中使用的型号，并建立品牌关联
      await syncModelRecords(connection, brand);

      // 构建查询获取型号列表（包含 sort_order 用于排序）
      let query = `
        SELECT DISTINCT m.id, m.name, m.brand_id, m.sort_order
        FROM models m
        WHERE m.name IS NOT NULL AND m.name != ""
      `;
      let queryParams = [];

      // 如果提供了品牌过滤参数，通过品牌ID关联查询
      if (brand) {
        query += `
          AND m.brand_id = (SELECT id FROM brands WHERE name = ? LIMIT 1)
        `;
        queryParams.push(brand);
      }
      query += ' ORDER BY m.sort_order, m.name';

      log.debug('🔍 执行型号查询SQL:', query);
      log.debug('🔍 查询参数:', queryParams);
      const [models] = await connection.execute(query, queryParams);
      log.debug('📊 型号查询结果数量:', models.length);
      log.debug('📊 型号查询结果数据:', models);

      connection.release();

      // 返回完整的型号对象数组，让前端可以按 sort_order 排序
      const modelList = models.map(item => ({
        id: item.id,
        name: item.name,
        brand_id: item.brand_id,
        sort_order: item.sort_order || 0
      }));
      log.debug('📤 返回给前端的型号列表:', modelList);
      ApiResponse.success(res, modelList);
    } catch (dbError) {
      connection.release();
      log.error('❌ 型号数据库查询失败:', dbError);
      throw dbError;
    }
  } catch (error) {
    log.error('获取型号列表失败:', error);
    ApiResponse.serverError(res, '获取型号列表失败', error);
  }
});

// 获取手机颜色列表
router.get('/colors', unifiedAuth, requirePermission('colors:view'), cacheMiddleware({ ttl: 1000 }), async (req, res) => {
  try {
    const { sold_only } = req.query;
    const pool = require('../config/database').getDatabase();
    const connection = await pool.getConnection();

    try {
      // 先检查colors表结构
      try {
        const [tableInfo] = await connection.execute('DESCRIBE colors');
        log.debug('✅ colors表存在，字段信息:', tableInfo.map(f => f.Field));

        const hasNameField = tableInfo.some(f => f.Field === 'name');
        if (hasNameField) {
          const query = 'SELECT DISTINCT name FROM colors WHERE name IS NOT NULL AND name != "" ORDER BY name';
          log.debug('🔍 执行颜色查询SQL:', query);
          const [colors] = await connection.execute(query);
          log.debug('📊 颜色查询结果数量:', colors.length);
          log.debug('📊 颜色查询结果数据:', colors);

          connection.release();
          const colorList = colors.map(item => item.name);
          log.debug('📤 返回给前端的颜色列表:', colorList);
          return ApiResponse.success(res, colorList);
        } else {
          log.debug('❌ colors表没有name字段');
          throw new Error('colors表没有name字段');
        }
      } catch (err) {
        log.debug('❌ colors表不存在或无法访问:', err.message);
      }

      // 回退到从phones表获取
      log.debug('🔄 使用phones表作为颜色的备选方案');
      const fallbackQuery = 'SELECT DISTINCT as name FROM phones WHERE IS NOT NULL AND != "" ORDER BY ';
      log.debug('🔄 备选SQL:', fallbackQuery);
      const [fallbackColors] = await connection.execute(fallbackQuery);
      const colorList = fallbackColors.map(item => item.name);
      log.debug('📤 从phones表返回颜色列表:', colorList);

      connection.release();
      ApiResponse.success(res, colorList);
    } catch (dbError) {
      connection.release();
      log.error('❌ 颜色数据库查询失败:', dbError);
      throw dbError;
    }
  } catch (error) {
    log.error('获取颜色列表失败:', error);
    ApiResponse.serverError(res, '获取颜色列表失败', error);
  }
});

// 获取手机内存列表
router.get('/memories', unifiedAuth, requirePermission('memories:view'), cacheMiddleware({ ttl: 1000 }), async (req, res) => {
  try {
    const { sold_only } = req.query;
    log.debug('🔍 内存API调用参数:', { sold_only });
    const pool = require('../config/database').getDatabase();
    const connection = await pool.getConnection();

    try {
      // 确保memories表包含所有phones表中使用的内存规格
      await syncMemoryRecords(connection);

      // 构建查询获取内存列表
      let query = `
        SELECT DISTINCT m.size
        FROM memories m
        WHERE m.size IS NOT NULL AND m.size != ""
      `;
      let queryParams = [];

      // 如果提供了品牌或型号过滤参数，通过phones表关联查询
      if (false) {
        let joinConditions = [];
        if (false) {
          joinConditions.push('b.name = ?');
          /* 参数缺失 */
        }
        if (false) {
          joinConditions.push('m.name = ?');
          /* 参数缺失 */
        }

        query = `
          SELECT DISTINCT m.size
          FROM memories m
          INNER JOIN phones p ON m.size = mem.size
          WHERE m.size IS NOT NULL AND m.size != ""
          AND p.IS NOT NULL AND p.!= ""
          AND ${joinConditions.join(' AND ')}
          ORDER BY m.size
        `;
        log.debug('🔍 执行品牌/型号过滤的内存查询SQL:', query);
        log.debug('🔍 查询参数:', queryParams);
      } else {
        query += ' ORDER BY m.size';
        log.debug('🔍 执行基础内存查询SQL:', query);
      }

      const [memories] = await connection.execute(query, queryParams);
      log.debug('📊 内存查询结果数量:', memories.length);
      log.debug('📊 内存查询结果数据:', memories);

      connection.release();

      // 从size字段获取内存数据
      const memoryList = memories.map(item => item.size);
      log.debug('📤 返回给前端的内存列表:', memoryList);
      ApiResponse.success(res, memoryList);
    } catch (dbError) {
      connection.release();
      log.error('❌ 内存数据库查询失败:', dbError);
      throw dbError;
    }
  } catch (error) {
    log.error('获取内存列表失败:', error);
    ApiResponse.serverError(res, '获取内存列表失败', error);
  }
});

// 同步内存记录：确保memories表包含phones表中所有使用的内存规格
async function syncMemoryRecords(connection) {
  try {
    // 获取phones表中所有不重复的内存规格
    const [phoneMemories] = await connection.execute(`
      SELECT DISTINCT mem.size as memory
      FROM phones p
      LEFT JOIN memories mem ON p.memory_id = mem.id
      WHERE mem.size IS NOT NULL AND mem.size != ""
      AND mem.size NOT IN (SELECT DISTINCT size FROM memories WHERE size = mem.size)
    `);

    for (const phoneMemory of phoneMemories) {
      const memorySpec = phoneMemory;
      log.debug(`🔧 为缺失的内存规格 "${memorySpec}" 创建memories表记录`);

      // 插入新的内存记录到memories表
      await connection.execute(
        'INSERT INTO memories (size, created_at, updated_at) VALUES (?, NOW(), NOW())',
        [memorySpec]
      );
    }

    if (phoneMemories.length > 0) {
      log.debug(`✅ 已为 ${phoneMemories.length} 个新内存规格创建memories表记录`);
    }
  } catch (error) {
    log.warn('⚠️ 同步内存记录时出现警告:', error.message);
    // 不抛出错误，允许继续执行后续逻辑
  }
}

// 同步品牌记录：确保brands表包含phones表中所有使用的品牌规格
async function syncBrandRecords(connection) {
  try {
    // 获取phones表中所有不重复的品牌规格
    const [phoneBrands] = await connection.execute(`
      SELECT DISTINCT b.name as brand
      FROM phones p
      LEFT JOIN brands b ON p.brand_id = b.id
      WHERE b.name IS NOT NULL AND b.name != ""
      AND b.name NOT IN (SELECT DISTINCT name FROM brands WHERE name = b.name)
    `);

    for (const phoneBrand of phoneBrands) {
      const brandSpec = phoneBrand;
      log.debug(`🔧 为缺失的品牌规格 "${brandSpec}" 创建brands表记录`);

      // 插入新的品牌记录到brands表
      await connection.execute(
        'INSERT INTO brands (name, created_at, updated_at) VALUES (?, NOW(), NOW())',
        [brandSpec]
      );
    }

    if (phoneBrands.length > 0) {
      log.debug(`✅ 已为 ${phoneBrands.length} 个新品牌规格创建brands表记录`);
    }
  } catch (error) {
    log.warn('⚠️ 同步品牌记录时出现警告:', error.message);
    // 不抛出错误，允许继续执行后续逻辑
  }
}

// 同步型号记录：确保models表包含phones表中所有使用的型号规格，并建立品牌关联
async function syncModelRecords(connection, brandFilter = null) {
  try {
    let whereClause = 'WHERE m.name IS NOT NULL AND m.name != ""';
    let params = [];
    let subQueryParams = [];

    // 添加品牌过滤条件
    if (brandFilter) {
      whereClause += ' AND b.name = ?';
      params.push(brandFilter);
      subQueryParams.push(brandFilter);
    }

    // 获取phones表中所有不重复的型号规格，并包含品牌信息
    const [phoneModels] = await connection.execute(`
      SELECT DISTINCT m.name as model, b.name as brand
      FROM phones p
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN brands b ON p.brand_id = b.id
      ${whereClause}
      AND m.name IS NOT NULL
      AND m.name NOT IN (
        SELECT DISTINCT name FROM models
        WHERE name = m.name
        ${brandFilter ? 'AND brand_id = (SELECT id FROM brands WHERE name = ? LIMIT 1)' : ''}
      )
      ORDER BY m.name`, [...params, ...subQueryParams]);

    for (const phoneModel of phoneModels) {
      const modelSpec = phoneModel.model;
      const brandSpec = phoneModel.brand;

      log.debug(`🔧 为缺失的型号规格 "${modelSpec}" (品牌: ${brandSpec}) 创建models表记录`);

      // 先确保品牌存在
      await syncBrandRecords(connection);

      // 获取品牌ID
      const [brandRecord] = await connection.execute(
        'SELECT id FROM brands WHERE name = ? LIMIT 1',
        [brandSpec]
      );

      let brandId = null;
      if (brandRecord.length > 0) {
        brandId = brandRecord[0].id;
      } else {
        // 如果品牌不存在，创建新品牌
        const [insertBrandResult] = await connection.execute(
          'INSERT INTO brands (name, created_at, updated_at) VALUES (?, NOW(), NOW())',
          [brandSpec]
        );
        brandId = insertBrandResult.insertId;
        log.debug(`🔧 为新品牌 "${brandSpec}" 创建了记录，ID: ${brandId}`);
      }

      // 🔥 关键修复：检查型号是否已存在，避免重复创建
      const [existingModel] = await connection.execute(
        'SELECT id FROM models WHERE brand_id = ? AND name = ? LIMIT 1',
        [brandId, modelSpec]
      );

      if (existingModel.length > 0) {
        log.debug(`ℹ️ 型号 "${modelSpec}" 已存在 (ID: ${existingModel[0].id}), 跳过创建`);
        continue;
      }

      // 🔥 过滤掉过期的 iPhone 11 Pro 系列型号（11pro, 11promax 等）
      const obsoleteModels = ['11pro', '11proamx', '11promax'];
      const normalizedModelSpec = modelSpec.toLowerCase().replace(/\s+/g, '');
      if (obsoleteModels.some(om => normalizedModelSpec.includes(om))) {
        log.debug(`⚠️ 跳过过期型号: ${modelSpec}`);
        continue;
      }

      // 插入新的型号记录到models表
      await connection.execute(
        'INSERT INTO models (brand_id, name, created_at, updated_at) VALUES (?, ?, NOW(), NOW())',
        [brandId, modelSpec]
      );
    }

    if (phoneModels.length > 0) {
      log.debug(`✅ 已为 ${phoneModels.length} 个新型号规格创建models表记录`);
    }
  } catch (error) {
    log.warn('⚠️ 同步型号记录时出现警告:', error.message);
    // 不抛出错误，允许继续执行后续逻辑
  }
}

// 获取已销售手机的时间信息（入库时间和出库时间）
router.get('/sold-timeline', unifiedAuth, requirePermission('system:edit'), async (req, res) => {
  try {
    const { } = req.query;
    const pool = require('../config/database').getDatabase();
    const connection = await pool.getConnection();

    try {
      let query = `
        SELECT
          p.id,
          b.name as brand,
          m.name as model,
          co.name as color,
          mem.size as memory,
          p.Inventorytime as inventory_time,  -- 入库时间
          latest_sale.sale_date as sale_time,        -- 出库时间（销售时间）
          c.name as customer_name,
          c.phone as customer_phone,
          st.name as store_name
        FROM phones p
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN colors co ON p.color_id = co.id
      LEFT JOIN memories mem ON p.memory_id = mem.id
        LEFT JOIN (
          SELECT
            s.*,
            ROW_NUMBER() OVER (PARTITION BY s.phone_id ORDER BY s.created_at DESC) as rn
          FROM sales s
        ) latest_sale ON p.id = latest_sale.phone_id AND latest_sale.rn = 1
        LEFT JOIN customers c ON latest_sale.customer_id = c.id
        LEFT JOIN stores st ON p.store_id = st.id
        WHERE p.status = 'sold'
      `;

      let queryParams = [];

      if (false) {
        query += ' AND b.name = ?';
        /* 参数缺失 */
      }

      if (false) {
        query += ' AND m.name = ?';
        /* 参数缺失 */
      }

      query += ' ORDER BY latest_sale.sale_date DESC';

      const [soldPhones] = await connection.execute(query, queryParams);

      connection.release();

      ApiResponse.success(res, soldPhones, '获取已销售手机时间线数据成功');
    } catch (dbError) {
      connection.release();
      throw dbError;
    }
  } catch (error) {
    log.error('获取已销售手机时间线数据失败:', error);
    ApiResponse.serverError(res, '获取已销售手机时间线数据失败', error);
  }
});

// 根据IMEI或序列号搜索商品（用于销售单添加商品）
// 支持精确匹配和模糊搜索
// 注意：此路由必须在 /:id 路由之前定义
router.get('/search-by-identifier', unifiedAuth, requirePermission('query:view'), async (req, res) => {
  let connection;
  try {
    const { keyword } = req.query;

    if (!keyword) {
      return ApiResponse.badRequest(res, '搜索关键字不能为空');
    }

    const pool = require('../config/database').getDatabase();
    connection = await pool.getConnection();

    const searchKeyword = keyword.trim();

    // 先尝试精确匹配 IMEI 或序列号
    const exactQuery = `
      SELECT
        p.id,
        p.imei,
        p.serial_number,
        b.name as brand_name,
        m.name as model_name,
        co.name as color_name,
        mem.size as memory_size,
        p.purchase_cost,
        p.sale_price,
        p.is_new,
        p.Inventorytime,
        p.status,
        p.salestime,
        st.name as store_name,
        st.id as store_id
      FROM phones p
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN colors co ON p.color_id = co.id
      LEFT JOIN memories mem ON p.memory_id = mem.id
      LEFT JOIN stores st ON p.store_id = st.id
      WHERE p.imei = ? OR p.serial_number = ?
      LIMIT 1
    `;

    const [exactResults] = await connection.execute(exactQuery, [searchKeyword, searchKeyword]);

    if (exactResults.length > 0) {
      connection.release();
      return ApiResponse.success(res, {
        ...exactResults[0],
        match_type: 'exact'
      }, '查询成功');
    }

    // 精确匹配未找到，尝试模糊搜索
    const fuzzyQuery = `
      SELECT
        p.id,
        p.imei,
        p.serial_number,
        b.name as brand_name,
        m.name as model_name,
        co.name as color_name,
        mem.size as memory_size,
        p.purchase_cost,
        p.sale_price,
        p.is_new,
        p.Inventorytime,
        p.status,
        p.salestime,
        st.name as store_name,
        st.id as store_id
      FROM phones p
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN colors co ON p.color_id = co.id
      LEFT JOIN memories mem ON p.memory_id = mem.id
      LEFT JOIN stores st ON p.store_id = st.id
      WHERE p.imei LIKE ? OR p.serial_number LIKE ?
      ORDER BY
        CASE
          WHEN p.imei = ? THEN 1
          WHEN p.serial_number = ? THEN 1
          WHEN p.imei LIKE ? THEN 2
          WHEN p.serial_number LIKE ? THEN 2
          ELSE 3
        END
      LIMIT 10
    `;

    const fuzzyPattern = `%${searchKeyword}%`;
    const [fuzzyResults] = await connection.execute(fuzzyQuery, [
      fuzzyPattern, fuzzyPattern,
      searchKeyword, searchKeyword,
      `${searchKeyword}%`, `${searchKeyword}%`
    ]);

    connection.release();

    if (fuzzyResults.length > 0) {
      // 返回模糊搜索结果（带匹配类型标记）
      const resultsWithType = fuzzyResults.map(item => ({
        ...item,
        match_type: 'fuzzy'
      }));
      return ApiResponse.success(res, resultsWithType, `找到 ${fuzzyResults.length} 个相似商品`);
    }

    // 没有找到任何结果
    return ApiResponse.success(res, [], `未找到匹配 "${searchKeyword}" 的商品，请检查IMEI或序列号`);

  } catch (error) {
    log.error('搜索商品失败:', error);
    if (connection) connection.release();
    ApiResponse.serverError(res, '搜索商品失败', error);
  }
});

// ===== 公开端点（无需登录认证）=====
// 注意：这些路由必须在 /:id 之前定义，否则会被 /:id 路由拦截

// 获取在库最久的商品信息（用于同行咨询，无需登录）
router.get('/longest-inventory', async (req, res) => {
  log.debug('🔓 [公开端点] longest-inventory 被调用！');
  let connection;
  try {
    const { brand, model, color, memory, store_id } = req.query;

    log.debug('📦 查询在库最久商品，参数:', { brand, model, color, memory, store_id });

    const pool = require('../config/database').getDatabase();
    connection = await pool.getConnection();

    // 构建WHERE条件
    let whereConditions = [
      'p.status = "in_stock"',
      'p.is_new = 1'
    ];
    let queryParams = [];

    if (brand) {
      whereConditions.push('b.name = ?');
      queryParams.push(brand);
    }
    if (model) {
      whereConditions.push('m.name = ?');
      queryParams.push(model);
    }
    if (color) {
      whereConditions.push('co.name = ?');
      queryParams.push(color);
    }
    if (memory) {
      whereConditions.push('mem.size = ?');
      queryParams.push(memory);
    }
    if (store_id) {
      whereConditions.push('p.store_id = ?');
      queryParams.push(parseInt(store_id));
    }

    const whereClause = whereConditions.join(' AND ');

    // 查询在库商品，按入库时间升序排序（最久的在前）
    const query = `
      SELECT
        p.id,
        p.imei,
        p.serial_number,
        b.name as brand,
        m.name as model,
        co.name as color,
        mem.size as memory,
        st.name as store_name,
        p.Inventorytime as inventory_time,
        p.sale_price,
        p.purchase_cost,
        p.remarks
      FROM phones p
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN colors co ON p.color_id = co.id
      LEFT JOIN memories mem ON p.memory_id = mem.id
      LEFT JOIN stores st ON p.store_id = st.id
      WHERE ${whereClause}
      ORDER BY p.Inventorytime ASC
      LIMIT 50
    `;

    log.debug('执行SQL:', query);
    log.debug('查询参数:', queryParams);

    const [results] = await connection.execute(query, queryParams);

    // 计算在库天数
    const today = new Date();
    const processedResults = results.map(item => {
      const inventoryDate = new Date(item.inventory_time);
      const diffTime = today.getTime() - inventoryDate.getTime();
      const inventoryDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return {
        ...item,
        inventory_days: inventoryDays,
        inventory_date: inventoryDate.toISOString().split('T')[0]
      };
    });

    connection.release();

    ApiResponse.success(res, {
      total: processedResults.length,
      data: processedResults
    }, '查询在库最久商品成功');
  } catch (error) {
    log.error('查询在库最久商品失败:', error);
    if (connection) connection.release();
    ApiResponse.serverError(res, '查询在库最久商品失败', error);
  }
});

// ===== 需要认证的路由 =====

// 获取单个手机详情
router.get('/:id', unifiedAuth, requirePermission('sales:view'), async (req, res) => {
  try {
    const { id } = req.params;

    // 从数据库查询手机详情
    const pool = require('../config/database').getDatabase();
    const connection = await pool.getConnection();
    const [phones] = await connection.execute(
      `SELECT
              p.id,
              p.imei,
              p.serial_number,
              p.brand_id,
              p.model_id,
              p.color_id,
              p.memory_id,
              p.purchase_cost,
              p.sale_price,
              p.is_new,
              p.status,
              p.quality_grade,
              p.remarks,
              p.purchase_number,
              p.inventory_operator_id,
              p.sale_operator_id as phone_sale_operator_id,
              p.supplier_id,
              p.store_id as inventory_store_id,
              p.Inventorytime,
              p.salestime,
              b.name as brand,
              m.name as model,
              co.name as color,
              mem.size as memory,
              s.name as supplier_name,
              st.name as inventory_store_name,
              inv_u.name as inventory_operator_name,
              latest_sale.customer_id,
              c.name as customer_name,
              c.phone as customer_phone,
              c.apple_id as customer_apple_id,
              -- 优先使用sales表中的operator_id，如果没有则使用phones表中的sale_operator_id
              COALESCE(sales_operator.name, su.name) as sale_operator_name,
              COALESCE(latest_sale.operator_id, p.sale_operator_id) as sale_operator_id,
              latest_sale.sale_type,
              latest_sale.payment_method,
              latest_sale.invoice_number,
              -- 销售店铺信息（从sales表获取）
              latest_sale.store_id as sale_store_id,
              sale_st.name as sale_store_name
       FROM phones p
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN colors co ON p.color_id = co.id
      LEFT JOIN memories mem ON p.memory_id = mem.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN stores st ON p.store_id = st.id
      LEFT JOIN users su ON p.sale_operator_id = su.id
      LEFT JOIN users inv_u ON p.inventory_operator_id = inv_u.id
      LEFT JOIN (
        SELECT
          s.id,
          s.customer_id,
          s.phone_id,
          s.operator_id,
          s.sale_type,
          s.payment_method,
          s.invoice_number,
          s.store_id,
          ROW_NUMBER() OVER (PARTITION BY s.phone_id ORDER BY s.created_at DESC) as rn
        FROM sales s
      ) latest_sale ON p.id = latest_sale.phone_id AND latest_sale.rn = 1
      LEFT JOIN customers c ON latest_sale.customer_id = c.id
      LEFT JOIN users sales_operator ON latest_sale.operator_id = sales_operator.id
      LEFT JOIN stores sale_st ON latest_sale.store_id = sale_st.id
      WHERE p.id = ?`,
      [id]
    );
    connection.release();

    if (phones.length === 0) {
      return ApiResponse.notFound(res, '手机不存在');
    }

    const phone = phones[0];
    // 返回数据时，使用新的字段结构
    // 如果有销售店铺，使用销售店铺；否则使用库存店铺
    const responsePhone = {
      ...phone,
      purchase_price: phone.purchase_cost || phone.price,
      sale_price: phone.sale_price || phone.price,
      // store_id 优先使用销售店铺，如果没有则使用库存店铺
      store_id: phone.sale_store_id || phone.inventory_store_id,
      store_name: phone.sale_store_name || phone.inventory_store_name
    };
    ApiResponse.success(res, responsePhone);
  } catch (error) {
    log.error('获取手机详情失败:', error);
    ApiResponse.serverError(res, '获取手机详情失败', error);
  }
});

// 创建手机
router.post('/', unifiedAuth, requirePermission('system:edit'), (req, res) => {
  try {
    const {
      model_id,
      brand_id,
      color_id,
      memory_id,
      store_id,
      imei,
      serial_number,
      price,
      // cost_price,
      sale_price,
      condition,
      supplier_id,
      notes
    } = req.body;

    // 验证必需字段
    if (!model_id || !brand_id || !store_id || !imei || !price) {
      return ApiResponse.badRequest(res, '缺少必需字段');
    }

    // 检查IMEI是否重复
    const existingPhone = mockPhones.find(p => p.imei === imei);
    if (existingPhone) {
      return ApiResponse.badRequest(res, 'IMEI已存在');
    }

    const newPhone = {
      id: Math.max(...mockPhones.map(p => p.id)) + 1,
      model_id,
      model_name: `型号 ${model_id}`, // 实际应用中应从models表获取
      brand_id,
      brand_name: `品牌 ${brand_id}`, // 实际应用中应从brands表获取
      color_id,
      color_name: `颜色 ${color_id}`, // 实际应用中应从colors表获取
      memory_id,
      memory_spec: `${memory_id}GB`, // 实际应用中应从memories表获取
      store_id,
      store_name: `门店 ${store_id}`, // 实际应用中应从stores表获取
      imei,
      serial_number: serial_number || '',
      price: parseFloat(price),
      purchase_price: parseFloat(price) || parseFloat(price) * 0.85,
      sale_price: parseFloat(sale_price) || parseFloat(price),
      status: 'available',
      condition: condition || 'new',
      stock_date: new Date().toISOString().split('T')[0],
      supplier_id: supplier_id || null,
      supplier_name: supplier_id ? `供应商 ${supplier_id}` : null,
      notes: notes || '',
      images: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    mockPhones.push(newPhone);

    ApiResponse.created(res, '手机创建成功', newPhone);
  } catch (error) {
    log.error('创建手机失败:', error);
    ApiResponse.serverError(res, '创建手机失败', error);
  }
});

// 更新手机 - 支持四种权限：phones:edit（库存管理）、sales-editphoneview:edit（销售管理）、query:edit（综合查询编辑）、inventory:edit（库存编辑）
router.put('/:id', unifiedAuth, requireAnyPermission(['phones:edit', 'sales-editphoneview:edit', 'query:edit', 'inventory:edit']), async (req, res) => {
  let connection;
  try {
    const { id } = req.params;

    // 先打印整个请求体
    log.debug('🔍 PUT /phones/:', id, ' 请求体:', req.body);

    const {
      // 前端编辑页面发送的字段名
      brand_id,
      model_id,
      color_id,
      memory_id,
      // 前端可能发送的名称字段
      brand,
      model,
      color,
      memory,
      supplier_id,
      store_id,
      condition,
      imei,
      serial_number,
      cost_price,
      purchase_cost,       // 入库价格字段 (SalesView.vue 使用)
      purchase_unit_price, // 备用字段名
      purchase_price,      // 前端实际发送的入库价格字段
      sale_price,          // 前端实际发送的销售价格字段
      purchase_operator_id,   // 入库员ID
      sale_operator_id,        // 销售员ID
      stock_in_date,       // 入库时间 (前端发送的字段名)
      created_at,          // 入库时间 (SalesView.vue 发送的字段名)
      Inventorytime,        // 入库时间 (新字段名)
      salestime,            // 销售时间 (新字段名)
      // 客户信息字段 - 使用customer_id关联customers表
      customer_id,
      customer_name,       // 客户姓名
      customer_phone,      // 客户手机号
      apple_id,            // Apple ID
      status,               // 状态字段 (in_stock, sold, peer_transfer, supplier_proxy等)
      remarks
    } = req.body;

    // 处理notes/remarks字段兼容性
    const finalNotes = remarks || '';

    // 验证必需字段 - 使用前端字段名
    // brand_id 或 brand 至少需要一个
    if (!brand_id && !brand) {
      return ApiResponse.badRequest(res, '缺少品牌字段');
    }
    // model_id 或 model 至少需要一个
    if (!model_id && !model) {
      return ApiResponse.badRequest(res, '缺少型号字段');
    }
    if (!store_id) {
      return ApiResponse.badRequest(res, '缺少店铺字段');
    }
    if (!imei) {
      return ApiResponse.badRequest(res, '缺少IMEI号');
    }

    // 打印调试信息
    log.debug('📝 收到的更新数据:', {
      id,
      brand_id,
      brand,
      model_id,
      model,
      color_id,
      color,
      memory_id,
      memory,
      store_id,
      imei
    });
    // price字段不再是必需的，因为编辑页面只修改成本字段
    // 如果需要修改销售价格，可以在专门的页面或接口中处理

    // 获取数据库连接
    const pool = require('../config/database').getDatabase();
    connection = await pool.getConnection();

    // 检查手机是否存在
    const [existingPhones] = await connection.execute(
      'SELECT id FROM phones WHERE id = ?',
      [id]
    );

    if (existingPhones.length === 0) {
      return ApiResponse.notFound(res, '手机不存在');
    }

    // 检查IMEI是否重复（排除当前手机）
    // 只有当同一客户拥有相同IMEI时才报错，不同客户可以有相同IMEI
    let shouldRejectImei = false;

    const [duplicateImei] = await connection.execute(
      `SELECT p.id, s.customer_id
       FROM phones p
       LEFT JOIN sales s ON p.id = s.phone_id
       WHERE p.imei = ? AND p.id != ?`,
      [imei, id]
    );

    if (duplicateImei.length > 0) {
      // 检查是否有相同客户的重复IMEI
      for (const dup of duplicateImei) {
        if (dup.customer_id === customer_id) {
          shouldRejectImei = true;
          break;
        }
      }

      if (shouldRejectImei) {
        return ApiResponse.badRequest(res, '该客户已存在相同IMEI的手机');
      }
      // 如果客户不同，允许相同IMEI（不同客户可以拥有相同IMEI的手机）
      log.debug(`ℹ️ IMEI ${imei} 已存在于其他客户，允许继续`);
    }

    // 获取对应的brand_id
    let brandId = brand_id;  // 优先使用前端传递的brand_id
    if (!brandId && brand) {  // 如果没有brand_id但有brand字段，进行转换
      try {
        const [brandRecord] = await connection.execute(
          'SELECT id FROM brands WHERE name = ? LIMIT 1',
          [brand]
        );
        if (brandRecord.length > 0) {
          brandId = brandRecord[0].id;
        } else {
          return ApiResponse.badRequest(res, `品牌不存在，无法在编辑时自动创建：${brand}`);
        }
      } catch (brandError) {
        log.warn('获取brand_id失败:', brandError.message);
        // 如果获取失败，继续使用文本字段
      }
    }

    // 获取对应的model_id - 必须在brandId获取之后
    let modelId = model_id;  // 优先使用前端传递的model_id
    if (!modelId && model && brandId) {  // 如果没有model_id但有model字段和brandId，进行转换
      try {
        const normalizedModelName = String(model).trim().toLowerCase().replace(/\s+/g, '');
        const [modelRecord] = await connection.execute(
          `SELECT id
           FROM models
           WHERE brand_id = ?
             AND (
               name = ?
               OR LOWER(REPLACE(name, ' ', '')) = ?
             )
           ORDER BY CASE WHEN name = ? THEN 0 ELSE 1 END, id ASC
           LIMIT 1`,
          [brandId, model, normalizedModelName, model]
        );
        if (modelRecord.length > 0) {
          modelId = modelRecord[0].id;
        } else {
          return ApiResponse.badRequest(res, `型号不存在，无法在编辑时自动创建：${model}`);
        }
      } catch (ModelError) {
        log.warn('获取model_id失败:', ModelError.message);
        // 如果获取失败，继续使用文本字段
      }
    } else if (!modelId && model) {
      // 如果有model但没有brandId，尝试查找或创建不分品牌的model记录
      try {
        const normalizedModelName = String(model).trim().toLowerCase().replace(/\s+/g, '');
        const [modelRecord] = await connection.execute(
          `SELECT id
           FROM models
           WHERE name = ?
              OR LOWER(REPLACE(name, ' ', '')) = ?
           ORDER BY CASE WHEN name = ? THEN 0 ELSE 1 END, id ASC
           LIMIT 1`,
          [model, normalizedModelName, model]
        );
        if (modelRecord.length > 0) {
          modelId = modelRecord[0].id;
        } else {
          return ApiResponse.badRequest(res, `型号不存在，无法在编辑时自动创建：${model}`);
        }
      } catch (ModelError) {
        log.warn('获取model_id失败:', ModelError.message);
      }
    }

    // 获取对应的color_id
    let colorId = color_id;  // 优先使用前端传递的color_id
    if (!colorId && color) {  // 如果没有color_id但有color字段，进行转换
      try {
        const [colorRecord] = await connection.execute(
          'SELECT id FROM colors WHERE name = ? LIMIT 1',
          [color]
        );
        if (colorRecord.length > 0) {
          colorId = colorRecord[0].id;
        } else {
          return ApiResponse.badRequest(res, `颜色不存在，无法在编辑时自动创建：${color}`);
        }
      } catch (colorError) {
        log.warn('获取color_id失败:', colorError.message);
        // 如果获取失败，继续使用文本字段
      }
    }

    // 获取对应的memory_id
    let memoryId = memory_id;  // 优先使用前端传递的memory_id
    if (!memoryId && memory) {  // 如果没有memory_id但有memory字段，进行转换
      try {
        const [memoryRecord] = await connection.execute(
          'SELECT id FROM memories WHERE size = ? LIMIT 1',
          [memory]
        );
        if (memoryRecord.length > 0) {
          memoryId = memoryRecord[0].id;
        } else {
          return ApiResponse.badRequest(res, `内存不存在，无法在编辑时自动创建：${memory}`);
        }
      } catch (memoryError) {
        log.warn('获取memory_id失败:', memoryError.message);
        // 如果获取失败，继续使用文本字段
      }
    }

    // 获取对应的inventory_operator_id
    let inventoryOperatorId = null;
    // 直接使用前端发送的操作员ID
    if (purchase_operator_id) {
      inventoryOperatorId = purchase_operator_id;
      log.debug(`✅ 使用前端发送的入库员ID: ${inventoryOperatorId}`);
    } else {
      // 如果前端没有发送操作员ID，保持原有的操作员ID不变
      const [currentPhone] = await connection.execute(
        'SELECT inventory_operator_id FROM phones WHERE id = ?',
        [id]
      );
      if (currentPhone.length > 0) {
        inventoryOperatorId = currentPhone[0].inventory_operator_id;
        log.debug(`🔧 保持原有入库员ID: ${inventoryOperatorId}`);
      }
    }

    // 获取对应的sale_operator_id
    let saleOperatorId = null;
    // 直接使用前端发送的销售员ID
    if (sale_operator_id) {
      saleOperatorId = sale_operator_id;
      log.debug(`✅ 使用前端发送的销售员ID: ${saleOperatorId}`);
    } else {
      // 如果前端没有发送销售员ID，保持原有的销售员ID不变
      const [currentPhone] = await connection.execute(
        'SELECT sale_operator_id FROM phones WHERE id = ?',
        [id]
      );
      if (currentPhone.length > 0) {
        saleOperatorId = currentPhone[0].sale_operator_id;
        log.debug(`🔧 保持原有销售员ID: ${saleOperatorId}`);
      }
    }

    // 构建动态更新SQL语句 - 不更新phones表的customer_id，只更新sales表
    let updateFields = [
      'brand_id = ?',
      'model_id = ?',
      'color_id = ?',
      'memory_id = ?',
      'store_id = ?',
      'imei = ?',
      'serial_number = ?',
      'purchase_cost = ?', // 只更新purchase_cost字段（真正的成本价）
      'sale_price = ?',     // 更新销售价格字段
      'is_new = ?',         // 更新全新/二手状态 (1=全新, 0=二手)
      'quality_grade = ?',
      'supplier_id = ?',
      'inventory_operator_id = ?', // 更新入库员ID
      'sale_operator_id = ?', // 更新销售员ID
      'remarks = ?',
      'Inventorytime = ?',   // 入库时间 (新字段名)
      'salestime = ?',       // 销售时间 (新字段名)
    ];

    // 如果提供了status字段，添加到更新列表
    if (status) {
      updateFields.push('status = ?');
    }

    // 使用优先级：purchase_cost > purchase_price > purchase_unit_price > cost_price > 默认0
    const finalPurchaseCost = parseFloat(purchase_cost) || parseFloat(purchase_price) || parseFloat(purchase_unit_price) || parseFloat(cost_price) || 0;

    // 使用前端发送的销售价格，如果没有则保持原值
    const finalSalePrice = parseFloat(sale_price) || null;

    let updateValues = [
      brandId || null,     // 使用转换后的brand_id
      modelId || null,     // 使用转换后的model_id
      colorId || null,     // 使用转换后的color_id
      memoryId || null,    // 使用转换后的memory_id
      store_id,
      imei,
      serial_number || null,
      finalPurchaseCost, // 更新purchase_cost字段（真正的成本价）
      finalSalePrice,     // 更新sale_price字段（销售价格）
      condition === 'new' ? 1 : (condition === 'used' ? 0 : 1), // 更新is_new字段 (1=全新, 0=二手)
      condition === 'new' ? 'A' : condition === 'used' ? 'B' : 'A', // 转换为质量等级
      supplier_id || null,
      inventoryOperatorId, // 更新入库员ID
      saleOperatorId, // 更新销售员ID
      finalNotes,
      created_at || stock_in_date || Inventorytime || null,  // 优先使用前端发送的created_at
      salestime || null
    ];

    // 如果提供了status字段，添加到更新值
    if (status) {
      updateValues.push(status);
    }

    // 添加id作为最后一个参数
    updateValues.push(id);

    // 执行更新phones表
    const updateSQL = `UPDATE phones SET ${updateFields.join(', ')} WHERE id = ?`;
    await connection.execute(updateSQL, updateValues);
    log.debug('✅ phones表更新成功');

    // 🔥 处理客户信息更新
    // 规则：
    // 1. 只修改姓名或Apple ID → 直接更新customers表
    // 2. 修改手机号 → 根据新手机号查找客户，找到则关联，找不到则创建新客户
    let finalCustomerId = customer_id;

    // 获取原始客户信息（用于比较手机号是否变化）
    let originalCustomerPhone = null;
    if (finalCustomerId && finalCustomerId !== '') {
      const [originalCustomer] = await connection.execute(
        'SELECT phone FROM customers WHERE id = ?',
        [finalCustomerId]
      );
      if (originalCustomer.length > 0) {
        originalCustomerPhone = originalCustomer[0].phone;
      }
    }

    // 判断是否需要处理客户信息
    if (customer_name || customer_phone || apple_id) {
      // 检查手机号是否变化
      const phoneChanged = customer_phone && customer_phone !== originalCustomerPhone;

      if (phoneChanged) {
        // 🔥 手机号变化：根据新手机号查找客户
        log.debug(`📱 手机号变化: ${originalCustomerPhone} → ${customer_phone}，重新查找客户`);

        const [matchedCustomers] = await connection.execute(
          'SELECT id, name FROM customers WHERE phone = ? ORDER BY id DESC LIMIT 1',
          [customer_phone]
        );

        if (matchedCustomers.length > 0) {
          // 找到匹配的客户
          finalCustomerId = matchedCustomers[0].id;
          log.debug(`✅ 找到匹配客户: ID=${finalCustomerId}, 姓名=${matchedCustomers[0].name}, 手机=${customer_phone}`);

          // 如果前端还提供了姓名，更新客户姓名
          if (customer_name && customer_name !== matchedCustomers[0].name) {
            await connection.execute(
              'UPDATE customers SET name = ?, updated_at = NOW() WHERE id = ?',
              [customer_name, finalCustomerId]
            );
            log.debug(`✅ 更新客户姓名: ${customer_name}`);
          }
        } else {
          // 没找到匹配客户，创建新客户
          const memberNumber = await generateMemberNumber({ connection });
          const [newCustomer] = await connection.execute(
            `INSERT INTO customers (name, phone, member_number, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())`,
            [customer_name || null, customer_phone || null, memberNumber]
          );
          finalCustomerId = newCustomer.insertId;
          log.debug(`✅ 创建新客户: ID=${finalCustomerId}, 姓名=${customer_name}, 手机=${customer_phone}`);
        }

        // 更新phones表的customer_id
        await connection.execute(
          'UPDATE phones SET customer_id = ? WHERE id = ?',
          [finalCustomerId, id]
        );
      } else {
        // 🔥 手机号未变化：只更新姓名或Apple ID
        if (finalCustomerId && finalCustomerId !== '') {
          // 更新现有客户
          const updateCustomerFields = [];
          const updateCustomerValues = [];

          if (customer_name !== null && customer_name !== undefined) {
            updateCustomerFields.push('name = ?');
            updateCustomerValues.push(customer_name);
          }

          if (updateCustomerFields.length > 0) {
            updateCustomerFields.push('updated_at = NOW()');
            updateCustomerValues.push(finalCustomerId);

            await connection.execute(
              `UPDATE customers SET ${updateCustomerFields.join(', ')} WHERE id = ?`,
              updateCustomerValues
            );
            log.debug(`✅ 更新客户姓名: ID=${finalCustomerId}, 姓名=${customer_name}`);
          }
        } else if (customer_name || customer_phone) {
          // 没有customer_id但有客户信息，创建新客户
          const memberNumber = await generateMemberNumber({ connection });
          const [newCustomer] = await connection.execute(
            `INSERT INTO customers (name, phone, member_number, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())`,
            [customer_name || null, customer_phone || null, memberNumber]
          );
          finalCustomerId = newCustomer.insertId;
          log.debug(`✅ 创建新客户: ID=${finalCustomerId}, 姓名=${customer_name}, 手机=${customer_phone}`);

          // 更新phones表的customer_id
          await connection.execute(
            'UPDATE phones SET customer_id = ? WHERE id = ?',
            [finalCustomerId, id]
          );
        }
      }

      // 🔥 处理 Apple ID（存储在customers表）
      if (apple_id !== null && apple_id !== undefined && finalCustomerId) {
        await connection.execute(
          'UPDATE customers SET apple_id = ?, updated_at = NOW() WHERE id = ?',
          [apple_id || null, finalCustomerId]
        );
        log.debug(`✅ 更新Apple ID到customers表: ${apple_id || '(清空)'}`);
      }
    }

    // 🔥 联动更新sales表 - 只要phones表更新了，就同步更新对应的sales记录
    // 先检查是否存在销售记录
    const [existingSales] = await connection.execute(
      'SELECT id, customer_id, operator_id, sale_date, store_id, remarks, invoice_number, price, cost, sale_type FROM sales WHERE phone_id = ? ORDER BY created_at DESC LIMIT 1',
      [id]
    );

    // 🔥 如果提供了客户信息但没有销售记录，创建一条销售记录
    if ((finalCustomerId || customer_name || customer_phone) && existingSales.length === 0) {
      log.debug('🔥 没有销售记录但提供了客户信息，创建销售记录');

      // 确定销售类型
      const statusToSaleType = {
        'sold': 'retail',
        'peer_transfer': 'wholesale',
        'supplier_proxy': 'supplier_proxy'
      };
      const saleType = statusToSaleType[status] || 'retail';

      // 生成发票号
      const { generateInvoiceNumberForDate } = require('../utils/invoice-number');
      let invoiceNumber;
      const saleDate = salestime || null;

      if (saleDate) {
        const targetDate = new Date(saleDate);
        const year = targetDate.getFullYear();
        const month = String(targetDate.getMonth() + 1).padStart(2, '0');
        const day = String(targetDate.getDate()).padStart(2, '0');
        const dateStr = `${year}${month}${day}`;

        const typeSuffixMap = {
          'retail': 'XS',
          'peer_transfer': 'DH',
          'supplier_proxy': 'HB',
          'wholesale': 'PF'
        };
        const typeSuffix = typeSuffixMap[saleType] || 'XS';

        const prefixPattern = `${dateStr}%${typeSuffix}`;
        const [rows] = await connection.execute(
          `SELECT invoice_number FROM sales WHERE invoice_number LIKE ? ORDER BY id DESC LIMIT 1`,
          [prefixPattern]
        );

        let sequence = 1;
        if (rows.length > 0 && rows[0].invoice_number) {
          const currentSequenceStr = rows[0].invoice_number.substring(8, 12);
          const currentSequence = parseInt(currentSequenceStr, 10);
          if (!isNaN(currentSequence)) {
            sequence = currentSequence + 1;
          }
        }

        const sequenceStr = String(sequence).padStart(4, '0');
        invoiceNumber = `${dateStr}${sequenceStr}${typeSuffix}`;
      } else {
        const generateInvoiceNumber = require('../utils/invoice-number').generateInvoiceNumber;
        invoiceNumber = await generateInvoiceNumber(saleType, connection);
      }

      // 创建销售记录
      const [insertResult] = await connection.execute(
        `INSERT INTO sales (
          phone_id, customer_id, sale_type, operator_id, store_id,
          price, cost, sale_date, invoice_number, remarks, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          id,
          finalCustomerId || null,
          saleType,
          saleOperatorId || null,
          store_id || null,
          sale_price || null,
          finalPurchaseCost || null,
          saleDate || null,
          invoiceNumber,
          finalNotes || null
        ]
      );

      log.debug(`✅ 创建销售记录成功, ID: ${insertResult.insertId}, customer_id: ${finalCustomerId}, invoice_number: ${invoiceNumber}`);
    } else if (existingSales.length > 0) {
      const existingSale = existingSales[0];
      // 存在销售记录，执行更新
      const updateSalesFields = [];
      const updateSalesValues = [];

      // 🔥 如果发票号为空，自动生成发票号（使用销售时间）
      if (!existingSale.invoice_number) {
        const { generateInvoiceNumberForDate } = require('../utils/invoice-number');
        const saleType = existingSale.sale_type || 'retail';
        // 使用销售时间，优先使用 phones.salestime，否则使用 sales.sale_date
        const saleDate = salestime || existingSale.sale_date;
        let invoiceNumber;

        if (saleDate) {
          // 根据销售日期查询当天该类型的最大序号
          const targetDate = new Date(saleDate);
          const year = targetDate.getFullYear();
          const month = String(targetDate.getMonth() + 1).padStart(2, '0');
          const day = String(targetDate.getDate()).padStart(2, '0');
          const dateStr = `${year}${month}${day}`;

          const typeSuffixMap = {
            'retail': 'XS',
            'peer_transfer': 'DH',
            'supplier_proxy': 'HB',
            'wholesale': 'PF'
          };
          const typeSuffix = typeSuffixMap[saleType] || 'XS';

          // 查询该日期该类型的最大序号
          const prefixPattern = `${dateStr}%${typeSuffix}`;
          const [rows] = await connection.execute(
            `SELECT invoice_number FROM sales WHERE invoice_number LIKE ? ORDER BY id DESC LIMIT 1`,
            [prefixPattern]
          );

          let sequence = 1;
          if (rows.length > 0 && rows[0].invoice_number) {
            const currentInvoiceNumber = rows[0].invoice_number;
            const currentSequenceStr = currentInvoiceNumber.substring(8, 12);
            const currentSequence = parseInt(currentSequenceStr, 10);
            if (!isNaN(currentSequence)) {
              sequence = currentSequence + 1;
            }
          }

          const sequenceStr = String(sequence).padStart(4, '0');
          invoiceNumber = `${dateStr}${sequenceStr}${typeSuffix}`;
        } else {
          // 如果没有销售时间，使用当前时间
          const generateInvoiceNumber = require('../utils/invoice-number').generateInvoiceNumber;
          invoiceNumber = await generateInvoiceNumber(saleType, connection);
        }

        updateSalesFields.push('invoice_number = ?');
        updateSalesValues.push(invoiceNumber);
        log.debug(`✅ 自动生成发票号: ${invoiceNumber}, 类型: ${saleType}, 销售日期: ${saleDate || '当前时间'}`);
      }

      // 同步 customer_id（使用处理后的finalCustomerId）
      if (finalCustomerId !== null && finalCustomerId !== undefined && finalCustomerId !== '') {
        updateSalesFields.push('customer_id = ?');
        updateSalesValues.push(finalCustomerId);
        log.debug(`✅ 同步customer_id到sales表: ${finalCustomerId}`);
      }

      // 同步 operator_id（如果前端提供了）
      if (saleOperatorId !== null && saleOperatorId !== undefined) {
        updateSalesFields.push('operator_id = ?');
        updateSalesValues.push(saleOperatorId);
      }

      // 同步 sale_date（从phones表同步）
      if (salestime !== null && salestime !== undefined) {
        updateSalesFields.push('sale_date = ?');
        updateSalesValues.push(salestime);
      }

      // 同步 store_id
      if (store_id !== null && store_id !== undefined) {
        updateSalesFields.push('store_id = ?');
        updateSalesValues.push(store_id);
      }

      // 🔥 同步销售价格 (price字段)
      if (sale_price !== null && sale_price !== undefined) {
        updateSalesFields.push('price = ?');
        updateSalesValues.push(parseFloat(sale_price));
        log.debug(`✅ 同步销售价格: ${sale_price}`);
      }

      // 🔥 同步入库成本 (cost字段) - 优先使用purchase_cost，否则使用purchase_price
      const costValue = purchase_cost !== null && purchase_cost !== undefined
        ? purchase_cost
        : (purchase_unit_price || purchase_price);
      if (costValue !== null && costValue !== undefined) {
        updateSalesFields.push('cost = ?');
        updateSalesValues.push(parseFloat(costValue));
        log.debug(`✅ 同步入库成本: ${costValue}`);
      }

      // 同步 remarks
      updateSalesFields.push('remarks = ?');
      updateSalesValues.push(finalNotes);

      if (updateSalesFields.length > 0) {
        updateSalesFields.push('updated_at = NOW()');
        updateSalesValues.push(id);

        const [updateSalesResult] = await connection.execute(
          `UPDATE sales SET ${updateSalesFields.join(', ')} WHERE phone_id = ?`,
          updateSalesValues
        );

        log.debug(`✅ 同步更新sales表成功，影响行数: ${updateSalesResult.affectedRows}`);
      }
    }

    // 根据状态更新销售记录的sale_type
    if (status) {
      log.debug('🔄 根据状态更新销售记录的sale_type...');

      // 状态到sale_type的映射
      const statusToSaleType = {
        'sold': 'retail',           // 正常零售
        'peer_transfer': 'wholesale',  // 批发给同行
        'supplier_proxy': 'supplier_proxy'  // 代供应商划拨
      };

      const targetSaleType = statusToSaleType[status];

      if (targetSaleType) {
        // 更新该手机的销售记录中的sale_type
        const [updateSaleTypeResult] = await connection.execute(
          `UPDATE sales
           SET sale_type = ?, updated_at = NOW()
           WHERE phone_id = ?`,
          [targetSaleType, id]
        );

        if (updateSaleTypeResult.affectedRows > 0) {
          log.debug(`✅ 更新销售记录sale_type成功，影响行数: ${updateSaleTypeResult.affectedRows}, 新sale_type: ${targetSaleType}`);
        } else {
          log.debug('ℹ️ 该手机没有销售记录，或无需更新sale_type');
        }
      } else {
        log.debug(`ℹ️ 状态 "${status}" 不需要更新sale_type (在库、预定、维修、丢失等状态)`);
      }
    }

    // 获取更新后的完整手机信息
    log.debug(`🔍 查询更新后的手机信息，ID: ${id}`);
    const [updatedPhones] = await connection.execute(
      `SELECT p.id, p.imei, p.serial_number, p.brand_id, p.model_id, p.color_id, p.memory_id, p.sale_price, p.purchase_cost, p.is_new, p.status, p.quality_grade, p.remarks, p.purchase_number, p.inventory_operator_id, p.sale_operator_id, p.supplier_id, p.store_id, p.Inventorytime, p.salestime,
              s.name as supplier_name,
              st.name as store_name,
              su.name as sale_operator_name,
              inv_u.name as inventory_operator_name,
              latest_sale.customer_id,
              c.name as customer_name,
              c.phone as customer_phone,
              c.apple_id as customer_apple_id
       FROM phones p
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN colors co ON p.color_id = co.id
      LEFT JOIN memories mem ON p.memory_id = mem.id
       LEFT JOIN suppliers s ON p.supplier_id = s.id
       LEFT JOIN stores st ON p.store_id = st.id
       LEFT JOIN users su ON p.sale_operator_id = su.id
       LEFT JOIN users inv_u ON p.inventory_operator_id = inv_u.id
       LEFT JOIN (
         SELECT
           s.customer_id,
           s.phone_id,
           ROW_NUMBER() OVER (PARTITION BY s.phone_id ORDER BY s.created_at DESC) as rn
         FROM sales s
       ) latest_sale ON p.id = latest_sale.phone_id AND latest_sale.rn = 1
       LEFT JOIN customers c ON latest_sale.customer_id = c.id
       WHERE p.id = ?`,
      [id]
    );

    const updatedPhone = updatedPhones[0];
    log.debug(`📋 返回给前端的更新后数据:`, {
      id: updatedPhone?.id,
      imei: updatedPhone?.imei,
      sale_operator_id: updatedPhone?.sale_operator_id,
      sale_operator_name: updatedPhone?.sale_operator_name,
      inventory_operator_id: updatedPhone?.inventory_operator_id,
      inventory_operator_name: updatedPhone?.inventory_operator_name
    });

    // 清除相关缓存，确保前端能看到最新数据
    log.debug('🧹 清除查询接口缓存...');
    try {
      clearCache('/api/query/comprehensive');
      clearCache('/api/query/statistics');
      log.debug('✅ 缓存清除完成');
    } catch (cacheError) {
      log.warn('⚠️ 缓存清除失败:', cacheError.message);
    }

    // 自动匹配预定单（当手机入库且状态为 in_stock 时）
    if (status === 'in_stock' || !status) {
      log.debug('🔍 开始自动匹配预定单...');

      try {
        // 查找符合条件的最早期预定单
        const [matchablePreorders] = await connection.execute(
          `SELECT id, preorder_number, customer_id, customer_name, customer_phone,
                  brand_id, model_id, color_id, memory_id, expected_price, deposit_amount
           FROM preorders
           WHERE status = 'pending'
             AND brand_id = ?
             AND model_id = ?
             AND color_id = ?
             AND memory_id = ?
             AND store_id = ?
           ORDER BY created_at ASC
           LIMIT 1`,
          [brandId, modelId, colorId, memoryId, store_id]
        );

        if (matchablePreorders.length > 0) {
          const preorder = matchablePreorders[0];
          log.debug(`✅ 找到匹配的预定单: ${preorder.preorder_number}`);

          // 自动匹配预定单
          await connection.execute(
            `UPDATE preorders SET
              status = 'arrived',
              matched_phone_id = ?,
              imei = ?,
              actual_model = (SELECT CONCAT(b.name, ' ', m.name) FROM brands b, models m WHERE b.id = ? AND m.id = ?),
              matched_time = NOW(),
              updated_at = NOW()
            WHERE id = ?`,
            [id, imei, brandId, modelId, preorder.id]
          );

          // 更新手机状态为已预定
          await connection.execute(
            `UPDATE phones SET is_preordered = 1, updated_at = NOW() WHERE id = ?`,
            [id]
          );

          log.debug(`✅ 预定单 ${preorder.preorder_number} 自动匹配成功`);

          // 添加提示信息到响应中
          if (updatedPhone) {
            updatedPhone.auto_matched_preorder = preorder.preorder_number;
            updatedPhone.auto_matched_customer = preorder.customer_name;
          }
        } else {
          log.debug('ℹ️ 没有找到匹配的预定单');
        }
      } catch (matchError) {
        log.error('❌ 自动匹配预定单失败:', matchError);
        // 不影响主流程，继续返回成功
      }
    }

    ApiResponse.success(res, updatedPhone, '手机更新成功');
  } catch (error) {
    log.error('更新手机失败:', error);
    ApiResponse.serverError(res, '更新手机失败', error);
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// 删除手机
router.delete('/:id', unifiedAuth, requirePermission('phones:delete'), async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const pool = require('../config/database').getDatabase();
    connection = await pool.getConnection();

    // 使用QueryRepository中的deletePhoneRecord方法
    const QueryRepository = require('../repositories/query.repository');
    const queryRepo = new QueryRepository();

    const result = await queryRepo.deletePhoneRecord(parseInt(id));

    ApiResponse.success(res, result, '手机删除成功');
  } catch (error) {
    log.error('删除手机失败:', error);
    ApiResponse.serverError(res, '删除手机失败', error);
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// 获取手机统计信息
router.get('/stats/overview', unifiedAuth, requirePermission('system:edit'), (req, res) => {
  try {
    const { store_id } = req.query;

    let phonesForStats = [...mockPhones];
    if (store_id) {
      phonesForStats = phonesForStats.filter(phone => phone.store_id === parseInt(store_id));
    }

    const stats = {
      total: phonesForStats.length,
      available: phonesForStats.filter(p => p.status === 'available').length,
      sold: phonesForStats.filter(p => p.status === 'sold').length,
      reserved: phonesForStats.filter(p => p.status === 'reserved').length,
      repair: phonesForStats.filter(p => p.status === 'repair').length,
      totalValue: phonesForStats.reduce((sum, p) => sum + p.price, 0),
      totalCost: phonesForStats.reduce((sum, p) => sum + p.price, 0),
      byBrand: {},
      byModel: {},
      byStore: {},
      byCondition: {}
    };

    // 按品牌统计
    phonesForStats.forEach(phone => {
      stats.byBrand[phone.brand_name] = (stats.byBrand[phone.brand_name] || 0) + 1;
      stats.byModel[phone.model_name] = (stats.byModel[phone.model_name] || 0) + 1;
      stats.byStore[phone.store_name] = (stats.byStore[phone.store_name] || 0) + 1;
      stats.byCondition[phone.condition] = (stats.byCondition[phone.condition] || 0) + 1;
    });

    ApiResponse.success(res, stats);
  } catch (error) {
    log.error('获取手机统计失败:', error);
    ApiResponse.serverError(res, '获取手机统计失败', error);
  }
});

// 获取单个手机详情
router.patch('/:id/status', unifiedAuth, requirePermission('system:edit'), (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return ApiResponse.badRequest(res, '状态不能为空');
    }

    const phoneIndex = mockPhones.findIndex(p => p.id === parseInt(id));
    if (phoneIndex === -1) {
      return ApiResponse.notFound(res, '手机不存在');
    }

    const validStatuses = ['available', 'sold', 'reserved', 'repair', 'lost'];
    if (!validStatuses.includes(status)) {
      return ApiResponse.badRequest(res, '无效的状态');
    }

    mockPhones[phoneIndex].status = status;
    mockPhones[phoneIndex].updated_at = new Date().toISOString();

    ApiResponse.success(res, mockPhones[phoneIndex], '手机状态更新成功');
  } catch (error) {
    log.error('更新手机状态失败:', error);
    ApiResponse.serverError(res, '更新手机状态失败', error);
  }
});

// ============================================================================
// 手机图片管理 API（库存管理用）
// ============================================================================

const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const ShopServiceClass = require('../services/shop.service');
const shopService = new ShopServiceClass();

// 配置图片上传
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/phones');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
    } catch (error) {
      // 目录已存在，忽略错误
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'phone-' + uniqueSuffix + ext);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('只支持上传图片文件（jpeg, jpg, png, gif, webp）'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

/**
 * 上传手机图片
 * POST /api/phones/:id/upload-image
 * 权限：inventory:edit
 */
router.post('/:id/upload-image',
  unifiedAuth,
  requirePermission('inventory:edit'),
  upload.single('image'),
  async (req, res) => {
    try {
      if (!req.file) {
        return ApiResponse.error(res, '没有上传文件', 400);
      }

      const { id } = req.params;
      const uploadedBy = req.user ? req.user.id : 0;

      // 生成文件访问URL
      const fileUrl = `/uploads/phones/${req.file.filename}`;

      // 使用 ShopService 添加单张图片（不删除旧图片）
      await shopService.addPhoneImage(id, fileUrl, 'inventory', uploadedBy);

      ApiResponse.success(res, {
        url: fileUrl,
        filename: req.file.filename,
        originalname: req.file.originalname,
        size: req.file.size
      }, '图片上传成功');
    } catch (error) {
      log.error('上传图片失败:', error);
      ApiResponse.error(res, error.message || '上传失败', 500);
    }
  }
);

/**
 * 获取手机图片列表
 * GET /api/phones/:id/images
 * 权限：inventory:view
 */
router.get('/:id/images',
  unifiedAuth,
  requirePermission('inventory:view'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const images = await shopService.getPhoneImages(id);

      ApiResponse.success(res, images, '获取图片成功');
    } catch (error) {
      log.error('获取图片失败:', error);
      ApiResponse.error(res, error.message || '获取失败', 500);
    }
  }
);

/**
 * 设置主图
 * PUT /api/phones/:id/images/:imageId/primary
 * 权限：inventory:edit
 */
router.put('/:id/images/:imageId/primary',
  unifiedAuth,
  requirePermission('inventory:edit'),
  async (req, res) => {
    try {
      const { id, imageId } = req.params;
      await shopService.setPrimaryImage(imageId);

      ApiResponse.success(res, null, '设置主图成功');
    } catch (error) {
      log.error('设置主图失败:', error);
      ApiResponse.error(res, error.message || '设置失败', 500);
    }
  }
);

/**
 * 重新排序图片
 * PUT /api/phones/:id/images/reorder
 * 权限：inventory:edit
 * Body: { imageIds: [1, 2, 3, ...] } - 按新顺序排列的图片ID数组
 */
router.put('/:id/images/reorder',
  unifiedAuth,
  requirePermission('inventory:edit'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { imageIds } = req.body;

      if (!Array.isArray(imageIds) || imageIds.length === 0) {
        return ApiResponse.error(res, '图片ID列表不能为空', 400);
      }

      await shopService.reorderPhoneImages(id, imageIds);

      ApiResponse.success(res, null, '图片排序更新成功');
    } catch (error) {
      log.error('图片排序失败:', error);
      ApiResponse.error(res, error.message || '排序失败', 500);
    }
  }
);

/**
 * 删除图片
 * DELETE /api/phones/:id/images/:imageId
 * 权限：inventory:edit
 */
router.delete('/:id/images/:imageId',
  unifiedAuth,
  requirePermission('inventory:edit'),
  async (req, res) => {
    try {
      const { id, imageId } = req.params;
      await shopService.deleteImage(imageId);

      ApiResponse.success(res, null, '删除图片成功');
    } catch (error) {
      log.error('删除图片失败:', error);
      ApiResponse.error(res, error.message || '删除失败', 500);
    }
  }
);

// ============================================================================
// H5商品验机信息管理 API
// ============================================================================

/**
 * 获取商品H5上架信息
 * GET /api/phones/:id/h5-product
 * 权限：inventory:view
 */
router.get('/:id/h5-product',
  unifiedAuth,
  requirePermission('inventory:view'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const product = await shopService.getPhoneH5Product(id);

      if (!product) {
        return ApiResponse.success(res, { is_published: 1 }, '未找到上架信息，默认上架');
      }

      ApiResponse.success(res, product, '获取成功');
    } catch (error) {
      log.error('获取H5商品信息失败:', error);
      ApiResponse.error(res, error.message || '获取失败', 500);
    }
  }
);

/**
 * 更新商品H5上架状态
 * PUT /api/phones/:id/h5-product
 * 权限：inventory:edit
 * Body: { is_published: 0 | 1 }
 */
router.put('/:id/h5-product',
  unifiedAuth,
  requirePermission('inventory:edit'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { is_published } = req.body;

      // 验证值
      if (is_published !== 0 && is_published !== 1) {
        return ApiResponse.badRequest(res, 'is_published 必须是 0 或 1');
      }

      await shopService.updatePhoneH5Product(id, { is_published });

      ApiResponse.success(res, null, is_published === 1 ? '已上架' : '已下架');
    } catch (error) {
      log.error('更新H5上架状态失败:', error);
      ApiResponse.error(res, error.message || '更新失败', 500);
    }
  }
);

/**
 * 保存商品验机信息
 * POST /api/phones/:id/inspection
 * 权限：inventory:edit
 */
router.post('/:id/inspection',
  unifiedAuth,
  requirePermission('inventory:edit'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const inspectionData = {
        condition_grade: req.body.condition_grade || null,
        battery_status: req.body.battery_status || '',
        screen_condition: req.body.screen_condition || 'original',
        system_version: req.body.system_version || '',
        model_version: req.body.model_version || '',
        warranty_date: req.body.warranty_date || null,
        is_warranty_expired: req.body.is_warranty_expired || false,
        sale_price: req.body.sale_price || null
      };

      await shopService.saveProductInspection(id, inspectionData);
      ApiResponse.success(res, null, '验机信息保存成功');
    } catch (error) {
      log.error('保存验机信息失败:', error);
      ApiResponse.error(res, error.message || '保存失败', 500);
    }
  }
);

/**
 * 获取商品验机信息
 * GET /api/phones/:id/inspection
 * 权限：inventory:view
 */
router.get('/:id/inspection',
  unifiedAuth,
  requirePermission('inventory:view'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const inspection = await shopService.getProductInspection(id);

      if (!inspection) {
        return ApiResponse.success(res, null, '暂无验机信息');
      }

      ApiResponse.success(res, inspection, '获取验机信息成功');
    } catch (error) {
      log.error('获取验机信息失败:', error);
      ApiResponse.error(res, error.message || '获取失败', 500);
    }
  }
);

// ============================================================================
// 视频上传 API
// ============================================================================

// 配置视频上传存储
const videoStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/videos');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
    } catch (error) {
      // 目录已存在，忽略错误
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'video-' + uniqueSuffix + ext);
  }
});

// 视频文件过滤器
const videoFilter = (req, file, cb) => {
  const allowedTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('只支持上传视频文件（mp4, webm, ogg, mov）'), false);
  }
};

const videoUpload = multer({
  storage: videoStorage,
  fileFilter: videoFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  }
});

/**
 * 上传商品视频
 * POST /api/phones/:id/upload-video
 * 权限：inventory:edit
 */
router.post('/:id/upload-video',
  unifiedAuth,
  requirePermission('inventory:edit'),
  videoUpload.single('video'),
  async (req, res) => {
    try {
      if (!req.file) {
        return ApiResponse.error(res, '没有上传文件', 400);
      }

      const { id } = req.params;
      const uploadedBy = req.user ? req.user.id : 0;

      // 生成文件访问URL
      const videoUrl = `/uploads/videos/${req.file.filename}`;

      // 使用 addPhoneImage 方法，指定类型为 video
      await shopService.addPhoneImage(id, videoUrl, 'video', uploadedBy);

      ApiResponse.success(res, {
        url: videoUrl,
        filename: req.file.filename,
        originalname: req.file.originalname,
        size: req.file.size
      }, '视频上传成功');
    } catch (error) {
      log.error('上传视频失败:', error);
      ApiResponse.error(res, error.message || '上传失败', 500);
    }
  }
);

module.exports = router;
