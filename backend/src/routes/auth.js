const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getDatabase, isConnected } = require('../config/database');
const { generateTokens, addToBlacklist, verifyToken } = require('../middleware/jwt-blacklist');
const { unifiedAuth } = require('../middleware/unified-auth');
const { recordSuccessfulLogin, recordFailedLogin, getClientIdentifier } = require('../middleware/login-attempts');
const ApiResponse = require('../utils/response');
const { validateBody } = require('../middleware/validation');
const { getUserAccessProfile } = require('../services/accessControl.service');
const { hasColumn } = require('../services/schemaInspector.service');
const log = require('../utils/log');

// 登录失败处理辅助函数
const handleLoginFailure = (req, res, message) => {
  const identifier = getClientIdentifier(req);
  const result = recordFailedLogin(identifier);
  req.loginAttemptHandled = true;

  if (result.attempts >= 3 || result.blocked) {
    log.warn(`登录失败记录 - 标识符: ${identifier}, 尝试次数: ${result.attempts}`);
  }

  // 设置响应头
  res.setHeader('X-Login-Attempts-Remaining', result.remainingAttempts);

  // 如果被锁定，返回 429 状态码
  if (result.blocked) {
    const lockUntil = result.lockUntil;
    const now = Date.now();
    const remainingMinutes = Math.ceil((lockUntil - now) / 60000);

    log.warn(`账户已被锁定 - 标识符: ${identifier}, 锁定时长: ${remainingMinutes} 分钟`);

    return res.status(429).json({
      success: false,
      message: '登录尝试次数过多，账户已被临时锁定',
      code: 'LOGIN_RATE_LIMITED',
      details: {
        lockDuration: remainingMinutes
      }
    });
  }

  // 否则返回标准错误
  return res.status(401).json({
    success: false,
    message
  });
};

const EMPTY_ACCESS_PROFILE = Object.freeze({
  summary: {},
  userPermissions: [],
  rolePermissions: {},
  roles: [],
  menuVisibility: {}
});

const rawSql = (value) => ({ __raw: value });

const cloneEmptyAccessProfile = () => ({
  summary: {},
  userPermissions: [],
  rolePermissions: {},
  roles: [],
  menuVisibility: {}
});

const normalizeAccessProfile = (accessProfile = null) => {
  if (!accessProfile || typeof accessProfile !== 'object') {
    return cloneEmptyAccessProfile();
  }

  return {
    summary: accessProfile.summary && typeof accessProfile.summary === 'object'
      ? accessProfile.summary
      : {},
    userPermissions: Array.isArray(accessProfile.userPermissions)
      ? accessProfile.userPermissions
      : [],
    rolePermissions: accessProfile.rolePermissions && typeof accessProfile.rolePermissions === 'object'
      ? accessProfile.rolePermissions
      : {},
    roles: Array.isArray(accessProfile.roles)
      ? accessProfile.roles
      : [],
    menuVisibility: accessProfile.menuVisibility && typeof accessProfile.menuVisibility === 'object'
      ? accessProfile.menuVisibility
      : {}
  };
};

function buildInsertStatement(tableName, valueMap) {
  const columns = [];
  const placeholders = [];
  const values = [];

  Object.entries(valueMap).forEach(([column, value]) => {
    if (value === undefined) {
      return;
    }

    columns.push(`\`${column}\``);

    if (value && typeof value === 'object' && value.__raw) {
      placeholders.push(value.__raw);
      return;
    }

    placeholders.push('?');
    values.push(value);
  });

  return {
    sql: `INSERT INTO \`${tableName}\` (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`,
    values
  };
}

