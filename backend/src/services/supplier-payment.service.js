/**
 * 供应商打款服务层
 */
const { getDatabase } = require('../config/database')
const { ensureSupplierPaymentSchema } = require('../utils/supplier-payment-schema')
const { normalizeDateTime } = require('../utils/time')
const { randomUUID } = require('node:crypto')
const log = require('../utils/log')

async function executeQuery(sql, params) {
  const db = getDatabase()
  const [rows] = await db.execute(sql, params)
  return rows
}

class SupplierPaymentService {
  /**
   * 获取供应商应付统计
   * 统计所有有供应商的手机（包括在库和已销售）
   * 支持按销售状态筛选
   * 只排除划拨（supplier_proxy）的手机，批发（peer_transfer）的手机需要正常打款
   */
  async getStatistics(filters = {}) {
    const { supplier_id, sale_status = 'all' } = filters

    let whereClause = 'WHERE p.supplier_id IS NOT NULL AND p.status != \'supplier_proxy\''
    const params = []

    if (supplier_id) {
      whereClause += ' AND p.supplier_id = ?'
      params.push(supplier_id)
    }

    // 销售状态筛选 - status 字段是字符串类型
    // 'sold' 包括正常销售(sold)和批发销售(peer_transfer)，但不包括划拨(supplier_proxy)
    // 'stock' 只包括在库(in_stock)
    if (sale_status === 'sold') {
      whereClause += ' AND p.status IN (\'sold\', \'peer_transfer\')'
    } else if (sale_status === 'stock') {
      whereClause += ' AND p.status = \'in_stock\''
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
    `, params)

    return stats.map(stat => ({
      supplier_id: stat.supplier_id,
      supplier_name: stat.supplier_name,
      unpaid_count: stat.unpaid_count || 0,
      unpaid_amount: parseFloat(stat.unpaid_amount) || 0,
      paid_count: stat.paid_count || 0,
      paid_amount: parseFloat(stat.paid_amount) || 0
    }))
  }

  /**
   * 获取汇总统计（用于卡片显示）
   * 不按供应商分组，直接统计总数
   * 只排除划拨（supplier_proxy）的手机，批发（peer_transfer）的手机需要正常打款
   */
  async getSummaryStatistics(filters = {}) {
    const {
      supplier_id, store_id, payment_status = 'all', sale_status = 'all',
      keyword, start_date, end_date
    } = filters

    let whereClause = 'WHERE p.supplier_id IS NOT NULL AND p.status != \'supplier_proxy\''
    const params = []

    if (supplier_id) {
      whereClause += ' AND p.supplier_id = ?'
      params.push(supplier_id)
    }
    if (store_id) {
      whereClause += ' AND p.store_id = ?'
      params.push(store_id)
    }
    if (payment_status === 'unpaid') {
      whereClause += ' AND (p.payment_status IS NULL OR p.payment_status != \'paid\')'
    } else if (payment_status === 'paid') {
      whereClause += ' AND p.payment_status = \'paid\''
    }

    // 销售状态筛选 - status 字段是字符串类型
    // 'sold' 包括正常销售(sold)和批发销售(peer_transfer)，但不包括划拨(supplier_proxy)
    // 'stock' 只包括在库(in_stock)
    if (sale_status === 'sold') {
      whereClause += ' AND p.status IN (\'sold\', \'peer_transfer\')'
    } else if (sale_status === 'stock') {
      whereClause += ' AND p.status = \'in_stock\''
    }

    if (start_date) {
      whereClause += sale_status === 'sold' ? ' AND DATE(p.sale_time) >= ?' : ' AND DATE(p.inventory_time) >= ?'
      params.push(start_date)
    }
    if (end_date) {
      whereClause += sale_status === 'sold' ? ' AND DATE(p.sale_time) <= ?' : ' AND DATE(p.inventory_time) <= ?'
      params.push(end_date)
    }
    if (keyword && keyword.trim()) {
      const searchTerm = `%${keyword.trim()}%`
      whereClause += ` AND (
        (CONVERT(p.imei USING utf8mb4) COLLATE utf8mb4_unicode_ci) LIKE ? OR
        (CONVERT(p.serial_number USING utf8mb4) COLLATE utf8mb4_unicode_ci) LIKE ? OR
        (CONVERT(br.name USING utf8mb4) COLLATE utf8mb4_unicode_ci) LIKE ? OR
        (CONVERT(m.name USING utf8mb4) COLLATE utf8mb4_unicode_ci) LIKE ? OR
        (CONVERT(CONCAT(br.name, ' ', m.name) USING utf8mb4) COLLATE utf8mb4_unicode_ci) LIKE ?
      )`
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm)
    }

    // 直接统计总数
    const summary = await executeQuery(`
      SELECT
        COUNT(CASE WHEN (p.payment_status IS NULL OR p.payment_status != 'paid') THEN 1 END) as total_unpaid_count,
        COALESCE(SUM(CASE WHEN (p.payment_status IS NULL OR p.payment_status != 'paid') THEN p.purchase_cost ELSE 0 END), 0) as total_unpaid_amount,
        COUNT(CASE WHEN p.payment_status = 'paid' THEN 1 END) as total_paid_count,
        COALESCE(SUM(CASE WHEN p.payment_status = 'paid' THEN p.purchase_cost ELSE 0 END), 0) as total_paid_amount,
        COUNT(DISTINCT p.supplier_id) as supplier_count
      FROM phones p
      LEFT JOIN brands br ON p.brand_id = br.id
      LEFT JOIN models m ON p.model_id = m.id
      ${whereClause}
    `, params)

    return {
      total_unpaid_count: parseInt(summary[0]?.total_unpaid_count) || 0,
      total_unpaid_amount: parseFloat(summary[0]?.total_unpaid_amount) || 0,
      total_paid_count: parseInt(summary[0]?.total_paid_count) || 0,
      total_paid_amount: parseFloat(summary[0]?.total_paid_amount) || 0,
      supplier_count: parseInt(summary[0]?.supplier_count) || 0
    }
  }

  /**
   * 获取供应商手机列表
   * 支持按销售状态筛选：sold(已售)/stock(在库)/all(全部)
   * 支持关键词搜索：IMEI、序列号、品牌、型号
   */
  async getPhones(filters = {}) {
    await ensureSupplierPaymentSchema()

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
      page_size = 50
    } = filters

    const shouldExportAll = export_all === true || export_all === 'true'
    const validPageSize = shouldExportAll ? null : Math.min(Math.max(parseInt(page_size, 10) || 50, 1), 200)
    const validPage = shouldExportAll ? 1 : Math.max(parseInt(page), 1)
    const offset = shouldExportAll ? 0 : (validPage - 1) * validPageSize

    // 构建查询条件 - 查询所有有供应商的手机
    // 只排除划拨（supplier_proxy）的手机，批发（peer_transfer）的手机需要正常打款
    const whereConditions = ['p.supplier_id IS NOT NULL', 'p.status != \'supplier_proxy\'']
    const params = []

    if (supplier_id) {
      whereConditions.push('p.supplier_id = ?')
      params.push(supplier_id)
    }

    if (store_id) {
      whereConditions.push('p.store_id = ?')
      params.push(store_id)
    }

    // 打款状态筛选：未打款是 NULL 或 != 'paid'
    if (payment_status === 'unpaid') {
      whereConditions.push('(p.payment_status IS NULL OR p.payment_status != \'paid\')')
    } else if (payment_status === 'paid') {
      whereConditions.push('p.payment_status = \'paid\'')
    }
    // 'all' 不添加条件，包括所有

    // 销售状态筛选 - status 字段是字符串类型
    // 'sold' 包括正常销售(sold)和批发销售(peer_transfer)，但不包括划拨(supplier_proxy)
    // 'stock' 只包括在库(in_stock)
    if (sale_status === 'sold') {
      whereConditions.push('p.status IN (\'sold\', \'peer_transfer\')')
    } else if (sale_status === 'stock') {
      whereConditions.push('p.status = \'in_stock\'')
    }
    // 'all' 不添加条件，包括所有

    // 时间筛选 - 根据销售状态决定使用入库时间还是销售时间
    if (start_date) {
      if (sale_status === 'sold') {
        // 已售状态使用销售时间
        whereConditions.push('DATE(p.sale_time) >= ?')
      } else {
        // 在库或全部状态使用入库时间
        whereConditions.push('DATE(p.inventory_time) >= ?')
      }
      params.push(start_date)
    }

    if (end_date) {
      if (sale_status === 'sold') {
        // 已售状态使用销售时间
        whereConditions.push('DATE(p.sale_time) <= ?')
      } else {
        // 在库或全部状态使用入库时间
        whereConditions.push('DATE(p.inventory_time) <= ?')
      }
      params.push(end_date)
    }

    // 关键词搜索：IMEI、序列号、品牌、型号
    if (keyword && keyword.trim()) {
      const searchCondition = `(
        (CONVERT(p.imei USING utf8mb4) COLLATE utf8mb4_unicode_ci) LIKE ? OR
        (CONVERT(p.serial_number USING utf8mb4) COLLATE utf8mb4_unicode_ci) LIKE ? OR
        (CONVERT(br.name USING utf8mb4) COLLATE utf8mb4_unicode_ci) LIKE ? OR
        (CONVERT(m.name USING utf8mb4) COLLATE utf8mb4_unicode_ci) LIKE ? OR
        (CONVERT(CONCAT(br.name, ' ', m.name) USING utf8mb4) COLLATE utf8mb4_unicode_ci) LIKE ?
      )`
      const searchTerm = `%${keyword.trim()}%`
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm)
      whereConditions.push(searchCondition)
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`

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
        p.payment_remarks,
        p.payment_batch_id,
        p.payment_operator_id,
        p.inventory_time,
        p.status as phone_status,
        p.is_new,
        p.inventory_operator_id,
        p.sale_time,
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
      LEFT JOIN sales sale ON sale.id = p.sale_id
      LEFT JOIN stores sale_st ON sale.store_id = sale_st.id
      LEFT JOIN users u1 ON p.inventory_operator_id = u1.id
      LEFT JOIN users u2 ON p.sale_operator_id = u2.id
      LEFT JOIN users u3 ON p.payment_operator_id = u3.id
      ${whereClause}
      ORDER BY
        CASE
          WHEN p.sale_time IS NOT NULL THEN 1
          ELSE 2
        END,
        p.sale_time DESC,
        p.inventory_time DESC
      ${shouldExportAll ? '' : `LIMIT ${validPageSize} OFFSET ${offset}`}
    `

    const phones = await executeQuery(listSql, params)

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
      payment_remarks: p.payment_remarks || '',
      payment_batch_id: p.payment_batch_id || null,
      payment_operator_id: p.payment_operator_id,
      payment_operator_name: p.payment_operator_name || '-',
      inventory_time: p.inventory_time,
      sale_time: p.sale_time,
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
    }))

    // 查询总数
    const countResult = await executeQuery(`
      SELECT COUNT(*) AS total
      FROM phones p
      LEFT JOIN brands br ON p.brand_id = br.id
      LEFT JOIN models m ON p.model_id = m.id
      ${whereClause}
    `, params)

    const total = countResult[0]?.total || 0

    return {
      phones: formattedPhones,
      pagination: {
        page: validPage,
        page_size: validPageSize || total,
        total,
        total_pages: validPageSize ? Math.ceil(total / validPageSize) : (total > 0 ? 1 : 0),
        has_next: validPageSize ? validPage < Math.ceil(total / validPageSize) : false,
        has_prev: validPageSize ? validPage > 1 : false
      }
    }
  }

  /**
   * 批量打款
   */
  async batchPayment({ phone_ids, payment_method, payment_time, payment_remarks, operator_id }) {
    await ensureSupplierPaymentSchema()
    const db = getDatabase()

    // 验证手机ID - 查找未打款的手机（payment_status IS NULL 或 != 'paid'）
    const connection = await db.getConnection()
    try {
      await connection.beginTransaction()
      const [phones] = await connection.execute(`
        SELECT id, imei, purchase_cost, supplier_id
        FROM phones
        WHERE id IN (${phone_ids.map(() => '?').join(',')})
          AND supplier_id IS NOT NULL
          AND status != 'supplier_proxy'
          AND (payment_status IS NULL OR payment_status != 'paid')
        FOR UPDATE
      `, phone_ids)

      if (phones.length === 0) throw new Error('没有找到可打款的手机')

      const paymentTime = normalizeDateTime(payment_time, false)
      if (!paymentTime) throw new Error('打款时间无效')
      const paymentBatchId = randomUUID()

      for (const phone of phones) {
        await connection.execute(`
          UPDATE phones
          SET payment_status = 'paid', payment_method = ?, payment_time = ?, payment_remarks = ?, payment_batch_id = ?, payment_operator_id = ?
          WHERE id = ?
        `, [payment_method, paymentTime, payment_remarks?.trim() || null, paymentBatchId, operator_id, phone.id])
      }
      await connection.commit()

      return {
        count: phones.length,
        total_amount: phones.reduce((sum, p) => sum + Number(p.purchase_cost || 0), 0),
        payment_method,
        payment_time: paymentTime,
        payment_batch_id: paymentBatchId
      }
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }

  /**
   * 单个手机打款
   */
  async singlePayment({ phone_id, payment_method, payment_time, payment_remarks, operator_id }) {
    await ensureSupplierPaymentSchema()
    const db = getDatabase()

    // 获取手机信息
    const connection = await db.getConnection()
    try {
      await connection.beginTransaction()
      const [phones] = await connection.execute(`
        SELECT id, imei, purchase_cost, supplier_id, payment_status, status
        FROM phones
        WHERE id = ?
        FOR UPDATE
      `, [phone_id])

      if (!phones || phones.length === 0) throw new Error('手机不存在')

      const phone = phones[0]

      if (phone.supplier_id === null || phone.supplier_id === undefined) throw new Error('该手机没有供应商')
      if (phone.status === 'supplier_proxy') throw new Error('划拨手机不可打款')
      if (phone.payment_status === 'paid') throw new Error('该手机已打款')

      const paymentTime = normalizeDateTime(payment_time, false)
      if (!paymentTime) throw new Error('打款时间无效')

      await connection.execute(`
        UPDATE phones
        SET payment_status = 'paid', payment_method = ?, payment_time = ?, payment_remarks = ?, payment_batch_id = NULL, payment_operator_id = ?
        WHERE id = ?
      `, [payment_method, paymentTime, payment_remarks?.trim() || null, operator_id, phone_id])
      await connection.commit()

      return {
        phone_id,
        imei: phone.imei,
        amount: Number(phone.purchase_cost || 0),
        payment_method,
        payment_time: paymentTime
      }
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }

  /**
   * 批量取消打款
   */
  async batchCancelPayment({ phone_ids }) {
    await ensureSupplierPaymentSchema()
    const db = getDatabase()

    const connection = await db.getConnection()
    try {
      await connection.beginTransaction()
      const [phones] = await connection.execute(`
        SELECT id, imei, purchase_cost, supplier_id
        FROM phones
        WHERE id IN (${phone_ids.map(() => '?').join(',')})
          AND supplier_id IS NOT NULL
          AND status != 'supplier_proxy'
          AND payment_status = 'paid'
        FOR UPDATE
      `, phone_ids)
      if (phones.length === 0) throw new Error('没有找到可取消打款的手机')

      for (const phone of phones) {
        await connection.execute(`
          UPDATE phones
          SET payment_status = NULL, payment_method = NULL,
              payment_time = NULL, payment_remarks = NULL, payment_batch_id = NULL, payment_operator_id = NULL
          WHERE id = ?
        `, [phone.id])
      }
      await connection.commit()
      return {
        count: phones.length,
        total_amount: phones.reduce((sum, p) => sum + Number(p.purchase_cost || 0), 0),
        message: `成功取消 ${phones.length} 台手机的打款`
      }
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }

  /**
   * 更新打款信息
   */
  async updatePayment({ phone_id, payment_method, payment_time, payment_remarks }) {
    await ensureSupplierPaymentSchema()
    const db = getDatabase()

    const connection = await db.getConnection()
    try {
      await connection.beginTransaction()

      // 先锁定被编辑记录，使用原始打款时间确定批次，避免编辑时被当前时间拆批。
      const [phones] = await connection.execute(`
        SELECT
          id,
          imei,
          supplier_id,
          payment_status,
          payment_method,
          payment_remarks,
          payment_batch_id,
          DATE_FORMAT(payment_time, '%Y-%m-%d %H:%i:%s') AS batch_payment_time
        FROM phones
        WHERE id = ?
        FOR UPDATE
      `, [phone_id])

      if (!phones || phones.length === 0) {
        throw new Error('手机不存在')
      }

      const phone = phones[0]

      // 如果 payment_method 和 payment_time 都为 null，则是取消打款操作。
      if (payment_method === null && payment_time === null) {
        await connection.execute(`
          UPDATE phones
          SET payment_status = NULL,
              payment_method = NULL,
              payment_time = NULL,
              payment_remarks = NULL,
              payment_batch_id = NULL,
              payment_operator_id = NULL
          WHERE id = ?
        `, [phone_id])
        await connection.commit()

        return {
          phone_id,
          imei: phone.imei,
          payment_status: 'unpaid',
          payment_method: null,
          payment_time: null
        }
      }

      if (phone.payment_status !== 'paid') {
        throw new Error('该手机未打款，无法编辑')
      }

      const paymentTime = payment_time === undefined
        ? phone.batch_payment_time
        : normalizeDateTime(payment_time, false)
      if (!paymentTime) throw new Error('打款时间无效')

      const nextPaymentMethod = payment_method === undefined
        ? phone.payment_method
        : payment_method
      const nextPaymentRemarks = payment_remarks === undefined
        ? (phone.payment_remarks?.trim() || null)
        : (payment_remarks?.trim() || null)

      let batchPhones
      if (phone.payment_batch_id) {
        [batchPhones] = await connection.execute(`
          SELECT id
          FROM phones
          WHERE payment_batch_id = ?
            AND supplier_id = ?
            AND payment_status = 'paid'
          FOR UPDATE
        `, [phone.payment_batch_id, phone.supplier_id])
      } else if (phone.batch_payment_time) {
        // 兼容历史数据：没有批次编号时，回退到供应商和原始秒级时间。
        [batchPhones] = await connection.execute(`
          SELECT id
          FROM phones
          WHERE supplier_id = ?
            AND payment_status = 'paid'
            AND DATE_FORMAT(payment_time, '%Y-%m-%d %H:%i:%s') = ?
          FOR UPDATE
        `, [phone.supplier_id, phone.batch_payment_time])
      } else {
        // 历史脏数据没有打款时间时，仅更新当前记录，避免误合并其他批次。
        batchPhones = [{ id: phone_id }]
      }

      const batchIds = batchPhones.map(item => item.id)
      if (batchIds.length === 0) {
        throw new Error('未找到可编辑的打款批次')
      }

      await connection.execute(`
        UPDATE phones
        SET payment_method = ?,
            payment_time = ?,
            payment_remarks = ?
        WHERE id IN (${batchIds.map(() => '?').join(',')})
      `, [nextPaymentMethod, paymentTime, nextPaymentRemarks, ...batchIds])

      await connection.commit()

      return {
        phone_id,
        imei: phone.imei,
        batch_count: batchIds.length,
        payment_method: nextPaymentMethod,
        payment_time: paymentTime,
        payment_remarks: nextPaymentRemarks,
        payment_batch_id: phone.payment_batch_id || null
      }
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }

  /**
   * 获取打款批次详情
   * @param {number} supplier_id - 供应商ID
   * @param {string} payment_time - 历史记录回退使用的打款时间
   * @param {string|null} payment_batch_id - 新记录使用的批次编号
   */
  async getPaymentBatchDetails(supplier_id, payment_time, payment_batch_id = null) {
    await ensureSupplierPaymentSchema()
    log.debug('🔍 [批次详情] 查询参数:', { supplier_id, payment_time, payment_batch_id })

    const batchCondition = payment_batch_id
      ? `p.payment_batch_id = ?
        AND p.supplier_id = ?
        AND p.payment_status = 'paid'`
      : `p.supplier_id = ?
        AND p.payment_status = 'paid'
        AND DATE_FORMAT(p.payment_time, '%Y-%m-%d %H:%i:%s') = ?`
    const batchParams = payment_batch_id
      ? [payment_batch_id, supplier_id]
      : [supplier_id, payment_time]

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
        p.payment_remarks,
        p.payment_batch_id,
        p.payment_operator_id,
        p.inventory_time,
        p.sale_time,
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
      WHERE ${batchCondition}
      ORDER BY p.sale_time DESC, p.payment_time DESC
    `, batchParams)

    log.debug('🔍 [批次详情] 精确查询结果数量:', phones.length)

    return phones.map(p => ({
      id: p.id,
      imei: p.imei,
      serial_number: p.serial_number,
      purchase_cost: parseFloat(p.purchase_cost),
      sale_price: parseFloat(p.sale_price || 0),
      payment_time: p.payment_time,
      payment_method: p.payment_method,
      payment_remarks: p.payment_remarks || '',
      payment_batch_id: p.payment_batch_id || null,
      payment_operator_id: p.payment_operator_id,
      payment_operator_name: p.payment_operator_name,
      inventory_time: p.inventory_time,
      sale_time: p.sale_time,
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
    }))
  }
}

module.exports = new SupplierPaymentService()
