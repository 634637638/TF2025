/**
 * 供应商打款服务层
 */
const { getDatabase } = require('../config/database');
const log = require('../utils/log');

async function executeQuery(sql, params) {
  const db = getDatabase();
  const [rows] = await db.execute(sql, params);
  return rows;
}

class SupplierPaymentService {
  /**
   * 获取供应商应付统计
   * 统计所有有供应商的手机（包括在库和已销售）
   * 支持按销售状态筛选
   * 只排除划拨（supplier_proxy）的手机，批发（peer_transfer）的手机需要正常打款
   */
  async getStatistics(filters = {}) {
    const { supplier_id, sale_status = 'all' } = filters;

    let whereClause = 'WHERE p.supplier_id IS NOT NULL AND p.status != \'supplier_proxy\'';
    const params = [];

    if (supplier_id) {
      whereClause += ' AND p.supplier_id = ?';
      params.push(supplier_id);
    }

    // 销售状态筛选 - status 字段是字符串类型
    // 'sold' 包括正常销售(sold)和批发销售(peer_transfer)，但不包括划拨(supplier_proxy)
    // 'stock' 只包括在库(in_stock)
    if (sale_status === 'sold') {
      whereClause += ' AND p.status IN (\'sold\', \'peer_transfer\')';
    } else if (sale_status === 'stock') {
      whereClause += ' AND p.status = \'in_stock\'';
    }
    // 'all' 不添加条件

    // 按供应商统计未付款和已付款手机
    // 未付款：payment_status IS NULL 或 payment_status != 'paid'
    const stats = await executeQuery(`
      SELECT
        s.id as supplier_id,
        s.name as supplier_name,
        COUNT(CASE WHEN (p.payment_status IS NULL OR p.payment_status != 'paid') THEN 1 END) as unpaid_count,
        COALESCE(SUM(CASE WHEN (p.payment_status IS NULL OR p.payment_status != 'paid') THEN p.purchase_cost ELSE 0 END), 0) as unpaid_amount,
        COUNT(CASE WHEN p.payment_status = 'paid' THEN 1 END) as paid_count,
        COALESCE(SUM(CASE WHEN p.payment_status = 'paid' THEN p.purchase_cost ELSE 0 END), 0) as paid_amount
      FROM suppliers s
      LEFT JOIN phones p ON s.id = p.supplier_id
      ${whereClause}
      GROUP BY s.id, s.name
      HAVING unpaid_count > 0 OR paid_count > 0
      ORDER BY unpaid_amount DESC
    `, params);

    return stats.map(stat => ({
      supplier_id: stat.supplier_id,
      supplier_name: stat.supplier_name,
      unpaid_count: stat.unpaid_count || 0,
      unpaid_amount: parseFloat(stat.unpaid_amount) || 0,
      paid_count: stat.paid_count || 0,
      paid_amount: parseFloat(stat.paid_amount) || 0
    }));
  }

  /**
   * 获取汇总统计（用于卡片显示）
   * 不按供应商分组，直接统计总数
   * 只排除划拨（supplier_proxy）的手机，批发（peer_transfer）的手机需要正常打款
   */
  async getSummaryStatistics(filters = {}) {
    const { sale_status = 'all' } = filters;

    let whereClause = 'WHERE p.supplier_id IS NOT NULL AND p.status != \'supplier_proxy\'';
    const params = [];

    // 销售状态筛选 - status 字段是字符串类型
    // 'sold' 包括正常销售(sold)和批发销售(peer_transfer)，但不包括划拨(supplier_proxy)
    // 'stock' 只包括在库(in_stock)
    if (sale_status === 'sold') {
      whereClause += ' AND p.status IN (\'sold\', \'peer_transfer\')';
    } else if (sale_status === 'stock') {
      whereClause += ' AND p.status = \'in_stock\'';
    }

    // 直接统计总数
    const summary = await executeQuery(`
      SELECT
        COUNT(CASE WHEN (p.payment_status IS NULL OR p.payment_status != 'paid') THEN 1 END) as total_unpaid_count,
        COALESCE(SUM(CASE WHEN (p.payment_status IS NULL OR p.payment_status != 'paid') THEN p.purchase_cost ELSE 0 END), 0) as total_unpaid_amount,
        COUNT(CASE WHEN p.payment_status = 'paid' THEN 1 END) as total_paid_count,
        COALESCE(SUM(CASE WHEN p.payment_status = 'paid' THEN p.purchase_cost ELSE 0 END), 0) as total_paid_amount
      FROM phones p
      ${whereClause}
    `, params);

    return {
      total_unpaid_count: parseInt(summary[0]?.total_unpaid_count) || 0,
      total_unpaid_amount: parseFloat(summary[0]?.total_unpaid_amount) || 0,
      total_paid_count: parseInt(summary[0]?.total_paid_count) || 0,
      total_paid_amount: parseFloat(summary[0]?.total_paid_amount) || 0
    };
  }

