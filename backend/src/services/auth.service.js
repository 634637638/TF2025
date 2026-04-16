const BaseService = require('./base.service');
const UserRepository = require('../repositories/user.repository');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDatabase } = require('../config/database');
const { hasGlobalAdminRole, getRoleHierarchyFromDB } = require('./accessControl.service');
const { hasColumn } = require('./schemaInspector.service');
const log = require('../utils/log');

/**
 * 认证Service类
 * 处理用户认证相关的业务逻辑
 */
class AuthService extends BaseService {
  constructor() {
    super(new UserRepository());
    this.userRepository = new UserRepository();
  }

  /**
   * 用户登录
   * @param {string} username - 用户名
   * @param {string} password - 密码
   * @param {Object} clientInfo - 客户端信息
   * @returns {Promise<Object>} 登录结果
   */
  async login(username, password, clientInfo = {}) {
    try {
      // 验证输入
      if (!username || !password) {
        return this.errorResponse('用户名和密码不能为空');
      }

      // 查找用户
      const user = await this.userRepository.findByUsername(username);
      if (!user) {
        return this.errorResponse('用户名或密码错误');
      }

      // 验证密码
      const isPasswordValid = await this.validatePassword(password, user.password);
      if (!isPasswordValid) {
        return this.errorResponse('用户名或密码错误');
      }

      // 检查用户状态
      const isActiveUser = user.status === 1 || user.status === 'active';
      if (!isActiveUser) {
        return this.errorResponse('账户已被禁用，请联系管理员');
      }

      // 获取用户完整信息（合并查询减少数据库往返）
      const userFullInfo = await this.getUserFullInfo(user.id);
      const { operatorInfo, userStores } = userFullInfo;

      // 获取用户的主门店ID（用于数据权限过滤）
      const primaryStoreId = userStores.length > 0
        ? (userStores.find(s => s.is_primary)?.store_id || userStores[0].store_id)
        : null;

      // 提取所有门店ID数组
      const storeIds = userStores.map(s => s.store_id);

      // 获取用户角色层级（从数据库查询）
      const userMaxHierarchy = await this.getUserMaxHierarchy(user.id);

      // 检查是否为全局管理员（从数据库动态判断）
      const isGlobalAdmin = userMaxHierarchy >= 80;

      // 扩展用户对象，包含门店信息和层级
      const userWithStores = {
        ...user,
        store_id: primaryStoreId,
        store_ids: storeIds,
        maxHierarchy: userMaxHierarchy
      };

      // 生成JWT令牌（包含门店信息和层级）
      const tokens = this.generateTokens(userWithStores, isGlobalAdmin);

      // 更新最后登录时间
      await this.updateLastLogin(user.id);

      // 记录登录日志
      this.logOperation('login', {
        userId: user.id,
        username: user.username,
        clientInfo
      });

      // 返回用户信息和令牌
      const userData = {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        store_id: primaryStoreId, // 主门店ID
        store_ids: storeIds, // 所有关联的门店ID数组
        stores: userStores, // 门店详细信息
        status: user.status,
        operatorInfo: operatorInfo || null
      };

      return this.successResponse('登录成功', {
        user: userData,
        ...tokens
      });
    } catch (error) {
      log.error('登录失败:', error);
      return this.errorResponse('登录失败', error.message);
    }
  }

