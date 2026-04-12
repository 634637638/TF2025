/**
 * 预定管理路由
 * 提供预定单的增删改查、匹配、交付等功能
 * 兼容云端现有表结构
 */
const express = require('express');
const router = express.Router();
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth');
const ApiResponse = require('../utils/response');
const log = require('../utils/log');

const PREORDER_STATUS = {
  PENDING: 'pending',
  MATCHED: 'arrived',
  DELIVERED: 'completed',
  CANCELLED: 'cancelled'
};

const PREORDER_STATUS_LABELS = {
  [PREORDER_STATUS.PENDING]: '待匹配',
  [PREORDER_STATUS.MATCHED]: '已匹配',
  [PREORDER_STATUS.DELIVERED]: '已交付',
  [PREORDER_STATUS.CANCELLED]: '已取消'
};

const LEGACY_PREORDER_STATUS_ALIASES = {
  pending: PREORDER_STATUS.PENDING,
  matched: PREORDER_STATUS.MATCHED,
  arrived: PREORDER_STATUS.MATCHED,
  delivered: PREORDER_STATUS.DELIVERED,
  completed: PREORDER_STATUS.DELIVERED,
  cancelled: PREORDER_STATUS.CANCELLED
};

const normalizePreorderStatus = (status) => {
  if (!status) {
    return null;
  }

  return LEGACY_PREORDER_STATUS_ALIASES[String(status).trim()] || null;
};

/**
 * 获取预定单列表
 * GET /api/preorders
 */
