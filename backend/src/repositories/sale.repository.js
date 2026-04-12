const BaseRepository = require('./base.repository');
const log = require('../utils/log');

const PHONE_STOCK_BASE_FIELDS = `
  id,
  imei,
  serial_number,
  is_new,
  purchase_cost,
  status,
  store_id,
  supplier_id,
  inventory_operator_id,
  created_at
`;

const withPhoneFallbacks = (phone) => ({
  ...phone,
  purchase_number: phone.purchase_number || `P${phone.id}`,
  supplier_name: phone.supplier_name || `供应商${phone.supplier_id || '未知'}`,
  store_name: phone.store_name || `店铺${phone.store_id || '未知'}`,
  inventory_operator_name: phone.inventory_operator_name || `操作员${phone.inventory_operator_id || '未知'}`,
  inbound_date: phone.inbound_date || phone.created_at,
  brand: phone.brand || '未知品牌',
  model: phone.model || '未知型号',
  cost: parseFloat(phone.purchase_price) || 0
});

class SaleRepository extends BaseRepository {
  constructor() {
    super('sales');
  }

  /**
   * 根据IMEI查找手机
   * @param {string} imei - IMEI号
   * @returns {Object} 手机信息
   */
  async findPhoneByImei(imei) {
    try {
      // 简化查询，先获取核心手机信息，避免复杂的JOIN操作
      const query = `
        SELECT
          ${PHONE_STOCK_BASE_FIELDS}
        FROM phones
        WHERE imei = ? AND status = 'in_stock'
        LIMIT 1
      `;
      const records = await this.executeQuery(query, [imei]); // 移除超时，使用默认查询
      return records[0] || null;
    } catch (error) {
      log.error('通过IMEI查找手机失败:', error);
      throw error;
    }
  }

  /**
   * 根据ID查找手机
   * @param {number} phoneId - 手机ID
   * @returns {Object} 手机信息
   */
  async findPhoneById(phoneId) {
    try {
      const query = `
        SELECT
          ${PHONE_STOCK_BASE_FIELDS}
        FROM phones
        WHERE id = ? AND status = 'in_stock'
        LIMIT 1
      `;
      const records = await this.executeQuery(query, [phoneId]);
      return records[0] || null;
    } catch (error) {
      log.error('通过ID查找手机失败:', error);
      throw error;
    }
  }

  /**
   * 根据序列号查找手机
   * @param {string} serialNumber - 序列号
   * @returns {Object} 手机信息
   */
  async findBySerialNumber(serialNumber) {
    try {
      const query = `
        SELECT
          ph.id,
          ph.imei,
          ph.serial_number,
          ph.is_new,
          ph.brand,
          ph.model,
          ph.color,
          ph.memory,
          ph.purchase_cost as purchase_price,
          ph.status,
          ph.quality_grade,
          ph.created_at,
          ph.updated_at,
          ph.store_id,
          ph.purchase_number,
          ph.supplier_id,
          ph.inventory_operator_id,
          s.name as supplier_name,
          st.name as store_name,
          inv_op.name as inventory_operator_name,
          ph.created_at as inbound_date
        FROM phones ph
        LEFT JOIN suppliers s ON ph.supplier_id = s.id
        LEFT JOIN stores st ON ph.store_id = st.id
        LEFT JOIN users inv_op ON ph.inventory_operator_id = inv_op.id
        WHERE ph.serial_number = ? AND ph.status = 'in_stock'
      `;
      const records = await this.executeQuery(query, [serialNumber]);
      return records[0] || null;
    } catch (error) {
      log.error('通过序列号查找手机失败:', error);
      throw error;
    }
  }

