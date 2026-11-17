const { withConnection } = require('../core/db/connection')
const { getDatabase } = require('../config/database')
const log = require('../utils/log')

/**
 * 用户-门店关联 Repository
 * 处理用户和门店的多对多关联关系
 */
class UserStoreRepository {
  constructor({ database = getDatabase } = {}) {
    this.database = database
    this.tableName = 'user_stores'
  }

  findAuditUser(userId) {
    return this.database().execute('SELECT id, username, name FROM users WHERE id = ?', [userId])
  }

  /**
   * 获取用户关联的所有门店
   * @param {number} userId - 用户ID
   * @returns {Promise<Array>} 门店列表
   */
  async getUserStores(userId) {
    try {
      const pool = this.database()
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
      `, [userId])

      return rows
    } catch (error) {
      log.error('获取用户门店列表失败:', error)
      throw error
    }
  }

  /**
   * 获取门店关联的所有用户
   * @param {number} storeId - 门店ID
   * @returns {Promise<Array>} 用户列表
   */
  async getStoreUsers(storeId) {
    try {
      const pool = this.database()
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
      `, [storeId])

      return rows
    } catch (error) {
      log.error('获取门店用户列表失败:', error)
      throw error
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
  async withUserBindingTransaction(userId, operation) {
    return withConnection(this.database, async connection => {
      await connection.beginTransaction()
      try {
        const [users] = await connection.execute('SELECT id FROM users WHERE id = ? FOR UPDATE', [userId])
        if (!users.length) throw Object.assign(new Error('用户不存在'), { statusCode: 404 })
        const result = await operation(connection)
        await connection.commit()
        return result
      } catch (error) {
        await connection.rollback()
        throw error
      }
    })
  }

  async assignStoresToUser(userId, storeIds, assignedBy, isPrimary = 0, replaceExisting = false) {
    const ids = [...new Set(storeIds.map(Number))]
    if (!ids.length || ids.some(id => !Number.isSafeInteger(id) || id <= 0)) {
      throw Object.assign(new Error('门店编号无效'), { statusCode: 400 })
    }
    return this.withUserBindingTransaction(userId, async connection => {
      const [stores] = await connection.execute(
        `SELECT id FROM stores WHERE id IN (${ids.map(() => '?').join(',')}) AND status = 1 FOR UPDATE`, ids)
      if (stores.length !== ids.length) throw Object.assign(new Error('部分门店不存在或已停用'), { statusCode: 400 })
      if (replaceExisting) await connection.execute('DELETE FROM user_stores WHERE user_id = ?', [userId])
      if (isPrimary) await connection.execute('UPDATE user_stores SET is_primary = 0 WHERE user_id = ?', [userId])
      await connection.execute(`INSERT INTO user_stores (user_id, store_id, is_primary, assigned_by)
        VALUES ${ids.map(() => '(?, ?, ?, ?)').join(', ')}
        ON DUPLICATE KEY UPDATE is_primary = IF(VALUES(is_primary) = 1, 1, is_primary), assigned_by = VALUES(assigned_by)`,
      ids.flatMap((id, index) => [userId, id, isPrimary && index === 0 ? 1 : 0, assignedBy]))
      return { success: true, message: `成功为用户关联 ${ids.length} 个门店` }
    })
  }

  /**
   * 移除用户的门店关联
   * @param {number} userId - 用户ID
   * @param {number} storeId - 门店ID
   * @returns {Promise<Object>} 移除结果
   */
  async removeUserStore(userId, storeId) {
    try {
      await this.withUserBindingTransaction(userId, connection => connection.execute(
        'DELETE FROM user_stores WHERE user_id = ? AND store_id = ?', [userId, storeId]
      ))

      return {
        success: true,
        message: '成功移除用户门店关联'
      }
    } catch (error) {
      log.error('移除用户门店关联失败:', error)
      throw error
    }
  }

  /**
   * 移除用户的所有门店关联
   * @param {number} userId - 用户ID
   * @returns {Promise<Object>} 移除结果
   */
  async removeAllUserStores(userId) {
    try {
      const [result] = await this.withUserBindingTransaction(userId, connection => connection.execute(
        'DELETE FROM user_stores WHERE user_id = ?', [userId]
      ))

      return {
        success: true,
        message: `成功移除用户的 ${result.affectedRows} 个门店关联`,
        affectedRows: result.affectedRows
      }
    } catch (error) {
      log.error('移除用户所有门店关联失败:', error)
      throw error
    }
  }

  /**
   * 设置用户的主门店
   * @param {number} userId - 用户ID
   * @param {number} storeId - 门店ID
   * @returns {Promise<Object>} 设置结果
   */
  async setPrimaryStore(userId, storeId) {
    return this.withUserBindingTransaction(userId, async connection => {
      const [stores] = await connection.execute('SELECT id FROM stores WHERE id = ? AND status = 1 FOR UPDATE', [storeId])
      if (!stores.length) throw Object.assign(new Error('门店不存在或已停用'), { statusCode: 400 })
      await connection.execute('UPDATE user_stores SET is_primary = 0 WHERE user_id = ?', [userId])
      await connection.execute(`INSERT INTO user_stores (user_id,store_id,is_primary) VALUES (?,?,1)
        ON DUPLICATE KEY UPDATE is_primary = 1`, [userId, storeId])
      return { success: true, message: '成功设置用户的主门店' }
    })
  }

  /**
   * 获取用户的主门店
   * @param {number} userId - 用户ID
   * @returns {Promise<Object|null>} 主门店信息
   */
  async getUserPrimaryStore(userId) {
    try {
      const pool = this.database()
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
      `, [userId])

      return rows.length > 0 ? rows[0] : null
    } catch (error) {
      log.error('获取用户主门店失败:', error)
      throw error
    }
  }

  /**
   * 检查用户是否有关联门店
   * @param {number} userId - 用户ID
   * @returns {Promise<boolean>} 是否有关联门店
   */
  async hasUserStores(userId) {
    try {
      const stores = await this.getUserStores(userId)
      return stores.length > 0
    } catch (error) {
      log.error('检查用户门店关联失败:', error)
      return false
    }
  }
}

module.exports = UserStoreRepository
