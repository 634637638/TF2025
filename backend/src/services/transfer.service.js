const { getDatabase } = require('../config/database');
const { normalizeDateTime } = require('../utils/time');
const log = require('../utils/log');

/**
 * 批发/划拨服务类
 * 支持两种场景：
 * 1. 批发给同行（wholesale）：产生货款，计算利润，创建销售记录
 * 2. 代供应商划拨（supplier_proxy）：不产生货款，不计算利润，不创建销售记录
 */
class TransferService {
  /**
   * 生成会员号（与 customers.js 中的 generateMemberNumber 逻辑一致）
   */
  async generateMemberNumber(connection) {
    const maxAttempts = 10;
    let attempts = 0;

    while (attempts < maxAttempts) {
      attempts++;
      try {
        // 获取当前最大的会员编号
        const [result] = await connection.query(
          'SELECT member_number FROM customers WHERE member_number IS NOT NULL AND member_number != "" ORDER BY member_number DESC LIMIT 1'
        );

        let maxNumber = 0;
        if (result.length > 0 && result[0].member_number) {
          const lastMemberNumber = result[0].member_number;
          // 处理不同格式的会员号
          if (lastMemberNumber.startsWith('TF')) {
            maxNumber = parseInt(lastMemberNumber.substring(2)) || 0;
          } else if (lastMemberNumber.startsWith('C')) {
            maxNumber = parseInt(lastMemberNumber.substring(1)) || 0;
          }
        }

        // 生成新的会员编号，加上尝试次数避免重复
        const newNumber = maxNumber + attempts;
        const paddedNumber = newNumber.toString().padStart(6, '0');
        const memberNumber = `TF${paddedNumber}`;

        // 检查是否已存在
        const [existing] = await connection.query(
          'SELECT id FROM customers WHERE member_number = ?',
          [memberNumber]
        );

        if (existing.length === 0) {
          return memberNumber;
        }

        // 如果存在，继续尝试
        log.debug(`会员号 ${memberNumber} 已存在，进行第 ${attempts + 1} 次尝试`);
      } catch (error) {
        log.error(`生成会员号失败 (尝试 ${attempts}):`, error);
        if (attempts >= maxAttempts) {
          // 最后一次尝试失败，使用时间戳
          const timestamp = Date.now().toString().slice(-6);
          return `TF${timestamp}`;
        }
      }
    }

    // 如果所有尝试都失败，使用时间戳
    const timestamp = Date.now().toString().slice(-6);
    return `TF${timestamp}`;
  }