router.get('/', unifiedAuth, requirePermission('preorders:view'), async (req, res) => {
  let connection;
  try {
    // 处理查询参数，确保正确处理 undefined
    const page = req.query.page && req.query.page !== 'undefined' ? req.query.page : 1;
    const limit = req.query.limit && req.query.limit !== 'undefined' ? req.query.limit : 20;
    const status = req.query.status && req.query.status !== 'undefined' && req.query.status !== 'null' ? req.query.status : null;
    const customer_id = req.query.customer_id && req.query.customer_id !== 'undefined' ? req.query.customer_id : null;
    const search = req.query.search && req.query.search !== 'undefined' ? req.query.search : null;
    const startDate = req.query.startDate && req.query.startDate !== 'undefined' ? req.query.startDate : null;
    const endDate = req.query.endDate && req.query.endDate !== 'undefined' ? req.query.endDate : null;

    const pool = require('../config/database').getDatabase();
    connection = await pool.getConnection();

    // 构建查询条件
    let whereConditions = ['1=1'];
    let params = [];

    // 状态筛选 - 映射前端状态值到数据库状态值
    const normalizedStatus = normalizePreorderStatus(status);

    if (normalizedStatus) {
      whereConditions.push('p.status = ?');
      params.push(normalizedStatus);
    } else {
      whereConditions.push(`p.status IN ('${PREORDER_STATUS.PENDING}', '${PREORDER_STATUS.MATCHED}', '${PREORDER_STATUS.CANCELLED}')`);
    }

    // 客户筛选
    if (customer_id) {
      whereConditions.push('p.customer_id = ?');
      params.push(customer_id);
    }

    // 搜索功能（客户姓名、预定单号、手机型号）
    if (search) {
      whereConditions.push(`(
        c.name LIKE ? OR
        c.phone LIKE ? OR
        p.preorder_number LIKE ? OR
        p.phone_model LIKE ? OR
        CONCAT(p.phone_model, ' ', p.color, ' ', p.storage) LIKE ? OR
        CONCAT(
          COALESCE(br.name, ''),
          ' ',
          COALESCE(mo.name, ''),
          ' ',
          COALESCE(co.name, ''),
          ' ',
          COALESCE(me.size, '')
        ) LIKE ?
      )`);
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam, searchParam, searchParam, searchParam);
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

    const whereClause = whereConditions.join(' AND ');

    // 获取总数
    const countQuery = `
      SELECT COUNT(*) as total
      FROM preorders p
      LEFT JOIN customers c ON p.customer_id = c.id
      LEFT JOIN brands br ON p.brand_id = br.id
      LEFT JOIN models mo ON p.model_id = mo.id
      LEFT JOIN colors co ON p.color_id = co.id
      LEFT JOIN memories me ON p.memory_id = me.id
      WHERE ${whereClause}
    `;

    const [countResult] = await connection.execute(countQuery, params);
    const total = countResult[0].total;

    // 分页查询
    const parsedPage = parseInt(page) || 1;
    const parsedLimit = parseInt(limit) || 20;
    const offset = (parsedPage - 1) * parsedLimit;

    const query = `
      SELECT
        p.*,
        c.name as customer_name,
        c.phone as customer_phone,
        u.name as operator_name,
        st.name as store_name,
        br.name as brand_name,
        mo.name as model_name,
        co.name as color_name,
        me.size as memory_size,
        ph.supplier_id,
        s.name as supplier_name,
        p.deposit_amount as advance_payment,
        p.total_price as expected_price,
        CASE
          WHEN p.status = '${PREORDER_STATUS.PENDING}' THEN '${PREORDER_STATUS_LABELS[PREORDER_STATUS.PENDING]}'
          WHEN p.status = '${PREORDER_STATUS.MATCHED}' THEN '${PREORDER_STATUS_LABELS[PREORDER_STATUS.MATCHED]}'
          WHEN p.status = '${PREORDER_STATUS.DELIVERED}' THEN '${PREORDER_STATUS_LABELS[PREORDER_STATUS.DELIVERED]}'
          WHEN p.status = '${PREORDER_STATUS.CANCELLED}' THEN '${PREORDER_STATUS_LABELS[PREORDER_STATUS.CANCELLED]}'
          ELSE p.status
        END as status_text,
        CONCAT(COALESCE(br.name, ''), ' ', COALESCE(mo.name, ''), ' ', COALESCE(co.name, ''), ' ', COALESCE(me.size, '')) as product_name,
        CASE
          WHEN p.actual_price IS NOT NULL THEN p.actual_price - p.deposit_amount
          ELSE NULL
        END as remaining_amount
      FROM preorders p
      LEFT JOIN customers c ON p.customer_id = c.id
      LEFT JOIN users u ON p.operator_id = u.id
      LEFT JOIN stores st ON p.store_id = st.id
      LEFT JOIN brands br ON p.brand_id = br.id
      LEFT JOIN models mo ON p.model_id = mo.id
      LEFT JOIN colors co ON p.color_id = co.id
      LEFT JOIN memories me ON p.memory_id = me.id
      LEFT JOIN phones ph ON p.matched_phone_id = ph.id
      LEFT JOIN suppliers s ON ph.supplier_id = s.id
      WHERE ${whereClause}
      ORDER BY
        p.status = '${PREORDER_STATUS.PENDING}' DESC,
        p.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const finalParams = [...params, String(parsedLimit), String(offset)];
    const [records] = await connection.execute(query, finalParams);

    ApiResponse.success(res, {
      records,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total: parseInt(total) || 0,
        pages: Math.ceil((parseInt(total) || 0) / parsedLimit)
      }
    });
  } catch (error) {
    log.error('获取预定单列表失败:', error);
    ApiResponse.serverError(res, '获取预定单列表失败', error);
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

/**
 * 获取预定单统计信息
 * GET /api/preorders/stats
 */
router.get('/stats', unifiedAuth, requirePermission('preorders:view'), async (req, res) => {
  let connection;
  try {
    const pool = require('../config/database').getDatabase();
    connection = await pool.getConnection();

    const statsQuery = `
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = '${PREORDER_STATUS.PENDING}' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN status = '${PREORDER_STATUS.MATCHED}' THEN 1 ELSE 0 END) as matched_count,
        SUM(CASE WHEN status = '${PREORDER_STATUS.DELIVERED}' THEN 1 ELSE 0 END) as delivered_count,
        SUM(CASE WHEN status = '${PREORDER_STATUS.CANCELLED}' THEN 1 ELSE 0 END) as cancelled_count,
        SUM(
          CASE
            WHEN deposit > 0 THEN deposit
            WHEN advance_payment > 0 THEN advance_payment
            ELSE 0
          END
        ) as total_deposits,
        SUM(CASE WHEN status = '${PREORDER_STATUS.DELIVERED}' THEN COALESCE(actual_price, 0) ELSE 0 END) as total_sales_value
      FROM preorders
    `;

    const [statsResult] = await connection.execute(statsQuery);
    const stats = statsResult[0];

    ApiResponse.success(res, {
      total: parseInt(stats.total) || 0,
      pending_count: parseInt(stats.pending_count) || 0,
      matched_count: parseInt(stats.matched_count) || 0,
      delivered_count: parseInt(stats.delivered_count) || 0,
      cancelled_count: parseInt(stats.cancelled_count) || 0,
      total_deposits: parseFloat(stats.total_deposits) || 0,
      total_sales_value: parseFloat(stats.total_sales_value) || 0
    });
  } catch (error) {
    log.error('获取预定统计失败:', error);
    ApiResponse.serverError(res, '获取预定统计失败', error);
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

/**
 * 查找待匹配的预定单（用于入库时自动匹配）
 * GET /api/preorders/matchable
 * 参数: phone_model, color, storage
 */
router.get('/matchable', unifiedAuth, requirePermission('preorders:match'), async (req, res) => {
  let connection;
  try {
    const {
      phone_model,
      color,
      storage,
      brand_id,
      model_id,
      color_id,
      memory_id,
      store_id
    } = req.query;

    const hasIdMatchParams = brand_id && model_id && color_id && memory_id;
    if (!hasIdMatchParams && !phone_model) {
      return ApiResponse.badRequest(res, '请提供手机型号或完整商品ID');
    }

    const pool = require('../config/database').getDatabase();
    connection = await pool.getConnection();

    const whereConditions = [`p.status = '${PREORDER_STATUS.PENDING}'`];
    const matchConditions = [];
    const params = [];

    if (hasIdMatchParams) {
      matchConditions.push(`
        (
          p.brand_id = ?
          AND p.model_id = ?
          AND p.color_id = ?
          AND p.memory_id = ?
        )
      `);
      params.push(brand_id, model_id, color_id, memory_id);
    }

    if (phone_model) {
      const textConditions = ['p.phone_model = ?'];
      params.push(phone_model);

      if (color) {
        textConditions.push('p.color = ?');
        params.push(color);
      }

      if (storage) {
        textConditions.push('p.storage = ?');
        params.push(storage);
      }

      matchConditions.push(`(${textConditions.join(' AND ')})`);
    }

    if (matchConditions.length === 0) {
      return ApiResponse.badRequest(res, '缺少有效的匹配条件');
    }

    whereConditions.push(`(${matchConditions.join(' OR ')})`);

    if (store_id) {
      whereConditions.push('(p.store_id IS NULL OR p.store_id = ?)');
      params.push(store_id);
    }

    const query = `
      SELECT
        p.id,
        p.preorder_number,
        p.customer_id,
        p.brand_id,
        p.model_id,
        p.color_id,
        p.memory_id,
        c.name as customer_name,
        c.phone as customer_phone,
        br.name as brand_name,
        mo.name as model_name,
        co.name as color_name,
        me.size as memory_size,
        CONCAT(COALESCE(br.name, ''), ' ', COALESCE(mo.name, ''), ' ', COALESCE(co.name, ''), ' ', COALESCE(me.size, '')) as product_name,
        CASE
          WHEN p.deposit > 0 THEN p.deposit
          WHEN p.advance_payment > 0 THEN p.advance_payment
          ELSE 0
        END as deposit_amount,
        p.expected_price as total_price,
        p.created_at,
        DATEDIFF(COALESCE(p.expected_arrival, DATE_ADD(p.created_at, INTERVAL 30 DAY)), CURDATE()) as days_remaining,
        u.name as operator_name
      FROM preorders p
      LEFT JOIN customers c ON p.customer_id = c.id
      LEFT JOIN users u ON p.operator_id = u.id
      LEFT JOIN brands br ON p.brand_id = br.id
      LEFT JOIN models mo ON p.model_id = mo.id
      LEFT JOIN colors co ON p.color_id = co.id
      LEFT JOIN memories me ON p.memory_id = me.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY p.created_at ASC
      LIMIT 10
    `;

    const [preorders] = await connection.execute(query, params);

    ApiResponse.success(res, preorders);
  } catch (error) {
    log.error('查找可匹配预定单失败:', error);
    ApiResponse.serverError(res, '查找可匹配预定单失败', error);
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

/**
 * 获取单个预定单详情
 * GET /api/preorders/:id
 */
router.get('/:id', unifiedAuth, requirePermission('preorders:view'), async (req, res) => {
  let connection;
  try {
    const { id } = req.params;

    const pool = require('../config/database').getDatabase();
    connection = await pool.getConnection();

    const query = `
      SELECT
        p.*,
        c.name as customer_name,
        c.phone as customer_phone,
        u.name as operator_name,
        br.name as brand_name,
        mo.name as model_name,
        co.name as color_name,
        me.size as memory_size,
        p.deposit_amount as advance_payment,
        p.total_price as expected_price,
        CASE
          WHEN p.status = '${PREORDER_STATUS.PENDING}' THEN '${PREORDER_STATUS_LABELS[PREORDER_STATUS.PENDING]}'
          WHEN p.status = '${PREORDER_STATUS.MATCHED}' THEN '${PREORDER_STATUS_LABELS[PREORDER_STATUS.MATCHED]}'
          WHEN p.status = '${PREORDER_STATUS.DELIVERED}' THEN '${PREORDER_STATUS_LABELS[PREORDER_STATUS.DELIVERED]}'
          WHEN p.status = '${PREORDER_STATUS.CANCELLED}' THEN '${PREORDER_STATUS_LABELS[PREORDER_STATUS.CANCELLED]}'
          ELSE p.status
        END as status_text,
        CONCAT(COALESCE(br.name, ''), ' ', COALESCE(mo.name, ''), ' ', COALESCE(co.name, ''), ' ', COALESCE(me.size, '')) as product_name,
        CASE
          WHEN p.actual_price IS NOT NULL THEN p.actual_price - p.deposit_amount
          ELSE NULL
        END as remaining_amount
      FROM preorders p
      LEFT JOIN customers c ON p.customer_id = c.id
      LEFT JOIN users u ON p.operator_id = u.id
      LEFT JOIN brands br ON p.brand_id = br.id
      LEFT JOIN models mo ON p.model_id = mo.id
      LEFT JOIN colors co ON p.color_id = co.id
      LEFT JOIN memories me ON p.memory_id = me.id
      WHERE p.id = ?
    `;

    const [records] = await connection.execute(query, [id]);

    if (records.length === 0) {
      return ApiResponse.notFound(res, '预定单不存在');
    }

    ApiResponse.success(res, records[0]);
  } catch (error) {
    log.error('获取预定单详情失败:', error);
    ApiResponse.serverError(res, '获取预定单详情失败', error);
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

/**
 * 创建预定单
 * POST /api/preorders
 */
router.post('/', unifiedAuth, requirePermission('preorders:create'), async (req, res) => {
  let connection;
  try {
    const {
      customer_id,
      store_id,
      brand_id,
      model_id,
      color_id,
      memory_id,
      is_new,
      expected_price,
      advance_payment,
      remarks,
      notes
    } = req.body;

    // 兼容前端可能使用 notes 字段
    const finalRemarks = remarks || notes;

    // 使用前端传来的店铺ID，如果没有则使用用户的主店铺
    const finalStoreId = store_id || req.user?.store_id;

    const pool = require('../config/database').getDatabase();
    connection = await pool.getConnection();

    // 数据验证
    if (!customer_id) {
      return ApiResponse.badRequest(res, '请选择客户');
    }

    if (!brand_id || !model_id || !color_id || !memory_id) {
      return ApiResponse.badRequest(res, '请完整选择商品信息（品牌、型号、颜色、内存）');
    }

    // 定金必填
    if (!advance_payment || advance_payment <= 0) {
      return ApiResponse.badRequest(res, '请输入有效的定金金额');
    }

    // 验证客户是否存在
    const [customerResult] = await connection.execute(
      'SELECT id, name, phone FROM customers WHERE id = ?',
      [customer_id]
    );

    if (customerResult.length === 0) {
      return ApiResponse.notFound(res, '客户不存在');
    }

    const customer = customerResult[0];

    // 验证商品信息是否存在
    const [brandResult] = await connection.execute('SELECT id, name FROM brands WHERE id = ?', [brand_id]);
    if (brandResult.length === 0) {
      return ApiResponse.notFound(res, '品牌不存在');
    }

    const [modelResult] = await connection.execute('SELECT id, name FROM models WHERE id = ?', [model_id]);
    if (modelResult.length === 0) {
      return ApiResponse.notFound(res, '型号不存在');
    }

    const [colorResult] = await connection.execute('SELECT id, name FROM colors WHERE id = ?', [color_id]);
    if (colorResult.length === 0) {
      return ApiResponse.notFound(res, '颜色不存在');
    }

    const [memoryResult] = await connection.execute('SELECT id, size FROM memories WHERE id = ?', [memory_id]);
    if (memoryResult.length === 0) {
      return ApiResponse.notFound(res, '内存不存在');
    }

    // 生成预定单号 (PR + 年月日时分秒)
    const now = new Date();
    const preorderNumber = `PR${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;

    // 获取当前用户ID和店铺ID
    const userId = req.user?.sub || req.user?.id;
    const userStoreId = req.user?.store_id;

    await connection.beginTransaction();

    try {
      // 检查是否有匹配的库存手机
      log.debug('🔍 开始查找匹配的库存手机:', {
        brand_id,
        model_id,
        color_id,
        memory_id,
        预订店铺: finalStoreId,
        说明: '不限制库存商品所在店铺'
      });

      const [matchingPhones] = await connection.execute(
        `SELECT id, imei, purchase_cost, store_id
         FROM phones
         WHERE brand_id = ?
           AND model_id = ?
           AND color_id = ?
           AND memory_id = ?
           AND is_new = ?
           AND status = 'in_stock'
           AND is_preordered = 0
         ORDER BY id ASC
         LIMIT 1`,
        [brand_id, model_id, color_id, memory_id, is_new || 1]
      );

      log.debug('📦 匹配查询结果:', {
        找到数量: matchingPhones.length,
        手机信息: matchingPhones.length > 0 ? matchingPhones[0] : null
      });

      let initialStatus = PREORDER_STATUS.PENDING;
      let matchedPhoneId = null;
      let matchedImei = null;

      // 如果找到匹配的手机，自动匹配
      if (matchingPhones.length > 0) {
        const matchedPhone = matchingPhones[0];
        initialStatus = PREORDER_STATUS.MATCHED;
        matchedPhoneId = matchedPhone.id;
        matchedImei = matchedPhone.imei;

        log.debug('✅ 自动匹配成功:', {
          phone_id: matchedPhoneId,
          imei: matchedImei
        });

        // 标记手机为已预定
        await connection.execute(
          `UPDATE phones SET is_preordered = 1 WHERE id = ?`,
          [matchedPhoneId]
        );
      } else {
        log.debug('⚠️ 未找到匹配的库存手机');
      }

      // 插入预定单
      const [insertResult] = await connection.execute(
        `INSERT INTO preorders (
          preorder_number, customer_id, store_id, customer_name, customer_phone,
          brand_id, model_id, color_id, memory_id, is_new,
          deposit_amount, deposit_paid, total_price,
          status, remarks, created_by, matched_phone_id, imei, matched_time
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          preorderNumber,
          customer_id,
          finalStoreId || null,
          customer.name,
          customer.phone,
          brand_id,
          model_id,
          color_id,
          memory_id,
          is_new || 1,
          advance_payment,
          advance_payment, // deposit_paid 默认等于 deposit_amount
          expected_price || null,
          initialStatus,
          finalRemarks || null,
          userId,
          matchedPhoneId,
          matchedImei,
          initialStatus === PREORDER_STATUS.MATCHED ? new Date() : null
        ]
      );

      const preorderId = insertResult.insertId;

      await connection.commit();

      ApiResponse.success(res, {
        id: preorderId,
        preorder_number: preorderNumber,
        auto_matched: initialStatus === PREORDER_STATUS.MATCHED,
        matched_phone_id: matchedPhoneId,
        imei: matchedImei
      }, initialStatus === PREORDER_STATUS.MATCHED ? '预定单创建成功，已自动匹配库存' : '预定单创建成功');

    } catch (dbError) {
      await connection.rollback();
      throw dbError;
    }

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    log.error('创建预定单失败:', error);
    ApiResponse.serverError(res, '创建预定单失败', error);
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

/**
 * 匹配预定单（将手机分配给预定单）
 * PUT /api/preorders/:id/match
 */
router.put('/:id/match', unifiedAuth, requirePermission('preorders:match'), async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const { phone_id, imei, actual_model, arrival_date, actual_price } = req.body;

    if (!phone_id && !imei) {
      return ApiResponse.badRequest(res, '请选择要匹配的手机或输入IMEI');
    }

    const pool = require('../config/database').getDatabase();
    connection = await pool.getConnection();

    await connection.beginTransaction();

    try {
      // 检查预定单是否存在且状态为pending
      const [preorderResult] = await connection.execute(
        'SELECT * FROM preorders WHERE id = ? AND status = ?',
        [id, PREORDER_STATUS.PENDING]
      );

      if (preorderResult.length === 0) {
        await connection.rollback();
        return ApiResponse.badRequest(res, '预定单不存在或状态不正确');
      }

      const preorder = preorderResult[0];

      let phoneImei = imei;
      let phoneActualModel = actual_model;
      let phoneActualPrice = actual_price;

      // 如果提供了 phone_id，获取手机信息
      if (phone_id) {
        const [phoneResult] = await connection.execute(
          'SELECT imei, brand_id, model_id, color_id, memory_id, purchase_cost FROM phones WHERE id = ? AND status = ?',
          [phone_id, 'in_stock']
        );

        if (phoneResult.length === 0) {
          await connection.rollback();
          return ApiResponse.badRequest(res, '手机不存在或已售出');
        }

        const phone = phoneResult[0];
        phoneImei = phoneImei || phone.imei;

        // 获取手机详细信息
        const [detailsResult] = await connection.execute(`
          SELECT
            b.name as brand_name,
            m.name as model_name
          FROM phones p
          LEFT JOIN brands b ON p.brand_id = b.id
          LEFT JOIN models m ON p.model_id = m.id
          WHERE p.id = ?
        `, [phone_id]);

        if (detailsResult.length > 0) {
          phoneActualModel = phoneActualModel || `${detailsResult[0].brand_name} ${detailsResult[0].model_name}`;
        }

        phoneActualPrice = phoneActualPrice || preorder.expected_price || phone.purchase_price;
      }

      // 计算尾款
      const finalPrice = phoneActualPrice || preorder.expected_price;
      const remainingAmount = finalPrice - (preorder.advance_payment || preorder.deposit || 0);

      // 更新预定单状态
      await connection.execute(
        `UPDATE preorders SET
          status = '${PREORDER_STATUS.MATCHED}',
          imei = ?,
          actual_model = ?,
          arrival_date = ?,
          actual_price = ?,
          matched_time = COALESCE(matched_time, NOW()),
          updated_at = NOW()
        WHERE id = ?`,
        [
          phoneImei || null,
          phoneActualModel || preorder.phone_model,
          arrival_date || new Date().toISOString().split('T')[0],
          finalPrice,
          id
        ]
      );

      // 如果提供了 phone_id，更新手机状态
      if (phone_id) {
        await connection.execute(
          `UPDATE phones SET
            is_preordered = 1,
            updated_at = NOW()
          WHERE id = ?`,
          [phone_id]
        );
      }

      await connection.commit();

      ApiResponse.success(res, {
        id: parseInt(id),
        imei: phoneImei,
        actual_model: phoneActualModel,
        actual_price: finalPrice,
        remaining_amount: remainingAmount
      }, '预定单匹配成功');

    } catch (dbError) {
      await connection.rollback();
      throw dbError;
    }

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    log.error('匹配预定单失败:', error);
    ApiResponse.serverError(res, '匹配预定单失败', error);
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

/**
 * 完成交付（标记为已交付）
 * PUT /api/preorders/:id/deliver
 */
router.put('/:id/deliver', unifiedAuth, requirePermission('preorders:complete'), async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const { actual_price, remarks } = req.body;

    const pool = require('../config/database').getDatabase();
    connection = await pool.getConnection();

    await connection.beginTransaction();

    try {
      // 检查预定单状态
      const [preorderResult] = await connection.execute(
        'SELECT * FROM preorders WHERE id = ?',
        [id]
      );

      if (preorderResult.length === 0) {
        await connection.rollback();
        return ApiResponse.notFound(res, '预定单不存在');
      }

      const preorder = preorderResult[0];

      if (preorder.status === PREORDER_STATUS.CANCELLED) {
        await connection.rollback();
        return ApiResponse.badRequest(res, '已取消的预定单不能交付');
      }

      if (preorder.status === PREORDER_STATUS.DELIVERED) {
        await connection.rollback();
        return ApiResponse.badRequest(res, '预定单已交付');
      }

      // 如果有IMEI，更新对应的手机状态为已售出
      if (preorder.imei) {
        await connection.execute(
          `UPDATE phones SET
            status = 'sold',
            salestime = NOW(),
            updated_at = NOW()
          WHERE imei = ? AND status = 'in_stock'`,
          [preorder.imei]
        );
      }

      const finalPrice = actual_price || preorder.actual_price || preorder.expected_price;

      // 更新预定单状态
      await connection.execute(
        `UPDATE preorders SET
          status = '${PREORDER_STATUS.DELIVERED}',
          actual_price = ?,
          remarks = ?,
          updated_at = NOW()
        WHERE id = ?`,
        [finalPrice, remarks || preorder.remarks, id]
      );

      await connection.commit();

      ApiResponse.success(res, {
        id: parseInt(id),
        actual_price: finalPrice,
        message: '预定单交付成功'
      }, '预定单交付成功');

    } catch (dbError) {
      await connection.rollback();
      throw dbError;
    }

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    log.error('完成预定单交付失败:', error);
    ApiResponse.serverError(res, '完成预定单交付失败', error);
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

/**
 * 取消预定单
 * PUT /api/preorders/:id/cancel
 */
router.put('/:id/cancel', unifiedAuth, requirePermission('preorders:cancel'), async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const pool = require('../config/database').getDatabase();
    connection = await pool.getConnection();

    await connection.beginTransaction();

    try {
      // 检查预定单状态
      const [preorderResult] = await connection.execute(
        'SELECT * FROM preorders WHERE id = ?',
        [id]
      );

      if (preorderResult.length === 0) {
        await connection.rollback();
        return ApiResponse.notFound(res, '预定单不存在');
      }

      const preorder = preorderResult[0];

      if (preorder.status === PREORDER_STATUS.CANCELLED) {
        await connection.rollback();
        return ApiResponse.badRequest(res, '预定单已被取消');
      }

      if (preorder.status === PREORDER_STATUS.DELIVERED) {
        await connection.rollback();
        return ApiResponse.badRequest(res, '已交付的预定单不能取消');
      }

      // 如果已匹配手机，释放手机（通过 matched_phone_id）
      if (preorder.matched_phone_id) {
        await connection.execute(
          `UPDATE phones SET is_preordered = 0 WHERE id = ?`,
          [preorder.matched_phone_id]
        );
      }

      // 更新预定单状态
      await connection.execute(
        `UPDATE preorders SET
          status = '${PREORDER_STATUS.CANCELLED}',
          cancelled_at = NOW(),
          cancel_reason = ?,
          updated_at = NOW()
        WHERE id = ?`,
        [reason || null, id]
      );

      await connection.commit();

      ApiResponse.success(res, {
        id: parseInt(id),
        message: '预定单取消成功'
      }, '预定单取消成功');

    } catch (dbError) {
      await connection.rollback();
      throw dbError;
    }

  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (e) {}
    }
    log.error('取消预定单失败:', error);
    ApiResponse.serverError(res, '取消预定单失败', error);
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

/**
 * 更新预定单
 * PUT /api/preorders/:id
 */
router.put('/:id', unifiedAuth, requirePermission('preorders:edit'), async (req, res) => {
  let connection;
  try {
    const { id } = req.params;

    const pool = require('../config/database').getDatabase();
    connection = await pool.getConnection();

    // 检查预定单是否存在
    const [existingRecords] = await connection.execute(
      'SELECT id, status FROM preorders WHERE id = ?',
      [id]
    );

    if (existingRecords.length === 0) {
      return ApiResponse.notFound(res, '预定单不存在');
    }

    const preorder = existingRecords[0];

    // 只允许编辑待匹配状态的预定单
    if (preorder.status !== PREORDER_STATUS.PENDING) {
      return ApiResponse.badRequest(res, '只能编辑待匹配状态的预定单');
    }

    const updateData = req.body;
    const updateFields = [];
    const updateValues = [];

    // 字段映射：前端字段 -> 数据库字段
    const fieldMapping = {
      'expected_price': 'total_price',
      'advance_payment': 'deposit_amount'
    };

    // 可编辑字段 - 支持新的 ID 字段和旧字段
    const allowedFields = [
      'customer_id', 'store_id', 'customer_name', 'customer_phone',  // 客户和店铺信息
      'brand_id', 'model_id', 'color_id', 'memory_id', 'is_new',  // 商品信息
      'phone_model', 'color', 'storage',  // 旧字段（兼容）
      'expected_arrival', 'expected_price', 'advance_payment', 'deposit', 'remarks'
    ];

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        // 使用映射后的字段名
        const dbField = fieldMapping[field] || field;
        updateFields.push(`${dbField} = ?`);
        updateValues.push(updateData[field]);
      }
    }

    if (updateFields.length === 0) {
      return ApiResponse.badRequest(res, '没有提供要更新的字段');
    }

    updateFields.push('updated_at = NOW()');
    updateValues.push(id);

    const updateQuery = `
      UPDATE preorders
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `;

    await connection.execute(updateQuery, updateValues);

    // 获取更新后的记录
    const [updatedRecords] = await connection.execute(`
      SELECT * FROM preorders WHERE id = ?
    `, [id]);

    ApiResponse.success(res, updatedRecords[0], '预定单更新成功');
  } catch (error) {
    log.error('更新预定单失败:', error);
    ApiResponse.serverError(res, '更新预定单失败', error);
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

/**
 * 恢复已取消的预定单
 * PUT /api/preorders/:id/restore
 */
router.put('/:id/restore', unifiedAuth, requirePermission('preorders:edit'), async (req, res) => {
  let connection;
  try {
    const { id } = req.params;

    const pool = require('../config/database').getDatabase();
    connection = await pool.getConnection();

    // 检查预定单是否存在
    const [existingRecords] = await connection.execute(
      'SELECT id, status, preorder_number FROM preorders WHERE id = ?',
      [id]
    );

    if (existingRecords.length === 0) {
      return ApiResponse.notFound(res, '预定单不存在');
    }

    const preorder = existingRecords[0];

    // 只允许恢复已取消的预定单
    if (preorder.status !== PREORDER_STATUS.CANCELLED) {
      return ApiResponse.badRequest(res, '只能恢复已取消状态的预定单');
    }

    // 恢复预定单状态为待匹配
    await connection.execute(
      `UPDATE preorders SET status = '${PREORDER_STATUS.PENDING}', cancelled_at = NULL, cancel_reason = NULL, updated_at = NOW() WHERE id = ?`,
      [id]
    );

    // 获取更新后的记录
    const [updatedRecords] = await connection.execute(`
      SELECT
        p.*,
        c.name as customer_name,
        c.phone as customer_phone,
        u.name as operator_name,
        st.name as store_name,
        br.name as brand_name,
        mo.name as model_name,
        co.name as color_name,
        me.size as memory_size,
        ph.supplier_id,
        s.name as supplier_name,
        p.deposit_amount as advance_payment,
        p.total_price as expected_price,
        CASE
          WHEN p.status = '${PREORDER_STATUS.PENDING}' THEN '${PREORDER_STATUS_LABELS[PREORDER_STATUS.PENDING]}'
          WHEN p.status = '${PREORDER_STATUS.MATCHED}' THEN '${PREORDER_STATUS_LABELS[PREORDER_STATUS.MATCHED]}'
          WHEN p.status = '${PREORDER_STATUS.DELIVERED}' THEN '${PREORDER_STATUS_LABELS[PREORDER_STATUS.DELIVERED]}'
          WHEN p.status = '${PREORDER_STATUS.CANCELLED}' THEN '${PREORDER_STATUS_LABELS[PREORDER_STATUS.CANCELLED]}'
          ELSE p.status
        END as status_text
      FROM preorders p
      LEFT JOIN customers c ON p.customer_id = c.id
      LEFT JOIN users u ON p.operator_id = u.id
      LEFT JOIN stores st ON p.store_id = st.id
      LEFT JOIN brands br ON p.brand_id = br.id
      LEFT JOIN models mo ON p.model_id = mo.id
      LEFT JOIN colors co ON p.color_id = co.id
      LEFT JOIN memories me ON p.memory_id = me.id
      LEFT JOIN phones ph ON p.matched_phone_id = ph.id
      LEFT JOIN suppliers s ON ph.supplier_id = s.id
      WHERE p.id = ?
    `, [id]);

    ApiResponse.success(res, updatedRecords[0], '预定单已恢复');
  } catch (error) {
    log.error('恢复预定单失败:', error);
    ApiResponse.serverError(res, '恢复预定单失败', error);
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

/**
 * 删除预定单
 * DELETE /api/preorders/:id
 */
router.delete('/:id', unifiedAuth, requirePermission('preorders:delete'), async (req, res) => {
  let connection;
  try {
    const { id } = req.params;

    const pool = require('../config/database').getDatabase();
    connection = await pool.getConnection();

    // 检查预定单是否存在
    const [existingRecords] = await connection.execute(
      'SELECT status FROM preorders WHERE id = ?',
      [id]
    );

    if (existingRecords.length === 0) {
      return ApiResponse.notFound(res, '预定单不存在');
    }

    const preorder = existingRecords[0];

    // 只允许删除已取消或已交付的预定单
    if (preorder.status !== PREORDER_STATUS.CANCELLED && preorder.status !== PREORDER_STATUS.DELIVERED) {
      return ApiResponse.badRequest(res, '只能删除已取消或已交付的预定单');
    }

    // 删除预定单
    await connection.execute('DELETE FROM preorders WHERE id = ?', [id]);

    ApiResponse.success(res, {
      id: parseInt(id),
      deleted: true
    }, '预定单删除成功');
  } catch (error) {
    log.error('删除预定单失败:', error);
    ApiResponse.serverError(res, '删除预定单失败', error);
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

module.exports = router;
