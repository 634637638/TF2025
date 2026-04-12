const BaseRepository = require('./base.repository');
const { hasColumn, hasTable } = require('../services/schemaInspector.service');
const log = require('../utils/log');

class QueryRepository extends BaseRepository {
  constructor() {
    super('phones');
  }

  normalizeStatus(status) {
    if (!status) {
      return undefined;
    }

    const statusMapping = {
      '在库': 'in_stock',
      '已售': 'sold',
      '预订': 'reserved',
      '维修中': 'repair',
      '丢失': 'lost',
      '调货': 'peer_transfer',
      '划拨': 'supplier_proxy',
      '已退货': 'returned',
      '损坏': 'damaged',
      '可用': 'available'
    };

    return statusMapping[status] || status;
  }

  isSalesRelatedStatus(status) {
    return ['sold', 'peer_transfer', 'supplier_proxy'].includes(status);
  }

  getBusinessTimeExpression(status) {
    const normalizedStatus = this.normalizeStatus(status);

    if (normalizedStatus) {
      return this.isSalesRelatedStatus(normalizedStatus) ? 'p.salestime' : 'p.Inventorytime';
    }

    return 'p.salestime';
  }

  /**
   * 综合查询手机数据（包含所有关联信息）
   */
  async getComprehensivePhoneQuery(filters = {}) {
    const {
      page = 1,
      limit = 20,
      phone_id,
      supplier_id,
      store_id,
      store_ids,  // 新增：支持多门店ID数组
      brand,
      model,
      color,
      memory,
      status,
      is_new,
      sale_operator_id,
      start_date,
      end_date,
      search_term,
      sort_field = 'salestime',
      sort_order = 'DESC'
    } = filters;

    const normalizedStatus = this.normalizeStatus(status);

    // 如果查询状态是 reserved（预订），则查询预订表
    if (normalizedStatus === 'reserved') {
      return this.getPreorderQuery(filters);
    }

    const normalizedPage = parseInt(page, 10) || 1;
    const normalizedLimit = parseInt(limit, 10) || 20;
    const offset = (normalizedPage - 1) * normalizedLimit;
    const db = this.getConnection();
    const supportsSalesPaymentChannel = await hasColumn('sales', 'payment_channel', db);
    const supportsPaymentRecordsTable = await hasTable('payment_records', db);
    const supportsPaymentRecordsChannel = supportsPaymentRecordsTable
      ? await hasColumn('payment_records', 'payment_channel', db)
      : false;
    const paymentChannelFallbackExpr = supportsPaymentRecordsChannel
      ? `(SELECT pr.payment_channel
          FROM payment_records pr
          WHERE pr.order_id IN (latest_sale.id, p.id)
          ORDER BY pr.id DESC
          LIMIT 1)`
      : 'NULL';
    const salesPaymentChannelSelect = supportsSalesPaymentChannel
      ? `COALESCE(latest_sale.payment_channel, ${paymentChannelFallbackExpr}) as payment_channel`
      : `${paymentChannelFallbackExpr} as payment_channel`;

    // 构建WHERE条件
    const whereConditions = [];
    const whereParams = [];

    if (phone_id) {
      whereConditions.push('p.id = ?');
      whereParams.push(phone_id);
    }

    if (supplier_id) {
      whereConditions.push('p.supplier_id = ?');
      whereParams.push(supplier_id);
    }

    // 优先使用多门店过滤 - 使用销售店铺而不是手机当前所在店铺
    if (store_ids && Array.isArray(store_ids) && store_ids.length > 0) {
      const placeholders = store_ids.map(() => '?').join(',');
      whereConditions.push(`COALESCE(latest_sale.store_id, p.store_id) IN (${placeholders})`);
      whereParams.push(...store_ids);
    } else if (store_id) {
      whereConditions.push('COALESCE(latest_sale.store_id, p.store_id) = ?');
      whereParams.push(store_id);
    }

    if (brand) {
      whereConditions.push('b.name LIKE ?');
      whereParams.push(`%${brand}%`);
    }

    if (model) {
      whereConditions.push('m.name LIKE ?');
      whereParams.push(`%${model}%`);
    }

    if (color) {
      whereConditions.push('co.name LIKE ?');
      whereParams.push(`%${color}%`);
    }

    if (memory) {
      whereConditions.push('mem.size LIKE ?');
      whereParams.push(`%${memory}%`);
    }

    const businessTimeExpression = this.getBusinessTimeExpression(normalizedStatus);

    if (normalizedStatus) {
      whereConditions.push('p.status = ?');
      whereParams.push(normalizedStatus);
    } else if (!phone_id) {
      whereConditions.push('p.status IN (?, ?, ?)');
      whereParams.push('sold', 'peer_transfer', 'supplier_proxy');
    }

    if (is_new !== undefined) {
      whereConditions.push('p.is_new = ?');
      whereParams.push(is_new);
    }

    // 人员筛选：
    // 1. 销售类状态按 sales.operator_id 过滤
    // 2. 在库/维修等非销售状态按 phones.inventory_operator_id 过滤
    // 3. 默认列表只展示销售类状态，因此默认按销售员过滤
    if (sale_operator_id) {
      if (normalizedStatus && !this.isSalesRelatedStatus(normalizedStatus)) {
        whereConditions.push('p.inventory_operator_id = ?');
        whereParams.push(sale_operator_id);
      } else {
        whereConditions.push('EXISTS (SELECT 1 FROM sales s WHERE s.phone_id = p.id AND s.operator_id = ?)');
        whereParams.push(sale_operator_id);
      }
    }

    if (start_date) {
      whereConditions.push(`${businessTimeExpression} >= ?`);
      whereParams.push(`${start_date} 00:00:00`);
    }

    if (end_date) {
      whereConditions.push(`${businessTimeExpression} <= ?`);
      whereParams.push(`${end_date} 23:59:59`);
    }

    if (search_term) {
      whereConditions.push('(p.imei LIKE ? OR p.serial_number LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)');
      whereParams.push(`%${search_term}%`, `%${search_term}%`, `%${search_term}%`, `%${search_term}%`);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // 验证排序字段 - 更新为新的字段名
    const orderByFieldMap = {
      business_time: businessTimeExpression,
      Inventorytime: 'p.Inventorytime',
      salestime: 'p.salestime',
      brand: 'b.name',
      brand_name: 'b.name',
      model: 'm.name',
      model_name: 'm.name',
      price: 'p.sale_price',
      sale_price: 'p.sale_price',
      purchase_unit_price: 'p.purchase_cost',
      purchase_cost: 'p.purchase_cost'
    };
    const validSortField = Object.prototype.hasOwnProperty.call(orderByFieldMap, sort_field)
      ? sort_field
      : 'salestime';
    const validSortOrder = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const orderByField = orderByFieldMap[validSortField];
    const latestSaleJoinClause = `
      LEFT JOIN sales latest_sale ON latest_sale.id = (
        SELECT s.id
        FROM sales s
        WHERE s.phone_id = p.id
        ORDER BY s.created_at DESC, s.id DESC
        LIMIT 1
      )
    `;

    const buildDetailQuery = ({ whereSql, orderSql }) => `
      SELECT
        -- 手机基本信息
        p.id as phone_id,
        p.imei,
        p.serial_number,
        p.brand_id,
        p.model_id,
        p.color_id,
        p.memory_id,
        b.name as brand,
        -- 🔥 在SQL层面直接标准化型号名称（去除空格变体）
        CASE
          -- iPad 系列：统一为 "iPad XX" 格式
          WHEN m.name = 'iPad11' THEN 'iPad 11'
          WHEN m.name = 'ipad11' THEN 'iPad 11'
          WHEN m.name REGEXP '^iPad[0-9]' THEN CONCAT('iPad ', SUBSTRING(m.name, 6))
          WHEN m.name REGEXP '^ipad[0-9]' THEN CONCAT('iPad ', SUBSTRING(m.name, 6))
          -- iPhone 系列：统一为 "iPhone XX" 格式
          WHEN m.name = 'iphone17' THEN 'iPhone 17'
          WHEN m.name = 'iphone17pro' THEN 'iPhone 17 Pro'
          WHEN m.name = 'iphone17promax' THEN 'iPhone 17 Pro Max'
          WHEN m.name REGEXP '^iPhone[0-9]' THEN CONCAT('iPhone ', SUBSTRING(m.name, 7))
          WHEN m.name REGEXP '^iphone[0-9]' THEN CONCAT('iPhone ', SUBSTRING(m.name, 7))
          -- AirPods 系列：统一为 "AirPods" 格式
          WHEN m.name = 'Air Pods' THEN 'AirPods'
          WHEN m.name = 'AirPods' THEN 'AirPods'
          WHEN m.name = 'airpods' THEN 'AirPods'
          -- 其他情况：去除多余空格
          ELSE TRIM(m.name)
        END as model,
        co.name as color,
        mem.size as memory,
        p.purchase_cost as purchase_price,
        p.sale_price as sale_price,
        pl.wholesale_price,
        pl.retail_price,
        p.is_new,
        p.is_preordered,
        p.status,
        p.quality_grade,
        p.remarks,
        p.purchase_number,
        p.Inventorytime,
        p.salestime,
        p.inventory_operator_id,

        -- 图片信息
        (SELECT COUNT(*) FROM H5_images WHERE phone_id = p.id) as image_count,
        (SELECT COUNT(*) > 0 FROM H5_images WHERE phone_id = p.id) as has_images,

        -- 供应商信息
        supp.id as supplier_id,
        supp.name as supplier_name,
        supp.contact as supplier_contact,
        supp.phone as supplier_phone,

        -- 店铺信息：优先显示销售店铺，如果没有则显示入库店铺，都没有则显示 NULL
        COALESCE(sale_st.id, st.id) as store_id,
        COALESCE(sale_st.name, st.name) as store_name,
        COALESCE(sale_st.location, st.location) as store_address,
        COALESCE(sale_st.phone, st.phone) as store_phone,

        -- 入库员信息
        inventory_op.name as inventory_operator_name,

        -- 销售员信息 - 从sales获取
        sale_op.name as phone_sale_operator_name,
        p.sale_operator_id as phone_sale_operator_id,

        -- 客户信息 - 从sales表关联
        latest_sale.customer_id as customer_id,
        c.name as customer_name,
        c.phone as customer_phone,
        c.apple_id as customer_apple_id,
        latest_sale.id as sale_id,
        latest_sale.sale_type,
        latest_sale.remarks as sale_remarks,
        COALESCE(salesperson_user.name, sale_op.name) as sale_operator_name,
        latest_sale.payment_method,
        ${salesPaymentChannelSelect},
        latest_sale.invoice_number,
        latest_sale.sale_date as sales_sale_date,
        latest_sale.created_at as sale_created_at,
        latest_sale.operator_id as sales_record_operator_id,
        COALESCE(latest_sale.operator_id, p.sale_operator_id) as sale_operator_id,
        p.salestime as phones_salestime

      FROM phones p
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN colors co ON p.color_id = co.id
      LEFT JOIN memories mem ON p.memory_id = mem.id
      LEFT JOIN suppliers supp ON p.supplier_id = supp.id
      LEFT JOIN stores st ON p.store_id = st.id
      LEFT JOIN users inventory_op ON p.inventory_operator_id = inventory_op.id
      LEFT JOIN users sale_op ON p.sale_operator_id = sale_op.id
      LEFT JOIN price_list pl ON p.brand_id = pl.brand_id
        AND p.model_id = pl.model_id
        AND (p.color_id = pl.color_id OR (p.color_id IS NULL AND pl.color_id IS NULL))
        AND (p.memory_id = pl.memory_id OR (p.memory_id IS NULL AND pl.memory_id IS NULL))
        AND pl.status = 1
      ${latestSaleJoinClause}
      LEFT JOIN customers c ON latest_sale.customer_id = c.id
      LEFT JOIN users salesperson_user ON latest_sale.operator_id = salesperson_user.id
      LEFT JOIN stores sale_st ON latest_sale.store_id = sale_st.id

      ${whereSql}

      ${orderSql}
    `;

    try {
      const filterJoins = [];
      if (brand || validSortField === 'brand') {
        filterJoins.push('LEFT JOIN brands b ON p.brand_id = b.id');
      }
      if (model || validSortField === 'model') {
        filterJoins.push('LEFT JOIN models m ON p.model_id = m.id');
      }
      if (color) {
        filterJoins.push('LEFT JOIN colors co ON p.color_id = co.id');
      }
      if (memory) {
        filterJoins.push('LEFT JOIN memories mem ON p.memory_id = mem.id');
      }
      // 如果使用了店铺筛选或搜索词，需要包含 latest_sale 子查询
      if (search_term || store_id || (store_ids && store_ids.length > 0)) {
        filterJoins.push(latestSaleJoinClause);
        filterJoins.push('LEFT JOIN customers c ON latest_sale.customer_id = c.id');
      }

      const countQuery = `
        SELECT COUNT(DISTINCT p.id) as total
        FROM phones p
        ${filterJoins.join('\n')}
        ${whereClause}
      `;

      const idQuery = `
        SELECT DISTINCT p.id
        FROM phones p
        ${filterJoins.join('\n')}
        ${whereClause}
        ORDER BY
          ${orderByField} ${validSortOrder},
          p.id DESC
        LIMIT ? OFFSET ?
      `;

      const [[countResult], [pagedRows]] = await Promise.all([
        db.query(countQuery, whereParams),
        db.query(idQuery, [...whereParams, normalizedLimit, offset])
      ]);
      const total = countResult[0].total;
      const pagedPhoneIds = pagedRows.map(row => row.id);

      if (pagedPhoneIds.length === 0) {
        return {
          data: [],
          pagination: {
            page: normalizedPage,
            limit: normalizedLimit,
            total: parseInt(total),
            totalPages: Math.ceil(total / normalizedLimit),
            hasNextPage: normalizedPage < Math.ceil(total / normalizedLimit),
            hasPrevPage: normalizedPage > 1
          }
        };
      }

      const detailPlaceholders = pagedPhoneIds.map(() => '?').join(',');
      const detailQuery = buildDetailQuery({
        whereSql: `WHERE p.id IN (${detailPlaceholders})`,
        orderSql: `ORDER BY FIELD(p.id, ${detailPlaceholders})`
      });

      const [results] = await db.query(detailQuery, [...pagedPhoneIds, ...pagedPhoneIds]);

      return {
        data: results,
        pagination: {
          page: normalizedPage,
          limit: normalizedLimit,
          total: parseInt(total),
          totalPages: Math.ceil(total / normalizedLimit),
          hasNextPage: normalizedPage < Math.ceil(total / normalizedLimit),
          hasPrevPage: normalizedPage > 1
        }
      };
    } catch (error) {
      log.error('综合查询失败:', error);
      throw new Error('综合查询失败: ' + error.message);
    }
  }

  /**
   * 获取统计信息
   */
  async getQueryStatistics(filters = {}) {
    const {
      supplier_id,
      store_id,
      store_ids,  // 新增：支持多门店ID数组
      brand,
      model,
      status,
      is_new,
      sale_operator_id,
      start_date,
      end_date
    } = filters;

    // 构建WHERE条件
    const whereConditions = [];
    const whereParams = [];

    if (supplier_id) {
      whereConditions.push('p.supplier_id = ?');
      whereParams.push(supplier_id);
    }

    // 优先使用多门店过滤 - 使用销售店铺而不是手机当前所在店铺
    if (store_ids && Array.isArray(store_ids) && store_ids.length > 0) {
      const placeholders = store_ids.map(() => '?').join(',');
      whereConditions.push(`COALESCE(latest_sale.store_id, p.store_id) IN (${placeholders})`);
      whereParams.push(...store_ids);
    } else if (store_id) {
      whereConditions.push('COALESCE(latest_sale.store_id, p.store_id) = ?');
      whereParams.push(store_id);
    }

    if (brand) {
      whereConditions.push('b.name LIKE ?');
      whereParams.push(`%${brand}%`);
    }

    if (model) {
      whereConditions.push('m.name LIKE ?');
      whereParams.push(`%${model}%`);
    }

    const normalizedStatus = this.normalizeStatus(status);
    const statisticsTimeExpression = normalizedStatus
      ? this.getBusinessTimeExpression(normalizedStatus)
      : `COALESCE(
          CASE
            WHEN p.status IN ('sold', 'peer_transfer', 'supplier_proxy') THEN p.salestime
            ELSE NULL
          END,
          p.Inventorytime
        )`;

    if (normalizedStatus) {
      whereConditions.push('p.status = ?');
      whereParams.push(normalizedStatus);
    }

    if (is_new !== undefined) {
      whereConditions.push('p.is_new = ?');
      whereParams.push(is_new);
    }

    // 人员筛选：
    // 1. 明确筛销售类状态时，按销售员统计
    // 2. 明确筛在库等非销售状态时，按入库员统计
    // 3. 未筛状态时，为了让顶部卡片语义正确：
    //    销售类状态走销售员，非销售类状态走入库员
    if (sale_operator_id) {
      if (normalizedStatus) {
        if (this.isSalesRelatedStatus(normalizedStatus)) {
          whereConditions.push('EXISTS (SELECT 1 FROM sales s WHERE s.phone_id = p.id AND s.operator_id = ?)');
          whereParams.push(sale_operator_id);
        } else {
          whereConditions.push('p.inventory_operator_id = ?');
          whereParams.push(sale_operator_id);
        }
      } else {
        whereConditions.push(`(
          (p.status IN ('sold', 'peer_transfer', 'supplier_proxy')
            AND EXISTS (SELECT 1 FROM sales s WHERE s.phone_id = p.id AND s.operator_id = ?))
          OR
          (p.status NOT IN ('sold', 'peer_transfer', 'supplier_proxy')
            AND p.inventory_operator_id = ?)
        )`);
        whereParams.push(sale_operator_id, sale_operator_id);
      }
    }

    if (start_date) {
      whereConditions.push(`${statisticsTimeExpression} >= ?`);
      whereParams.push(`${start_date} 00:00:00`);
    }

    if (end_date) {
      whereConditions.push(`${statisticsTimeExpression} <= ?`);
      whereParams.push(`${end_date} 23:59:59`);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // 如果使用了店铺筛选，需要包含 latest_sale 子查询
    const needsLatestSale = store_id || (store_ids && store_ids.length > 0);
    const latestSaleJoin = needsLatestSale ? `
      LEFT JOIN (
        SELECT phone_id, store_id, MAX(id) as max_id
        FROM sales
        GROUP BY phone_id
      ) latest_sale ON p.id = latest_sale.phone_id
    ` : '';

    const query = `
      SELECT
        COUNT(*) as total_phones,
        SUM(CASE WHEN p.status = 'in_stock' THEN 1 ELSE 0 END) as in_stock_count,
        SUM(CASE WHEN p.status = 'sold' THEN 1 ELSE 0 END) as sold_count,
        SUM(CASE WHEN p.is_new = 1 THEN 1 ELSE 0 END) as new_count,
        SUM(CASE WHEN p.is_new = 0 THEN 1 ELSE 0 END) as used_count,
        SUM(p.purchase_cost) as total_purchase_cost,
        SUM(CASE WHEN p.status = 'sold' THEN p.sale_price ELSE 0 END) as total_sales_revenue
      FROM phones p
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN models m ON p.model_id = m.id
      ${latestSaleJoin}
      ${whereClause}
    `;

    try {
      const db = this.getConnection();
      const [results] = await db.query(query, whereParams);
      return results[0];
    } catch (error) {
      log.error('统计查询失败:', error);
      throw new Error('统计查询失败: ' + error.message);
    }
  }

  /**
   * 获取退库记录列表
   */
  async getReturnGoodsRecords(filters = {}) {
    const page = Math.max(parseInt(filters.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(filters.limit, 10) || 20, 1), 100);
    const offset = (page - 1) * limit;
    const keyword = String(filters.keyword || '').trim();
    const startDate = String(filters.start_date || '').trim();
    const endDate = String(filters.end_date || '').trim();

    const whereConditions = [];
    const params = [];

    if (keyword) {
      whereConditions.push(`(
        CAST(srl.phone_id AS CHAR) LIKE ?
        OR p.imei LIKE ?
        OR p.serial_number LIKE ?
        OR b.name LIKE ?
        OR m.name LIKE ?
        OR co.name LIKE ?
        OR mem.size LIKE ?
        OR c.name LIKE ?
        OR u.name LIKE ?
        OR srl.original_sale_operator_name LIKE ?
        OR srl.remarks LIKE ?
      )`);
      const keywordPattern = `%${keyword}%`;
      params.push(
        keywordPattern,
        keywordPattern,
        keywordPattern,
        keywordPattern,
        keywordPattern,
        keywordPattern,
        keywordPattern,
        keywordPattern,
        keywordPattern,
        keywordPattern,
        keywordPattern
      );
    }

    if (startDate) {
      whereConditions.push('DATE(srl.reversal_date) >= ?');
      params.push(startDate);
    }

    if (endDate) {
      whereConditions.push('DATE(srl.reversal_date) <= ?');
      params.push(endDate);
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    const baseFromSql = `
      FROM sale_reversal_logs srl
      LEFT JOIN phones p ON srl.phone_id = p.id
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN colors co ON p.color_id = co.id
      LEFT JOIN memories mem ON p.memory_id = mem.id
      LEFT JOIN customers c ON srl.original_customer_id = c.id
      LEFT JOIN users u ON srl.operator_id = u.id
      ${whereClause}
    `;

    const query = `
      SELECT
        srl.id,
        srl.phone_id,
        srl.original_sale_id,
        srl.original_sale_type,
        srl.original_customer_id,
        srl.original_sale_operator_id,
        srl.original_sale_operator_name,
        srl.operator_id,
        srl.reversal_date,
        srl.remarks,
        srl.created_at,
        p.imei,
        p.serial_number,
        b.name AS brand,
        CASE
          WHEN m.name = 'iPad11' THEN 'iPad 11'
          WHEN m.name = 'ipad11' THEN 'iPad 11'
          WHEN m.name REGEXP '^iPad[0-9]' THEN CONCAT('iPad ', SUBSTRING(m.name, 6))
          WHEN m.name REGEXP '^ipad[0-9]' THEN CONCAT('iPad ', SUBSTRING(m.name, 6))
          WHEN m.name = 'iphone17' THEN 'iPhone 17'
          WHEN m.name = 'iphone17pro' THEN 'iPhone 17 Pro'
          WHEN m.name = 'iphone17promax' THEN 'iPhone 17 Pro Max'
          WHEN m.name REGEXP '^iPhone[0-9]' THEN CONCAT('iPhone ', SUBSTRING(m.name, 7))
          WHEN m.name REGEXP '^iphone[0-9]' THEN CONCAT('iPhone ', SUBSTRING(m.name, 7))
          ELSE TRIM(m.name)
        END AS model,
        co.name AS color,
        mem.size AS memory,
        c.name AS customer_name,
        c.phone AS customer_phone,
        u.name AS operator_name
      ${baseFromSql}
      ORDER BY srl.reversal_date DESC, srl.id DESC
      LIMIT ? OFFSET ?
    `;

    const countSql = `
      SELECT COUNT(*) AS total
      ${baseFromSql}
    `;

    const statsSql = `
      SELECT
        COUNT(*) AS total_records,
        COUNT(DISTINCT srl.phone_id) AS total_phones,
        COUNT(DISTINCT DATE(srl.reversal_date)) AS total_days
      ${baseFromSql}
    `;

    try {
      const db = this.getConnection();
      const [rows] = await db.query(query, [...params, limit, offset]);
      const [countRows] = await db.query(countSql, params);
      const [statsRows] = await db.query(statsSql, params);

      const total = parseInt(countRows?.[0]?.total, 10) || 0;
      const totalPages = total > 0 ? Math.ceil(total / limit) : 0;
      const stats = statsRows?.[0] || {};

      return {
        data: rows,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        },
        stats: {
          total_records: parseInt(stats.total_records, 10) || 0,
          total_phones: parseInt(stats.total_phones, 10) || 0,
          total_days: parseInt(stats.total_days, 10) || 0
        }
      };
    } catch (error) {
      log.error('退库记录查询失败:', error);
      throw new Error('退库记录查询失败: ' + error.message);
    }
  }

  async updateReturnGoodsRecord(recordId, payload = {}) {
    const db = this.getConnection();
    const updateFields = [];
    const params = [];

    if (Object.prototype.hasOwnProperty.call(payload, 'original_sale_type')) {
      updateFields.push('original_sale_type = ?');
      params.push(payload.original_sale_type || null);
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'original_sale_operator_id')) {
      updateFields.push('original_sale_operator_id = ?');
      params.push(payload.original_sale_operator_id || null);
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'original_sale_operator_name')) {
      updateFields.push('original_sale_operator_name = ?');
      params.push(payload.original_sale_operator_name || null);
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'reversal_date')) {
      updateFields.push('reversal_date = ?');
      params.push(payload.reversal_date || null);
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'remarks')) {
      updateFields.push('remarks = ?');
      params.push(payload.remarks || null);
    }

    if (updateFields.length === 0) {
      throw new Error('没有可更新的字段');
    }

    params.push(recordId);

    const [result] = await db.execute(
      `UPDATE sale_reversal_logs
       SET ${updateFields.join(', ')}, updated_at = NOW()
       WHERE id = ?`,
      params
    );

    if (!result.affectedRows) {
      throw new Error('退库记录不存在');
    }

    return true;
  }

  async deleteReturnGoodsRecord(recordId) {
    const db = this.getConnection();
    const [result] = await db.execute(
      'DELETE FROM sale_reversal_logs WHERE id = ?',
      [recordId]
    );

    if (!result.affectedRows) {
      throw new Error('退库记录不存在');
    }

    return true;
  }

  
  /**
   * 退库操作 - 删除购买信息，恢复库存状态
   */
  async returnToStock(phoneId, operatorId, returnInfo = {}) {
    const pool = this.getConnection();
    let connection;

    try {
      // 从连接池获取一个连接
      connection = await pool.getConnection();

      // 开始事务
      await connection.beginTransaction();

      // 1. 获取手机当前信息
      const [phoneRecords] = await connection.execute(
        'SELECT status FROM phones WHERE id = ?',
        [phoneId]
      );

      if (phoneRecords.length === 0) {
        throw new Error('手机不存在');
      }

      const phone = phoneRecords[0];

      // 只允许退库已售出、同行批发、代供应商划拨的手机
      const allowedStatuses = ['sold', 'peer_transfer', 'supplier_proxy'];
      if (!allowedStatuses.includes(phone.status)) {
        throw new Error('只能退库已售出、同行批发或划拨的手机');
      }

      // 2. 获取销售记录信息
      const [saleRecords] = await connection.execute(
        `SELECT
          s.id,
          s.customer_id,
          s.sale_type,
          s.operator_id,
          COALESCE(sale_user.name, phone_sale_user.name) AS sale_operator_name
        FROM sales s
        LEFT JOIN users sale_user ON s.operator_id = sale_user.id
        LEFT JOIN phones p ON s.phone_id = p.id
        LEFT JOIN users phone_sale_user ON p.sale_operator_id = phone_sale_user.id
        WHERE s.phone_id = ?`,
        [phoneId]
      );

      log.debug('退库 - 查找销售记录:', {
        phoneId,
        foundRecords: saleRecords.length,
        records: saleRecords
      });

      if (saleRecords.length === 0) {
        throw new Error('未找到相关销售记录，无法退库。只有已创建销售记录的已售出/批发/划拨商品才能退库。');
      }

      const originalSaleId = saleRecords[0].id;
      const originalCustomerId = saleRecords[0].customer_id;
      const saleType = phone.status;
      const originalSaleOperatorId = saleRecords[0].operator_id || null;
      const originalSaleOperatorName = saleRecords[0].sale_operator_name || null;

      log.debug('退库 - 销售记录详情:', {
        originalSaleId,
        originalCustomerId,
        originalSaleOperatorId,
        saleType,
        originalSaleOperatorName
      });

      // 3. 删除销售记录
      await connection.execute(
        'DELETE FROM sales WHERE phone_id = ?',
        [phoneId]
      );

      // 4. 更新手机状态，清除所有销售相关信息，恢复到入库时的原始状态
      await connection.execute(
        `UPDATE phones SET
          status = 'in_stock',
          salestime = NULL,
          sale_price = NULL,
          sale_operator_id = NULL
        WHERE id = ?`,
        [phoneId]
      );

      // 5. 记录退库日志
      const remarks = returnInfo.remarks || `客户退库操作 - ${returnInfo.return_reason || '未指定原因'} (${returnInfo.handle_method || '未指定处理方式'})`;
      await connection.execute(
        `INSERT INTO sale_reversal_logs
          (phone_id, original_sale_id, original_sale_type, original_customer_id, original_sale_operator_id, original_sale_operator_name, operator_id, reversal_date, remarks)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
        [phoneId, originalSaleId, saleType, originalCustomerId, originalSaleOperatorId, originalSaleOperatorName, operatorId, remarks]
      );

      await connection.commit();

      return {
        success: true,
        message: '退库成功，手机已恢复到未销售状态'
      };
    } catch (error) {
      if (connection) {
        await connection.rollback();
      }
      log.error('退库操作失败:', error);
      throw error;
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }

  /**
   * 删除手机记录（包括关联的销售记录）
   */
  async deletePhoneRecord(phoneId) {
    const pool = this.getConnection();
    let connection;

    try {
      // 从连接池获取一个连接
      connection = await pool.getConnection();

      // 开始事务
      await connection.beginTransaction();

      // 1. 删除关联的销售记录
      await connection.execute(
        'DELETE FROM sales WHERE phone_id = ?',
        [phoneId]
      );

      // 2. 尝试删除返销日志记录（如果表存在）
      try {
        await connection.execute(
          'DELETE FROM sale_reversal_logs WHERE phone_id = ?',
          [phoneId]
        );
      } catch (logError) {
        // 如果表不存在，忽略错误继续执行
        if (!logError.message.includes("Table") || !logError.message.includes("doesn't exist")) {
          throw logError; // 如果是其他错误，重新抛出
        }
      }

      // 3. 删除其他可能引用该手机的记录
      try {
        await connection.execute(
          'DELETE FROM sales_order_items WHERE phone_id = ?',
          [phoneId]
        );
      } catch (orderError) {
        // 如果表不存在或约束问题，忽略错误继续执行
        if (!orderError.message.includes("Table") || !orderError.message.includes("doesn't exist")) {
          log.warn(`删除销售订单项记录时出现警告: ${orderError.message}`);
        }
      }

      try {
        await connection.execute(
          'DELETE FROM rentals WHERE phone_id = ?',
          [phoneId]
        );
      } catch (rentalError) {
        // 如果表不存在或约束问题，忽略错误继续执行
        if (!rentalError.message.includes("Table") || !rentalError.message.includes("doesn't exist")) {
          log.warn(`删除租赁记录时出现警告: ${rentalError.message}`);
        }
      }

      // 4. 删除手机记录
      const [result] = await connection.execute(
        'DELETE FROM phones WHERE id = ?',
        [phoneId]
      );

      if (result.affectedRows === 0) {
        throw new Error('手机记录不存在');
      }

      // 提交事务
      await connection.commit();

      return {
        success: true,
        message: '删除成功',
        deletedRecords: {
          sales: result.affectedRows,
          phone: 1
        }
      };
    } catch (error) {
      // 回滚事务
      if (connection) {
        await connection.rollback();
      }
      log.error('删除手机记录失败:', error);
      throw error;
    } finally {
      // 释放连接回连接池
      if (connection) {
        connection.release();
      }
    }
  }

  /**
   * 获取查询选项数据
   */
  async getQueryOptionsData() {
    try {
      log.info('获取查询选项数据（直接从数据库查询）');

      const db = this.getConnection();

      // 先检查数据库中是否有数据
      const [countCheck] = await db.query(`
        SELECT
          (SELECT COUNT(*) FROM suppliers WHERE status = 1 OR status IS NULL) as suppliers,
          (SELECT COUNT(*) FROM stores WHERE status = 1 OR status IS NULL) as stores,
          (SELECT COUNT(*) FROM brands WHERE status = 1 OR status IS NULL) as brands,
          (SELECT COUNT(*) FROM models WHERE status = 1 OR status IS NULL) as models,
          (SELECT COUNT(*) FROM colors WHERE status = 1 OR status IS NULL) as colors,
          (SELECT COUNT(*) FROM memories WHERE status = 1 OR status IS NULL) as memories
      `);

      log.info('数据库数据统计:', countCheck[0]);

      // 并行查询所有选项数据
      const [
        suppliersResult,
        storesResult,
        brandsResult,
        modelsResult,
        colorsResult,
        memoriesResult
      ] = await Promise.all([
        // 供应商：优先显示启用状态，但如果没有则显示全部
        db.query('SELECT id, name, sort_order FROM suppliers WHERE (status = 1 OR status IS NULL) ORDER BY sort_order, id'),
        // 店铺
        db.query('SELECT id, name, sort_order FROM stores WHERE (status = 1 OR status IS NULL) ORDER BY sort_order, id'),
        // 品牌
        db.query('SELECT id, name, sort_order FROM brands WHERE (status = 1 OR status IS NULL) ORDER BY sort_order, id'),
        // 型号（包含品牌信息用于联动）
        db.query(`
          SELECT m.id, m.name, m.brand_id, m.sort_order, b.name as brand_name
          FROM models m
          LEFT JOIN brands b ON m.brand_id = b.id
          WHERE (m.status = 1 OR m.status IS NULL)
          ORDER BY m.sort_order, m.id
        `),
        // 颜色
        db.query('SELECT id, name, sort_order FROM colors WHERE (status = 1 OR status IS NULL) ORDER BY sort_order, id'),
        // 内存
        db.query('SELECT id, size as name, sort_order FROM memories WHERE (status = 1 OR status IS NULL) ORDER BY sort_order, id')
      ]);

      const suppliers = suppliersResult[0] || [];
      const stores = storesResult[0] || [];
      const brands = brandsResult[0] || [];
      const models = modelsResult[0] || [];
      const colors = colorsResult[0] || [];
      const memories = memoriesResult[0] || [];

      log.info('查询选项数据获取成功', {
        suppliers: suppliers.length,
        stores: stores.length,
        brands: brands.length,
        models: models.length,
        colors: colors.length,
        memories: memories.length
      });

      // 如果没有数据，输出调试信息
      if (suppliers.length === 0) log.warn('供应商数据为空');
      if (stores.length === 0) log.warn('店铺数据为空');
      if (brands.length === 0) log.warn('品牌数据为空');
      if (models.length === 0) log.warn('型号数据为空');
      if (colors.length === 0) log.warn('颜色数据为空');
      if (memories.length === 0) log.warn('内存数据为空');

      return {
        suppliers,
        stores,
        brands,
        models,
        colors,
        memories
      };

    } catch (error) {
      log.error('获取查询选项数据失败:', error);

      // 如果数据库查询失败，返回空数组而不是抛出错误，确保页面可以加载
      return {
        suppliers: [],
        stores: [],
        brands: [],
        models: [],
        colors: [],
        memories: []
      };
    }
  }

  /**
   * 查询预订数据（当status=reserved时调用）
   */
  async getPreorderQuery(filters = {}) {
    const {
      page = 1,
      limit = 20,
      supplier_id,
      store_id,
      store_ids,
      brand,
      model,
      color,
      memory,
      start_date,
      end_date,
      search_term,
      sort_field = 'created_at',
      sort_order = 'DESC'
    } = filters;

    const normalizedPage = parseInt(page, 10) || 1;
    const normalizedLimit = parseInt(limit, 10) || 20;
    const offset = (normalizedPage - 1) * normalizedLimit;
    const db = this.getConnection();

    // 构建WHERE条件
    const whereConditions = [];
    const whereParams = [];

    // 只查询pending和arrived状态的预订
    whereConditions.push('pr.status IN (?, ?)');
    whereParams.push('pending', 'arrived');

    if (brand) {
      whereConditions.push('b.name LIKE ?');
      whereParams.push(`%${brand}%`);
    }

    if (model) {
      whereConditions.push('m.name LIKE ?');
      whereParams.push(`%${model}%`);
    }

    if (color) {
      whereConditions.push('co.name LIKE ?');
      whereParams.push(`%${color}%`);
    }

    if (memory) {
      whereConditions.push('mem.size LIKE ?');
      whereParams.push(`%${memory}%`);
    }

    // 店铺筛选：对于已匹配的预订，使用手机的店铺；对于待匹配的，使用预订的店铺
    if (store_ids && Array.isArray(store_ids) && store_ids.length > 0) {
      const placeholders = store_ids.map(() => '?').join(',');
      whereConditions.push(`(COALESCE(st.id, pr.store_id) IN (${placeholders}))`);
      whereParams.push(...store_ids);
    } else if (store_id) {
      whereConditions.push('(COALESCE(st.id, pr.store_id) = ?)');
      whereParams.push(store_id);
    }

    // 供应商筛选：只对已匹配的预订有效
    if (supplier_id) {
      whereConditions.push('(p.supplier_id = ? OR pr.status = ?)');
      whereParams.push(supplier_id, 'pending');
    }

    // 日期筛选
    if (start_date) {
      whereConditions.push('pr.created_at >= ?');
      whereParams.push(`${start_date} 00:00:00`);
    }

    if (end_date) {
      whereConditions.push('pr.created_at <= ?');
      whereParams.push(`${end_date} 23:59:59`);
    }

    // 搜索条件
    if (search_term) {
      whereConditions.push('(pr.customer_name LIKE ? OR pr.customer_phone LIKE ? OR pr.preorder_number LIKE ? OR p.imei LIKE ?)');
      whereParams.push(`%${search_term}%`, `%${search_term}%`, `%${search_term}%`, `%${search_term}%`);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // 构建查询
    const query = `
      SELECT
        -- 基本信息
        pr.id as phone_id,
        COALESCE(p.imei, '待匹配') as imei,
        COALESCE(p.serial_number, '待匹配') as serial_number,
        pr.brand_id,
        pr.model_id,
        pr.color_id,
        pr.memory_id,
        b.name as brand,
        m.name as model,
        co.name as color,
        mem.size as memory,
        COALESCE(p.purchase_cost, 0) as purchase_price,
        pr.total_price as sale_price,
        NULL as wholesale_price,
        NULL as retail_price,
        COALESCE(pr.is_new, p.is_new, 1) as is_new,  -- 优先显示预订的机况
        COALESCE(p.is_preordered, 0) as is_preordered,
        'reserved' as status,
        pr.status as preorder_status,
        COALESCE(p.quality_grade, '') as quality_grade,
        pr.remarks,
        NULL as purchase_number,
        COALESCE(p.Inventorytime, NULL) as Inventorytime,
        NULL as salestime,
        COALESCE(p.inventory_operator_id, NULL) as inventory_operator_id,

        -- 供应商信息
        COALESCE(supp.id, NULL) as supplier_id,
        COALESCE(supp.name, '待匹配') as supplier_name,
        COALESCE(supp.contact, '') as supplier_contact,
        COALESCE(supp.phone, '') as supplier_phone,

        -- 店铺信息
        COALESCE(st.id, pr.store_id) as store_id,
        COALESCE(st.name, '待匹配') as store_name,
        COALESCE(st.location, '') as store_address,
        COALESCE(st.phone, '') as store_phone,

        -- 入库员信息
        COALESCE(inventory_op.name, '待匹配') as inventory_operator_name,

        -- 销售员信息
        NULL as phone_sale_operator_name,
        NULL as phone_sale_operator_id,

        -- 客户信息
        pr.customer_id,
        pr.customer_name,
        pr.customer_phone,
        c.apple_id as customer_apple_id,
        NULL as sale_id,
        NULL as sale_type,
        pr.remarks as sale_remarks,
        NULL as sale_operator_name,
        NULL as payment_method,
        NULL as payment_channel,
        pr.preorder_number as invoice_number,
        NULL as sales_sale_date,
        pr.created_at as sale_created_at,
        NULL as sales_record_operator_id,
        pr.created_by as sale_operator_id,
        pr.created_at as phones_salestime

      FROM preorders pr
      LEFT JOIN brands b ON pr.brand_id = b.id
      LEFT JOIN models m ON pr.model_id = m.id
      LEFT JOIN colors co ON pr.color_id = co.id
      LEFT JOIN memories mem ON pr.memory_id = mem.id
      LEFT JOIN customers c ON pr.customer_id = c.id
      LEFT JOIN phones p ON pr.matched_phone_id = p.id
      LEFT JOIN suppliers supp ON p.supplier_id = supp.id
      LEFT JOIN stores st ON p.store_id = st.id
      LEFT JOIN users inventory_op ON p.inventory_operator_id = inventory_op.id
      ${whereClause}
      ORDER BY pr.${sort_field === 'salestime' ? 'created_at' : sort_field} ${sort_order}
      LIMIT ${normalizedLimit} OFFSET ${offset}
    `;

    // 计数查询
    const countQuery = `
      SELECT COUNT(*) as total
      FROM preorders pr
      LEFT JOIN brands b ON pr.brand_id = b.id
      LEFT JOIN models m ON pr.model_id = m.id
      LEFT JOIN colors co ON pr.color_id = co.id
      LEFT JOIN memories mem ON pr.memory_id = mem.id
      LEFT JOIN phones p ON pr.matched_phone_id = p.id
      LEFT JOIN suppliers supp ON p.supplier_id = supp.id
      LEFT JOIN stores st ON p.store_id = st.id
      ${whereClause}
    `;

    try {
      const [data] = await db.execute(query, whereParams);
      const [countResult] = await db.execute(countQuery, whereParams);
      const total = countResult[0]?.total || 0;

      return { data, total };
    } catch (error) {
      log.error('查询预订数据失败:', error);
      throw error;
    }
  }
}

module.exports = QueryRepository;