  /**
   * 生成单号
   */
  generateRecordNumber(type = 'WS') {
    const date = new Date();
    const dateStr = date.getFullYear().toString() +
      (date.getMonth() + 1).toString().padStart(2, '0') +
      date.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${type}${dateStr}${random}`;
  }

  /**
   * 批发给同行
   * 场景：自己批发给同行，产生货款，计算利润
   */
  async wholesaleToPeer({
    phone_ids,
    customer_id,
    customer_name,
    customer_phone,
    phones,
    remarks,
    operator_id,
    store_id,
    salesperson_name,
    payment_method,
    invoice_number,
    sale_date
  }) {
    log.debug('=== TransferService.wholesaleToPeer 开始 ===');
    log.debug('phone_ids:', JSON.stringify(phone_ids));
    log.debug('phones 参数类型:', typeof phones);
    log.debug('phones 参数值:', JSON.stringify(phones));
    log.debug('phones 是数组吗:', Array.isArray(phones));
    log.debug('customer_id:', customer_id);
    log.debug('store_id:', store_id);
    log.debug('salesperson_name:', salesperson_name);

    const pool = getDatabase();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      let success_count = 0;
      const failed_phones = [];
      const results = [];

      // 如果没有客户ID，先检查或创建客户
      let final_customer_id = customer_id;
      if (!final_customer_id && customer_name && customer_phone) {
        // 🔥 先检查手机号是否已存在（确保唯一性）
        const [existingCustomer] = await connection.query(
          'SELECT id, name, member_number FROM customers WHERE phone = ? AND status = 1',
          [customer_phone]
        );

        if (existingCustomer.length > 0) {
          // 手机号已存在，直接使用已有客户
          final_customer_id = existingCustomer[0].id;
          log.debug(`手机号 ${customer_phone} 已存在，使用已有客户 ID: ${final_customer_id}`);
        } else {
          // 生成会员号
          const memberNumber = await this.generateMemberNumber(connection);
          // 创建新客户
          const [insertResult] = await connection.query(
            `INSERT INTO customers (name, phone, customer_type, vip_level, member_number, created_at)
             VALUES (?, ?, 'wholesale', 'normal', ?, NOW())`,
            [customer_name, customer_phone, memberNumber]
          );
          final_customer_id = insertResult.insertId;
          log.debug(`创建新客户 ID: ${final_customer_id}, 手机号: ${customer_phone}`);
        }
      }

      if (!final_customer_id) {
        throw new Error('客户信息不完整');
      }

      // 获取客户信息
      const [customerData] = await connection.query(
        'SELECT name, phone, customer_type FROM customers WHERE id = ?',
        [final_customer_id]
      );

      if (customerData.length === 0) {
        throw new Error('客户不存在');
      }

      const customer = customerData[0];

      // 如果提供了销售员姓名，查找对应的销售员ID
      let final_operator_id = operator_id;
      if (salesperson_name) {
        const [salespersonData] = await connection.query(
          'SELECT id, store_id FROM users WHERE name = ? OR username = ?',
          [salesperson_name, salesperson_name]
        );

        if (salespersonData && salespersonData.length > 0) {
          final_operator_id = salespersonData[0].id;
          log.debug(`使用指定销售员: ${salesperson_name}, ID: ${final_operator_id}`);
        } else {
          log.warn(`未找到销售员: ${salesperson_name}，使用当前操作员`);
        }
      }

      // 确定门店ID：优先使用前端传入的，否则使用操作员的默认门店
      let final_store_id = store_id;
      if (!final_store_id) {
        // 获取操作员的默认门店
        const [operatorData] = await connection.query(
          'SELECT store_id FROM users WHERE id = ?',
          [operator_id]
        );

        if (!operatorData || operatorData.length === 0) {
          throw new Error('操作员信息不存在');
        }

        final_store_id = operatorData[0].store_id;
        log.debug(`使用操作员的默认门店ID: ${final_store_id}`);
      }

      // 处理每台手机
      for (const phone_id of phone_ids) {
        try {
          log.debug(`处理手机 ID: ${phone_id}, phones 数组:`, JSON.stringify(phones));

          // 从phones数组中找到对应手机的价格信息
          const phoneData = phones?.find(p => p.phone_id === phone_id);
          log.debug(`找到的 phoneData:`, JSON.stringify(phoneData));

          const wholesale_price = phoneData?.wholesale_price;
          const purchase_cost = phoneData?.purchase_cost;

          if (!wholesale_price || wholesale_price <= 0) {
            log.error(`批发价格无效: phone_id=${phone_id}, wholesale_price=${wholesale_price}`);
            failed_phones.push({ phone_id, error: `批发价格无效: ${wholesale_price}` });
            continue;
          }

          // 检查手机状态和信息
          const [phoneRecords] = await connection.query(
            'SELECT id, imei, status, purchase_cost, supplier_id FROM phones WHERE id = ?',
            [phone_id]
          );

          if (phoneRecords.length === 0) {
            failed_phones.push({ phone_id, error: '手机不存在' });
            continue;
          }

          const phone = phoneRecords[0];

          // 只有在库状态才能批发
          if (phone.status !== 'in_stock') {
            failed_phones.push({
              phone_id,
              imei: phone.imei,
              error: `手机状态不是在库，当前状态: ${phone.status}`
            });
            continue;
          }

          // 使用传入的入库价或原始入库价
          const final_purchase_cost = purchase_cost || phone.purchase_cost || 0;
          const price = wholesale_price || 0;
          const profit = price - final_purchase_cost;

          // 更新手机的入库价（如果传入）
          if (purchase_cost && purchase_cost !== phone.purchase_cost) {
            await connection.query(
              'UPDATE phones SET purchase_cost = ? WHERE id = ?',
              [purchase_cost, phone_id]
            );
          }

          // 生成批发单号
          const record_no = this.generateRecordNumber('WS');

          // 验证销售时间必填
          if (!sale_date) {
            throw new Error('销售时间不能为空');
          }

          // 统一转换为北京时间字符串
          const saleTimeStr = normalizeDateTime(sale_date, true);

          // 更新手机状态
          await connection.query(
            `UPDATE phones SET
              status = 'peer_transfer',
              sale_price = ?,
              wholesale_date = ?,
              wholesale_price = ?,
              salestime = ?,
              remarks = ?
            WHERE id = ?`,
            [price, saleTimeStr, price, saleTimeStr, remarks || null, phone_id]
          );

          // 🔥 如果没有发票号，自动生成（使用销售时间）
          let finalInvoiceNumber = invoice_number;
          if (!finalInvoiceNumber) {
            const { generateInvoiceNumber } = require('../utils/invoice-number');
            const saleDateObj = new Date(saleTimeStr);
            finalInvoiceNumber = await generateInvoiceNumber('wholesale', connection, saleDateObj);
            log.debug(`✅ 自动生成批发发票号: ${finalInvoiceNumber}, 销售日期: ${saleTimeStr.split(' ')[0]}`);
          }

          // 创建销售记录（批发模式）
          // 注意：sales表不存储salesperson_name，通过operator_id关联users表获取
          const saleInsertResult = await connection.query(
            `INSERT INTO sales
              (phone_id, customer_id, sale_type, price, cost, operator_id,
               payment_method, invoice_number, remarks, sale_date, store_id)
            VALUES (?, ?, 'wholesale', ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              phone_id,
              final_customer_id,
              price,
              final_purchase_cost,
              final_operator_id,
              payment_method || null,
              finalInvoiceNumber,
              remarks || null,
              saleTimeStr,
              final_store_id
            ]
          );

