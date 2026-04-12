const express = require('express');
const router = express.Router();
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth');
const ApiResponse = require('../utils/response');
const { getDatabase } = require('../config/database');
const { getModuleAccessScope } = require('../services/accessControl.service');
const log = require('../utils/log');

// 获取员工列表
router.get('/', unifiedAuth, requirePermission('employee:view'), async (req, res) => {
  try {
    const { page = 1, limit = 10000, status, search } = req.query;

    const db = getDatabase();
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // 构建查询条件
    let whereConditions = [];
    let queryParams = [];

  
    if (status !== undefined) {
      whereConditions.push('status = ?');
      queryParams.push(parseInt(status));
    }

    if (search) {
      whereConditions.push('(name LIKE ? OR username LIKE ? OR phone LIKE ? OR email LIKE ?)');
      const searchPattern = `%${search}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // 查询总数
    const countQuery = `SELECT COUNT(*) as total FROM users ${whereClause}`;
    const [countResult] = await db.execute(countQuery, queryParams);
    const total = countResult[0].total;

    // 确保参数是正确的整数类型
    const limitInt = parseInt(limit) || 10000;
    const offsetInt = parseInt(offset) || 0;

    // 查询员工列表，包含角色信息
    // 使用模板字符串拼接 LIMIT 和 OFFSET（因为是整数，安全）
    const query = `
      SELECT
        u.id,
        u.username,
        u.name,
        u.phone,
        u.email,
        u.salary_template_id,
        u.status,
        u.last_login,
        u.created_at,
        u.updated_at,
        u.hire_date,
        CASE
          WHEN EXISTS(SELECT 1 FROM stores WHERE manager_id = u.id) THEN
            (SELECT name FROM stores WHERE manager_id = u.id LIMIT 1)
          ELSE '未分配'
        END as store_name,
        CASE
          WHEN u.salary_template_id IS NOT NULL THEN
            CONCAT('薪资模板-', u.salary_template_id)
          ELSE '未设置'
        END as salary_template_name,
        -- 获取角色信息
        (
          SELECT GROUP_CONCAT(r.name ORDER BY r.id SEPARATOR ', ')
          FROM user_roles ur
          JOIN roles r ON ur.role_id = r.id
          WHERE ur.user_id = u.id
        ) as roles,
        (
          SELECT GROUP_CONCAT(r.id ORDER BY r.id SEPARATOR ',')
          FROM user_roles ur
          JOIN roles r ON ur.role_id = r.id
          WHERE ur.user_id = u.id
        ) as role_ids
      FROM users u
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT ${limitInt} OFFSET ${offsetInt}
    `;

    // 统一使用参数化查询（只包含过滤条件的参数）
    const [employees] = await db.execute(query, queryParams);

    ApiResponse.success(res, {
      employees: employees,
      pagination: {
        current: parseInt(page),
        pageSize: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    log.error('获取员工列表失败:', error);
    ApiResponse.serverError(res, '获取员工列表失败', error);
  }
});

// 获取员工简化列表（用于工资管理）
// 只返回基本的员工信息，不需要员工管理权限
// 管理员（增删改查全开）：可以看到所有员工
// 普通员工：只能看到自己
router.get('/salary-list', unifiedAuth, requirePermission('salary-records:view'), async (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.user.id || req.user.userId;

    // 检查用户是否为工资模块管理员（拥有完整CRUD权限）
    const { isAdmin } = await getModuleAccessScope(userId, ['salary-records', 'my-salary']);

    let query;
    let params;

    if (isAdmin) {
      // 管理员：查看所有员工
      query = `
        SELECT
          id,
          username,
          name,
          phone,
          status,
          hire_date,
          salary_template_id
        FROM users
        WHERE status = 1
        ORDER BY id
      `;
      params = [];
    } else {
      // 普通员工：只能看到自己
      query = `
        SELECT
          id,
          username,
          name,
          phone,
          status,
          hire_date,
          salary_template_id
        FROM users
        WHERE id = ? AND status = 1
        ORDER BY id
      `;
      params = [userId];
    }

    const [employees] = await db.execute(query, params);

    ApiResponse.success(res, {
      employees: employees || [],
      total: employees.length
    });
  } catch (error) {
    log.error('获取员工列表失败:', error);
    ApiResponse.serverError(res, '获取员工列表失败', error);
  }
});

// 获取员工当前底薪（包含工龄涨薪计算）
// 专门用于工资发放页面
// 支持通过 date 参数（YYYY-MM）计算指定月份的底薪
// 管理员（增删改查全开）：可以看到所有员工
// 普通员工：只能看到自己
router.get('/current-salary', unifiedAuth, requirePermission('salary-records:view'), async (req, res) => {
  try {
    const db = getDatabase();
    const { date } = req.query; // 接收日期参数，格式：YYYY-MM
    const userId = req.user.id || req.user.userId;

    // 检查用户是否为工资模块管理员（拥有完整CRUD权限）
    const { isAdmin } = await getModuleAccessScope(userId, ['salary-records', 'my-salary']);

    let query;
    let params;

    if (isAdmin) {
      // 管理员：获取所有员工
      query = `
        SELECT
          u.id,
          u.username,
          u.name,
          u.hire_date,
          u.salary_template_id,
          st.base_salary,
          st.auto_raise_rule,
          st.commission_type,
          st.commission_fixed,
          st.commission_new_fixed,
          st.commission_used_fixed,
          st.commission_percentage,
          st.overtime_hourly_rate,
          st.rest_days
        FROM users u
        LEFT JOIN salary_templates st ON u.salary_template_id = st.id
        WHERE u.status = 1
        ORDER BY u.id
      `;
      params = [];
    } else {
      // 普通员工：只获取自己
      query = `
        SELECT
          u.id,
          u.username,
          u.name,
          u.hire_date,
          u.salary_template_id,
          st.base_salary,
          st.auto_raise_rule,
          st.commission_type,
          st.commission_fixed,
          st.commission_new_fixed,
          st.commission_used_fixed,
          st.commission_percentage,
          st.overtime_hourly_rate,
          st.rest_days
        FROM users u
        LEFT JOIN salary_templates st ON u.salary_template_id = st.id
        WHERE u.id = ? AND u.status = 1
        ORDER BY u.id
      `;
      params = [userId];
    }

    const [employees] = await db.execute(query, params);

    // 计算每个员工的当前底薪
    const employeesWithSalary = employees.map(emp => {
      let baseSalary = parseFloat(emp.base_salary) || 0;
      let currentSalary = baseSalary;
      let salaryAdjustment = 0;
      let salaryNote = '';

      if (emp.auto_raise_rule && emp.hire_date) {
        try {
          const rule = typeof emp.auto_raise_rule === 'string'
            ? JSON.parse(emp.auto_raise_rule)
            : emp.auto_raise_rule;

          if (rule.enabled && rule.months && rule.amount) {
            const hireDate = new Date(emp.hire_date);

            // 使用传入的日期参数，如果没有则使用当前日期
            let calculationDate;
            if (date) {
              // 解析 YYYY-MM 格式，使用该月的第一天
              const [year, month] = date.split('-').map(Number);
              calculationDate = new Date(year, month - 1, 1);
            } else {
              calculationDate = new Date();
            }

            const years = calculationDate.getFullYear() - hireDate.getFullYear();
            const months = calculationDate.getMonth() - hireDate.getMonth();
            const monthsOfService = years * 12 + months;

            const raiseCount = Math.floor(monthsOfService / rule.months);

            if (raiseCount > 0) {
              const potentialAdjustment = raiseCount * parseFloat(rule.amount);
              const maxSalary = parseFloat(rule.max_salary) || 0;

              const newSalary = baseSalary + potentialAdjustment;
              if (maxSalary > 0 && newSalary > maxSalary) {
                salaryAdjustment = maxSalary - baseSalary;
                currentSalary = maxSalary;
                salaryNote = `工龄涨薪：每${rule.months}个月涨${rule.amount}元，已达到上限`;
              } else {
                salaryAdjustment = potentialAdjustment;
                currentSalary = newSalary;
                salaryNote = `工龄涨薪：每${rule.months}个月涨${rule.amount}元，已涨薪${raiseCount}次`;
              }
            }
          }
        } catch (e) {
          log.warn('解析自动涨薪规则失败:', e);
        }
      }

      return {
        id: emp.id,
        username: emp.username,
        name: emp.name,
        salary_template_id: emp.salary_template_id,
        base_salary: baseSalary,
        current_salary: currentSalary,
        salary_adjustment: salaryAdjustment,
        salary_note: salaryNote,
        commission_type: emp.commission_type || 'fixed',
        commission_fixed: parseFloat(emp.commission_fixed) || 0,
        commission_new_fixed: parseFloat(emp.commission_new_fixed || emp.commission_fixed) || 0,
        commission_used_fixed: parseFloat(emp.commission_used_fixed) || 0,
        commission_percentage: parseFloat(emp.commission_percentage) || 0,
        overtime_hourly_rate: parseFloat(emp.overtime_hourly_rate) || 0,
        rest_days: parseFloat(emp.rest_days) || 0
      };
    });

    ApiResponse.success(res, { employees: employeesWithSalary });
  } catch (error) {
    log.error('获取员工当前底薪失败:', error);
    ApiResponse.serverError(res, '获取员工当前底薪失败', error);
  }
});

// ==================== 角色管理相关路由 ====================

// 获取权限系统的所有角色（与权限系统同步）
router.get('/system-roles', unifiedAuth, requirePermission('permissions:admin'), async (req, res) => {
  try {
    const db = getDatabase();

    const query = `
      SELECT
        id,
        name,
        description,
        COALESCE(code, CONCAT('role_', id)) AS role_code,
        role_type,
        hierarchy_level,
        is_active,
        created_at,
        updated_at
      FROM roles
      WHERE is_active = 1
      ORDER BY
        COALESCE(hierarchy_level, 0) DESC,
        id ASC
    `;

    const [roles] = await db.execute(query);

    ApiResponse.success(res, '获取系统角色列表成功', {
      roles: roles
    });
  } catch (error) {
    log.error('获取系统角色列表失败:', error);
    ApiResponse.serverError(res, '获取系统角色列表失败', error);
  }
});

// 获取所有角色
router.get('/roles', unifiedAuth, requirePermission('employee:view'), async (req, res) => {
  try {
    const db = getDatabase();

    const query = `
      SELECT
        r.id,
        r.name,
        r.description,
        r.created_at,
        r.updated_at,
        COUNT(ur.user_id) as user_count
      FROM roles r
      LEFT JOIN user_roles ur ON r.id = ur.role_id
      GROUP BY r.id
      ORDER BY r.id
    `;

    const [roles] = await db.execute(query);

    ApiResponse.success(res, { roles });
  } catch (error) {
    log.error('获取角色列表失败:', error);
    ApiResponse.serverError(res, '获取角色列表失败', error);
  }
});

// 创建新角色
router.post('/roles', unifiedAuth, requirePermission('employee:create'), async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || name.trim() === '') {
      return ApiResponse.badRequest(res, '角色名称不能为空');
    }

    const db = getDatabase();

    // 检查角色名称是否重复
    const [existingRole] = await db.execute(
      'SELECT id FROM roles WHERE name = ?',
      [name.trim()]
    );

    if (existingRole.length > 0) {
      return ApiResponse.badRequest(res, '角色名称已存在');
    }

    // 创建角色
    const [result] = await db.execute(
      'INSERT INTO roles (name, description, created_at, updated_at) VALUES (?, ?, NOW(), NOW())',
      [name.trim(), description || '']
    );

    const [newRole] = await db.execute(
      'SELECT * FROM roles WHERE id = ?',
      [result.insertId]
    );

    ApiResponse.created(res, '角色创建成功', newRole[0]);
  } catch (error) {
    log.error('创建角色失败:', error);
    ApiResponse.serverError(res, '创建角色失败', error);
  }
});

// 更新角色
router.put('/roles/:id', unifiedAuth, requirePermission('employee:edit'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const db = getDatabase();

    // 检查角色是否存在
    const [role] = await db.execute(
      'SELECT id FROM roles WHERE id = ?',
      [id]
    );

    if (role.length === 0) {
      return ApiResponse.notFound(res, '角色不存在');
    }

    // 检查角色名称是否重复（排除当前角色）
    if (name && name.trim() !== '') {
      const [existingRole] = await db.execute(
        'SELECT id FROM roles WHERE name = ? AND id != ?',
        [name.trim(), id]
      );

      if (existingRole.length > 0) {
        return ApiResponse.badRequest(res, '角色名称已存在');
      }
    }

    // 更新角色
    const updateFields = [];
    const updateValues = [];

    if (name && name.trim() !== '') {
      updateFields.push('name = ?');
      updateValues.push(name.trim());
    }

    if (description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(description);
    }

    if (updateFields.length > 0) {
      updateValues.push(id);

      const updateQuery = `UPDATE roles SET ${updateFields.join(', ')} WHERE id = ?`;
      await db.execute(updateQuery, updateValues);
    }

    // 获取更新后的角色信息
    const [updatedRole] = await db.execute(
      'SELECT * FROM roles WHERE id = ?',
      [id]
    );

    ApiResponse.success(res, updatedRole[0], '角色更新成功');
  } catch (error) {
    log.error('更新角色失败:', error);
    ApiResponse.serverError(res, '更新角色失败', error);
  }
});

// 删除角色
router.delete('/roles/:id', unifiedAuth, requirePermission('employee:delete'), async (req, res) => {
  try {
    const { id } = req.params;

    const db = getDatabase();

    // 检查角色是否存在
    const [role] = await db.execute(
      'SELECT id FROM roles WHERE id = ?',
      [id]
    );

    if (role.length === 0) {
      return ApiResponse.notFound(res, '角色不存在');
    }

    // 检查是否有用户使用此角色
    const [usersWithRole] = await db.execute(
      'SELECT COUNT(*) as count FROM user_roles WHERE role_id = ?',
      [id]
    );

    if (usersWithRole[0].count > 0) {
      return ApiResponse.badRequest(res, '此角色仍有用户使用，无法删除');
    }

    // 删除角色
    await db.execute('DELETE FROM roles WHERE id = ?', [id]);

    ApiResponse.success(res, { id: parseInt(id) }, '角色删除成功');
  } catch (error) {
    log.error('删除角色失败:', error);
    ApiResponse.serverError(res, '删除角色失败', error);
  }
});

// 为员工分配角色
router.post('/:id/roles', unifiedAuth, requirePermission('employee:edit'), async (req, res) => {
  try {
    const { id } = req.params;
    const { role_ids } = req.body;

    if (!Array.isArray(role_ids) || role_ids.length === 0) {
      return ApiResponse.badRequest(res, '请选择要分配的角色');
    }

    const db = getDatabase();

    // 检查员工是否存在
    const [employee] = await db.execute(
      'SELECT id FROM users WHERE id = ?',
      [id]
    );

    if (employee.length === 0) {
      return ApiResponse.notFound(res, '员工不存在');
    }

    // 检查角色是否都存在
    const roleIdsString = role_ids.join(',');
    const [roles] = await db.execute(
      `SELECT id FROM roles WHERE id IN (${roleIdsString})`
    );

    if (roles.length !== role_ids.length) {
      return ApiResponse.badRequest(res, '部分角色不存在');
    }

    // 删除员工现有的所有角色
    await db.execute('DELETE FROM user_roles WHERE user_id = ?', [id]);

    // 分配新角色
    for (const roleId of role_ids) {
      await db.execute(
        'INSERT INTO user_roles (user_id, role_id, assigned_at) VALUES (?, ?, NOW())',
        [id, roleId]
      );
    }

    // 获取更新后的员工角色信息
    const [updatedEmployee] = await db.execute(`
      SELECT
        u.id,
        u.username,
        u.name,
        (
          SELECT GROUP_CONCAT(r.name ORDER BY r.id SEPARATOR ', ')
          FROM user_roles ur
          JOIN roles r ON ur.role_id = r.id
          WHERE ur.user_id = u.id
        ) as role_names,
        (
          SELECT GROUP_CONCAT(r.id ORDER BY r.id SEPARATOR ',')
          FROM user_roles ur
          JOIN roles r ON ur.role_id = r.id
          WHERE ur.user_id = u.id
        ) as role_ids
      FROM users u
      WHERE u.id = ?
    `, [id]);

    ApiResponse.success(res, updatedEmployee[0], '角色分配成功');
  } catch (error) {
    log.error('分配角色失败:', error);
    ApiResponse.serverError(res, '分配角色失败', error);
  }
});

// 移除员工的单个角色
router.delete('/:employeeId/roles/:roleId', unifiedAuth, requirePermission('employee:edit'), async (req, res) => {
  try {
    const { employeeId, roleId } = req.params;

    const db = getDatabase();

    // 检查员工是否存在
    const [employee] = await db.execute(
      'SELECT id FROM users WHERE id = ?',
      [employeeId]
    );

    if (employee.length === 0) {
      return ApiResponse.notFound(res, '员工不存在');
    }

    // 检查角色分配是否存在
    const [assignment] = await db.execute(
      'SELECT * FROM user_roles WHERE user_id = ? AND role_id = ?',
      [employeeId, roleId]
    );

    if (assignment.length === 0) {
      return ApiResponse.badRequest(res, '该员工未分配此角色');
    }

    // 删除角色分配
    await db.execute(
      'DELETE FROM user_roles WHERE user_id = ? AND role_id = ?',
      [employeeId, roleId]
    );

    ApiResponse.success(res, null, '角色移除成功');
  } catch (error) {
    log.error('移除角色失败:', error);
    ApiResponse.serverError(res, '移除角色失败', error);
  }
});

// ==================== 员工详情相关路由 ====================

// 获取员工详情
router.get('/:id', unifiedAuth, requirePermission('employee:view'), async (req, res) => {
  try {
    const { id } = req.params;

    const db = getDatabase();

    const query = `
      SELECT
        id,
        username,
        name,
        phone,
        email,
        salary_template_id,
        status,
        last_login,
        created_at,
        hire_date,
        COALESCE(
          (SELECT GROUP_CONCAT(r.name)
           FROM user_roles ur
           INNER JOIN roles r ON ur.role_id = r.id
           WHERE ur.user_id = users.id),
          '未分配角色'
        ) as roles,
        COALESCE(
          (SELECT GROUP_CONCAT(ur.role_id)
           FROM user_roles ur
           WHERE ur.user_id = users.id),
          ''
        ) as role_ids,
        CASE
          WHEN EXISTS(SELECT 1 FROM stores WHERE manager_id = users.id) THEN
            (SELECT name FROM stores WHERE manager_id = users.id LIMIT 1)
          ELSE '未分配'
        END as store_name,
        CASE
          WHEN users.salary_template_id IS NOT NULL THEN
            CONCAT('薪资模板-', users.salary_template_id)
          ELSE '未设置'
        END as salary_template_name
      FROM users
      WHERE id = ?
    `;

    const [employees] = await db.execute(query, [id]);

    if (employees.length === 0) {
      return ApiResponse.notFound(res, '员工不存在');
    }

    ApiResponse.success(res, employees[0]);
  } catch (error) {
    log.error('获取员工详情失败:', error);
    ApiResponse.serverError(res, '获取员工详情失败', error);
  }
});

// 创建员工
router.post('/', unifiedAuth, requirePermission('employee:create'), async (req, res) => {
  try {
    const {
      username,
      name,
      password,
      phone,
      email,
      salary_template_id,
      hire_date,
      role_id,
      role_ids
    } = req.body;

    // 验证必需字段
    if (!username || !name || !password) {
      return ApiResponse.badRequest(res, '缺少必需字段：用户名、姓名、密码');
    }

    // 验证手机号格式（如果提供）
    if (phone) {
      const phoneRegex = /^1[3-9]\d{9}$/;
      if (!phoneRegex.test(phone)) {
        return ApiResponse.badRequest(res, '手机号格式不正确');
      }
    }

    // 验证邮箱格式（如果提供）
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return ApiResponse.badRequest(res, '邮箱格式不正确');
      }
    }

    
    const db = getDatabase();

    // 检查用户名是否重复
    const [existingUsers] = await db.execute(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );

    if (existingUsers.length > 0) {
      return ApiResponse.badRequest(res, '用户名已存在');
    }

    // 检查手机号是否重复（如果提供）
    if (phone) {
      const [existingPhones] = await db.execute(
        'SELECT id FROM users WHERE phone = ?',
        [phone]
      );

      if (existingPhones.length > 0) {
        return ApiResponse.badRequest(res, '手机号已存在');
      }
    }

    // 创建新员工
    const insertQuery = `
      INSERT INTO users (
        username, name, password, phone, email,
        salary_template_id, hire_date, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())
    `;

    // 使用bcrypt加密密码（实际项目中应使用bcrypt等更安全的加密方式）
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 12);

    await db.execute(insertQuery, [
      username,
      name,
      hashedPassword,
      phone || null,
      email || null,
      salary_template_id || null,
      hire_date || null
    ]);

    const [newEmployee] = await db.execute(
      `SELECT
        id, username, name, phone, email, salary_template_id,
        status, last_login, created_at, updated_at, hire_date,
        CASE
          WHEN EXISTS(SELECT 1 FROM stores WHERE manager_id = users.id) THEN
            (SELECT name FROM stores WHERE manager_id = users.id LIMIT 1)
          ELSE '未分配'
        END as store_name
       FROM users WHERE username = ?`,
      [username]
    );

    // 处理角色关联
    const rolesToAssign = role_ids || (role_id ? [role_id] : []);

    // 如果提供了角色，创建用户角色关联
    if (rolesToAssign.length > 0) {
      for (const roleId of rolesToAssign) {
        await db.execute(
          'INSERT INTO user_roles (user_id, role_id, created_at) VALUES (?, ?, NOW())',
          [newEmployee[0].id, roleId]
        );
      }
    }

    ApiResponse.created(res, '员工创建成功', newEmployee[0]);
  } catch (error) {
    log.error('创建员工失败:', error);
    ApiResponse.serverError(res, '创建员工失败', error);
  }
});

// 更新员工
router.put('/:id', unifiedAuth, requirePermission('employee:edit'), async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const { role_id, role_ids } = updateData;

    const db = getDatabase();

    // 检查员工是否存在
    const [existingEmployee] = await db.execute(
      'SELECT id FROM users WHERE id = ?',
      [id]
    );

    if (existingEmployee.length === 0) {
      return ApiResponse.notFound(res, '员工不存在');
    }

    // 如果更新手机号，检查是否重复
    if (updateData.phone) {
      const [existingPhones] = await db.execute(
        'SELECT id FROM users WHERE phone = ? AND id != ?',
        [updateData.phone, id]
      );

      if (existingPhones.length > 0) {
        return ApiResponse.badRequest(res, '手机号已存在');
      }
    }

    // 如果更新用户名，检查是否重复
    if (updateData.username) {
      const [existingUsernames] = await db.execute(
        'SELECT id FROM users WHERE username = ? AND id != ?',
        [updateData.username, id]
      );

      if (existingUsernames.length > 0) {
        return ApiResponse.badRequest(res, '用户名已存在');
      }
    }

    // 构建更新字段
    const updateFields = [];
    const updateValues = [];

    const allowedFields = [
      'username', 'name', 'phone', 'email', 'salary_template_id', 'status', 'hire_date'
    ];

    // 处理普通字段
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        updateValues.push(updateData[field]);
      }
    }

    // 处理密码字段（需要特殊处理）
    let passwordUpdated = false;
    if (updateData.password !== undefined) {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash(updateData.password, 12);
      updateFields.push('password = ?');
      updateValues.push(hashedPassword);
      passwordUpdated = true;

      log.debug(`🔐 用户 ${id} 密码已更新，需要将旧 token 加入黑名单`);
    }

    if (updateFields.length === 0) {
      return ApiResponse.badRequest(res, '没有提供有效的更新字段');
    }

    updateValues.push(id);

    const updateQuery = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;

    log.debug('更新SQL:', updateQuery);
    log.debug('更新参数:', updateValues);

    await db.execute(updateQuery, updateValues);

    // 处理角色更新
    if (role_ids !== undefined || role_id !== undefined) {
      // 先删除原有的角色关联
      await db.execute(
        'DELETE FROM user_roles WHERE user_id = ?',
        [id]
      );

      // 处理新的角色关联
      const rolesToAssign = role_ids || (role_id ? [role_id] : []);

      // 如果有新的角色 ID，创建新的关联
      if (rolesToAssign.length > 0) {
        for (const roleId of rolesToAssign) {
          await db.execute(
            'INSERT INTO user_roles (user_id, role_id, created_at) VALUES (?, ?, NOW())',
            [id, roleId]
          );
        }
      }
    }

    const [updatedEmployee] = await db.execute(
      `SELECT
        id,
        username,
        name,
        phone,
        email,
        salary_template_id,
        status,
        last_login,
        created_at,
        updated_at,
        hire_date,
        CASE
          WHEN EXISTS(SELECT 1 FROM stores WHERE manager_id = users.id) THEN
            (SELECT name FROM stores WHERE manager_id = users.id LIMIT 1)
          ELSE '未分配'
        END as store_name,
        CASE
          WHEN users.salary_template_id IS NOT NULL THEN
            CONCAT('薪资模板-', users.salary_template_id)
          ELSE '未设置'
        END as salary_template_name
       FROM users
       WHERE id = ?`,
      [id]
    );

    // 如果更新的是自己的密码，将当前 token 加入黑名单
    if (passwordUpdated && parseInt(id) === req.user.id) {
      const authHeader = req.headers['authorization'];
      const currentToken = authHeader && authHeader.split(' ')[1];

      if (currentToken) {
        const { addToBlacklist } = require('../middleware/jwt-blacklist');
        addToBlacklist(currentToken, 'password_changed');
        log.debug(`🔐 用户 ${id} 修改密码后，当前 token 已加入黑名单`);
      }

      // 返回特殊状态码，提示前端需要重新登录
      return res.status(200).json({
        success: true,
        message: '员工更新成功，密码已修改，请重新登录',
        data: updatedEmployee[0],
        require_relogin: true,
        code: 'PASSWORD_CHANGED'
      });
    }

    ApiResponse.success(res, updatedEmployee[0], '员工更新成功');
  } catch (error) {
    log.error('更新员工失败:', error);
    ApiResponse.serverError(res, '更新员工失败', error);
  }
});

// 删除员工
router.delete('/:id', unifiedAuth, requirePermission('employee:delete'), async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    // 检查员工是否存在
    const [existingEmployee] = await db.execute(
      'SELECT id FROM users WHERE id = ?',
      [id]
    );

    if (existingEmployee.length === 0) {
      return ApiResponse.notFound(res, '员工不存在');
    }

    // 防止删除自己
    if (parseInt(id) === req.user.id) {
      return ApiResponse.badRequest(res, '不能删除自己的账户');
    }

    // 删除员工
    await db.execute('DELETE FROM users WHERE id = ?', [id]);

    ApiResponse.success(res, { id: parseInt(id) }, '员工删除成功');
  } catch (error) {
    log.error('删除员工失败:', error);
    ApiResponse.serverError(res, '删除员工失败', error);
  }
});

// 更新员工状态
router.patch('/:id/status', unifiedAuth, requirePermission('employee:edit'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (status === undefined) {
      return ApiResponse.badRequest(res, '缺少status参数');
    }

    const db = getDatabase();

    // 检查员工是否存在
    const [existingEmployee] = await db.execute(
      'SELECT id FROM users WHERE id = ?',
      [id]
    );

    if (existingEmployee.length === 0) {
      return ApiResponse.notFound(res, '员工不存在');
    }

    // 防止禁用自己
    if (parseInt(id) === req.user.id && status === 0) {
      return ApiResponse.badRequest(res, '不能禁用自己的账户');
    }

    // 更新状态
    await db.execute(
      'UPDATE users SET status = ? WHERE id = ?',
      [status, id]
    );

    const statusText = status === 1 ? '启用' : '禁用';
    ApiResponse.success(res, { id: parseInt(id), status }, `员工${statusText}成功`);
  } catch (error) {
    log.error('更新员工状态失败:', error);
    ApiResponse.serverError(res, '更新员工状态失败', error);
  }
});

// 获取员工统计信息
router.get('/stats/overview', unifiedAuth, requirePermission('employee:view'), async (req, res) => {
  try {
    const db = getDatabase();

    const statsQuery = `
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) as inactive,
        SUM(CASE WHEN phone IS NOT NULL AND phone != '' THEN 1 ELSE 0 END) as with_phone,
        SUM(CASE WHEN email IS NOT NULL AND email != '' THEN 1 ELSE 0 END) as with_email,
        SUM(CASE WHEN salary_template_id IS NOT NULL THEN 1 ELSE 0 END) as with_salary_template
      FROM users
    `;

    const [stats] = await db.execute(statsQuery);

    // 按角色统计 - 基于user_roles表
    const roleQuery = `
      SELECT r.name as role_name, COUNT(ur.user_id) as count
      FROM roles r
      LEFT JOIN user_roles ur ON r.id = ur.role_id
      GROUP BY r.id, r.name
    `;

    const [roleStats] = await db.execute(roleQuery);

    // 最近登录统计
    const recentLoginQuery = `
      SELECT COUNT(*) as recent_logins
      FROM users
      WHERE last_login >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    `;

    const [recentLoginStats] = await db.execute(recentLoginQuery);

    const result = {
      ...stats[0],
      ...recentLoginStats[0],
      byRole: roleStats.reduce((acc, role) => {
        acc[role.role_name] = role.count;
        return acc;
      }, {})
    };

    ApiResponse.success(res, result);
  } catch (error) {
    log.error('获取员工统计失败:', error);
    ApiResponse.serverError(res, '获取员工统计失败', error);
  }
});

module.exports = router;
