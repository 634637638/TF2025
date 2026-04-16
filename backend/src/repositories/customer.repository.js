const BaseRepository = require('./base.repository');
const log = require('../utils/log');

class CustomerRepository extends BaseRepository {
  constructor() {
    super('customers');
  }

  /**
   * 创建客户
   * @param {Object} customerData - 客户数据
   * @returns {number} 新增记录的ID
   */
  async createCustomer(customerData) {
    try {
      const {
        name,
        phone,
        id_card,
        address,
        member_number,
        balance = 0,
        points = 0,
        wechat,
        qq,
        apple_id,
        status = 1,
        remarks
      } = customerData;

      // 确保所有undefined值转换为null
      const data = {
        name: name || null,
        phone: phone || null,
        id_card: id_card || null,
        address: address || null,
        member_number: member_number || null,
        balance: balance || 0,
        points: points || 0,
        wechat: wechat || null,
        qq: qq || null,
        apple_id: apple_id || null,
        status: status || 1,
        remarks: remarks || null
      };

      log.debug(`创建客户参数 [${this.tableName}]:`, data);

      // 使用BaseRepository的create方法
      const result = await this.create(data);

      log.info(`创建客户成功 [${this.tableName}]，ID: ${result.id}`);
      return result;
    } catch (error) {
      log.error('创建客户失败:', error);
      throw error;
    }
  }

  /**
   * 根据手机号查找客户
   * @param {string} phone - 手机号
   * @returns {Object|null} 客户信息
   */
  async findCustomerByPhone(phone) {
    try {
      log.debug(`开始查询客户 [${this.tableName}]，手机号: ${phone}`);

      // 使用BaseRepository的executeQuery方法
      const records = await this.executeQuery(
        `SELECT * FROM ${this.tableName} WHERE phone = ? AND status = 1`,
        [phone]
      );

      // 安全地访问 records.length
      const recordCount = (records && Array.isArray(records)) ? records.length : 0;
      log.info(`客户查询成功 [${this.tableName}]，找到 ${recordCount} 条记录`);

      if (recordCount > 0) {
        // 删除调试日志

      }

      return (recordCount > 0) ? records[0] : null;
    } catch (error) {
      log.error('根据手机号查找客户失败:', error);
      throw error;
    }
  }

  /**
   * 根据ID查找客户
   * @param {number} id - 客户ID
   * @returns {Object|null} 客户信息
   */
  async findCustomerById(id) {
    try {
      log.debug(`根据ID查找客户 [${this.tableName}]，ID: ${id}`);
      const query = `SELECT * FROM ${this.tableName} WHERE id = ? AND status = 1`;
      const records = await this.executeQuery(query, [id]);

      // 删除调试日志
      if (!records) {
        log.warn(`查询返回 null`);
        return null;
      }

      if (!Array.isArray(records)) {
        log.warn(`查询返回非数组结果:`, records);
        // 尝试将单个对象转换为数组
        return typeof records === 'object' ? records : null;
      }

      if (records.length === 0) {
        log.warn(`未找到客户，ID: ${id}`);
        return null;
      }

      // 删除调试日志
      return records[0];
    } catch (error) {
      log.error('根据ID查找客户失败:', error);
      throw error;
    }
  }

