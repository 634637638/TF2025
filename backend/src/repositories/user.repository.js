const BaseRepository = require('./base.repository');
const log = require('../utils/log');

/**
 * 用户Repository类
 * 处理用户相关的数据库操作
 */
class UserRepository extends BaseRepository {
  constructor() {
    super('users');
  }

  /**
   * 根据用户名查找用户
   * @param {string} username - 用户名
   * @returns {Promise} 用户信息
   */
  async findByUsername(username) {
    const sql = `
      SELECT
        u.id,
        u.username,
        u.password,
        u.name,
        u.phone,
        u.email,
        u.status,
        u.created_at,
        u.updated_at,
        GROUP_CONCAT(r.name SEPARATOR ',') as role
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      WHERE u.username = ? AND u.status != 0
      GROUP BY u.id
    `;
    const results = await this.executeQuery(sql, [username]);
    return results.length > 0 ? results[0] : null;
  }

  /**
   * 根据用户名查找用户（包含详细信息）
   * @param {string} username - 用户名
   * @returns {Promise} 用户详细信息
   */
  async findUserDetailsByUsername(username) {
    const sql = `
      SELECT u.*, '默认店铺' as store_name
      FROM users u
      WHERE u.username = ? AND u.status != 'deleted'
    `;
    const results = await this.executeQuery(sql, [username]);
    return results.length > 0 ? results[0] : null;
  }

  /**
   * 根据ID查找用户详细信息
   * @param {number} id - 用户ID
   * @returns {Promise} 用户详细信息
   */
  async findUserDetailsById(id) {
    // 首先获取用户基本信息
    const userSql = `
      SELECT u.*, '默认店铺' as store_name
      FROM users u
      WHERE u.id = ? AND u.status != 'deleted'
    `;
    const userResults = await this.executeQuery(userSql, [id]);

    if (userResults.length === 0) {
      return null;
    }

    const user = userResults[0];

    // 获取用户角色信息
    const roleSql = `
      SELECT r.name as role_name
      FROM roles r
      INNER JOIN user_roles ur ON r.id = ur.role_id
      WHERE ur.user_id = ?
    `;
    const roleResults = await this.executeQuery(roleSql, [id]);

    // 将角色信息添加到用户对象
    user.roles = roleResults.map(row => row.role_name);

    return user;
  }

