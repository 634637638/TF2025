/**
 * 入库管理路由
 * 提供入库记录的增删改查功能
 */
const express = require('express');
const router = express.Router();
const { unifiedAuth, requirePermission, requireAnyPermission } = require('../middleware/unified-auth');
const ApiResponse = require('../utils/response');
const log = require('../utils/log');

// 获取入库记录列表
router.get('/', unifiedAuth, requirePermission('stock-in:view'), async (req, res) => {
  let connection;
  try {
    const {
      page = 1,
      limit = 20,
      search,
      productType,
      brandId,
      storeId,
      supplierId,
      operationType,
      isSettled,
      startDate,
      endDate
    } = req.query;

    // 获取数据库连接
    const pool = require('../config/database').getDatabase();
    connection = await pool.getConnection();

    // 构建查询条件
    let whereConditions = [];
    let params = [];

    // 商品类型筛选 (通过is_new字段判断，1=全新，0=二手)
    if (productType) {
      if (productType === 'new') {
        whereConditions.push('p.is_new = 1');
      } else if (productType === 'used') {
        whereConditions.push('p.is_new = 0');
      }
    }

    // 品牌筛选
    if (brandId) {
      whereConditions.push('p.= (SELECT name FROM brands WHERE id = ?)');
      params.push(parseInt(brandId));
    }

    // 门店筛选
    if (storeId) {
      whereConditions.push('p.store_id = ?');
      params.push(parseInt(storeId));
    }

    // 供应商筛选
    if (supplierId) {
      whereConditions.push('p.supplier_id = ?');
      params.push(parseInt(supplierId));
    }

    // 搜索功能
    if (search) {
      whereConditions.push(`(
        p.LIKE ? OR
        p.LIKE ? OR
        p.imei LIKE ? OR
        s.name LIKE ? OR
        p.purchase_number LIKE ? OR
        u.name LIKE ? OR
        u.username LIKE ?
      )`);
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam, searchParam, searchParam, searchParam, searchParam);
    }

    // 日期范围筛选
    if (startDate) {
      whereConditions.push('p.created_at >= ?');
      params.push(startDate);
    }

    if (endDate) {
      whereConditions.push('p.created_at <= ?');
      params.push(endDate);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // 获取总数
    const countQuery = `
      SELECT COUNT(*) as total
      FROM phones p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN users u ON p.inventory_operator_id = u.id
      ${whereClause}
    `;

    const [countResult] = await connection.execute(countQuery, params);
    const total = countResult[0].total;

    // 分页查询入库记录
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const query = `
      SELECT
        p.id,
        p.imei,
        p.serial_number,
        p.purchase_cost as unit_cost,
        p.purchase_cost as total_cost,
        p.store_id,
        s.name as store_name,
        p.supplier_id,
        supp.name as supplier_name,
        p.inventory_operator_id,
        u.name as operator_name,
        u.username as operator_username,
        p.status,
        p.is_new,
        p.Inventorytime,
        p.purchase_number,
        p.remarks as note,
        p.Inventorytime,
        p.salestime,
        b.name as brand_name,
        m.name as model_name,
        c.name as color_name,
        mem.size as memory_name,
        CASE
          WHEN p.is_new = 1 THEN '全新'
          ELSE '二手'
        END as phone_condition
      FROM phones p
      LEFT JOIN stores s ON p.store_id = s.id
      LEFT JOIN suppliers supp ON p.supplier_id = supp.id
      LEFT JOIN users u ON p.inventory_operator_id = u.id
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN colors c ON p.color_id = c.id
      LEFT JOIN memories mem ON p.memory_id = mem.id
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const [records] = await connection.execute(query, [...params, parseInt(limit), offset]);

    // 转换数据格式以匹配前端期望
    const formattedRecords = records.map(record => ({
      ...record,
      product_type: 'phone', // 目前只有手机类型
      product_name: `${record.brand_name || ''} ${record.model_name || ''}`,
      brand_name: record.brand_name || '',
      model_name: record.model_name || '',
      color_name: record.color_name || '',
      memory_name: record.memory_name || '',
      quantity: 1, // 每条记录代表一个手机
      operation_type: 'in',
      reason: '采购入库',
      is_settled: 1, // 默认为已结算
      reference_type: 'purchase',
      reference_id: record.purchase_number
    }));

    ApiResponse.success(res, {
      records: formattedRecords,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(total),
        pages: Math.ceil(parseInt(total) / parseInt(limit))
      }
    });
  } catch (error) {
    log.error('获取入库记录失败:', error);
    ApiResponse.serverError(res, '获取入库记录失败', error);
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// 获取入库记录统计信息
router.get('/stats/overview', unifiedAuth, requirePermission('stock-in:view'), async (req, res) => {
  let connection;
  try {
    const { storeId, startDate, endDate } = req.query;

    // 获取数据库连接
    const pool = require('../config/database').getDatabase();
    connection = await pool.getConnection();

    // 构建查询条件
    let whereConditions = [];
    let params = [];

    // 门店筛选
    if (storeId) {
      whereConditions.push('p.store_id = ?');
      params.push(parseInt(storeId));
    }

    // 日期范围筛选
    if (startDate) {
      whereConditions.push('p.created_at >= ?');
      params.push(startDate);
    }

    if (endDate) {
      whereConditions.push('p.created_at <= ?');
      params.push(endDate);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // 获取统计数据
    const statsQuery = `
      SELECT
        COUNT(*) as totalItems,
        SUM(p.purchase_cost) as totalValue,
        COUNT(CASE WHEN DATE(p.created_at) = CURDATE() THEN 1 END) as todayStockIn,
        COUNT(CASE WHEN p.is_new = 1 THEN 1 END) as newItems,
        COUNT(CASE WHEN p.is_new = 0 THEN 1 END) as usedItems,
        COUNT(CASE WHEN p.status = 'in_stock' THEN 1 END) as inStockItems,
        COUNT(CASE WHEN p.status = 'sold' THEN 1 END) as soldItems
      FROM phones p
      ${whereClause}
    `;

    const [statsResult] = await connection.execute(statsQuery, params);
    const stats = statsResult[0];

    // 按门店统计
    const storeStatsQuery = `
      SELECT
        s.name as store_name,
        COUNT(*) as count
      FROM phones p
      LEFT JOIN stores s ON p.store_id = s.id
      ${whereClause}
      GROUP BY p.store_id, s.name
      ORDER BY count DESC
    `;

    const [storeStats] = await connection.execute(storeStatsQuery, params);
    const byStore = {};
    storeStats.forEach(row => {
      byStore[row.store_name || '未知门店'] = row.count;
    });

    // 按品牌统计
    const brandStatsQuery = `
      SELECT
        p.as brand_name,
        COUNT(*) as count
      FROM phones p
      ${whereClause}
      GROUP BY p.ORDER BY count DESC
    `;

    const [brandStats] = await connection.execute(brandStatsQuery, params);
    const byBrand = {};
    brandStats.forEach(row => {
      byBrand[row.brand_name || '未知品牌'] = row.count;
    });

    // 获取低库存和缺货商品统计（假设有库存表）
    let lowStockItems = 0;
    let outOfStockItems = 0;

    try {
      const [stockStats] = await connection.execute(`
        SELECT
          COUNT(CASE WHEN quantity <= 5 AND quantity > 0 THEN 1 END) as low_stock,
          COUNT(CASE WHEN quantity = 0 THEN 1 END) as out_of_stock
        FROM inventory
      `);
      lowStockItems = stockStats[0]?.low_stock || 0;
      outOfStockItems = stockStats[0]?.out_of_stock || 0;
    } catch (stockError) {
      log.debug('库存统计表不存在，使用默认值');
    }

    const finalStats = {
      todayStockIn: parseInt(stats.todayStockIn) || 0,
      totalItems: parseInt(stats.totalItems) || 0,
      totalValue: parseFloat(stats.totalValue) || 0,
      lowStockItems,
      outOfStockItems,
      byStore,
      byBrand,
      byProductType: {
        phone: parseInt(stats.totalItems) || 0,
        accessory: 0 // 当前系统只有手机类型
      },
      byOperationType: {
        in: parseInt(stats.totalItems) || 0,
        out: 0,
        adjust: 0
      },
      settledCount: parseInt(stats.totalItems) || 0, // 假设都已结算
      unsettledCount: 0
    };

    ApiResponse.success(res, finalStats);
  } catch (error) {
    log.error('获取入库统计失败:', error);
    ApiResponse.serverError(res, '获取入库统计失败', error);
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// 获取单个入库记录详情
router.get('/:id', unifiedAuth, requirePermission('stock-in:view'), async (req, res) => {
  let connection;
  try {
    const { id } = req.params;

    // 获取数据库连接
    const pool = require('../config/database').getDatabase();
    connection = await pool.getConnection();

    const query = `
      SELECT
        p.id,
        p.imei,
        p.serial_number,
        p.p.p.p.p.purchase_cost as unit_cost,
        p.purchase_cost as total_cost,
        p.store_id,
        s.name as store_name,
        p.supplier_id,
        supp.name as supplier_name,
        p.inventory_operator_id,
        u.name as operator_name,
        u.username as operator_username,
        p.status,
        p.is_new,
        p.Inventorytime,
        p.purchase_number,
        p.remarks as note,
        p.Inventorytime,
        p.salestime,
        CASE
          WHEN p.is_new = 1 THEN '全新'
          ELSE '二手'
        END as phone_condition
      FROM phones p
      LEFT JOIN stores s ON p.store_id = s.id
      LEFT JOIN suppliers supp ON p.supplier_id = supp.id
      LEFT JOIN users u ON p.inventory_operator_id = u.id
      WHERE p.id = ?
    `;

    const [records] = await connection.execute(query, [id]);

    if (records.length === 0) {
      return ApiResponse.notFound(res, '入库记录不存在');
    }

    const record = records[0];

    // 转换数据格式以匹配前端期望
    const formattedRecord = {
      ...record,
      product_type: 'phone',
      product_name: `${record.brand_name || ''} ${record.model_name || ''}`,
      brand_name: record.brand_name || '',
      model_name: record.model_name || '',
      color_name: record.color_name || '',
      memory_name: record.memory_name || '',
      quantity: 1,
      operation_type: 'in',
      reason: '采购入库',
      is_settled: 1,
      reference_type: 'purchase',
      reference_id: record.purchase_number
    };

    ApiResponse.success(res, formattedRecord);
  } catch (error) {
    log.error('获取入库详情失败:', error);
    ApiResponse.serverError(res, '获取入库详情失败', error);
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// 创建入库记录
router.post('/', unifiedAuth, requireAnyPermission(['stock-in:create', 'inventory:create']), async (req, res) => {
  let connection;
  try {
    const {
      supplier_id,
      store_id,
      stock_in_date,
      operator_name,
      condition,
      products,
      notes
    } = req.body;

    // 获取数据库连接
    const pool = require('../config/database').getDatabase();
    connection = await pool.getConnection();

    // 统一使用当前登录用户作为入库操作员，不再回退到固定管理员ID
    const currentUser = req.user || {};
    const currentUserId = currentUser.id || currentUser.sub;
    if (!currentUserId) {
      return ApiResponse.error(res, '用户未登录或登录已失效', 401);
    }

    let inventoryOperatorId = currentUserId;
    let actualOperatorName = operator_name?.trim() || currentUser.name || currentUser.username || '未知用户';

    const [userResult] = await connection.execute(
      'SELECT name, username FROM users WHERE id = ? LIMIT 1',
      [currentUserId]
    );

    if (userResult.length > 0) {
      const user = userResult[0];
      actualOperatorName = user.name || user.username || actualOperatorName;
    }

    // 数据验证
    if (!supplier_id) {
      return ApiResponse.badRequest(res, '请选择供应商');
    }

    if (!store_id) {
      return ApiResponse.badRequest(res, '请选择店铺');
    }

    if (!stock_in_date) {
      return ApiResponse.badRequest(res, '请选择入库时间');
    }

    if (!operator_name) {
      return ApiResponse.badRequest(res, '操作员不能为空');
    }

    if (!condition || !['全新', '二手'].includes(condition)) {
      return ApiResponse.badRequest(res, '请选择商品状态');
    }

    if (!products || !Array.isArray(products) || products.length === 0) {
      return ApiResponse.badRequest(res, '商品列表不能为空');
    }

    // 验证每个商品
    for (let i = 0; i < products.length; i++) {
      const product = products[i];

      if (!product.brand_id) {
        return ApiResponse.badRequest(res, `第${i + 1}行商品请选择品牌`);
      }

      if (!product.model_id) {
        return ApiResponse.badRequest(res, `第${i + 1}行商品请选择型号`);
      }

      if (!product.color_id) {
        return ApiResponse.badRequest(res, `第${i + 1}行商品请选择颜色`);
      }

      if (!product.memory_id) {
        return ApiResponse.badRequest(res, `第${i + 1}行商品请选择内存`);
      }

      // IMEI验证：如果是15位纯数字，或与序列号相同（无IMEI设备如iPad、手表等）
      if (!product.imei) {
        return ApiResponse.badRequest(res, `第${i + 1}行商品请输入IMEI号`);
      }
      // 检查IMEI是否有效（15位纯数字 或 与序列号相同且至少4位）
      const isValidIMEI = (product.imei.length === 15 && /^\d{15}$/.test(product.imei)) ||
                          (product.imei === product.serial_number && product.imei.length >= 4);
      if (!isValidIMEI) {
        return ApiResponse.badRequest(res, `第${i + 1}行商品IMEI号必须为15位数字，或与序列号相同（无IMEI设备）`);
      }

      if (product.serial_number && product.serial_number.length > 50) {
        return ApiResponse.badRequest(res, `第${i + 1}行商品序列号最长50位`);
      }

      if (!product.purchase_price || product.purchase_price <= 0) {
        return ApiResponse.badRequest(res, `第${i + 1}行商品请输入有效的入库价格`);
      }
    }

    // 生成入库单号（使用北京时间：PO + 年份 + 时分秒6位）
    const now = new Date();
    // 转换为北京时间 (UTC+8)
    const beijingTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    const year = beijingTime.getUTCFullYear();
    const hours = String(beijingTime.getUTCHours()).padStart(2, '0');
    const minutes = String(beijingTime.getUTCMinutes()).padStart(2, '0');
    const seconds = String(beijingTime.getUTCSeconds()).padStart(2, '0');
    const purchase_number = `PO${year}${hours}${minutes}${seconds}`;

    // 开始事务
    await connection.beginTransaction();

    try {
      const insertedProducts = [];

      // 批量插入每个商品
      for (let i = 0; i < products.length; i++) {
        const product = products[i];

        // 获取品牌、型号、颜色、内存的名称
        const [brandResult] = await connection.execute(
          'SELECT name FROM brands WHERE id = ?',
          [product.brand_id]
        );
        const [modelResult] = await connection.execute(
          'SELECT name FROM models WHERE id = ?',
          [product.model_id]
        );
        const [colorResult] = await connection.execute(
          'SELECT name FROM colors WHERE id = ?',
          [product.color_id]
        );
        const [memoryResult] = await connection.execute(
          'SELECT size FROM memories WHERE id = ?',
          [product.memory_id]
        );

        const brandName = brandResult[0]?.name || '';
        const modelName = modelResult[0]?.name || '';
        const colorName = colorResult[0]?.name || '';
        const memoryName = memoryResult[0]?.size || '';

        // 检查IMEI是否已存在 - 只检查在库状态，允许回收已售商品重新入库
        const [existingPhones] = await connection.execute(
          'SELECT id, status FROM phones WHERE imei = ?',
          [product.imei]
        );

        // 只有在库状态才报错，已售出的商品可以回收后重新入库
        if (existingPhones.length > 0) {
          const existingPhone = existingPhones[0];
          if (existingPhone.status === 'in_stock') {
            await connection.rollback();
            return ApiResponse.badRequest(res, `第${i + 1}行商品IMEI号已在库中，无法重复入库`);
          }
          // 如果是已售出或其他状态，允许重新入库（回收商品）
          log.debug(`ℹ️  IMEI ${product.imei} 已存在但状态为 ${existingPhone.status}，允许回收入库`);
        }

        // 插入phones表 - 使用基本的必需字段
        // 确保所有ID字段都有效，如果为null则设为null
        const insertValues = [
            purchase_number,
            inventoryOperatorId, // 记录入库操作员ID
            product.brand_id || null,
            product.model_id || null,
            product.color_id || null,
            product.memory_id || null,
            product.imei,
            product.serial_number || '',
            product.purchase_price, // purchase_cost: 实际采购成本价
            // sale_price: 如果前端传了 sale_price 则使用，否则为 null（显示"电询"）
            (product.sale_price !== undefined && product.sale_price !== null && product.sale_price > 0)
              ? product.sale_price
              : null,
            condition === '全新' ? 1 : 0,
            supplier_id,
            store_id,
            'in_stock',
            condition === '全新' ? 'A' : 'B', // quality_grade
            notes || '',
            stock_in_date,  // 使用前端发送的入库日期
            null  // salestime 在入库时为空
        ];

        log.debug('📝 插入phones表的数据:', {
          purchase_number,
          inventoryOperatorId,
          brand_id: product.brand_id,
          model_id: product.model_id,
          color_id: product.color_id,
          memory_id: product.memory_id,
          imei: product.imei
        });

        const [insertResult] = await connection.execute(
          `INSERT INTO phones (
            purchase_number, inventory_operator_id, brand_id, model_id, color_id, memory_id,
            imei, serial_number, purchase_cost, sale_price, is_new, supplier_id, store_id, status,
            quality_grade, remarks, Inventorytime, salestime
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          insertValues
        );

        const phoneId = insertResult.insertId;

        // 如果是二手商品，同时创建 H5_product 记录
        if (condition === '二手') {
          const isPublished = product.is_published !== undefined ? product.is_published : 1;
          await connection.execute(
            `INSERT INTO H5_product (phone_id, is_published, created_at, updated_at) VALUES (?, ?, NOW(), NOW())
             ON DUPLICATE KEY UPDATE is_published = VALUES(is_published), updated_at = NOW()`,
            [phoneId, isPublished]
          );
          log.debug(`✅ 创建 H5_product 记录: phone_id=${phoneId}, is_published=${isPublished}`);
        }

        insertedProducts.push({
          id: phoneId,
          brand_id: product.brand_id || null,
          model_id: product.model_id || null,
          color_id: product.color_id || null,
          memory_id: product.memory_id || null,
          store_id: store_id || null,
          brand_name: brandName,
          model_name: modelName,
          color_name: colorName,
          memory_name: memoryName,
          imei: product.imei,
          serial_number: product.serial_number,
          purchase_price: product.purchase_price
        });
      }

      // 提交事务
      await connection.commit();

      // 检查是否有匹配的待匹配预定单，并自动匹配
      const matchablePreorders = [];
      const autoMatchedPreorders = [];

      for (const product of insertedProducts) {
        try {
          const brandId = product.brand_id || null;
          const modelId = product.model_id || null;
          const colorId = product.color_id || null;
          const memoryId = product.memory_id || null;

          // 查找匹配的待匹配预定单（不限制店铺）
          const [preorderResult] = await connection.execute(`
            SELECT
              id,
              preorder_number,
              customer_id,
              customer_name,
              customer_phone,
              brand_id,
              model_id,
              color_id,
              memory_id,
              is_new,
              deposit_amount,
              total_price
            FROM preorders
            WHERE status = 'pending'
              AND brand_id = ?
              AND model_id = ?
              AND color_id = ?
              AND memory_id = ?
              AND is_new = ?
            ORDER BY created_at ASC
            LIMIT 1
          `, [brandId, modelId, colorId, memoryId, product.is_new || 1]);

          if (preorderResult.length > 0) {
            const preorder = preorderResult[0];

            // 自动匹配：更新预定单状态
            await connection.execute(`
              UPDATE preorders SET
                status = 'arrived',
                matched_phone_id = ?,
                imei = ?,
                matched_time = NOW(),
                updated_at = NOW()
              WHERE id = ?
            `, [product.id, product.imei, preorder.id]);

            // 标记手机为已预定
            await connection.execute(`
              UPDATE phones SET is_preordered = 1
              WHERE id = ?
            `, [product.id]);

            autoMatchedPreorders.push({
              preorder_id: preorder.id,
              preorder_number: preorder.preorder_number,
              customer_name: preorder.customer_name,
              phone_id: product.id,
              imei: product.imei
            });

            log.debug(`✅ 自动匹配预定单: ${preorder.preorder_number} -> IMEI: ${product.imei}`);
          }
        } catch (matchError) {
          log.warn('自动匹配预定单失败:', matchError);
        }
      }

      // 构建响应数据
      const responseData = {
        purchase_number,
        supplier_id,
        store_id,
        stock_in_date,
        actualOperatorName,
        condition,
        notes,
        products: insertedProducts,
        total_count: products.length,
        total_amount: products.reduce((sum, p) => sum + p.purchase_price, 0)
      };

      // 如果有自动匹配的预定单，添加到响应中
      if (autoMatchedPreorders.length > 0) {
        responseData.auto_matched_preorders = autoMatchedPreorders;
        responseData.has_auto_matched = true;
      }

      // 返回成功结果
      const successMessage = autoMatchedPreorders.length > 0
        ? `商品入库成功，已自动匹配 ${autoMatchedPreorders.length} 个预定单`
        : '商品入库成功';

      ApiResponse.success(res, responseData, successMessage);

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
      connection.release();
    }
  }
});

