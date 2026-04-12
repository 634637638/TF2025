const { getDatabase, isConnected } = require('../config/database');
const log = require('../utils/log');

/**
 * 用户-门店关联 Repository
 * 处理用户和门店的多对多关联关系
 */
class UserStoreRepository {
  constructor() {
    this.tableName = 'user_stores';
  }

  /**
   * 获取用户关联的所有门店
   * @param {number} userId - 用户ID
   * @returns {Promise<Array>} 门店列表
   */
  async getUserStores(userId) {
    try {
      if (!isConnected()) {
        throw new Error('数据库未连接');
      }

      const pool = getDatabase();
      const [rows] = await pool.execute(`
        SELECT
          us.id,
          us.user_id,
          us.store_id,
          us.is_primary,
          us.assigned_at,
          s.name as store_name,
          s.location as store_address,
          s.phone as store_phone,
          s.manager_id,
          u.name as manager_name
        FROM ${this.tableName} us
        INNER JOIN stores s ON us.store_id = s.id
        LEFT JOIN users u ON s.manager_id = u.id
        WHERE us.user_id = ?
        ORDER BY us.is_primary DESC, us.assigned_at DESC
      `, [userId]);

      return rows;
    } catch (error) {
      log.error('获取用户门店列表失败:', error);
      throw error;
    }
  }

  /**
   * 获取门店关联的所有用户
   * @param {number} storeId - 门店ID
   * @returns {Promise<Array>} 用户列表
   */
  async getStoreUsers(storeId) {
    try {
      if (!isConnected()) {
        throw new Error('数据库未连接');
      }

      const pool = getDatabase();
      const [rows] = await pool.execute(`
        SELECT
          us.id,
          us.user_id,
          us.store_id,
          us.is_primary,
          us.assigned_at,
          u.username,
          u.name as user_name,
          u.role,
          u.phone as user_phone
        FROM ${this.tableName} us
        INNER JOIN users u ON us.user_id = u.id
        WHERE us.store_id = ?
        ORDER BY us.is_primary DESC, u.username ASC
      `, [storeId]);

      return rows;
    } catch (error) {
      log.error('获取门店用户列表失败:', error);
      throw error;
    }
  }

  /**
   * 为用户关联门店（支持批量）
   * @param {number} userId - 用户ID
   * @param {Array<number>|number} storeIds - 门店ID或门店ID数组
   * @param {number} assignedBy - 分配人ID
   * @param {number} isPrimary - 是否为主门店
   * @returns {Promise<Object>} 关联结果
   */
  async assignStoresToUser(userId, storeIds, assignedBy, isPrimary = 0) {
    try {
      if (!isConnected()) {
        throw new Error('数据库未连接');
      }

      const pool = getDatabase();

      // 转换为数组
      const storeIdArray = Array.isArray(storeIds) ? storeIds : [storeIds];

      // 删除用户现有的所有门店关联（如果要完全替换）
      // await pool.execute('DELETE FROM user_stores WHERE user_id = ?', [userId]);

      // 批量插入新的关联
      const values = storeIdArray.map(storeId => [userId, storeId, isPrimary, assignedBy]);
      const placeholders = values.map(() => '(?, ?, ?, ?)').join(', ');
      const flatValues = values.flat();

      await pool.execute(`
        INSERT IGNORE INTO ${this.tableName}
        (user_id, store_id, is_primary, assigned_by)
        VALUES ${placeholders}
      `, flatValues);

      return {
        success: true,
        message: `成功为用户关联 ${storeIdArray.length} 个门店`
      };
    } catch (error) {
      log.error('关联用户门店失败:', error);
      throw error;
    }
  }

  /**
   * 为门店关联用户（支持批量）
   * @param {number} storeId - 门店ID
   * @param {Array<number>|number} userIds - 用户ID或用户ID数组
   * @param {number} assignedBy - 分配人ID
   * @param {number} isPrimary - 是否为主门店
   * @returns {Promise<Object>} 关联结果
   */
  async assignUsersToStore(storeId, userIds, assignedBy, isPrimary = 0) {
    try {
      if (!isConnected()) {
        throw new Error('数据库未连接');
      }

      const pool = getDatabase();

      // 转换为数组
      const userIdArray = Array.isArray(userIds) ? userIds : [userIds];

      // 批量插入新的关联
      const values = userIdArray.map(userId => [userId, storeId, isPrimary, assignedBy]);
      const placeholders = values.map(() => '(?, ?, ?, ?)').join(', ');
      const flatValues = values.flat();

      await pool.execute(`
        INSERT IGNORE INTO ${this.tableName}
        (user_id, store_id, is_primary, assigned_by)
        VALUES ${placeholders}
      `, flatValues);

      return {
        success: true,
        message: `成功为门店关联 ${userIdArray.length} 个用户`
      };
    } catch (error) {
      log.error('关联门店用户失败:', error);
      throw error;
    }
  }