async function getUserStoreBindings(database, userId) {
  try {
    const [stores] = await database.execute(`
      SELECT
        us.store_id,
        us.is_primary,
        s.name as store_name
      FROM user_stores us
      INNER JOIN stores s ON us.store_id = s.id
      WHERE us.user_id = ?
      ORDER BY us.is_primary DESC, us.assigned_at ASC
    `, [userId]);

    const primaryStore = stores.find(store => store.is_primary === 1) || stores[0] || null;

    return {
      stores,
      primaryStoreId: primaryStore ? primaryStore.store_id : null,
      storeIds: stores.map(store => store.store_id)
    };
  } catch (error) {
    log.warn('⚠️ 获取用户门店失败，使用空门店信息:', error);
    return {
      stores: [],
      primaryStoreId: null,
      storeIds: []
    };
  }
}

async function buildAuthenticatedUserPayload(database, user) {
  let accessProfile = EMPTY_ACCESS_PROFILE;

  try {
    // 并行获取权限和门店信息，减少等待时间
    const [accessProfileResult] = await Promise.all([
      getUserAccessProfile(user.id, database)
    ]);
    accessProfile = normalizeAccessProfile(accessProfileResult);
  } catch (error) {
    log.warn('⚠️ 获取用户权限汇总失败，使用空权限:', error);
    accessProfile = cloneEmptyAccessProfile();
  }

  const { stores, primaryStoreId, storeIds } = await getUserStoreBindings(database, user.id);
  const roleNames = accessProfile.roles.map(role => role.roleName).filter(Boolean);
  const roleIds = accessProfile.roles
    .map(role => role.roleId)
    .filter(roleId => roleId !== null && roleId !== undefined);
  const roleCodes = accessProfile.roles.map(role => role.roleCode).filter(Boolean);

  return {
    accessProfile,
    tokenPayload: {
      id: user.id,
      username: user.username,
      name: user.name,
      store_id: primaryStoreId,
      store_ids: storeIds,
      roles: roleNames,
      role_ids: roleIds,
      role_codes: roleCodes
    },
    userPayload: {
      id: user.id,
      username: user.username,
      name: user.name,
      phone: user.phone || '',
      email: user.email || '',
      status: user.status,
      store_id: primaryStoreId,
      store_ids: storeIds,
      stores,
      roles: roleNames,
      role: roleNames[0] || null,
      role_ids: roleIds,
      role_id: roleIds[0] || null,
      role_codes: roleCodes,
      permissions: accessProfile.userPermissions,
      access_profile: accessProfile,
      permission_summary: accessProfile.summary,
      menu_visibility: accessProfile.menuVisibility
    }
  };
}

async function ensureDevelopmentAdminRole(connection) {
  const supportsRoleCode = await hasColumn('roles', 'code', connection);
  const query = supportsRoleCode
    ? 'SELECT id FROM roles WHERE code = ? OR name IN (?, ?) LIMIT 1'
    : 'SELECT id FROM roles WHERE name IN (?, ?) LIMIT 1';
  const params = supportsRoleCode
    ? ['admin', '管理员', '系统管理员']
    : ['管理员', '系统管理员'];
  const [existingRoles] = await connection.execute(query, params);

  if (existingRoles.length > 0) {
    return existingRoles[0].id;
  }

  const roleData = {
    name: '管理员',
    description: '开发环境初始化管理员角色',
    code: supportsRoleCode ? 'admin' : undefined,
    role_type: await hasColumn('roles', 'role_type', connection) ? 'system' : undefined,
    group_name: await hasColumn('roles', 'group_name', connection) ? 'system' : undefined,
    hierarchy_level: await hasColumn('roles', 'hierarchy_level', connection) ? 100 : undefined,
    status: await hasColumn('roles', 'status', connection) ? 'active' : undefined,
    is_active: await hasColumn('roles', 'is_active', connection) ? 1 : undefined,
    created_at: await hasColumn('roles', 'created_at', connection) ? rawSql('NOW()') : undefined,
    updated_at: await hasColumn('roles', 'updated_at', connection) ? rawSql('NOW()') : undefined
  };

  const { sql, values } = buildInsertStatement('roles', roleData);
  const [result] = await connection.execute(sql, values);
  return result.insertId;
}