  /**
   * 获取客户列表
   * @param {Object} filters - 筛选条件
   * @returns {Object} 客户列表和分页信息
   */
  async getCustomers(filters = {}) {
    try {
      const {
        name,
        phone,
        page = 1,
        limit = 20
      } = filters;

      const offset = (page - 1) * limit;

      // 构建查询条件
      const conditions = ['status = 1'];
      const params = [];

      if (name) {
        conditions.push('name LIKE ?');
        params.push(`%${name}%`);
      }

      if (phone) {
        conditions.push('phone LIKE ?');
        params.push(`%${phone}%`);
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`;

      // 查询数据
      const query = `
        SELECT
          id, name, phone, id_card, address, member_number, balance, points,
          wechat, qq, apple_id, status, remarks, last_purchase_date, created_at
        FROM ${this.tableName}
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `;

      const dataParams = [...params, parseInt(limit), parseInt(offset)];
      const records = await this.executeQuery(query, dataParams);

      // 查询总数
      const countQuery = `
        SELECT COUNT(*) as total
        FROM ${this.tableName}
        ${whereClause}
      `;
      const [countResult] = await this.executeQuery(countQuery, params);
      const total = countResult.total;

      return {
        records,
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
      log.error('获取客户列表失败:', error);
      throw error;
    }
  }

  /**
   * 更新客户信息
   * @param {number} id - 客户ID
   * @param {Object} customerData - 更新数据
   * @returns {boolean} 是否成功
   */
  async updateCustomer(id, customerData) {
    try {
      const {
        name,
        phone,
        id_card,
        address,
        member_number,
        balance,
        points,
        wechat,
        qq,
        apple_id,
        status,
        remarks
      } = customerData;

      const query = `
        UPDATE ${this.tableName} SET
          name = ?, phone = ?, id_card = ?, address = ?, member_number = ?,
          balance = ?, points = ?, wechat = ?, qq = ?, apple_id = ?,
          status = ?, remarks = ?, updated_at = NOW()
        WHERE id = ?
      `;

      const params = [
        name, phone, id_card, address, member_number,
        balance, points, wechat, qq, apple_id,
        status, remarks, id
      ];

      const result = await this.executeQuery(query, params);
      return result.affectedRows > 0;
    } catch (error) {
      log.error('更新客户信息失败:', error);
      throw error;
    }
  }

  /**
   * 删除客户（软删除）
   * @param {number} id - 客户ID
   * @returns {boolean} 是否成功
   */
  async deleteCustomer(id) {
    try {
      const query = `UPDATE ${this.tableName} SET status = 0, updated_at = NOW() WHERE id = ?`;
      const result = await this.executeQuery(query, [id]);
      return result.affectedRows > 0;
    } catch (error) {
      log.error('删除客户失败:', error);
      throw error;
    }
  }

  /**
   * 更新客户积分
   * @param {number} id - 客户ID
   * @param {number} points - 积分变化量（增量，可正可负）
   * @returns {boolean} 是否成功
   */
  async updateCustomerPoints(id, points) {
    try {
      const query = `
        UPDATE ${this.tableName}
        SET points = points + ?, updated_at = NOW()
        WHERE id = ?
      `;
      const result = await this.executeQuery(query, [points, id]);
      return result.affectedRows > 0;
    } catch (error) {
      log.error('更新客户积分失败:', error);
      throw error;
    }
  }

  /**
   * 更新客户余额
   * @param {number} id - 客户ID
   * @param {number} balance - 新余额（绝对值）
   * @returns {boolean} 是否成功
   */
  async updateCustomerBalance(id, balance) {
    try {
      const query = `
        UPDATE ${this.tableName}
        SET balance = ?, updated_at = NOW()
        WHERE id = ?
      `;
      const result = await this.executeQuery(query, [balance, id]);
      return result.affectedRows > 0;
    } catch (error) {
      log.error('更新客户余额失败:', error);
      throw error;
    }
  }

  /**
   * 更新客户Apple ID
   * @param {number} id - 客户ID
   * @param {string} appleId - Apple ID
   * @returns {boolean} 是否成功
   */
  async updateCustomerAppleId(id, appleId) {
    try {
      const query = `
        UPDATE ${this.tableName}
        SET apple_id = ?, updated_at = NOW()
        WHERE id = ?
      `;
      const result = await this.executeQuery(query, [appleId, id]);
      return result.affectedRows > 0;
    } catch (error) {
      log.error('更新客户Apple ID失败:', error);
      throw error;
    }
  }

  /**
   * 根据手机号查找客户（别名方法，保持兼容性）
   * @param {string} phone - 手机号
   * @returns {Object|null} 客户信息
   */
  async findByPhone(phone) {
    return await this.findCustomerByPhone(phone);
  }

  /**
   * 搜索客户（用于模糊搜索）
   * @param {Object} options - 搜索选项
   * @returns {Object} 搜索结果
   */
  async searchCustomers(options = {}) {
    try {
      const { search, limit = 10 } = options;

      if (!search || search.trim().length < 2) {
        return { records: [] };
      }

      const query = `
        SELECT
          id, name, phone, id_card, address, member_number, balance, points,
          wechat, qq, apple_id, status, created_at, customer_type, vip_level,
          gender, city, province, birthday, email
        FROM ${this.tableName}
        WHERE status = 1 AND (
          name LIKE ? OR
          phone LIKE ? OR
          id_card LIKE ? OR
          email LIKE ? OR
          address LIKE ?
        )
        ORDER BY created_at DESC
        LIMIT ?
      `;

      const searchPattern = `%${search.trim()}%`;
      const records = await this.executeQuery(query, [
        searchPattern, searchPattern, searchPattern, searchPattern, searchPattern,
        parseInt(limit)
      ]);

      return { records: records || [] };
    } catch (error) {
      log.error('搜索客户失败:', error);
      throw error;
    }
  }

  /**
   * 使用选项获取客户列表（支持更多筛选条件）
   * @param {Object} options - 查询选项
   * @param {Object} filters - 筛选条件
   * @returns {Object} 客户列表和分页信息
   */
  async getCustomersWithOptions(options = {}, filters = {}) {
    try {
      const {
        page = 1,
        limit = 10
      } = options;

      const {
        customer_type,
        vip_level,
        gender,
        city,
        province,
        status,
        search
      } = filters;

      const offset = (parseInt(page) - 1) * parseInt(limit);

      // 构建查询条件
      const conditions = [];
      const params = [];

      // 默认只显示有效客户，除非明确指定了状态
      if (status !== undefined && status !== '' && status !== null) {
        conditions.push('status = ?');
        params.push(parseInt(status) === 0 ? 0 : 1); // 确保只有 0 或 1 两个值
      } else {
        conditions.push('status = ?');
        params.push(1);
      }

      if (customer_type) {
        conditions.push('customer_type = ?');
        params.push(customer_type);
      }

      if (vip_level) {
        conditions.push('vip_level = ?');
        params.push(vip_level);
      }

      if (gender) {
        conditions.push('gender = ?');
        params.push(gender);
      }

      if (city) {
        conditions.push('city LIKE ?');
        params.push(`%${city}%`);
      }

      if (province) {
        conditions.push('province LIKE ?');
        params.push(`%${province}%`);
      }

      if (search) {
        conditions.push('(name LIKE ? OR phone LIKE ? OR email LIKE ? OR id_card LIKE ?)');
        const searchPattern = `%${search}%`;
        params.push(searchPattern, searchPattern, searchPattern, searchPattern);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // 查询数据 - 简化和修复查询逻辑
      const finalLimit = parseInt(limit) || 10;
      const finalOffset = parseInt(offset) || 0;

      let query = `
        SELECT
          id, name, phone, email, customer_type, vip_level, gender, birthday,
          city, province, balance, points, wechat, qq, apple_id, member_number,
          id_card, address, status, remarks, blacklist, total_spent, last_purchase_date,
          register_date, created_at, updated_at
        FROM ${this.tableName}
        WHERE status = 1
        ORDER BY id DESC
        LIMIT ? OFFSET ?
      `;

      log.debug('客户查询调试信息:');
      log.debug('  query:', query);
      log.debug('  limit:', finalLimit, 'offset:', finalOffset);

      let records;
      try {
        // 使用参数化查询确保安全性
        records = await this.executeQuery(query, [finalLimit, finalOffset]);
        // 确保 records 是数组
        if (!Array.isArray(records)) {
          log.warn('查询返回非数组结果，转换为数组:', records);
          records = records ? [records] : [];
        }
        log.success('客户查询成功，记录数:', records.length);
      } catch (error) {
        log.fail('查询失败，尝试简化查询:', error.message);

        // 备用方案：简化查询
        const simpleQuery = `
          SELECT id, name, phone, email, customer_type, vip_level, gender, birthday,
                 city, province, balance, points, wechat, qq, apple_id, member_number,
                 id_card, address, status, remarks, blacklist, total_spent, last_purchase_date,
                 register_date, created_at, updated_at
          FROM ${this.tableName}
          WHERE status = 1
          ORDER BY id DESC
          LIMIT ? OFFSET ?
        `;

        records = await this.executeQuery(simpleQuery, [finalLimit, finalOffset]);
        // 确保 records 是数组
        if (!Array.isArray(records)) {
          log.warn('简化查询返回非数组结果，转换为数组:', records);
          records = records ? [records] : [];
        }
        log.success('简化查询成功，记录数:', records.length);
      }

      // 查询总数
      const countQuery = `
        SELECT COUNT(*) as total
        FROM ${this.tableName}
        ${whereClause}
      `;
      const [countResult] = await this.executeQuery(countQuery, params);
      const total = countResult.total;

      return {
        records: records || [],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      log.error('获取客户列表失败:', error);
      throw error;
    }
  }
}

module.exports = CustomerRepository;