  /**
   * 移除用户的门店关联
   * @param {number} userId - 用户ID
   * @param {number} storeId - 门店ID
   * @returns {Promise<Object>} 移除结果
   */
  async removeUserStore(userId, storeId) {
    try {
      if (!isConnected()) {
        throw new Error('数据库未连接');
      }

      const pool = getDatabase();
      await pool.execute(
        'DELETE FROM user_stores WHERE user_id = ? AND store_id = ?',
        [userId, storeId]
      );

      return {
        success: true,
        message: '成功移除用户门店关联'
      };
    } catch (error) {
      log.error('移除用户门店关联失败:', error);
      throw error;
    }
  }

  /**
   * 移除用户的所有门店关联
   * @param {number} userId - 用户ID
   * @returns {Promise<Object>} 移除结果
   */
  async removeAllUserStores(userId) {
    try {
      if (!isConnected()) {
        throw new Error('数据库未连接');
      }

      const pool = getDatabase();
      const [result] = await pool.execute(
        'DELETE FROM user_stores WHERE user_id = ?',
        [userId]
      );

      return {
        success: true,
        message: `成功移除用户的 ${result.affectedRows} 个门店关联`,
        affectedRows: result.affectedRows
      };
    } catch (error) {
      log.error('移除用户所有门店关联失败:', error);
      throw error;
    }
  }

  /**
   * 设置用户的主门店
   * @param {number} userId - 用户ID
   * @param {number} storeId - 门店ID
   * @returns {Promise<Object>} 设置结果
   */
  async setPrimaryStore(userId, storeId) {
    try {
      if (!isConnected()) {
        throw new Error('数据库未连接');
      }

      const pool = getDatabase();

      // 先取消该用户的所有主门店标记
      await pool.execute(
        'UPDATE user_stores SET is_primary = 0 WHERE user_id = ?',
        [userId]
      );

      // 检查用户是否已关联该门店
      const [existing] = await pool.execute(
        'SELECT id FROM user_stores WHERE user_id = ? AND store_id = ?',
        [userId, storeId]
      );

      if (existing.length === 0) {
        // 如果未关联，先创建关联
        await pool.execute(
          'INSERT INTO user_stores (user_id, store_id, is_primary) VALUES (?, ?, 1)',
          [userId, storeId]
        );
      } else {
        // 如果已关联，更新为主门店
        await pool.execute(
          'UPDATE user_stores SET is_primary = 1 WHERE user_id = ? AND store_id = ?',
          [userId, storeId]
        );
      }

      return {
        success: true,
        message: '成功设置用户的主门店'
      };
    } catch (error) {
      log.error('设置用户主门店失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户的主门店
   * @param {number} userId - 用户ID
   * @returns {Promise<Object|null>} 主门店信息
   */
  async getUserPrimaryStore(userId) {
    try {
      if (!isConnected()) {
        throw new Error('数据库未连接');
      }

      const pool = getDatabase();
      const [rows] = await pool.execute(`
        SELECT
          s.id,
          s.name,
          s.location as address,
          s.phone,
          s.manager_id,
          u.name as manager_name
        FROM ${this.tableName} us
        INNER JOIN stores s ON us.store_id = s.id
        LEFT JOIN users u ON s.manager_id = u.id
        WHERE us.user_id = ? AND us.is_primary = 1
        LIMIT 1
      `, [userId]);

      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      log.error('获取用户主门店失败:', error);
      throw error;
    }
  }

  /**
   * 检查用户是否有关联门店
   * @param {number} userId - 用户ID
   * @returns {Promise<boolean>} 是否有关联门店
   */
  async hasUserStores(userId) {
    try {
      const stores = await this.getUserStores(userId);
      return stores.length > 0;
    } catch (error) {
      log.error('检查用户门店关联失败:', error);
      return false;
    }
  }
}

module.exports = UserStoreRepository;