async function ensureUserRoleBinding(connection, userId, roleId) {
  const [existingBindings] = await connection.execute(
    'SELECT 1 FROM user_roles WHERE user_id = ? AND role_id = ? LIMIT 1',
    [userId, roleId]
  );

  if (existingBindings.length > 0) {
    return;
  }

  const bindingData = {
    user_id: userId,
    role_id: roleId,
    status: await hasColumn('user_roles', 'status', connection) ? 'active' : undefined,
    assigned_by: await hasColumn('user_roles', 'assigned_by', connection) ? userId : undefined,
    assigned_at: await hasColumn('user_roles', 'assigned_at', connection) ? rawSql('NOW()') : undefined,
    created_at: await hasColumn('user_roles', 'created_at', connection) ? rawSql('NOW()') : undefined,
    updated_at: await hasColumn('user_roles', 'updated_at', connection) ? rawSql('NOW()') : undefined
  };

  const { sql, values } = buildInsertStatement('user_roles', bindingData);
  await connection.execute(sql, values);
}

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: 用户登录
 *     description: |
 *       使用用户名和密码登录系统
 *       - 登录成功返回访问令牌和刷新令牌
 *       - 包含用户的角色、权限、门店信息
 *       - 支持 5 分钟内 5 次失败尝试限制
 *     tags: [认证]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 50
 *                 description: 用户名
 *                 example: "sadmin"
 *               password:
 *                 type: string
 *                 minLength: 4
 *                 maxLength: 100
 *                 description: 密码
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: 登录成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "登录成功"
 *                 token:
 *                   type: string
 *                   description: JWT 访问令牌（有效期 2 小时）
 *                 refreshToken:
 *                   type: string
 *                   description: JWT 刷新令牌（有效期 7 天）
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: 登录失败
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "用户名或密码错误"
 *       429:
 *         description: 登录尝试次数过多
 *         headers:
 *           X-Login-Attempts-Remaining:
 *             schema:
 *               type: integer
 *             description: 剩余尝试次数
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "登录尝试次数过多，账户已被临时锁定"
 *                 code:
 *                   type: string
 *                   example: "LOGIN_RATE_LIMITED"
 *                 details:
 *                   type: object
 *                   properties:
 *                     lockDuration:
 *                       type: integer
 *                       description: 锁定时长（分钟）
 */
router.post('/login', validateBody({
  username: { type: 'string', required: true, minLength: 3, maxLength: 50 },
  password: { type: 'string', required: true, minLength: 4, maxLength: 100 }
}), async (req, res) => {
  try {
    const { username, password } = req.body;

    // 注释：已移除开发环境硬编码密码绕过逻辑，确保数据库密码唯一性
    // 原有的硬编码密码验证存在安全风险，现已删除，所有登录必须通过数据库验证

    // 检查数据库连接
    if (!isConnected()) {
      log.error('数据库未连接，无法进行用户验证');
      return ApiResponse.error(res, '服务暂时不可用，请稍后再试', 503);
    }

    // 查询用户
    const database = getDatabase();
    const [users] = await database.execute(
      'SELECT id, username, password, name, status FROM users WHERE username = ?',
      [username]
    );

    if (users.length === 0) {
      return handleLoginFailure(req, res, '用户名或密码错误');
    }

    const user = users[0];

    // 检查用户状态
    if (user.status !== 1 && user.status !== 'active') {
      return handleLoginFailure(req, res, '账户已被禁用，请联系管理员启用账户');
    }

    // 验证密码 (数据库中的密码是bcrypt加密的)
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return handleLoginFailure(req, res, '用户名或密码错误');
    }

    // 更新最后登录时间
    await database.execute(
      'UPDATE users SET last_login = NOW() WHERE id = ?',
      [user.id]
    );

    // 记录登录成功
    const clientIdentifier = req.ip || req.connection.remoteAddress || 'unknown';
    recordSuccessfulLogin(`${clientIdentifier}:${username}`);

    const {
      userPayload,
      accessProfile,
      tokenPayload
    } = await buildAuthenticatedUserPayload(database, user);
    const { accessToken, refreshToken } = generateTokens(tokenPayload);

    // 登录接口特殊处理：token和user需要在顶层，而不是在data中
    res.json({
      success: true,
      message: '登录成功',
      token: accessToken,
      refreshToken: refreshToken,
      user: userPayload,
      accessProfile
    });

  } catch (error) {
    log.error('登录失败:', error);
    ApiResponse.error(res, '登录失败', 500);
  }
});