  /**
   * 获取可销售的手机列表
   * @param {Object} filters - 筛选条件
   * @returns {Array} 手机列表
   */
  async getAvailablePhones(filters = {}) {
    try {
      const {
        page = 1,
        limit = 50,
        search,
        store_id,
        operator_id,
        is_new
      } = filters;

      const offset = (page - 1) * limit;

      const whereConditions = ['ph.status = "in_stock"'];
      const queryParams = [];

      if (search && search.trim()) {
        whereConditions.push(`(
          ph.imei LIKE ? OR
          ph.serial_number LIKE ? OR
          ph.brand LIKE ? OR
          ph.model LIKE ? OR
          ph.purchase_number LIKE ?
        )`);
        const searchPattern = `%${search.trim()}%`;
        queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
      }

      if (filters.brand) {
        whereConditions.push('ph.brand = ?');
        queryParams.push(filters.brand);
      }

      if (filters.model) {
        whereConditions.push('ph.model = ?');
        queryParams.push(filters.model);
      }

      if (filters.color) {
        whereConditions.push('ph.color = ?');
        queryParams.push(filters.color);
      }

      if (filters.memory) {
        whereConditions.push('ph.memory = ?');
        queryParams.push(filters.memory);
      }

      if (store_id) {
        whereConditions.push('ph.store_id = ?');
        queryParams.push(store_id);
      }

      if (operator_id) {
        whereConditions.push('ph.inventory_operator_id = ?');
        queryParams.push(operator_id);
      }

      if (is_new !== undefined && is_new !== '') {
        whereConditions.push('ph.is_new = ?');
        queryParams.push(is_new === '1' ? 1 : 0);
      }

      const whereClause = whereConditions.join(' AND ');
      const limitVal = Number(limit);
      const offsetVal = Number(offset);

      const fullQuery = `
        SELECT
          ph.id,
          ph.imei,
          ph.serial_number,
          ph.is_new,
          ph.brand,
          ph.model,
          ph.color,
          ph.memory,
          ph.purchase_cost as purchase_price,
          ph.status,
          ph.quality_grade,
          ph.created_at,
          ph.updated_at,
          ph.store_id,
          ph.purchase_number,
          ph.supplier_id,
          ph.inventory_operator_id,
          s.name as supplier_name,
          st.name as store_name,
          inv_op.name as inventory_operator_name,
          ph.created_at as inbound_date
        FROM phones ph
        LEFT JOIN suppliers s ON ph.supplier_id = s.id
        LEFT JOIN stores st ON ph.store_id = st.id
        LEFT JOIN users inv_op ON ph.inventory_operator_id = inv_op.id
        WHERE ${whereClause}
        ORDER BY ph.created_at DESC
        LIMIT ${limitVal} OFFSET ${offsetVal}
      `;

      const records = await this.executeQuery(fullQuery, queryParams) || [];

      const countQuery = `
        SELECT COUNT(*) as total
        FROM phones ph
        WHERE ${whereClause}
      `;

      const countResult = await this.executeQuery(countQuery, queryParams);
      const total = countResult[0]?.total || 0;

      const processedRecords = records.map(withPhoneFallbacks);

      return {
        records: processedRecords,
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
      log.error('获取可销售手机列表失败:', error);
      throw error;
    }
  }

  /**
   * 更新手机状态为已售出
   * @param {number} phoneId - 手机ID
   * @param {number} saleId - 销售记录ID
   * @param {number} customerId - 客户ID (for logging purposes only)
   * @param {number} saleOperatorId - 销售操作员ID
   * @param {number} salePrice - 销售价格
   * @param {number} saleCost - 入库成本
   * @returns {boolean} 是否成功
   */
  async updatePhoneStatusToSold(phoneId, saleId, customerId, saleOperatorId = null, salePrice = null, saleCost = null) {
    try {
      // Note: customer_id and sold_at columns don't exist in phones table
      // Only update columns that actually exist in the schema
      const query = `
        UPDATE phones
        SET status = 'sold',
            sale_id = ?,
            sale_operator_id = ?,
            sale_price = ?,
            purchase_cost = ?,
            sale_date = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

      // Convert undefined values to null to prevent SQL binding errors
      const params = [
        saleId || null,
        saleOperatorId || null,
        salePrice !== null ? parseFloat(salePrice) : null,
        saleCost !== null ? parseFloat(saleCost) : null,
        phoneId
      ];

      const result = await this.executeQuery(query, params);
      return result.affectedRows > 0;
    } catch (error) {
      log.error('更新手机状态失败:', error);
      throw error;
    }
  }

  /**
   * 更新销售操作员信息
   * @param {number} phoneId - 手机ID
   * @param {number} saleOperatorId - 销售操作员ID
   * @returns {boolean} 是否成功
   */
  async updateSaleOperator(phoneId, saleOperatorId) {
    try {
      const query = `
        UPDATE phones
        SET sale_operator_id = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

      const result = await this.executeQuery(query, [saleOperatorId, phoneId]);
      return result.affectedRows > 0;
    } catch (error) {
      log.error('更新销售操作员失败:', error);
      throw error;
    }
  }

  /**
   * 获取可销售手机统计信息
   * @param {Object} filters - 筛选条件
   * @returns {Object} 统计信息
   */
  async getAvailablePhonesStats(filters = {}) {
    try {
      const { store_id, is_new } = filters;

      // 构建WHERE条件
      const whereConditions = ['status = "in_stock"'];
      const queryParams = [];

      if (store_id) {
        whereConditions.push('store_id = ?');
        queryParams.push(store_id);
      }

      if (is_new !== undefined && is_new !== '') {
        whereConditions.push('is_new = ?');
        queryParams.push(is_new === '1' ? 1 : 0);
      }

      const whereClause = whereConditions.join(' AND ');

      const query = `
        SELECT
          COUNT(*) as total_count,
          COUNT(DISTINCT brand) as brand_count,
          COUNT(DISTINCT model) as model_count,
          SUM(CASE WHEN is_new = 1 THEN 1 ELSE 0 END) as new_count,
          SUM(CASE WHEN is_new = 0 THEN 1 ELSE 0 END) as used_count,
          AVG(purchase_cost) as avg_cost
        FROM phones
        WHERE ${whereClause}
      `;

      const results = await this.executeQuery(query, queryParams);
      return results[0] || {};
    } catch (error) {
      log.error('获取可销售手机统计失败:', error);
      throw error;
    }
  }

  /**
   * 根据ID检查手机是否可销售
   * @param {number} phoneId - 手机ID
   * @returns {Object} 手机信息或null
   */
  async checkPhoneAvailability(phoneId) {
    try {
      const query = `
        SELECT ${PHONE_STOCK_BASE_FIELDS.replace('purchase_cost,', 'purchase_cost as purchase_price,')}, status
        FROM phones
        WHERE id = ? AND status = 'in_stock'
      `;

      const records = await this.executeQuery(query, [phoneId]);
      return records[0] || null;
    } catch (error) {
      log.error('检查手机可销售性失败:', error);
      throw error;
    }
  }

  /**
   * 创建销售记录
   * @param {Object} saleData - 销售数据
   * @returns {number} 销售记录ID
   */
  async createSale(saleData) {
    try {
      const query = `
        INSERT INTO sales (
          phone_id, customer_id, sale_type, price, operator_id, store_id,
          payment_method, invoice_number, sale_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      // Convert undefined values to null to prevent SQL binding errors
      const params = [
        saleData.phone_id,
        saleData.customer_id,
        saleData.sale_type,
        saleData.price,
        saleData.operator_id,
        saleData.store_id || null,
        saleData.payment_method || null,
        saleData.invoice_number || null,
        saleData.sale_date || new Date()
      ];

      // Use direct database connection for INSERT to get insertId
      const db = this.getConnection();
      const [result] = await db.execute(query, params);

      return result.insertId;
    } catch (error) {
      log.error('创建销售记录失败:', error);
      throw error;
    }
  }

  /**
   * 根据ID获取销售记录
   * @param {number} id - 销售记录ID
   * @returns {Object} 销售记录详情
   */
  async getSaleRecordById(id) {
    try {
      const query = `
        SELECT
          sr.id,
          sr.phone_id,
          sr.customer_id,
          sr.sale_type,
          sr.price,
          sr.operator_id,
          sr.store_id as sale_store_id,
          sr.payment_method,
          sr.invoice_number,
          sr.remarks,
          sr.sale_date,
          sr.created_at,
          sr.updated_at,
          c.name as customer_name,
          c.phone as customer_phone,
          c.apple_id as customer_apple_id,
          p.imei,
          p.serial_number,
          p.store_id as inventory_store_id,
          u.name as operator_name,
          ss.name as sale_store_name,
          inv_s.name as inventory_store_name
        FROM sales sr
        LEFT JOIN customers c ON sr.customer_id = c.id
        LEFT JOIN phones p ON sr.phone_id = p.id
        LEFT JOIN users u ON sr.operator_id = u.id
        LEFT JOIN stores ss ON sr.store_id = ss.id
        LEFT JOIN stores inv_s ON p.store_id = inv_s.id
        WHERE sr.id = ?
      `;

      const records = await this.executeQuery(query, [id]);
      return records[0] || null;
    } catch (error) {
      log.error('获取销售记录失败:', error);
      throw error;
    }
  }

  /**
   * 获取销售统计信息
   * @param {Object} filters - 筛选条件
   * @returns {Object} 统计信息
   */
  async getSaleStats(filters = {}) {
    try {
      const { start_date, end_date, store_id, operator_id } = filters;

      // 构建WHERE条件
      const whereConditions = ['1=1'];
      const queryParams = [];

      if (start_date) {
        whereConditions.push('DATE(sr.sale_date) >= ?');
        queryParams.push(start_date);
      }

      if (end_date) {
        whereConditions.push('DATE(sr.sale_date) <= ?');
        queryParams.push(end_date);
      }

      if (store_id) {
        whereConditions.push('p.store_id = ?');
        queryParams.push(store_id);
      }

      if (operator_id) {
        whereConditions.push('sr.operator_id = ?');
        queryParams.push(operator_id);
      }

      const whereClause = whereConditions.join(' AND ');

      const query = `
        SELECT
          COUNT(*) as total_sales,
          SUM(sr.price) as total_revenue,
          SUM(sr.cost) as total_cost,
                    AVG(sr.price) as avg_price,
                    COUNT(DISTINCT sr.customer_id) as unique_customers,
          COUNT(DISTINCT sr.operator_id) as active_operators,
          COUNT(CASE WHEN sr.sale_type = 'retail' THEN 1 END) as retail_sales,
          COUNT(CASE WHEN sr.sale_type = 'wholesale' THEN 1 END) as wholesale_sales,
          COUNT(CASE WHEN p.is_new = 1 THEN 1 END) as new_phone_sales,
          COUNT(CASE WHEN p.is_new = 0 THEN 1 END) as used_phone_sales
        FROM sales sr
        LEFT JOIN phones p ON sr.phone_id = p.id
        WHERE ${whereClause}
      `;

      const results = await this.executeQuery(query, queryParams);
      return results[0] || {};
    } catch (error) {
      log.error('获取销售统计失败:', error);
      throw error;
    }
  }

  /**
   * 获取销售记录
   * @param {Object} filters - 筛选条件
   * @returns {Object} 销售记录和分页信息
   */
  async getSaleRecords(filters = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        start_date,
        end_date,
        store_id,
        operator_id,
        customer_id,
        search
      } = filters;

      const offset = (page - 1) * limit;

      // 构建WHERE条件
      const whereConditions = ['1=1'];
      const queryParams = [];

      if (start_date) {
        whereConditions.push('DATE(sr.sale_date) >= ?');
        queryParams.push(start_date);
      }

      if (end_date) {
        whereConditions.push('DATE(sr.sale_date) <= ?');
        queryParams.push(end_date);
      }

      if (store_id) {
        whereConditions.push('p.store_id = ?');
        queryParams.push(store_id);
      }

      if (operator_id) {
        whereConditions.push('sr.operator_id = ?');
        queryParams.push(operator_id);
      }

      if (customer_id) {
        whereConditions.push('sr.customer_id = ?');
        queryParams.push(customer_id);
      }

      // 搜索：支持客户姓名、手机号、IMEI、品牌、型号
      if (search && search.trim()) {
        whereConditions.push(`(
          c.name LIKE ? OR
          c.phone LIKE ? OR
          p.imei LIKE ? OR
          p.brand LIKE ? OR
          p.model LIKE ? OR
          sr.invoice_number LIKE ?
        )`);
        const searchPattern = `%${search.trim()}%`;
        queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
      }

      const whereClause = whereConditions.join(' AND ');

      // 查询销售记录
      const query = `
        SELECT
          sr.id,
          sr.phone_id,
          sr.customer_id,
          sr.sale_type,
          sr.price,
          sr.operator_id,
          sr.payment_method,
          sr.invoice_number,
          sr.remarks,
          sr.sale_date,
          sr.created_at,
          c.name as customer_name,
          c.phone as customer_phone,
          c.apple_id as customer_apple_id,
          p.imei,
          p.serial_number,
          p.is_new,
          p.store_id,
          u.name as operator_name,
          s.name as store_name
        FROM sales sr
        LEFT JOIN customers c ON sr.customer_id = c.id
        LEFT JOIN phones p ON sr.phone_id = p.id
        LEFT JOIN users u ON sr.operator_id = u.id
        LEFT JOIN stores s ON p.store_id = s.id
        WHERE ${whereClause}
        ORDER BY sr.sale_date DESC, sr.created_at DESC
        LIMIT ? OFFSET ?
      `;

      const records = await this.executeQuery(query, [...queryParams, parseInt(limit), parseInt(offset)]);

      // 查询总数
      const countQuery = `
        SELECT COUNT(*) as total
        FROM sales sr
        LEFT JOIN customers c ON sr.customer_id = c.id
        LEFT JOIN phones p ON sr.phone_id = p.id
        WHERE ${whereClause}
      `;

      const countResult = await this.executeQuery(countQuery, queryParams);
      const total = (countResult && countResult[0]) ? countResult[0].total : 0;

      return {
        records,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(total),
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      log.error('获取销售记录失败:', error);
      throw error;
    }
  }

  /**
   * 获取手机统计信息
   * @param {Object} filters - 筛选条件
   * @returns {Object} 手机统计信息
   */
  async getPhoneStats(filters = {}) {
    try {
      const { store_id, operator_id } = filters;

      // 构建WHERE条件
      const whereConditions = ['1=1'];
      const queryParams = [];

      if (store_id) {
        whereConditions.push('store_id = ?');
        queryParams.push(store_id);
      }

      if (operator_id) {
        whereConditions.push('inventory_operator_id = ?');
        queryParams.push(operator_id);
      }

      const whereClause = whereConditions.join(' AND ');

      const query = `
        SELECT
          COUNT(*) as total_phones,
          COUNT(CASE WHEN status = 'in_stock' THEN 1 END) as in_stock_count,
          COUNT(CASE WHEN status = 'sold' THEN 1 END) as sold_count,
          COUNT(CASE WHEN status = 'reserved' THEN 1 END) as reserved_count,
          COUNT(CASE WHEN status = 'damaged' THEN 1 END) as damaged_count,
          COUNT(CASE WHEN is_new = 1 THEN 1 END) as new_count,
          COUNT(CASE WHEN is_new = 0 THEN 1 END) as used_count,
          SUM(CASE WHEN status = 'in_stock' THEN purchase_cost ELSE 0 END) as total_stock_value,
          AVG(CASE WHEN status = 'in_stock' THEN purchase_cost ELSE NULL END) as avg_stock_cost,
          COUNT(DISTINCT brand) as brand_count,
          COUNT(DISTINCT model) as model_count,
          COUNT(DISTINCT store_id) as store_count
        FROM phones
        WHERE ${whereClause}
      `;

      const results = await this.executeQuery(query, queryParams);
      return results[0] || {};
    } catch (error) {
      log.error('获取手机统计失败:', error);
      throw error;
    }
  }

  /**
   * 批量更新手机销售信息（优化版 - 避免 N+1 查询）
   * @param {Array} updates - 更新列表 [{phoneId, saleId, customerId, saleOperatorId}]
   * @returns {boolean} 是否成功
   */
  async batchUpdateSaleInfo(updates) {
    if (!updates || updates.length === 0) {
      return true;
    }

    const connection = await this.getConnection();

    try {
      await connection.beginTransaction();

      // Note: customer_id and sold_at columns don't exist in phones table
      // Keep batch update aligned with updatePhoneStatusToSold and current schema

      // 构建 sale_id 的 CASE 语句
      const saleIdCases = updates.map((u, i) => `WHEN ? THEN ?`).join(' ')
      const saleIdParams = updates.flatMap(u => [u.phoneId, u.saleId])

      // 构建 sale_operator_id 的 CASE 语句
      const saleOperatorIdCases = updates.map((u, i) => `WHEN ? THEN ?`).join(' ')
      const saleOperatorIdParams = updates.flatMap(u => [u.phoneId, u.saleOperatorId ?? null])

      // 获取所有需要更新的 phoneId
      const phoneIds = updates.map(u => u.phoneId)
      const phoneIdPlaceholders = phoneIds.map(() => '?').join(', ')

      const query = `
        UPDATE phones
        SET status = 'sold',
            sale_id = CASE id ${saleIdCases} END,
            sale_operator_id = CASE id ${saleOperatorIdCases} END,
            sale_date = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id IN (${phoneIdPlaceholders})
          AND status = 'in_stock'
      `

      // 合并所有参数
      const allParams = [
        ...saleIdParams,
        ...saleOperatorIdParams,
        ...phoneIds
      ]

      await connection.execute(query, allParams);

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      log.error('批量更新手机销售信息失败:', error);
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = SaleRepository;