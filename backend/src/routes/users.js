const express = require('express');
const { unifiedAuth, requirePermission, requireAnyPermission } = require('../middleware/unified-auth');
const UserRepository = require('../repositories/user.repository');
const ApiResponse = require('../utils/response');
const { getDatabase, isConnected } = require('../config/database');
const { getModuleAccessScope, hasUserPermission } = require('../services/accessControl.service');
const log = require('../utils/log');

const router = express.Router();
const userRepository = new UserRepository();

/**
 * 获取员工简单列表（用于考勤、综合查询等场景）
 * GET /api/users/employees
 * 权限规则：
 * - 考勤管理用户，或有综合查询权限：可以看到所有员工
 * - 普通用户（只有个人考勤查看权限）：只能看到自己
 */
router.get('/employees', unifiedAuth, requireAnyPermission(['attendance:view', 'query:view']), async (req, res) => {
  try {
    const { status = '1' } = req.query;
    const userId = req.user.id || req.user.userId;

    const db = getDatabase();
    const [attendanceScope, hasQueryPermission] = await Promise.all([
      getModuleAccessScope(userId, ['attendance', 'my-attendance']),
      hasUserPermission(userId, 'query_queryview', 'view')
    ]);
    const isAdmin = attendanceScope.isAdmin || hasQueryPermission;

    let users;
    if (isAdmin) {
      // 考勤管理用户或有综合查询权限：查看所有员工
      [users] = await db.execute(
        `SELECT id, username, name, status
         FROM users
         WHERE status = ?
         ORDER BY id`,
        [status]
      );
    } else {
      // 普通用户：只能看到自己
      [users] = await db.execute(
        `SELECT id, username, name, status
         FROM users
         WHERE id = ? AND status = ?`,
        [userId, status]
      );
    }

    const employees = users.map(user => ({
      id: user.id,
      name: user.name || user.username,
      username: user.username,
      status: user.status
    }));

    return ApiResponse.success(res, {
      employees,
      total: employees.length,
      isAdmin
    }, '获取员工列表成功');
  } catch (error) {
    log.error('获取员工列表失败:', error);
    return ApiResponse.error(res, '获取员工列表失败', 500);
  }
});

/**
 * 获取用户列表
 * GET /api/users
 */
router.get('/', unifiedAuth, requirePermission('users:view'), async (req, res) => {
  try {
    const { page = 1, limit = 1000, role, status = '1' } = req.query;

    // 验证分页参数
    const pageInt = parseInt(page);
    const limitInt = parseInt(limit);
    const offset = (pageInt - 1) * limitInt;

    // 使用UserRepository获取用户列表
    const filters = {
      role,
      status
    };

    const pagination = {
      page: pageInt,
      limit: limitInt,
      offset
    };

    const result = await userRepository.getUsers(filters, pagination);

    // 转换为前端需要的格式 (id, name)，添加store_id字段
    const formattedUsers = result.data.map(user => ({
      id: user.id,
      name: user.name || user.username, // 优先使用真实姓名，没有则使用用户名
      username: user.username,
      role: user.role,
      status: user.status,
      store_id: user.store_id || null // 添加门店ID字段
    }));

    return ApiResponse.success(res, {
      users: formattedUsers,
      pagination: {
        page: pageInt,
        limit: limitInt,
        total: result.total
      }
    }, '获取用户列表成功');
  } catch (error) {
    log.error('获取用户列表失败:', error);
    return ApiResponse.error(res, '获取用户列表失败', 500);
  }
});

/**
 * 根据用户名获取用户档案信息
 * GET /api/users/profile?username=<username>
 */
router.get('/profile', unifiedAuth, requirePermission('users:view'), async (req, res) => {
  try {
    const { username } = req.query;

    if (!username) {
      return ApiResponse.error(res, '用户名不能为空', 400);
    }

    const db = require('../config/database').getDatabase();

    // 查询用户信息，包括真实姓名（修改status条件为数字1）
    const [users] = await db.execute(
      'SELECT id, username, name, role, status, email, phone, store_id, created_at, updated_at FROM users WHERE username = ? AND status = 1',
      [username]
    );

    if (users.length === 0) {
      return ApiResponse.error(res, '用户不存在或已禁用', 404);
    }

    const user = users[0];

    // 格式化返回数据
    const userProfile = {
      id: user.id,
      username: user.username,
      name: user.name, // 真实姓名
      role: user.role,
      status: user.status,
      email: user.email,
      phone: user.phone,
      store_id: user.store_id,
      created_at: user.created_at,
      updated_at: user.updated_at
    };

    return ApiResponse.success(res, userProfile, '获取用户档案成功');
  } catch (error) {
    log.error('获取用户档案失败:', error);
    return ApiResponse.error(res, '获取用户档案失败', 500);
  }
});