/**
 * @swagger
 * /api/auth/user:
 *   get:
 *     summary: 获取当前用户信息
 *     description: 获取已登录用户的详细信息，包括角色和最后登录时间
 *     tags: [认证]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功返回用户信息
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     username:
 *                       type: string
 *                       example: "sadmin"
 *                     name:
 *                       type: string
 *                       example: "系统管理员"
 *                     phone:
 *                       type: string
 *                       example: "13800138000"
 *                     email:
 *                       type: string
 *                       format: email
 *                       example: "admin@example.com"
 *                     roles:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["管理员"]
 *                     role:
 *                       type: string
 *                       nullable: true
 *                       example: "管理员"
 *                     last_login:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: 未授权
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/user', unifiedAuth, async (req, res) => {
  try {
    // 检查数据库连接
    if (!isConnected()) {
      log.error('数据库未连接，无法获取用户信息');
      return ApiResponse.error(res, '服务暂时不可用，请稍后再试', 503);
    }

    const database = getDatabase();
    // 首先获取用户基本信息
    const [users] = await database.execute(
      'SELECT id, username, name, phone, email, status, last_login FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return ApiResponse.error(res, '用户不存在', 404);
    }

    const user = users[0];

    const { userPayload } = await buildAuthenticatedUserPayload(database, user);

    ApiResponse.success(res, {
      ...userPayload,
      last_login: user.last_login ? new Date(user.last_login).toISOString() : null
    });

  } catch (error) {
    log.error('获取用户信息失败:', error);
    ApiResponse.error(res, '获取用户信息失败', 500);
  }
});

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: 刷新访问令牌
 *     description: |
 *       使用刷新令牌获取新的访问令牌
 *       - 刷新令牌有效期为 7 天
 *       - 刷新成功后，旧的刷新令牌将失效
 *       - 返回新的访问令牌和刷新令牌
 *     tags: [认证]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 minLength: 10
 *                 description: 刷新令牌
 *     responses:
 *       200:
 *         description: 刷新成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "令牌刷新成功"
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                       description: 新的访问令牌
 *                     refreshToken:
 *                       type: string
 *                       description: 新的刷新令牌
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       401:
 *         description: 令牌无效或已过期
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/refresh', validateBody({
  refreshToken: { type: 'string', required: true, minLength: 10 }
}), async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!isConnected()) {
      return ApiResponse.error(res, '服务暂时不可用，请稍后再试', 503);
    }

    const database = getDatabase();

    // 验证刷新令牌
    const decoded = await verifyToken(refreshToken, 'refresh');

    // 查询用户信息
    const [users] = await database.execute(
      `SELECT id, username, name, status
       FROM users
       WHERE id = ?
         AND (status = 1 OR status = 'active')`,
      [decoded.sub]
    );

    if (users.length === 0) {
      return ApiResponse.error(res, '用户不存在或已被禁用', 401);
    }

    const user = users[0];

    const {
      userPayload,
      accessProfile,
      tokenPayload
    } = await buildAuthenticatedUserPayload(database, user);

    // 将旧的刷新令牌加入黑名单
    await addToBlacklist(refreshToken, 'refresh_used');

    // 生成新的令牌对
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(tokenPayload);

    ApiResponse.success(res, {
      token: accessToken,
      refreshToken: newRefreshToken,
      user: userPayload,
      accessProfile
    }, '令牌刷新成功');

  } catch (error) {
    log.error('令牌刷新失败:', error);

    if (error.message === '令牌已过期') {
      return ApiResponse.error(res, '刷新令牌已过期，请重新登录', 401);
    } else if (error.message === '无效的令牌' || error.message === 'Token已被吊销') {
      return ApiResponse.error(res, '无效的刷新令牌', 401);
    }

    ApiResponse.error(res, '令牌刷新失败', 500);
  }
});

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: 用户退出登录
 *     description: |
 *       退出当前设备登录
 *       - 将当前访问令牌加入黑名单
 *       - 需要提供有效的访问令牌
 *     tags: [认证]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 退出成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "退出成功"
 *       401:
 *         description: 未授权
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/logout', unifiedAuth, (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      // 将访问令牌加入黑名单
      addToBlacklist(token, 'logout');
    }

    ApiResponse.success(res, null, '退出成功');
  } catch (error) {
    log.error('退出处理失败:', error);
    ApiResponse.error(res, '退出失败', 500);
  }
});

/**
 * @swagger
 * /api/auth/logout-all:
 *   post:
 *     summary: 退出所有设备
 *     description: 退出当前用户在所有设备上的登录状态
 *     tags: [认证]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 退出成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "已退出所有设备"
 *       401:
 *         description: 未授权
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/logout-all', unifiedAuth, async (req, res) => {
  try {
    const database = getDatabase();
    const userId = req.user.id;

    // 这里可以实现将用户的所有令牌加入黑名单
    // 目前只是记录到数据库
    await database.execute(
      'INSERT INTO logout_all_logs (user_id, created_at) VALUES (?, NOW())',
      [userId]
    );

    ApiResponse.success(res, null, '已退出所有设备');
  } catch (error) {
    log.error('退出所有设备失败:', error);
    ApiResponse.error(res, '退出所有设备失败', 500);
  }
});

// 初始化管理员用户（仅开发环境）
router.post('/init-admin', async (req, res) => {
  try {
    // 仅在开发环境允许
    if (process.env.NODE_ENV === 'production') {
      return ApiResponse.error(res, '此功能仅在开发环境可用', 403);
    }

    const database = getDatabase();
    const connection = await database.getConnection();

    try {
      await connection.beginTransaction();

      // 检查是否已有管理员用户
      const [existingAdmins] = await connection.execute(
        'SELECT id FROM users WHERE username = ? LIMIT 1',
        ['admin']
      );

      if (existingAdmins.length > 0) {
        await connection.rollback();
        return ApiResponse.error(res, '管理员用户已存在', 400);
      }

      const adminRoleId = await ensureDevelopmentAdminRole(connection);

      // 创建默认管理员用户
      const defaultPassword = 'admin123';
      const hashedPassword = await bcrypt.hash(defaultPassword, 12);
      const supportsUserRole = await hasColumn('users', 'role', connection);
      const supportsUserRoleId = await hasColumn('users', 'role_id', connection);
      const userData = {
        username: 'admin',
        password: hashedPassword,
        name: '管理员',
        role: supportsUserRole ? 'admin' : undefined,
        role_id: supportsUserRoleId ? adminRoleId : undefined,
        status: 1,
        created_at: await hasColumn('users', 'created_at', connection) ? rawSql('NOW()') : undefined,
        updated_at: await hasColumn('users', 'updated_at', connection) ? rawSql('NOW()') : undefined
      };
      const { sql, values } = buildInsertStatement('users', userData);
      const [result] = await connection.execute(sql, values);

      await ensureUserRoleBinding(connection, result.insertId, adminRoleId);
      await connection.commit();

      ApiResponse.success(res, {
        id: result.insertId,
        username: 'admin',
        password: defaultPassword,
        role_id: adminRoleId,
        message: '请保存此密码并在登录后立即修改'
      }, '管理员用户初始化成功');
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    log.error('初始化管理员失败:', error);
    ApiResponse.error(res, '初始化管理员失败', 500);
  }
});

module.exports = router;