          const sale_id = saleInsertResult[0].insertId;

          // 更新手机的销售记录ID和销售员ID（保持数据一致性）
          await connection.query(
            'UPDATE phones SET sale_id = ?, sale_operator_id = ? WHERE id = ?',
            [sale_id, final_operator_id, phone_id]
          );

          log.debug(`批发手机 ${phone_id} 成功，准备添加到结果`);

          results.push({
            phone_id,
            imei: phone.imei,
            record_no,
            sale_id,
            customer_name: customer?.name || '未知',
            wholesale_price: price,
            purchase_cost: final_purchase_cost,
            profit,
            status: 'success'
          });

          success_count++;
          log.debug(`success_count 增加到: ${success_count}`);
        } catch (error) {
          log.error(`批发手机 ${phone_id} 失败:`, error);
          failed_phones.push({ phone_id, error: error.message });
        }
      }

      await connection.commit();

      log.debug(`=== 批发完成 ===`);
      log.debug(`success_count: ${success_count}`);
      log.debug(`total_count: ${phone_ids.length}`);
      log.debug(`failed_phones:`, JSON.stringify(failed_phones));
      log.debug(`results:`, JSON.stringify(results));

      return {
        success_count,
        total_count: phone_ids.length,
        results,
        failed_phones
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 代供应商划拨
   * 场景：代供应商把手机划拨给其客户，也创建销售记录
   * 与批发的区别：划拨不计算在供应商打款范围内
   */
  async proxyTransferForSupplier({
    phone_ids,
    supplier_id,
    customer_id,
    customer_name,
    customer_phone,
    phones,
    remarks,
    operator_id,
    store_id,
    salesperson_name,
    sale_date
  }) {
    const pool = getDatabase();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      let success_count = 0;
      const failed_phones = [];
      const results = [];

      // 如果传入了客户信息但没有ID，先检查或创建客户
      let final_customer_id = customer_id;
      if (!final_customer_id && customer_name && customer_phone) {
        // 🔥 先检查手机号是否已存在（确保唯一性）
        const [existingCustomer] = await connection.query(
          'SELECT id, name, member_number FROM customers WHERE phone = ? AND status = 1',
          [customer_phone]
        );

        if (existingCustomer.length > 0) {
          // 手机号已存在，直接使用已有客户
          final_customer_id = existingCustomer[0].id;
          log.debug(`手机号 ${customer_phone} 已存在，使用已有客户 ID: ${final_customer_id}`);
        } else {
          // 生成会员号
          const memberNumber = await this.generateMemberNumber(connection);
          const [insertResult] = await connection.query(
            `INSERT INTO customers (name, phone, customer_type, vip_level, member_number, created_at)
             VALUES (?, ?, 'allocate', 'normal', ?, NOW())`,
            [customer_name, customer_phone, memberNumber]
          );
          final_customer_id = insertResult.insertId;
          log.debug(`创建新客户 ID: ${final_customer_id}, 手机号: ${customer_phone}`);
        }
      }

      // 确定门店ID：优先使用前端传入的，否则使用操作员的默认门店
      let final_store_id = store_id;
      if (!final_store_id) {
        const [operatorData] = await connection.query(
          'SELECT store_id FROM users WHERE id = ?',
          [operator_id]
        );

        if (!operatorData || operatorData.length === 0) {
          throw new Error('操作员信息不存在');
        }

        final_store_id = operatorData[0].store_id;
        log.debug(`使用操作员的默认门店ID: ${final_store_id}`);
      }

      // 获取供应商信息
      const [supplierData] = await connection.query(
        'SELECT name FROM suppliers WHERE id = ?',
        [supplier_id]
      );

      if (supplierData.length === 0) {
        throw new Error('供应商不存在');
      }

      const supplier_name = supplierData[0].name;

      // 如果提供了销售员姓名，查找对应的销售员ID
      let final_operator_id = operator_id;
      if (salesperson_name) {
        const [salespersonData] = await connection.query(
          'SELECT id, store_id FROM users WHERE name = ? OR username = ?',
          [salesperson_name, salesperson_name]
        );

        if (salespersonData && salespersonData.length > 0) {
          final_operator_id = salespersonData[0].id;
          log.debug(`使用指定销售员: ${salesperson_name}, ID: ${final_operator_id}`);
        } else {
          log.warn(`未找到销售员: ${salesperson_name}，使用当前操作员`);
        }
      }

      // 获取客户信息
      let final_customer_name = '未知';
      if (final_customer_id) {
        const [customerData] = await connection.query(
          'SELECT name FROM customers WHERE id = ?',
          [final_customer_id]
        );
        if (customerData.length > 0) {
          final_customer_name = customerData[0].name;
        }
      } else if (customer_name) {
        final_customer_name = customer_name;
      }

      // 处理每台手机
      for (const phone_id of phone_ids) {
        try {
          // 从phones数组中找到对应手机的价格信息
          const phoneData = phones?.find(p => p.phone_id === phone_id);
          const wholesale_price = phoneData?.wholesale_price;
          const purchase_cost = phoneData?.purchase_cost;

          // 检查手机状态和信息
          const [phoneRecords] = await connection.query(
            'SELECT id, imei, status, purchase_cost, supplier_id FROM phones WHERE id = ?',
            [phone_id]
          );

          if (phoneRecords.length === 0) {
            failed_phones.push({ phone_id, error: '手机不存在' });
            continue;
          }

          const phone = phoneRecords[0];

          // 只有在库状态才能划拨
          if (phone.status !== 'in_stock') {
            failed_phones.push({
              phone_id,
              imei: phone.imei,
              error: `手机状态不是在库，当前状态: ${phone.status}`
            });
            continue;
          }

          // 划拨模式：入库价格和销售价都设置为0（不赚钱，只是帮供应商划拨）
          const final_purchase_cost = 0;
          const proxy_price = 0;

          // 生成划拨单号
          const record_no = this.generateRecordNumber('PX');

          // 验证销售时间必填
          if (!sale_date) {
            throw new Error('划拨时间不能为空');
          }

          // 统一转换为北京时间字符串
          const saleTimeStr = normalizeDateTime(sale_date, true);

          // 更新手机状态（划拨模式价格都为0，包括入库成本）
          await connection.query(
            `UPDATE phones SET
              status = 'supplier_proxy',
              sale_price = ?,
              wholesale_date = ?,
              wholesale_price = ?,
              purchase_cost = ?,
              salestime = ?,
              remarks = ?
            WHERE id = ?`,
            [proxy_price, saleTimeStr, proxy_price, final_purchase_cost, saleTimeStr, remarks || null, phone_id]
          );

          // 🔥 自动生成划拨发票号（使用销售时间）
          const { generateInvoiceNumber } = require('../utils/invoice-number');
          const saleDateObj = new Date(saleTimeStr);
          const invoiceNumber = await generateInvoiceNumber('supplier_proxy', connection, saleDateObj);
          log.debug(`✅ 自动生成划拨发票号: ${invoiceNumber}, 销售日期: ${saleTimeStr.split(' ')[0]}`);

          // 创建销售记录（划拨模式也创建销售记录）
          // 注意：sales表不存储salesperson_name，通过operator_id关联users表获取
          const saleInsertResult = await connection.query(
            `INSERT INTO sales
              (phone_id, customer_id, sale_type, price, cost, operator_id,
               store_id, invoice_number, remarks, sale_date)
            VALUES (?, ?, 'supplier_proxy', ?, ?, ?, ?, ?, ?, ?)`,
            [
              phone_id,
              final_customer_id || null,
              proxy_price,
              final_purchase_cost,
              final_operator_id,
              final_store_id,
              invoiceNumber,
              remarks || null,
              saleTimeStr
            ]
          );

          const sale_id = saleInsertResult[0].insertId;

          // 更新手机的销售记录ID和销售员ID（保持数据一致性）
          await connection.query(
            'UPDATE phones SET sale_id = ?, sale_operator_id = ? WHERE id = ?',
            [sale_id, final_operator_id, phone_id]
          );

          log.debug(`划拨手机 ${phone_id} 成功，准备添加到结果`);

          results.push({
            phone_id,
            imei: phone.imei,
            sale_id,
            supplier_name,
            customer_name: final_customer_name,
            proxy_price: wholesale_price || final_purchase_cost,
            purchase_cost: final_purchase_cost,
            status: 'success'
          });

          success_count++;
          log.debug(`success_count 增加到: ${success_count}`);
        } catch (error) {
          log.error(`划拨手机 ${phone_id} 失败:`, error);
          failed_phones.push({ phone_id, error: error.message });
        }
      }

      await connection.commit();

      log.debug(`=== 划拨完成 ===`);
      log.debug(`success_count: ${success_count}`);
      log.debug(`total_count: ${phone_ids.length}`);
      log.debug(`failed_phones:`, JSON.stringify(failed_phones));
      log.debug(`results:`, JSON.stringify(results));

      return {
        success_count,
        total_count: phone_ids.length,
        results,
        failed_phones
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 获取批发/划拨记录列表（从 sales 表查询）
   */
  async getWholesaleRecords(filters = {}) {
    const pool = getDatabase();
    const {
      page = 1,
      limit = 20,
      start_date,
      end_date,
      record_type,
      customer_id,
      supplier_id,
      store_id
    } = filters;

    const offset = (page - 1) * limit;
    const whereConditions = ['s.sale_type IN ("wholesale", "supplier_proxy")'];
    const whereParams = [];

    if (start_date) {
      whereConditions.push('s.sale_date >= ?');
      whereParams.push(`${start_date} 00:00:00`);
    }

    if (end_date) {
      whereConditions.push('s.sale_date <= ?');
      whereParams.push(`${end_date} 23:59:59`);
    }

    if (record_type) {
      whereConditions.push('s.sale_type = ?');
      whereParams.push(record_type);
    }

    if (customer_id) {
      whereConditions.push('s.customer_id = ?');
      whereParams.push(customer_id);
    }

    if (store_id) {
      whereConditions.push('s.store_id = ?');
      whereParams.push(store_id);
    }

    // supplier_id 需要从 phones 表关联
    if (supplier_id) {
      whereConditions.push('p.proxy_supplier_id = ?');
      whereParams.push(supplier_id);
    }

    const whereClause = whereConditions.join(' AND ');

    // 查询数据
    const query = `
      SELECT
        s.id,
        s.phone_id,
        p.imei as phone_imei,
        s.sale_type as record_type,
        s.store_id,
        st.name as store_name,
        s.customer_id,
        c.name as customer_name,
        s.price as wholesale_price,
        s.cost as purchase_cost,
        CASE
          WHEN s.cost IS NOT NULL THEN s.price - s.cost
          ELSE NULL
        END as profit,
        p.proxy_supplier_id,
        sup.name as supplier_name,
        s.sale_date as wholesale_date,
        s.operator_id,
        u.name as operator_name,
        s.remarks,
        s.status
      FROM sales s
      LEFT JOIN phones p ON s.phone_id = p.id
      LEFT JOIN stores st ON s.store_id = st.id
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN suppliers sup ON p.proxy_supplier_id = sup.id
      LEFT JOIN users u ON s.operator_id = u.id
      WHERE ${whereClause}
      ORDER BY s.sale_date DESC
      LIMIT ? OFFSET ?
    `;

    const [records] = await pool.query(query, [...whereParams, limit, offset]);

    // 查询总数
    const countQuery = `
      SELECT COUNT(*) as total
      FROM sales s
      LEFT JOIN phones p ON s.phone_id = p.id
      WHERE ${whereClause}
    `;

    const [countResult] = await pool.query(countQuery, whereParams.slice(0, -2));
    const total = countResult[0].total;

    return {
      data: records,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * 获取批发/划拨统计（从 sales 表统计）
   */
  async getWholesaleStatistics(filters = {}) {
    const pool = getDatabase();
    const { start_date, end_date, store_id, supplier_id } = filters;

    log.debug('📊 批发划拨统计查询参数:', filters);

    const whereConditions = ['s.sale_type IN ("wholesale", "supplier_proxy")'];
    const whereParams = [];

    if (start_date) {
      whereConditions.push('s.sale_date >= ?');
      whereParams.push(`${start_date} 00:00:00`);
    }

    if (end_date) {
      whereConditions.push('s.sale_date <= ?');
      whereParams.push(`${end_date} 23:59:59`);
    }

    if (store_id) {
      whereConditions.push('s.store_id = ?');
      whereParams.push(store_id);
    }

    if (supplier_id) {
      whereConditions.push('p.supplier_id = ?');
      whereParams.push(supplier_id);
    }

    const whereClause = whereConditions.join(' AND ');

    // 统计查询 - 通过 JOIN phones 表来筛选供应商
    const query = `
      SELECT
        s.sale_type,
        COUNT(*) as total_count,
        SUM(s.price) as total_amount,
        SUM(CASE WHEN s.cost IS NOT NULL THEN s.price - s.cost ELSE 0 END) as total_profit
      FROM sales s
      LEFT JOIN phones p ON s.phone_id = p.id
      WHERE ${whereClause}
      GROUP BY s.sale_type
    `;

    log.debug('📊 批发划拨统计SQL:', query);
    log.debug('📊 批发划拨统计参数:', whereParams);

    const [stats] = await pool.query(query, whereParams);

    const result = {
      wholesale: {
        total_count: 0,
        total_amount: 0,
        total_profit: 0
      },
      supplier_proxy: {
        total_count: 0,
        total_amount: 0,
        total_profit: 0
      }
    };

    stats.forEach(stat => {
      if (stat.sale_type === 'wholesale') {
        result.wholesale = {
          total_count: parseInt(stat.total_count) || 0,
          total_amount: parseFloat(stat.total_amount) || 0,
          total_profit: parseFloat(stat.total_profit) || 0
        };
      } else if (stat.sale_type === 'supplier_proxy') {
        result.supplier_proxy = {
          total_count: parseInt(stat.total_count) || 0,
          total_amount: parseFloat(stat.total_amount) || 0,
          total_profit: 0  // 划拨不计算利润
        };
      }
    });

    return result;
  }
}

module.exports = TransferService;
