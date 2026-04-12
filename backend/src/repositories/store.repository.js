const BaseRepository = require('./base.repository');
const { LEGACY_USER_ROLE_SQL_LIST } = require('../services/accessControl.service');
const log = require('../utils/log');

/**
 * 商店Repository类
 * 处理商店相关的数据库操作
 */
class StoreRepository extends BaseRepository {
  constructor() {
    super('stores');
  }

  /**
   * 获取商店列表（分页和过滤）
   * @param {Object} filters - 过滤条件
   * @param {Object} options - 查询选项
   * @returns {Promise} 查询结果
   */
  async getStoresWithPagination(filters = {}, options = {}) {
    const {
      name = '',
      status = null,
      page = 1,
      limit = 10
    } = filters;

    const {
      select = 's.*, u.name as manager_name',
      join = 'LEFT JOIN users u ON s.manager_id = u.id',
      orderBy = 's.created_at DESC'
    } = options;

    // 构建WHERE条件
    const whereConditions = [];
    const params = [];

    if (name && name.trim()) {
      whereConditions.push('s.name LIKE ?');
      params.push(`%${name.trim()}%`);
    }

    if (status !== null && status !== undefined) {
      whereConditions.push('s.status = ?');
      params.push(parseInt(status, 10));
    }

    const whereClause = whereConditions.length > 0 ? whereConditions.join(' AND ') : '';

    // 分页参数
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const validLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));

    try {
      // 查询数据
      const dataSql = `
        SELECT ${select}
        FROM ${this.tableName} s
        ${join}
        ${whereClause ? `WHERE ${whereClause}` : ''}
        ORDER BY ${orderBy}
        LIMIT ${validLimit} OFFSET ${offset}
      `;

      // 查询总数
      const countSql = `
        SELECT COUNT(*) as total
        FROM ${this.tableName} s
        ${whereClause ? `WHERE ${whereClause}` : ''}
      `;

      const [data, countResult] = await Promise.all([
        this.executeQuery(dataSql, params),
        this.executeQuery(countSql, params)
      ]);

      const total = countResult[0].total;
      const totalPages = Math.ceil(total / validLimit);

      return {
        data,
        pagination: {
          page: parseInt(page, 10),
          limit: validLimit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      };
    } catch (error) {
      log.error('获取商店列表失败:', error);
      throw error;
    }
  }

  /**
   * 获取商店统计信息
   * @returns {Promise} 统计信息
   */
  async getStoreStats() {
    try {
      const sql = `
        SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN status = 1 THEN 1 END) as active,
          COUNT(CASE WHEN status = 0 THEN 1 END) as inactive,
          COUNT(CASE WHEN manager_id IS NOT NULL THEN 1 END) as with_manager,
          COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as recent
        FROM ${this.tableName}
      `;

      const result = await this.executeQuery(sql);
      return result[0];
    } catch (error) {
      log.error('获取商店统计信息失败:', error);
      throw error;
    }
  }

  /**
   * 获取可用管理员列表
   * @returns {Promise} 管理员列表
   */
  async getAvailableManagers() {
    try {
      const sql = `
        SELECT id, name, username
        FROM users
        WHERE status = 1 AND role IN (${LEGACY_USER_ROLE_SQL_LIST})
        ORDER BY name
      `;

      return await this.executeQuery(sql);
    } catch (error) {
      log.error('获取管理员列表失败:', error);
      throw error;
    }
  }

  /**
   * 根据ID获取商店详细信息
   * @param {number} id - 商店ID
   * @returns {Promise} 商店详细信息
   */
  async getStoreById(id) {
    try {
      const sql = `
        SELECT s.*, u.name as manager_name
        FROM ${this.tableName} s
        LEFT JOIN users u ON s.manager_id = u.id
        WHERE s.id = ?
      `;

      const result = await this.executeQuery(sql, [id]);
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      log.error('获取商店详情失败:', error);
      throw error;
    }
  }

  /**
   * 检查商店名称是否已存在
   * @param {string} name - 商店名称
   * @param {number} excludeId - 排除的商店ID（用于更新时检查）
   * @returns {Promise} 是否存在
   */
  async checkNameExists(name, excludeId = null) {
    try {
      let sql = `SELECT id FROM ${this.tableName} WHERE name = ?`;
      const params = [name];

      if (excludeId) {
        sql += ' AND id != ?';
        params.push(excludeId);
      }

      const result = await this.executeQuery(sql, params);
      return result.length > 0;
    } catch (error) {
      log.error('检查商店名称失败:', error);
      throw error;
    }
  }

  /**
   * 验证管理员是否存在
   * @param {number} managerId - 管理员ID
   * @returns {Promise} 是否存在
   */
  async validateManager(managerId) {
    try {
      const sql = `
        SELECT id, name
        FROM users
        WHERE id = ? AND status = 1 AND role IN (${LEGACY_USER_ROLE_SQL_LIST})
      `;

      const result = await this.executeQuery(sql, [managerId]);
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      log.error('验证管理员失败:', error);
      throw error;
    }
  }

  /**
   * 创建商店
   * @param {Object} storeData - 商店数据
   * @returns {Promise} 创建结果
   */
  async createStore(storeData) {
    const { name, location, manager_id, phone, status = 1 } = storeData;

    try {
      // 检查商店名称是否已存在
      if (await this.checkNameExists(name)) {
        throw new Error('商店名称已存在');
      }

      // 验证管理员
      if (manager_id && !(await this.validateManager(manager_id))) {
        throw new Error('指定的管理员不存在或状态无效');
      }

      const sql = `
        INSERT INTO ${this.tableName} (name, location, manager_id, phone, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, NOW(), NOW())
      `;

      const params = [name, location, manager_id, phone, status];
      const result = await this.executeQuery(sql, params);

      return {
        id: result.insertId,
        affectedRows: result.affectedRows,
        data: { id: result.insertId, ...storeData }
      };
    } catch (error) {
      log.error('创建商店失败:', error);
      throw error;
    }
  }

  /**
   * 更新商店信息
   * @param {number} id - 商店ID
   * @param {Object} storeData - 更新数据
   * @returns {Promise} 更新结果
   */
  async updateStore(id, storeData) {
    const { name, location, manager_id, phone, status } = storeData;

    try {
      // 验证商店是否存在
      const existingStore = await this.findById(id);
      if (!existingStore) {
        throw new Error('商店不存在');
      }

      // 检查商店名称是否已存在（排除自身）
      if (name && name !== existingStore.name && await this.checkNameExists(name, id)) {
        throw new Error('商店名称已存在');
      }

      // 验证管理员
      if (manager_id && !(await this.validateManager(manager_id))) {
        throw new Error('指定的管理员不存在或状态无效');
      }

      const updates = [];
      const params = [];

      if (name !== undefined) {
        updates.push('name = ?');
        params.push(name);
      }
      if (location !== undefined) {
        updates.push('location = ?');
        params.push(location);
      }
      if (manager_id !== undefined) {
        updates.push('manager_id = ?');
        params.push(manager_id);
      }
      if (phone !== undefined) {
        updates.push('phone = ?');
        params.push(phone);
      }
      if (status !== undefined) {
        updates.push('status = ?');
        params.push(status);
      }

      if (updates.length === 0) {
        throw new Error('没有要更新的字段');
      }

      updates.push('updated_at = NOW()');
      params.push(id);

      const sql = `
        UPDATE ${this.tableName}
        SET ${updates.join(', ')}
        WHERE id = ?
      `;

      const result = await this.executeQuery(sql, params);

      return {
        affectedRows: result.affectedRows,
        changedRows: result.changedRows,
        data: { id, ...storeData }
      };
    } catch (error) {
      log.error('更新商店失败:', error);
      throw error;
    }
  }

  /**
   * 删除商店
   * @param {number} id - 商店ID
   * @returns {Promise} 删除结果
   */
  async deleteStore(id) {
    try {
      // 验证商店是否存在
      const existingStore = await this.findById(id);
      if (!existingStore) {
        throw new Error('商店不存在');
      }

      // 检查关联数据
      const hasRelatedData = await this.checkRelatedData(id);
      if (hasRelatedData) {
        throw new Error('无法删除，该商店存在关联数据（配件、客户或用户）');
      }

      const sql = `DELETE FROM ${this.tableName} WHERE id = ?`;
      const result = await this.executeQuery(sql, [id]);

      return {
        affectedRows: result.affectedRows,
        deletedId: id
      };
    } catch (error) {
      log.error('删除商店失败:', error);
      throw error;
    }
  }

  /**
   * 检查商店是否有关联数据
   * @param {number} id - 商店ID
   * @returns {Promise} 是否有关联数据
   */
  async checkRelatedData(id) {
    try {
      // 检查配件、客户、用户关联
      const relatedChecks = [
        'SELECT COUNT(*) as count FROM accessories WHERE store_id = ?',
        'SELECT COUNT(*) as count FROM customers WHERE store_id = ?',
        'SELECT COUNT(*) as count FROM users WHERE store_id = ?'
      ];

      for (const checkSql of relatedChecks) {
        const result = await this.executeQuery(checkSql, [id]);
        if (result[0].count > 0) {
          return true;
        }
      }

      return false;
    } catch (error) {
      log.error('检查关联数据失败:', error);
      return true; // 出错时保守处理，认为有关联数据
    }
  }

  /**
   * 批量更新商店状态
   * @param {Array} ids - 商店ID数组
   * @param {number} status - 状态值
   * @returns {Promise} 更新结果
   */
  async batchUpdateStatus(ids, status) {
    try {
      if (!Array.isArray(ids) || ids.length === 0) {
        throw new Error('请提供要更新的商店ID列表');
      }

      if (status !== 0 && status !== 1) {
        throw new Error('状态值只能是0或1');
      }

      const placeholders = ids.map(() => '?').join(', ');
      const sql = `
        UPDATE ${this.tableName}
        SET status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id IN (${placeholders})
      `;

      const params = [status, ...ids];
      const result = await this.executeQuery(sql, params);

      return {
        affectedRows: result.affectedRows,
        updatedCount: result.affectedRows,
        ids
      };
    } catch (error) {
      log.error('批量更新状态失败:', error);
      throw error;
    }
  }

  /**
   * 根据管理员ID获取商店
   * @param {number} managerId - 管理员ID
   * @returns {Promise} 商店列表
   */
  async getStoresByManager(managerId) {
    try {
      const sql = `
        SELECT s.*, u.name as manager_name
        FROM ${this.tableName} s
        LEFT JOIN users u ON s.manager_id = u.id
        WHERE s.manager_id = ?
        ORDER BY s.created_at DESC
      `;

      return await this.executeQuery(sql, [managerId]);
    } catch (error) {
      log.error('根据管理员获取商店失败:', error);
      throw error;
    }
  }

  /**
   * 获取活跃商店列表
   * @returns {Promise} 活跃商店列表
   */
  async getActiveStores() {
    try {
      return await this.findBy({ status: 1 }, {
        select: 'id, name, location, manager_id, phone',
        orderBy: 'name ASC'
      });
    } catch (error) {
      log.error('获取活跃商店失败:', error);
      throw error;
    }
  }
}

module.exports = StoreRepository;