  /**
   * 获取供应商手机列表
   * 支持按销售状态筛选：sold(已售)/stock(在库)/all(全部)
   * 支持关键词搜索：IMEI、序列号、品牌、型号
   */
  async getPhones(filters = {}) {
    const {
      supplier_id,
      store_id,
      payment_status = 'unpaid',
      sale_status = 'all',
      keyword,
      start_date,
      end_date,
      export_all = false,
      page = 1,
      limit = 50
    } = filters;

    const shouldExportAll = export_all === true || export_all === 'true';
    const validLimit = shouldExportAll ? null : Math.min(Math.max(parseInt(limit), 1), 100);
    const validPage = shouldExportAll ? 1 : Math.max(parseInt(page), 1);
    const offset = shouldExportAll ? 0 : (validPage - 1) * validLimit;

    // 构建查询条件 - 查询所有有供应商的手机
    // 只排除划拨（supplier_proxy）的手机，批发（peer_transfer）的手机需要正常打款
    const whereConditions = ['p.supplier_id IS NOT NULL', 'p.status != \'supplier_proxy\''];
    const params = [];

    if (supplier_id) {
      whereConditions.push('p.supplier_id = ?');
      params.push(supplier_id);
    }

    if (store_id) {
      whereConditions.push('p.store_id = ?');
      params.push(store_id);
    }

    // 打款状态筛选：未打款是 NULL 或 != 'paid'
    if (payment_status === 'unpaid') {
      whereConditions.push('(p.payment_status IS NULL OR p.payment_status != \'paid\')');
    } else if (payment_status === 'paid') {
      whereConditions.push('p.payment_status = \'paid\'');
    }
    // 'all' 不添加条件，包括所有

    // 销售状态筛选 - status 字段是字符串类型
    // 'sold' 包括正常销售(sold)和批发销售(peer_transfer)，但不包括划拨(supplier_proxy)
    // 'stock' 只包括在库(in_stock)
    if (sale_status === 'sold') {
      whereConditions.push('p.status IN (\'sold\', \'peer_transfer\')');
    } else if (sale_status === 'stock') {
      whereConditions.push('p.status = \'in_stock\'');
    }
    // 'all' 不添加条件，包括所有

    // 时间筛选 - 根据销售状态决定使用入库时间还是销售时间
    if (start_date) {
      if (sale_status === 'sold') {
        // 已售状态使用销售时间
        whereConditions.push('DATE(p.salestime) >= ?');
      } else {
        // 在库或全部状态使用入库时间
        whereConditions.push('DATE(p.Inventorytime) >= ?');
      }
      params.push(start_date);
    }

    if (end_date) {
      if (sale_status === 'sold') {
        // 已售状态使用销售时间
        whereConditions.push('DATE(p.salestime) <= ?');
      } else {
        // 在库或全部状态使用入库时间
        whereConditions.push('DATE(p.Inventorytime) <= ?');
      }
      params.push(end_date);
    }

    // 关键词搜索：IMEI、序列号、品牌、型号
    if (keyword && keyword.trim()) {
      const searchCondition = `(
        p.imei LIKE ? OR
        p.serial_number LIKE ? OR
        br.name LIKE ? OR
        m.name LIKE ? OR
        CONCAT(br.name, ' ', m.name) LIKE ?
      )`;
      const searchTerm = `%${keyword.trim()}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
      whereConditions.push(searchCondition);
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    // 查询数据
    const listSql = `
      SELECT
        p.id,
        p.imei,
        p.serial_number,
        p.purchase_cost,
        p.sale_price,
        p.payment_status,
        p.payment_method,
        p.payment_time,
        p.payment_operator_id,
        p.Inventorytime as purchase_date,
        p.status as phone_status,
        p.is_new,
        p.inventory_operator_id,
        p.salestime,
        p.sale_operator_id,
        s.id as supplier_id,
        s.name as supplier_name,
        br.name as brand_name,
        m.name as model_name,
        c.name as color_name,
        mem.size as memory_name,
        COALESCE(sale_st.name, st.name) as store_name,
        CONCAT(br.name, ' ', m.name) as full_model_name,
        u1.name as inventory_operator_name,
        u2.name as sale_operator_name,
        u3.name as payment_operator_name
      FROM phones p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN brands br ON p.brand_id = br.id
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN colors c ON p.color_id = c.id
      LEFT JOIN memories mem ON p.memory_id = mem.id
      LEFT JOIN stores st ON p.store_id = st.id
      LEFT JOIN sales sale ON p.id = sale.phone_id
      LEFT JOIN stores sale_st ON sale.store_id = sale_st.id
      LEFT JOIN users u1 ON p.inventory_operator_id = u1.id
      LEFT JOIN users u2 ON p.sale_operator_id = u2.id
      LEFT JOIN users u3 ON p.payment_operator_id = u3.id
      ${whereClause}
      ORDER BY
        CASE
          WHEN p.salestime IS NOT NULL THEN 1
          ELSE 2
        END,
        p.salestime DESC,
        p.Inventorytime DESC
      ${shouldExportAll ? '' : `LIMIT ${validLimit} OFFSET ${offset}`}
    `;

    const phones = await executeQuery(listSql, params);

    // 格式化数据，统一 payment_status：NULL 或 'paid' -> 'unpaid'
    const formattedPhones = phones.map(p => ({
      id: p.id,
      imei: p.imei || '-',
      serial_number: p.serial_number || '-',
      purchase_cost: parseFloat(p.purchase_cost) || 0,
      sale_price: parseFloat(p.sale_price) || 0,
      profit: (parseFloat(p.sale_price) || 0) - (parseFloat(p.purchase_cost) || 0),
      payment_status: (p.payment_status === 'paid') ? 'paid' : 'unpaid',
      payment_method: p.payment_method,
      payment_time: p.payment_time,
      payment_operator_id: p.payment_operator_id,
      payment_operator_name: p.payment_operator_name || '-',
      purchase_date: p.purchase_date,
      sale_time: p.salestime,
      phone_status: p.phone_status,
      is_new: p.is_new,
      supplier_id: p.supplier_id,
      supplier_name: p.supplier_name,
      full_model_name: p.full_model_name || '-',
      brand_name: p.brand_name || '-',
      model_name: p.model_name || '-',
      color_name: p.color_name || '-',
      memory_name: p.memory_name || '-',
      store_name: p.store_name || '-',
      inventory_operator_name: p.inventory_operator_name || '-',
      sale_operator_name: p.sale_operator_name || '-'
    }));

    // 查询总数
    const countResult = await executeQuery(`
      SELECT COUNT(*) as total
      FROM phones p
      ${whereClause}
    `, params);

    const total = countResult[0]?.total || 0;

    return {
      phones: formattedPhones,
      pagination: {
        page: validPage,
        limit: validLimit || total,
        total: total,
        totalPages: validLimit ? Math.ceil(total / validLimit) : (total > 0 ? 1 : 0),
        hasNextPage: validLimit ? validPage < Math.ceil(total / validLimit) : false,
        hasPrevPage: validLimit ? validPage > 1 : false
      }
    };
  }

  /**
   * 批量打款
   */
  async batchPayment({ phone_ids, payment_method, payment_time, operator_id }) {
    const db = getDatabase();

    // 验证手机ID - 查找未打款的手机（payment_status IS NULL 或 != 'paid'）
    const phones = await executeQuery(`
      SELECT id, imei, purchase_cost, supplier_id
      FROM phones
      WHERE id IN (${phone_ids.map(() => '?').join(',')})
      AND (payment_status IS NULL OR payment_status != 'paid')
    `, phone_ids);

    if (phones.length === 0) {
      throw new Error('没有找到可打款的手机');
    }

    // 更新打款状态
    const paymentTime = new Date(payment_time);

    for (const phone of phones) {
      await db.execute(`
        UPDATE phones
        SET payment_status = 'paid',
            payment_method = ?,
            payment_time = ?,
            payment_operator_id = ?
        WHERE id = ?
      `, [payment_method, paymentTime, operator_id, phone.id]);
    }

    return {
      count: phones.length,
      total_amount: phones.reduce((sum, p) => sum + parseFloat(p.purchase_cost), 0),
      payment_method,
      payment_time: paymentTime
    };
  }

  /**
   * 单个手机打款
   */
  async singlePayment({ phone_id, payment_method, payment_time, operator_id }) {
    const db = getDatabase();

    // 获取手机信息
    const phones = await executeQuery(`
      SELECT id, imei, purchase_cost, supplier_id, payment_status
      FROM phones
      WHERE id = ?
    `, [phone_id]);

    if (!phones || phones.length === 0) {
      throw new Error('手机不存在');
    }

    const phone = phones[0];

    // 检查是否已打款
    if (phone.payment_status === 'paid') {
      throw new Error('该手机已打款');
    }

    const paymentTime = new Date(payment_time);

    // 更新打款状态
    await db.execute(`
      UPDATE phones
      SET payment_status = 'paid',
          payment_method = ?,
          payment_time = ?,
          payment_operator_id = ?
      WHERE id = ?
    `, [payment_method, paymentTime, operator_id, phone_id]);

    return {
      phone_id,
      imei: phone.imei,
      amount: parseFloat(phone.purchase_cost),
      payment_method,
      payment_time: paymentTime
    };
  }

  /**
   * 批量取消打款
   */
  async batchCancelPayment({ phone_ids }) {
    const db = getDatabase();

    // 验证手机ID - 查找已打款的手机
    const phones = await executeQuery(`
      SELECT id, imei, purchase_cost, supplier_id
      FROM phones
      WHERE id IN (${phone_ids.map(() => '?').join(',')})
      AND payment_status = 'paid'
    `, phone_ids);

    if (phones.length === 0) {
      throw new Error('没有找到可取消打款的手机');
    }

    // 批量更新打款状态
    for (const phone of phones) {
      await db.execute(`
        UPDATE phones
        SET payment_status = NULL,
            payment_method = NULL,
            payment_time = NULL,
            payment_operator_id = NULL
        WHERE id = ?
      `, [phone.id]);
    }

    return {
      count: phones.length,
      total_amount: phones.reduce((sum, p) => sum + parseFloat(p.purchase_cost), 0),
      message: `成功取消 ${phones.length} 台手机的打款`
    };
  }

  /**
   * 更新打款信息
   */
  async updatePayment({ phone_id, payment_method, payment_time }) {
    const db = getDatabase();

    // 获取手机信息
    const phones = await executeQuery(`
      SELECT id, imei, payment_status
      FROM phones
      WHERE id = ?
    `, [phone_id]);

    if (!phones || phones.length === 0) {
      throw new Error('手机不存在');
    }

    const phone = phones[0];

    // 如果 payment_method 和 payment_time 都为 null，则是取消打款操作
    if (payment_method === null && payment_time === null) {
      // 取消打款：恢复到未打款状态（设为 NULL）
      await db.execute(`
        UPDATE phones
        SET payment_status = NULL,
            payment_method = NULL,
            payment_time = NULL,
            payment_operator_id = NULL
        WHERE id = ?
      `, [phone_id]);

      return {
        phone_id,
        imei: phone.imei,
        payment_status: 'unpaid',
        payment_method: null,
        payment_time: null
      };
    }

    // 正常更新打款信息
    if (phone.payment_status !== 'paid') {
      throw new Error('该手机未打款，无法编辑');
    }

    const paymentTime = new Date(payment_time);

    // 更新打款信息
    await db.execute(`
      UPDATE phones
      SET payment_method = ?,
          payment_time = ?
      WHERE id = ?
    `, [payment_method, paymentTime, phone_id]);

    return {
      phone_id,
      imei: phone.imei,
      payment_method,
      payment_time: paymentTime
    };
  }

  /**
   * 获取打款批次详情（精确到分钟）
   * @param {number} supplier_id - 供应商ID
   * @param {string} payment_time - 打款时间（从数据库读取的DATETIME格式字符串）
   */
  async getPaymentBatchDetails(supplier_id, payment_time) {
    log.debug('🔍 [批次详情] 查询参数:', { supplier_id, payment_time });

    // 直接使用数据库的格式化字符串进行精确匹配
    // 不在JavaScript中进行任何时区转换，避免时区问题
    const phones = await executeQuery(`
      SELECT
        p.id,
        p.imei,
        p.serial_number,
        p.purchase_cost,
        p.sale_price,
        p.payment_time,
        p.payment_method,
        p.payment_operator_id,
        p.Inventorytime as purchase_date,
        p.salestime,
        p.status as phone_status,
        p.payment_status,
        s.id as supplier_id,
        s.name as supplier_name,
        br.name as brand_name,
        m.name as model_name,
        c.name as color_name,
        mem.size as memory_name,
        st.name as store_name,
        u.name as payment_operator_name,
        DATE_FORMAT(p.payment_time, '%Y-%m-%d %H:%i:%s') as formatted_payment_time
      FROM phones p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN brands br ON p.brand_id = br.id
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN colors c ON p.color_id = c.id
      LEFT JOIN memories mem ON p.memory_id = mem.id
      LEFT JOIN stores st ON p.store_id = st.id
      LEFT JOIN users u ON p.payment_operator_id = u.id
      WHERE p.supplier_id = ?
        AND p.payment_status = 'paid'
        AND DATE_FORMAT(p.payment_time, '%Y-%m-%d %H:%i:%s') = ?
      ORDER BY p.salestime DESC, p.payment_time DESC
    `, [supplier_id, payment_time]);

    log.debug('🔍 [批次详情] 精确查询结果数量:', phones.length);

    return phones.map(p => ({
      id: p.id,
      imei: p.imei,
      serial_number: p.serial_number,
      purchase_cost: parseFloat(p.purchase_cost),
      sale_price: parseFloat(p.sale_price || 0),
      payment_time: p.payment_time,
      payment_method: p.payment_method,
      payment_operator_id: p.payment_operator_id,
      payment_operator_name: p.payment_operator_name,
      purchase_date: p.purchase_date,
      sale_time: p.salestime,
      phone_status: p.phone_status,
      payment_status: p.payment_status,
      supplier_id: p.supplier_id,
      supplier_name: p.supplier_name,
      brand_name: p.brand_name,
      model_name: p.model_name,
      store_name: p.store_name,
      color_name: p.color_name,
      memory_name: p.memory_name,
      full_model_name: p.model_name ? `${p.brand_name || ''} ${p.model_name}`.trim() : (p.brand_name || '')
    }));
  }
}

module.exports = new SupplierPaymentService();