/**
 * 获取操作员列表 (销售员)
 * GET /api/users/operators
 * 注意：必须放在 /:id 路由之前，否则 operators 会被当作 :id 参数处理
 */
router.get('/operators', unifiedAuth, async (req, res) => {
  try {
    const db = getDatabase();

    // 查询有角色的用户作为操作员 (通过user_roles和roles表关联查询)
    // 使用 GROUP_CONCAT 合并多个角色，避免重复用户
    const [operators] = await db.execute(`
      SELECT
        u.id,
        u.username,
        u.name,
        u.phone,
        u.status,
        u.salary_template_id,
        GROUP_CONCAT(DISTINCT r.name SEPARATOR ', ') as role_name,
        GROUP_CONCAT(DISTINCT COALESCE(r.code, CONCAT('role_', r.id)) SEPARATOR ', ') as role_codes
      FROM users u
      INNER JOIN user_roles ur ON u.id = ur.user_id
      INNER JOIN roles r ON ur.role_id = r.id
      WHERE u.status = 1 AND r.is_active = 1
      GROUP BY u.id, u.username, u.name, u.phone, u.status, u.salary_template_id
      ORDER BY u.created_at DESC
    `);

    // 转换为前端需要的格式 - 使用name字段作为显示名称
    const formattedOperators = operators.map(user => ({
      id: user.id,
      name: user.name || user.username, // 优先使用真实姓名，没有则使用用户名
      username: user.username,
      phone: user.phone,
      salary_template_id: user.salary_template_id,
      role: user.role_name,
      role_codes: user.role_codes ? user.role_codes.split(', ') : []
    }));

    return ApiResponse.success(res, formattedOperators, '获取操作员列表成功');
  } catch (error) {
    log.error('获取操作员列表失败:', error);
    return ApiResponse.error(res, '获取操作员列表失败', 500);
  }
});

/**
 * 根据ID获取用户详情
 * GET /api/users/:id
 */
router.get('/:id', unifiedAuth, requirePermission('users:view'), async (req, res) => {
  try {
    const { id } = req.params;

    const user = await userRepository.findUserDetailsById(id);
    if (!user) {
      return ApiResponse.error(res, '用户不存在', 404);
    }

    res.json(ApiResponse.success(user, '获取用户详情成功'));
  } catch (error) {
    log.error('获取用户详情失败:', error);
    return ApiResponse.error(res, '获取用户详情失败', 500);
  }
});

/**
 * 创建用户
 * POST /api/users
 */