  /**
   * 获取用户列表（分页）
   * @param {number} page - 页码
   * @param {number} limit - 每页数量
   * @param {Object} filters - 过滤条件
   * @returns {Promise} 用户列表
   */
  async getUsersWithPagination(page = 1, limit = 10, filters = {}) {
    const {
      role = null,
      status = '1',  // Use '1' for active based on table structure
      search = null
    } = filters;

    let whereConditions = [];
    let params = [];
    let roleJoin = '';

    if (role) {
      whereConditions.push('r.name = ?');
      params.push(role);
      roleJoin = `
        INNER JOIN user_roles ur ON u.id = ur.user_id
        INNER JOIN roles r ON ur.role_id = r.id
      `;
    }

    if (status) {
      whereConditions.push('u.status = ?');
      params.push(status);
    }

    if (search) {
      whereConditions.push('(u.username LIKE ? OR u.name LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // 查询数据
    const dataSql = `
      SELECT DISTINCT u.id, u.username, u.status, u.created_at, u.updated_at,
             u.name, u.phone, u.email,
             GROUP_CONCAT(r.name SEPARATOR ', ') as roles,
             GROUP_CONCAT(COALESCE(r.code, CONCAT('role_', r.id)) SEPARATOR ', ') as role_codes
      FROM users u
      ${roleJoin}
      LEFT JOIN user_roles ur2 ON u.id = ur2.user_id
      LEFT JOIN roles r ON ur2.role_id = r.id
      ${whereClause}
      GROUP BY u.id
      ORDER BY u.created_at DESC
      LIMIT ${limit} OFFSET ${(page - 1) * limit}
    `;

    // 查询总数
    const countSql = `
      SELECT COUNT(DISTINCT u.id) as total
      FROM users u
      ${roleJoin}
      ${whereClause}
    `;

    try {
      const [data, countResult] = await Promise.all([
        this.executeQuery(dataSql, params),
        this.executeQuery(countSql, params)
      ]);

      const total = countResult[0].total;
      const totalPages = Math.ceil(total / limit);

      return {
        data,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      };
    } catch (error) {
      log.error('分页查询用户失败:', error);
      throw error;
    }
  }

  /**
   * 创建用户
   * @param {Object} userData - 用户数据
   * @returns {Promise} 创建结果
   */
  async createUser(userData) {
    const { username, password, role, store_id, status = 'active' } = userData;

    // 检查用户名是否已存在
    const existingUser = await this.findByUsername(username);
    if (existingUser) {
      throw new Error('用户名已存在');
    }

    const sql = `
      INSERT INTO users (username, password, role, store_id, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, NOW(), NOW())
    `;

    try {
      const db = this.getConnection();
      const [result] = await db.execute(sql, [username, password, role, store_id, status]);
      return {
        id: result.insertId,
        affectedRows: result.affectedRows,
        data: { id: result.insertId, username, role, store_id, status }
      };
    } catch (error) {
      log.error('创建用户失败:', error);
      throw error;
    }
  }

  /**
   * 更新用户信息
   * @param {number} id - 用户ID
   * @param {Object} userData - 更新数据
   * @returns {Promise} 更新结果
   */
  async updateUser(id, userData) {
    const { username, password, role, store_id, status } = userData;
    const updates = [];
    const params = [];

    if (username !== undefined) {
      // 检查新用户名是否已被其他用户使用
      const existingUser = await this.executeQuery(
        'SELECT id FROM users WHERE username = ? AND id != ? AND status != "deleted"',
        [username, id]
      );
      if (existingUser.length > 0) {
        throw new Error('用户名已存在');
      }
      updates.push('username = ?');
      params.push(username);
    }

    if (password !== undefined) {
      updates.push('password = ?');
      params.push(password);
    }

    if (role !== undefined) {
      updates.push('role = ?');
      params.push(role);
    }

    if (store_id !== undefined) {
      updates.push('store_id = ?');
      params.push(store_id);
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

    const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;

    try {
      const db = this.getConnection();
      const [result] = await db.execute(sql, params);
      return {
        affectedRows: result.affectedRows,
        changedRows: result.changedRows,
        data: { id, ...userData }
      };
    } catch (error) {
      log.error('更新用户失败:', error);
      throw error;
    }
  }

  /**
   * 软删除用户
   * @param {number} id - 用户ID
   * @returns {Promise} 删除结果
   */
  async softDeleteUser(id) {
    const sql = 'UPDATE users SET status = "deleted", updated_at = NOW() WHERE id = ?';

    try {
      const db = this.getConnection();
      const [result] = await db.execute(sql, [id]);
      return {
        affectedRows: result.affectedRows,
        deletedId: id
      };
    } catch (error) {
      log.error('软删除用户失败:', error);
      throw error;
    }
  }

  /**
   * 根据角色获取用户
   * @param {string} role - 用户角色
   * @param {Object} options - 查询选项
   * @returns {Promise} 用户列表
   */
  async findByRole(role, options = {}) {
    const { store_id = null, status = 'active' } = options;

    let sql = `
      SELECT u.id, u.username, u.role, u.store_id, u.status, u.created_at,
             s.name as store_name
      FROM users u
      LEFT JOIN stores s ON u.store_id = s.id
      WHERE u.role = ? AND u.status = ?
    `;
    const params = [role, status];

    if (store_id) {
      sql += ' AND u.store_id = ?';
      params.push(store_id);
    }

    sql += ' ORDER BY u.created_at DESC';

    return await this.executeQuery(sql, params);
  }

  /**
   * 根据店铺ID获取用户
   * @param {number} storeId - 店铺ID
   * @param {Object} options - 查询选项
   * @returns {Promise} 用户列表
   */
  async findByStore(storeId, options = {}) {
    const { role = null, status = 'active' } = options;

    let sql = `
      SELECT u.id, u.username, u.role, u.store_id, u.status, u.created_at,
             s.name as store_name
      FROM users u
      LEFT JOIN stores s ON u.store_id = s.id
      WHERE u.store_id = ? AND u.status = ?
    `;
    const params = [storeId, status];

    if (role) {
      sql += ' AND u.role = ?';
      params.push(role);
    }

    sql += ' ORDER BY u.created_at DESC';

    return await this.executeQuery(sql, params);
  }

  /**
   * 获取用户统计信息
   * @param {Object} filters - 过滤条件
   * @returns {Promise} 统计信息
   */
  async getUserStats(filters = {}) {
    const { store_id = null } = filters;

    let sql = `
      SELECT
        COUNT(*) as total_users,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_users,
        COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive_users,
        COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_users,
        COUNT(CASE WHEN role = 'manager' THEN 1 END) as manager_users,
        COUNT(CASE WHEN role = 'employee' THEN 1 END) as employee_users
      FROM users
      WHERE status != 'deleted'
    `;
    const params = [];

    if (store_id) {
      sql += ' AND store_id = ?';
      params.push(store_id);
    }

    const result = await this.executeQuery(sql, params);
    return result[0];
  }

  /**
   * 获取用户列表（兼容性方法）
   * @param {Object} filters - 过滤条件
   * @param {Object} pagination - 分页参数
   * @returns {Promise} 用户列表
   */
  async getUsers(filters = {}, pagination = {}) {
    // 使用现有的 getUsersWithPagination 方法
    const { page = 1, limit = 10, offset = 0 } = pagination;
    const adjustedPage = Math.floor(offset / limit) + 1 || page;

    return await this.getUsersWithPagination(adjustedPage, limit, filters);
  }

  /**
   * 验证用户凭据
   * @param {string} username - 用户名
   * @param {string} password - 密码
   * @returns {Promise} 验证结果
   */
  async validateCredentials(username, password) {
    const sql = `
      SELECT id, username, password, role, store_id, status
      FROM users
      WHERE username = ? AND status = 1
    `;

    try {
      const result = await this.executeQuery(sql, [username]);
      if (result.length === 0) {
        return null;
      }

      const user = result[0];

      // 使用 bcryptjs 验证密码
      const bcrypt = require('bcryptjs');
      const isValid = await bcrypt.compare(password, user.password);

      if (!isValid) {
        return null;
      }

      // 返回用户信息（不包含密码）
      return {
        id: user.id,
        username: user.username,
        role: user.role,
        store_id: user.store_id,
        status: user.status
      };
    } catch (error) {
      log.error('验证用户凭据失败:', error);
      throw error;
    }
  }
}

module.exports = UserRepository;
