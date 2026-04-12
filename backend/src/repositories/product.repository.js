/**
 * 产品数据访问层
 * 处理所有产品相关的数据库操作
 */
const BaseRepository = require('./base.repository');
const log = require('../utils/log');

class ProductRepository extends BaseRepository {
  constructor() {
    super('products');
  }

  /**
   * 获取型号列表
   */
  async getModels(filters = {}) {
    try {
      const { brandId } = filters;

      let query = `
        SELECT
          m.id,
          m.name,
          m.brand_id,
          b.name as brand_name,
          COUNT(DISTINCT ph.id) as phone_count
        FROM models m
        LEFT JOIN brands b ON m.brand_id = b.id
        LEFT JOIN phones ph ON m.name = ph.model AND ph.status = 1
      `;

      const conditions = [];
      const params = [];

      if (brandId) {
        conditions.push('m.brand_id = ?');
        params.push(brandId);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ' GROUP BY m.id ORDER BY b.name, m.name';
      const models = await this.executeQuery(query, params);
      return models;
    } catch (error) {
      log.error('获取型号列表失败:', error);
      throw error;
    }
  }

  /**
   * 获取颜色列表
   */
  async getColors() {
    try {
      const query = `
        SELECT
          c.id,
          c.name,
          COUNT(DISTINCT ph.id) as phone_count
        FROM colors c
        LEFT JOIN phones ph ON c.name = ph.color AND ph.status = 1
        GROUP BY c.id
        ORDER BY c.name
      `;
      const colors = await this.executeQuery(query);
      return colors;
    } catch (error) {
      log.error('获取颜色列表失败:', error);
      throw error;
    }
  }

  /**
   * 获取内存规格列表
   */
  async getMemories() {
    try {
      const query = `
        SELECT
          m.id,
          m.size as name,
          COUNT(DISTINCT ph.id) as phone_count
        FROM memories m
        LEFT JOIN phones ph ON m.size = ph.memory AND ph.status = 1
        GROUP BY m.id
        ORDER BY CAST(m.size AS UNSIGNED)
      `;
      const memories = await this.executeQuery(query);
      return memories;
    } catch (error) {
      log.error('获取内存规格列表失败:', error);
      throw error;
    }
  }

  /**
   * 获取在库手机列表
   */
  async getInStockPhones(filters = {}) {
    try {
      const {
        page = 1,
        limit = 50,
        supplier_id,
        store_id,
        is_new,
        search
      } = filters;

      const offset = (page - 1) * limit;

      let query = `
        SELECT
          ph.id,
          ph.brand,
          ph.model,
          ph.color,
          ph.memory,
          ph.serial_number,
          ph.imei,
          ph.purchase_unit_price,
          ph.price,
          ph.is_new,
          ph.supplier_id,
          ph.store_id,
          ph.status,
          ph.quality_grade,
          ph.warranty_period,
          ph.purchase_date,
          ph.remarks,
          ph.created_at,
          ph.updated_at,
          s.name as supplier_name,
          st.name as store_name
        FROM phones ph
        LEFT JOIN suppliers s ON ph.supplier_id = s.id
        LEFT JOIN stores st ON ph.store_id = st.id
        WHERE ph.status = 1
      `;

      const params = [];

      if (supplier_id) {
        query += ' AND ph.supplier_id = ?';
        params.push(parseInt(supplier_id));
      }

      if (store_id) {
        query += ' AND ph.store_id = ?';
        params.push(parseInt(store_id));
      }

      if (is_new !== undefined && is_new !== '') {
        query += ' AND ph.is_new = ?';
        params.push(parseInt(is_new));
      }

      if (search) {
        query += ' AND (ph.serial_number LIKE ? OR ph.imei LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
      }

      query += ' ORDER BY ph.created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const phones = await this.executeQuery(query, params);

      // 获取总数
      let countQuery = `
        SELECT COUNT(*) as total
        FROM phones ph
        WHERE ph.status = 1
      `;
      const countParams = [];

      if (supplier_id) {
        countQuery += ' AND ph.supplier_id = ?';
        countParams.push(parseInt(supplier_id));
      }

      if (store_id) {
        countQuery += ' AND ph.store_id = ?';
        countParams.push(parseInt(store_id));
      }

      if (is_new !== undefined && is_new !== '') {
        countQuery += ' AND ph.is_new = ?';
        countParams.push(parseInt(is_new));
      }

      if (search) {
        countQuery += ' AND (ph.serial_number LIKE ? OR ph.imei LIKE ?)';
        countParams.push(`%${search}%`, `%${search}%`);
      }

      const countResult = await this.executeQuery(countQuery, countParams);
      const total = countResult[0].total;

      return {
        phones,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      log.error('获取在库手机列表失败:', error);
      throw error;
    }
  }

  /**
   * 根据ID获取手机详情
   */
  async getPhoneById(id) {
    try {
      const query = `
        SELECT
          ph.*,
          s.name as supplier_name,
          s.contact as supplier_contact,
          s.phone as supplier_phone,
          st.name as store_name,
          st.location as store_location
        FROM phones ph
        LEFT JOIN suppliers s ON ph.supplier_id = s.id
        LEFT JOIN stores st ON ph.store_id = st.id
        WHERE ph.id = ?
      `;
      const phones = await this.executeQuery(query, [id]);
      return phones[0] || null;
    } catch (error) {
      log.error('获取手机详情失败:', error);
      throw error;
    }
  }

  /**
   * 更新手机信息
   */
  async updatePhone(id, phoneData) {
    const pool = require('../config/database').getDatabase();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const fields = [];
      const params = [];

      Object.keys(phoneData).forEach(key => {
        if (phoneData[key] !== undefined) {
          fields.push(`${key} = ?`);
          params.push(phoneData[key]);
        }
      });

      if (fields.length === 0) {
        await connection.rollback();
        connection.release();
        return false;
      }

      params.push(id);
      const query = `UPDATE phones SET ${fields.join(', ')} WHERE id = ?`;
      const result = await connection.query(query, params);

      // 🔥 处理客户信息更新（在事务中）
      if (phoneData.customer_phone) {
        log.debug('处理客户信息更新，手机号:', phoneData.customer_phone);

        // 获取当前销售记录信息
        const [salesRecords] = await connection.query(
          'SELECT id, customer_id FROM sales WHERE phone_id = ? ORDER BY created_at DESC LIMIT 1',
          [id]
        );

        if (salesRecords.length > 0) {
          const currentSale = salesRecords[0];
          const currentCustomerId = currentSale.customer_id;
          log.debug('当前销售记录 customer_id:', currentCustomerId);

          // 场景一：更换客户（手机号变化）或场景二：修正客户信息
          let finalCustomerId = currentCustomerId;

          // 1. 根据新手机号查找客户
          const [matchedCustomers] = await connection.query(
            'SELECT id, name, phone FROM customers WHERE phone = ?',
            [phoneData.customer_phone]
          );

          if (matchedCustomers.length > 0) {
            // 找到匹配的客户
            const matchedCustomer = matchedCustomers[0];
            log.debug('找到匹配客户:', matchedCustomer);

            if (matchedCustomer.id === currentCustomerId) {
              // 场景二：修正客户信息（同一个客户，手机号没变）
              // 检查是否需要更新客户姓名（如果前端传了 customer_name）
              if (phoneData.customer_name && phoneData.customer_name !== matchedCustomer.name) {
                await connection.query(
                  'UPDATE customers SET name = ?, updated_at = NOW() WHERE id = ?',
                  [phoneData.customer_name, matchedCustomer.id]
                );
                log.debug(`场景二：更新客户姓名，ID=${matchedCustomer.id}, 新姓名=${phoneData.customer_name}`);
              }
            } else {
              // 场景一：更换客户（手机号变化，找到了不同的客户）
              finalCustomerId = matchedCustomer.id;
              log.debug(`场景一：更换客户，从 ${currentCustomerId} 到 ${finalCustomerId}`);

              // 同步更新 sales 表的 customer_id
              await connection.query(
                'UPDATE sales SET customer_id = ? WHERE phone_id = ?',
                [finalCustomerId, id]
              );
              log.debug(`已更新 sales.customer_id 为 ${finalCustomerId}`);
            }
          } else {
            // 没找到匹配客户，创建新客户
            log.debug('未找到匹配客户，创建新客户');
            const [newCustomer] = await connection.query(
              'INSERT INTO customers (name, phone, created_at, updated_at) VALUES (?, ?, NOW(), NOW())',
              [phoneData.customer_name || null, phoneData.customer_phone]
            );
            finalCustomerId = newCustomer.insertId;
            log.debug(`创建新客户，ID=${finalCustomerId}`);

            // 场景一：更换客户（新客户）
            // 同步更新 sales 表的 customer_id
            await connection.query(
              'UPDATE sales SET customer_id = ? WHERE phone_id = ?',
              [finalCustomerId, id]
            );
            log.debug(`已更新 sales.customer_id 为新客户 ${finalCustomerId}`);
          }
        } else {
          log.debug('该手机没有销售记录，跳过客户信息处理');
        }
      }

      // 🔥 同步更新 sales 表的其他字段（价格、时间等）
      const [phoneInfo] = await connection.query(
        'SELECT id, sale_id, status FROM phones WHERE id = ?',
        [id]
      );

      log.debug('检查手机销售信息:', {
        phoneId: id,
        phoneInfo: phoneInfo,
        hasSaleId: phoneInfo && phoneInfo.length > 0 && phoneInfo[0].sale_id
      });

      log.debug('接收到的数据:', {
        sale_price: phoneData.sale_price,
        purchase_cost: phoneData.purchase_cost,
        purchase_price: phoneData.purchase_price,
        store_id: phoneData.store_id,
        salestime: phoneData.salestime,
        payment_method: phoneData.payment_method
      });

      if (phoneInfo && phoneInfo.length > 0 && phoneInfo[0].sale_id) {
        const saleId = phoneInfo[0].sale_id;
        const salesFields = [];
        const salesParams = [];

        // 同步销售时间
        if (phoneData.salestime || phoneData.sale_date) {
          const saleDate = phoneData.salestime || phoneData.sale_date;
          salesFields.push('sale_date = ?');
          salesParams.push(saleDate);
          log.debug(`同步 sales 表 sale_date: ${saleDate}`);
        }

        // 同步销售价格
        if (phoneData.sale_price !== undefined) {
          salesFields.push('price = ?');
          salesParams.push(parseFloat(phoneData.sale_price));
          log.debug(`同步 sales 表 price: ${phoneData.sale_price}`);
        }

        // 同步采购成本
        if (phoneData.purchase_cost !== undefined || phoneData.purchase_price !== undefined) {
          const cost = parseFloat(phoneData.purchase_cost || phoneData.purchase_price || 0);
          salesFields.push('cost = ?');
          salesParams.push(cost);
          log.debug(`同步 sales 表 cost: ${cost}`);
        }

        // 同步销售门店
        if (phoneData.store_id !== undefined) {
          salesFields.push('store_id = ?');
          salesParams.push(parseInt(phoneData.store_id));
          log.debug(`同步 sales 表 store_id: ${phoneData.store_id}`);
        }

        // 同步销售员
        if (phoneData.sale_operator_id !== undefined || phoneData.operator_id !== undefined) {
          const operatorId = parseInt(phoneData.sale_operator_id || phoneData.operator_id || 0);
          if (operatorId > 0) {
            salesFields.push('operator_id = ?');
            salesParams.push(operatorId);
            log.debug(`同步 sales 表 operator_id: ${operatorId}`);
          }
        }

        // 同步支付方式
        if (phoneData.payment_method !== undefined) {
          salesFields.push('payment_method = ?');
          salesParams.push(phoneData.payment_method);
          log.debug(`同步 sales 表 payment_method: ${phoneData.payment_method}`);
        }

        // 同步备注
        if (phoneData.remarks !== undefined) {
          salesFields.push('remarks = ?');
          salesParams.push(phoneData.remarks);
          log.debug(`同步 sales 表 remarks: ${phoneData.remarks}`);
        }

        // 如果有需要同步的字段，执行更新
        if (salesFields.length > 0) {
          salesParams.push(saleId);
          const salesQuery = `UPDATE sales SET ${salesFields.join(', ')} WHERE id = ?`;
          log.debug('执行同步SQL:', salesQuery);
          log.debug('同步参数:', salesParams);
          await connection.query(salesQuery, salesParams);
          log.debug(`成功同步 sales 表 ${salesFields.length} 个字段，sale_id: ${saleId}`);
        } else {
          log.debug('没有需要同步的字段');
        }
      } else if (phoneInfo && phoneInfo.length > 0 && !phoneInfo[0].sale_id) {
        log.debug(`手机 ${id} 没有关联的销售记录（在库状态），跳过 sales 表同步`);
      } else {
        log.warn(`无法获取手机 ${id} 的信息`);
      }

      await connection.commit();
      connection.release();

      return result.affectedRows > 0;
    } catch (error) {
      await connection.rollback();
      connection.release();
      log.error('更新手机信息失败:', error);
      throw error;
    }
  }

  /**
   * 删除手机记录
   */
  async deletePhone(id) {
    try {
      const query = 'DELETE FROM phones WHERE id = ?';
      const result = await this.executeQuery(query, [id]);
      return result.affectedRows > 0;
    } catch (error) {
      log.error('删除手机记录失败:', error);
      throw error;
    }
  }

  /**
   * 获取型号建议
   */
  async getModelSuggestions(keyword = '') {
    try {
      let query = `
        SELECT DISTINCT
          m.name,
          b.name as brand_name
        FROM models m
        LEFT JOIN brands b ON m.brand_id = b.id
      `;

      const params = [];

      if (keyword) {
        query += ' WHERE m.name LIKE ?';
        params.push(`%${keyword}%`);
      }

      query += ' ORDER BY m.name LIMIT 50';
      const suggestions = await this.executeQuery(query, params);
      return suggestions;
    } catch (error) {
      log.error('获取型号建议失败:', error);
      throw error;
    }
  }

  /**
   * 获取产品统计信息
   */
  async getProductStats() {
    try {
      const stats = {};

      // 手机统计
      const [phoneStats] = await this
        .executeQuery(`
          SELECT
            COUNT(*) as total_phones,
            COUNT(CASE WHEN is_new = 1 THEN 1 END) as new_phones,
            COUNT(CASE WHEN is_new = 0 THEN 1 END) as used_phones,
            SUM(purchase_unit_price) as total_cost,
            SUM(price) as total_value,
            COUNT(CASE WHEN status = 1 THEN 1 END) as in_stock
          FROM phones
        `);

      stats.phones = phoneStats;

      // 型号统计
      const modelStats = await this.executeQuery(
        'SELECT COUNT(*) as total_models FROM models'
      );
      stats.total_models = modelStats[0].total_models;

      // 颜色统计
      const colorStats = await this.executeQuery(
        'SELECT COUNT(*) as total_colors FROM colors'
      );
      stats.total_colors = colorStats[0].total_colors;

      // 内存规格统计
      const memoryStats = await this.executeQuery(
        'SELECT COUNT(*) as total_memories FROM memories'
      );
      stats.total_memories = memoryStats[0].total_memories;

      return stats;
    } catch (error) {
      log.error('获取产品统计信息失败:', error);
      throw error;
    }
  }
}

module.exports = ProductRepository;