router.post('/', unifiedAuth, requirePermission('users:create'), async (req, res) => {
  try {
    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500);
    }

    const pool = getDatabase();
    const {
      username,
      password,
      name,
      email,
      phone,
      role = 'user',
      status = 1,
      store_id,
      group_name
    } = req.body;

    // 验证必需字段
    if (!username || !password) {
      return ApiResponse.badRequest(res, '用户名和密码不能为空');
    }

    // 检查用户名是否已存在
    const [existingUsers] = await pool.execute(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );
    if (existingUsers.length > 0) {
      return ApiResponse.badRequest(res, '用户名已存在');
    }

    // 插入新用户
    const insertQuery = `
      INSERT INTO users (
        username, password, name, email, phone, role, status, store_id, group_name, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;

    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);

    const insertValues = [
      username,
      hashedPassword,
      name || username,
      email || null,
      phone || null,
      role,
      parseInt(status),
      store_id || null,
      group_name || null
    ];

    const [result] = await pool.execute(insertQuery, insertValues);

    // 获取新创建的用户
    const [newUsers] = await pool.execute('SELECT id, username, name, email, phone, role, status, store_id, group_name, created_at FROM users WHERE id = ?', [result.insertId]);
    const newUser = newUsers[0];

    ApiResponse.created(res, '用户创建成功', newUser);
  } catch (error) {
    log.error('创建用户失败:', error);
    ApiResponse.serverError(res, '创建用户失败', error);
  }
});

/**
 * 更新用户
 * PUT /api/users/:id
 */
router.put('/:id', unifiedAuth, requirePermission('users:edit'), async (req, res) => {
  try {
    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500);
    }

    const { id } = req.params;
    const pool = getDatabase();

    // 检查用户是否存在
    const [existingUsers] = await pool.execute('SELECT id FROM users WHERE id = ?', [parseInt(id)]);
    if (existingUsers.length === 0) {
      return ApiResponse.notFound(res, '用户不存在');
    }

    const {
      username,
      name,
      email,
      phone,
      role,
      status,
      store_id,
      group_name,
      password // 可选的密码更新
    } = req.body;

    // 构建更新字段
    const updateFields = [];
    const updateValues = [];

    if (username !== undefined) {
      // 检查用户名是否重复（排除当前用户）
      const [duplicateCheck] = await pool.execute(
        'SELECT id FROM users WHERE username = ? AND id != ?',
        [username, parseInt(id)]
      );
      if (duplicateCheck.length > 0) {
        return ApiResponse.badRequest(res, '用户名已存在');
      }
      updateFields.push('username = ?');
      updateValues.push(username);
    }

    if (name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(name);
    }

    if (email !== undefined) {
      updateFields.push('email = ?');
      updateValues.push(email);
    }

    if (phone !== undefined) {
      updateFields.push('phone = ?');
      updateValues.push(phone);
    }

    if (role !== undefined) {
      updateFields.push('role = ?');
      updateValues.push(role);
    }

    if (status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(parseInt(status));
    }

    if (store_id !== undefined) {
      updateFields.push('store_id = ?');
      updateValues.push(store_id);
    }

    if (group_name !== undefined) {
      updateFields.push('group_name = ?');
      updateValues.push(group_name);
    }

    if (password !== undefined && password !== '') {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash(password, 10);
      updateFields.push('password = ?');
      updateValues.push(hashedPassword);
    }

    if (updateFields.length === 0) {
      return ApiResponse.badRequest(res, '没有提供要更新的字段');
    }

    // 添加更新时间
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(parseInt(id)); // 为WHERE子句添加id

    // 执行更新
    const updateQuery = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
    await pool.execute(updateQuery, updateValues);

    // 获取更新后的用户信息
    const [updatedUsers] = await pool.execute('SELECT id, username, name, email, phone, role, status, store_id, group_name, updated_at FROM users WHERE id = ?', [parseInt(id)]);

    ApiResponse.success(res, updatedUsers[0], '用户更新成功');
  } catch (error) {
    log.error('更新用户失败:', error);
    ApiResponse.serverError(res, '更新用户失败', error);
  }
});

/**
 * 删除用户
 * DELETE /api/users/:id
 */
router.delete('/:id', unifiedAuth, requirePermission('users:delete'), async (req, res) => {
  try {
    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500);
    }

    const { id } = req.params;
    const pool = getDatabase();

    // 检查用户是否存在
    const [existingUsers] = await pool.execute('SELECT * FROM users WHERE id = ?', [parseInt(id)]);
    if (existingUsers.length === 0) {
      return ApiResponse.notFound(res, '用户不存在');
    }

    // 删除用户
    await pool.execute('DELETE FROM users WHERE id = ?', [parseInt(id)]);

    ApiResponse.success(res, existingUsers[0], '用户删除成功');
  } catch (error) {
    log.error('删除用户失败:', error);
    ApiResponse.serverError(res, '删除用户失败', error);
  }
});

/**
 * 切换用户状态
 * PATCH /api/users/:id/toggle
 */
router.patch('/:id/toggle', unifiedAuth, requirePermission('users:edit'), async (req, res) => {
  try {
    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500);
    }

    const { id } = req.params;
    const pool = getDatabase();

    // 检查用户是否存在
    const [existingUsers] = await pool.execute('SELECT * FROM users WHERE id = ?', [parseInt(id)]);
    if (existingUsers.length === 0) {
      return ApiResponse.notFound(res, '用户不存在');
    }

    const currentUser = existingUsers[0];
    const newStatus = currentUser.status === 1 ? 0 : 1;

    // 更新状态
    await pool.execute(
      'UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newStatus, parseInt(id)]
    );

    // 获取更新后的数据
    const [updatedUsers] = await pool.execute('SELECT * FROM users WHERE id = ?', [parseInt(id)]);
    const updatedUser = updatedUsers[0];

    const statusText = newStatus === 1 ? '启用' : '禁用';
    ApiResponse.success(res, updatedUser, `用户${statusText}成功`);
  } catch (error) {
    log.error('切换用户状态失败:', error);
    ApiResponse.serverError(res, '切换用户状态失败', error);
  }
});

module.exports = router;