  /**
   * 用户注册
   * @param {Object} userData - 用户数据
   * @returns {Promise<Object>} 注册结果
   */
  async register(userData) {
    try {
      const { username, password, role, store_id } = userData;

      // 验证必填字段
      this.validateRequiredFields(userData, ['username', 'password', 'role']);

      // 验证用户名格式
      if (username.length < 3 || username.length > 20) {
        return this.errorResponse('用户名长度必须在3-20个字符之间');
      }

      // 验证密码强度
      if (password.length < 6) {
        return this.errorResponse('密码长度不能少于6个字符');
      }

      // 验证角色
      if (!LEGACY_USER_ROLE_CODES.includes(role)) {
        return this.errorResponse('无效的用户角色');
      }

      // 检查用户名是否已存在
      const existingUser = await this.userRepository.findByUsername(username);
      if (existingUser) {
        return this.errorResponse('用户名已存在');
      }

      // 加密密码
      const hashedPassword = await this.hashPassword(password);

      // 创建用户
      const newUserData = {
        username,
        password: hashedPassword,
        role,
        store_id: store_id || null,
        status: 'active'
      };

      const result = await this.userRepository.createUser(newUserData);

      this.logOperation('register', {
        userId: result.id,
        username,
        role
      });

      // 返回用户信息（不包含密码）
      const userResponse = {
        id: result.id,
        username,
        role,
        store_id: store_id || null,
        status: 'active'
      };

      return this.successResponse('注册成功', userResponse);
    } catch (error) {
      return this.handleValidationError(error);
    }
  }