// 更新入库记录
router.put('/:id', unifiedAuth, requirePermission('stock-in:edit'), async (req, res) => {
  let connection;
  try {
    const { id } = req.params;

    // 获取数据库连接
    const pool = require('../config/database').getDatabase();
    connection = await pool.getConnection();

    // 检查记录是否存在
    const [existingRecords] = await connection.execute('SELECT id FROM phones WHERE id = ?', [id]);
    if (existingRecords.length === 0) {
      return ApiResponse.notFound(res, '入库记录不存在');
    }

    const updateData = req.body;
    const updateFields = [];
    const updateValues = [];

    // 构建更新字段
    if (updateData.brand_id !== undefined) {
      updateFields.push('brand_id = ?');
      updateValues.push(updateData.brand_id);
    }

    if (updateData.model_id !== undefined) {
      updateFields.push('model_id = ?');
      updateValues.push(updateData.model_id);
    }

    if (updateData.color_id !== undefined) {
      updateFields.push('color_id = ?');
      updateValues.push(updateData.color_id);
    }

    if (updateData.memory_id !== undefined) {
      updateFields.push('memory_id = ?');
      updateValues.push(updateData.memory_id);
    }

    if (updateData.imei !== undefined) {
      updateFields.push('imei = ?');
      updateValues.push(updateData.imei);
    }

    if (updateData.serial_number !== undefined) {
      updateFields.push('serial_number = ?');
      updateValues.push(updateData.serial_number);
    }

    if (updateData.purchase_cost !== undefined) {
      updateFields.push('purchase_cost = ?');
      updateValues.push(updateData.purchase_cost);
    }

    if (updateData.sale_price !== undefined) {
      updateFields.push('sale_price = ?');
      updateValues.push(updateData.sale_price);
    }

    if (updateData.is_new !== undefined) {
      // 支持 '全新'/'二手' 字符串或 1/0 数字
      if (updateData.is_new === '全新') {
        updateFields.push('is_new = ?');
        updateValues.push(1);
      } else if (updateData.is_new === '二手') {
        updateFields.push('is_new = ?');
        updateValues.push(0);
      } else {
        updateFields.push('is_new = ?');
        updateValues.push(updateData.is_new);
      }
    }

    if (updateData.status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(updateData.status);
    }

    if (updateData.store_id !== undefined) {
      updateFields.push('store_id = ?');
      updateValues.push(updateData.store_id);
    }

    if (updateData.supplier_id !== undefined) {
      updateFields.push('supplier_id = ?');
      updateValues.push(updateData.supplier_id);
    }

    if (updateData.remarks !== undefined) {
      updateFields.push('remarks = ?');
      updateValues.push(updateData.remarks);
    }

    if (updateFields.length === 0) {
      return ApiResponse.badRequest(res, '没有提供要更新的字段');
    }

    updateFields.push('updated_at = NOW()');
    updateValues.push(id);

    // 执行更新
    const updateQuery = `
      UPDATE phones
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `;

    await connection.execute(updateQuery, updateValues);

    // 获取更新后的记录
    const [updatedRecords] = await connection.execute(`
      SELECT * FROM phones WHERE id = ?
    `, [id]);

    ApiResponse.success(res, updatedRecords[0], '入库记录更新成功');
  } catch (error) {
    log.error('更新入库记录失败:', error);
    ApiResponse.serverError(res, '更新入库记录失败', error);
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// 删除入库记录
router.delete('/:id', unifiedAuth, requirePermission('stock-in:delete'), async (req, res) => {
  let connection;
  try {
    const { id } = req.params;

    // 获取数据库连接
    const pool = require('../config/database').getDatabase();
    connection = await pool.getConnection();

    // 检查记录是否存在
    const [existingRecords] = await connection.execute('SELECT id FROM phones WHERE id = ?', [id]);
    if (existingRecords.length === 0) {
      return ApiResponse.notFound(res, '入库记录不存在');
    }

    // 删除记录
    await connection.execute('DELETE FROM phones WHERE id = ?', [id]);

    ApiResponse.success(res, {
      id: parseInt(id),
      deleted: true
    }, '入库记录删除成功');
  } catch (error) {
    log.error('删除入库记录失败:', error);
    ApiResponse.serverError(res, '删除入库记录失败', error);
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

module.exports = router;