  /**
   * 刷新令牌
   * @param {string} refreshToken - 刷新令牌
   * @returns {Promise<Object>} 刷新结果
   */
  async refreshToken(refreshToken) {
    try {
      if (!refreshToken) {
        return this.errorResponse('刷新令牌不能为空');
      }

      // 验证刷新令牌
      const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET, {
        issuer: 'tf2025-backend',
        audience: 'tf2025-users'
      });
      if (decoded.type !== 'refresh') {
        return this.errorResponse('无效的刷新令牌');
      }

      // 查找用户
      const user = await this.userRepository.findById(decoded.sub);
      const isActiveUser = user && (user.status === 1 || user.status === 'active');
      if (!isActiveUser) {
        return this.errorResponse('用户不存在或已被禁用');
      }

      // 生成新的令牌
      const tokens = this.generateTokens(user);

      return this.successResponse('令牌刷新成功', tokens);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return this.errorResponse('刷新令牌已过期，请重新登录');
      }
      if (error.name === 'JsonWebTokenError') {
        return this.errorResponse('无效的刷新令牌');
      }
      log.error('刷新令牌失败:', error);
      return this.errorResponse('令牌刷新失败', error.message);
    }
  }

  /**
   * 用户登出
   * @param {string} accessToken - 访问令牌
   * @param {string} refreshToken - 刷新令牌
   * @param {Object} user - 用户信息
   * @returns {Promise<Object>} 登出结果
   */
  async logout(accessToken, refreshToken, user) {
    try {
      // 这里应该将令牌加入黑名单
      // 可以使用 Redis 或数据库来存储黑名单令牌

      this.logOperation('logout', {
        userId: user.id,
        username: user.username
      }, user);

      return this.successResponse('登出成功');
    } catch (error) {
      log.error('登出失败:', error);
      return this.errorResponse('登出失败', error.message);
    }
  }

  /**
   * 修改密码
   * @param {number} userId - 用户ID
   * @param {string} oldPassword - 旧密码
   * @param {string} newPassword - 新密码
   * @returns {Promise<Object>} 修改结果
   */
  async changePassword(userId, oldPassword, newPassword) {
    try {
      // 验证输入
      if (!oldPassword || !newPassword) {
        return this.errorResponse('旧密码和新密码不能为空');
      }

      if (newPassword.length < 6) {
        return this.errorResponse('新密码长度不能少于6个字符');
      }

      // 获取用户信息
      const user = await this.userRepository.findById(userId);
      if (!user) {
        return this.errorResponse('用户不存在');
      }

      // 验证旧密码
      const isOldPasswordValid = await this.validatePassword(oldPassword, user.password);
      if (!isOldPasswordValid) {
        return this.errorResponse('旧密码错误');
      }

      // 加密新密码
      const hashedNewPassword = await this.hashPassword(newPassword);

      // 更新密码
      await this.userRepository.update(userId, { password: hashedNewPassword });

      this.logOperation('changePassword', { userId });

      return this.successResponse('密码修改成功');
    } catch (error) {
      return this.handleDatabaseError(error);
    }
  }

  /**
   * 获取用户信息
   * @param {number} userId - 用户ID
   * @returns {Promise<Object>} 用户信息
   */
  async getUserInfo(userId) {
    try {
      const user = await this.userRepository.findUserDetailsById(userId);
      if (!user) {
        return this.errorResponse('用户不存在');
      }

      // 不返回密码字段
      const { password, ...userInfo } = user;

      return this.successResponse('获取用户信息成功', userInfo);
    } catch (error) {
      return this.handleDatabaseError(error);
    }
  }

  /**
   * 更新用户信息
   * @param {number} userId - 用户ID
   * @param {Object} updateData - 更新数据
   * @returns {Promise<Object>} 更新结果
   */
  async updateUserInfo(userId, updateData) {
    try {
      // 不允许更新密码字段
      const { password, ...validUpdateData } = updateData;

      if (Object.keys(validUpdateData).length === 0) {
        return this.errorResponse('没有有效的更新字段');
      }

      const result = await this.userRepository.update(userId, validUpdateData);

      this.logOperation('updateUserInfo', { userId, data: validUpdateData });

      return this.successResponse('用户信息更新成功', result.data);
    } catch (error) {
      return this.handleDatabaseError(error);
    }
  }

  /**
   * 验证用户权限
   * @param {Object} user - 用户对象
   * @param {string|Array} requiredRoles - 需要的角色
   * @returns {boolean} 是否有权限
   */
  validateRole(user, requiredRoles) {
    if (!user || !user.role) {
      return false;
    }

    if (typeof requiredRoles === 'string') {
      requiredRoles = [requiredRoles];
    }

    return requiredRoles.includes(user.role);
  }

  /**
   * 验证密码
   * @param {string} plainPassword - 明文密码
   * @param {string} hashedPassword - 加密后的密码
   * @returns {Promise<boolean>} 是否匹配
   */
  async validatePassword(plainPassword, hashedPassword) {
    try {
      return await bcrypt.compare(plainPassword, hashedPassword);
    } catch (error) {
      log.error('密码验证失败:', error);
      return false;
    }
  }

  /**
   * 加密密码
   * @param {string} plainPassword - 明文密码
   * @returns {Promise<string>} 加密后的密码
   */
  async hashPassword(plainPassword) {
    try {
      const saltRounds = 10;
      return await bcrypt.hash(plainPassword, saltRounds);
    } catch (error) {
      log.error('密码加密失败:', error);
      throw new Error('密码加密失败');
    }
  }

  /**
   * 生成JWT令牌
   * @param {Object} user - 用户对象（包含 maxHierarchy 属性）
   * @param {boolean} isGlobalAdmin - 是否为全局管理员（预先计算）
   * @returns {Object} 包含访问令牌和刷新令牌的对象
   */
  generateTokens(user, isGlobalAdmin = false) {
    const payload = {
      sub: user.id,
      username: user.username,
      name: user.name,  // 添加用户真实姓名
      role: user.role,
      store_id: user.store_id,  // 主门店ID
      store_ids: user.store_ids || []  // 所有关联门店ID数组
    };

    // 根据用户层级动态设置Token过期时间（使用数据库配置）
    const userHierarchy = user.maxHierarchy || 0;

    let tokenExpiry;
    if (isGlobalAdmin || userHierarchy >= 80) {
      tokenExpiry = process.env.JWT_ACCESS_EXPIRES_ADMIN || '30d'; // 管理员30天
    } else if (userHierarchy >= 70) {
      tokenExpiry = process.env.JWT_ACCESS_EXPIRES_LONG || '7d';  // 管理者7天
    } else {
      tokenExpiry = process.env.JWT_ACCESS_EXPIRES_SHORT || '2h';  // 普通用户2小时
    }

    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: tokenExpiry,
      issuer: 'tf2025-backend',
      audience: 'tf2025-users'
    });

    const refreshToken = jwt.sign(
      { sub: user.id, type: 'refresh' },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d', // 刷新令牌30天
        issuer: 'tf2025-backend',
        audience: 'tf2025-users'
      }
    );

    // 计算实际的过期时间（秒）
    const expiresInSeconds = this.calculateExpirationInSeconds(tokenExpiry);

    return {
      accessToken,
      refreshToken,
      expiresIn: expiresInSeconds,
      tokenExpiry // 添加调试信息
    };
  }

  /**
   * 计算JWT过期时间（秒）
   * @param {string} expiry - 过期时间字符串 (如: '2h', '7d', '30d')
   * @returns {number} 过期时间的秒数
   */
  calculateExpirationInSeconds(expiry) {
    const units = {
      's': 1,
      'm': 60,
      'h': 60 * 60,
      'd': 60 * 60 * 24
    };

    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) {
      // 如果没有匹配，默认返回7天的秒数
      return 7 * 24 * 60 * 60;
    }

    const value = parseInt(match[1]);
    const unit = match[2];
    return value * (units[unit] || 1);
  }

  /**
   * 更新最后登录时间
   * @param {number} userId - 用户ID
   * @returns {Promise<void>}
   */
  async updateLastLogin(userId) {
    try {
      await this.userRepository.update(userId, { updated_at: new Date() });
    } catch (error) {
      log.error('更新最后登录时间失败:', error);
      // 不抛出错误，因为这不是关键操作
    }
  }

  /**
   * 获取用户统计信息
   * @param {Object} filters - 过滤条件
   * @returns {Promise<Object>} 统计信息
   */
  async getUserStats(filters = {}) {
    try {
      const stats = await this.userRepository.getUserStats(filters);
      return this.successResponse('获取用户统计信息成功', stats);
    } catch (error) {
      return this.handleDatabaseError(error);
    }
  }

  /**
   * 检查用户名是否可用
   * @param {string} username - 用户名
   * @param {number} excludeUserId - 排除的用户ID（用于更新时检查）
   * @returns {Promise<Object>} 检查结果
   */
  async checkUsernameAvailability(username, excludeUserId = null) {
    try {
      if (!username || username.length < 3) {
        return this.errorResponse('用户名长度不能少于3个字符');
      }

      let user;
      if (excludeUserId) {
        user = await this.userRepository.executeQuery(
          'SELECT id FROM users WHERE username = ? AND id != ? AND status != "deleted"',
          [username, excludeUserId]
        );
      } else {
        user = await this.userRepository.findByUsername(username);
      }

      const isAvailable = !user || (Array.isArray(user) && user.length === 0);

      return this.successResponse('检查完成', {
        username,
        available: isAvailable
      });
    } catch (error) {
      return this.handleDatabaseError(error);
    }
  }

  /**
   * 获取用户完整信息（合并查询，减少数据库往返）
   * 一次性获取用户、操作员信息、门店列表
   * @param {number} userId - 用户ID
   * @returns {Promise<Object>} 包含 operatorInfo 和 userStores
   */
  async getUserFullInfo(userId) {
    try {
      const { getDatabase } = require('../config/database');
      const connection = getDatabase();

      // 并行执行两个查询（操作员信息和门店信息）
      const [operatorInfoResult, userStoresResult] = await Promise.all([
        // 查询1：获取操作员信息
        (async () => {
          try {
            // 先检查表是否存在
            const [tables] = await connection.execute(`
              SELECT COUNT(*) as count
              FROM information_schema.tables
              WHERE table_schema = DATABASE() AND table_name = 'user_operator_assignments'
            `);

            if (tables[0].count === 0) {
              return null;
            }

            const [rows] = await connection.execute(`
              SELECT
                o.*,
                og.description as group_description,
                uoa.group_name as assigned_group,
                uoa.assigned_at
              FROM user_operator_assignments uoa
              LEFT JOIN operators o ON uoa.operator_id = o.id
              LEFT JOIN operator_groups og ON uoa.group_name = og.group_name
              WHERE uoa.user_id = ? AND uoa.status = 'active'
              ORDER BY uoa.assigned_at DESC
              LIMIT 1
            `, [userId]);

            return rows.length > 0 ? rows[0] : null;
          } catch (error) {
            log.error('获取操作员信息失败:', error);
            return null;
          }
        })(),
        // 查询2：获取门店列表
        (async () => {
          try {
            const [rows] = await connection.execute(`
              SELECT
                us.store_id,
                us.is_primary,
                s.name as store_name
              FROM user_stores us
              INNER JOIN stores s ON us.store_id = s.id
              WHERE us.user_id = ?
              ORDER BY us.is_primary DESC, us.assigned_at ASC
            `, [userId]);

            return rows || [];
          } catch (error) {
            log.error('获取门店信息失败:', error);
            return [];
          }
        })()
      ]);

      return {
        operatorInfo: operatorInfoResult || null,
        userStores: userStoresResult || []
      };
    } catch (error) {
      log.error('获取用户完整信息失败:', error);
      return { operatorInfo: null, userStores: [] };
    }
  }

  /**
   * 获取用户最大角色层级（从数据库查询）
   * @param {number} userId - 用户ID
   * @returns {Promise<number>} 用户最大层级值
   */
  async getUserMaxHierarchy(userId) {
    try {
      const connection = getDatabase();
      const hasHierarchyLevel = await hasColumn('roles', 'hierarchy_level', connection);
      const hierarchyExpr = hasHierarchyLevel ? 'COALESCE(r.hierarchy_level, 0)' : '0';

      const [rows] = await connection.execute(`
        SELECT MAX(${hierarchyExpr}) as max_hierarchy
        FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = ?
          AND ur.status = 'active'
          AND r.is_active = 1
          AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
      `, [userId]);

      return rows[0]?.max_hierarchy || 0;
    } catch (error) {
      log.error('获取用户角色层级失败:', error);
      return 0;
    }
  }

  /**
   * 获取用户关联的所有门店
   * @param {number} userId - 用户ID
   * @returns {Promise<Array>} 门店列表
   */
  async getUserStoresInfo(userId) {
    try {
      const { getDatabase } = require('../config/database');
      const connection = getDatabase();

      const [rows] = await connection.execute(`
        SELECT
          us.store_id,
          us.is_primary,
          s.name as store_name
        FROM user_stores us
        INNER JOIN stores s ON us.store_id = s.id
        WHERE us.user_id = ?
        ORDER BY us.is_primary DESC, us.assigned_at ASC
      `, [userId]);

      return rows;
    } catch (error) {
      log.error('获取用户门店信息失败:', error);
      return [];
    }
  }

  /**
   * 获取用户的操作员信息
   * @param {number} userId - 用户ID
   * @returns {Promise<Object|null>} 操作员信息
   */
  async getUserOperatorInfo(userId) {
    try {
      const { getDatabase } = require('../config/database');
      const connection = getDatabase();

      // 先检查表是否存在
      const [tables] = await connection.execute(`
        SELECT COUNT(*) as count
        FROM information_schema.tables
        WHERE table_schema = DATABASE() AND table_name = 'user_operator_assignments'
      `);

      // 如果表不存在，返回 null
      if (tables[0].count === 0) {
        return null;
      }

      const [rows] = await connection.execute(`
        SELECT
          o.*,
          og.description as group_description,
          uoa.group_name as assigned_group,
          uoa.assigned_at
        FROM user_operator_assignments uoa
        LEFT JOIN operators o ON uoa.operator_id = o.id
        LEFT JOIN operator_groups og ON uoa.group_name = og.group_name
        WHERE uoa.user_id = ? AND uoa.status = 'active'
        ORDER BY uoa.assigned_at DESC
        LIMIT 1
      `, [userId]);

      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      log.error('获取用户操作员信息失败:', error);
      return null;
    }
  }
}

module.exports = AuthService;
