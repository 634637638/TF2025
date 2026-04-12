/**
 * 员工数据访问层
 * 封装所有数据库操作
 */
const { executeQuery } = require('../config/database');
const BaseRepository = require('./base.repository');
const { LEGACY_USER_ROLE_SQL_LIST } = require('../services/accessControl.service');

class EmployeeRepository extends BaseRepository {
  constructor() {
    super('users'); // 员工数据存储在users表中
  }

  /**
   * 获取员工列表（带分页和过滤）
   */
  async getEmployeesWithPagination(filters = {}, options = {}) {
    const {
      page = 1,
      limit = 10,
      name,
      role,
      status,
      store_id
    } = filters;

    const validLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 100);
    const validPage = Math.max(parseInt(page) || 1, 1);
    const offset = (validPage - 1) * validLimit;

    // 构建查询条件
    const whereConditions = [];
    const params = [];

    // 筛选员工角色
    whereConditions.push(`(u.role IN (${LEGACY_USER_ROLE_SQL_LIST}))`);

    if (name) {
      whereConditions.push('(u.name LIKE ? OR u.username LIKE ?)');
      params.push(`%${name}%`, `%${name}%`);
    }

    if (role) {
      whereConditions.push('u.role = ?');
      params.push(role);
    }

    if (status !== undefined) {
      whereConditions.push('u.status = ?');
      params.push(parseInt(status));
    }

    if (store_id) {
      whereConditions.push('u.store_id = ?');
      params.push(parseInt(store_id));
    }

    const whereClause = whereConditions.join(' AND ');

    // 排序
    const orderBy = options.orderBy || 'u.created_at DESC';

    // 查询数据
    const dataQuery = `
      SELECT
        u.id,
        u.username,
        u.name,
        u.phone,
        u.email,
        u.role,
        u.status,
        u.last_login,
        u.created_at,
        u.updated_at,
        u.hire_date,
        u.store_id,
        s.name as store_name,
        st.name as salary_template_name,
        st.id as salary_template_id,
        COALESCE(sales.total_sales, 0) as total_sales,
        COALESCE(sales.total_amount, 0) as total_sales_amount,
        COALESCE(inventory.operations_count, 0) as inventory_operations
      FROM users u
      LEFT JOIN stores s ON u.store_id = s.id
      LEFT JOIN salary_templates st ON u.salary_template_id = st.id
      LEFT JOIN (
        SELECT
          operator_id,
          COUNT(*) as total_sales,
          SUM(total_amount) as total_amount
        FROM sales
        GROUP BY operator_id
      ) sales ON u.id = sales.operator_id
      LEFT JOIN (
        SELECT
          operator_id,
          COUNT(*) as operations_count
        FROM inventory_logs
        GROUP BY operator_id
      ) inventory ON u.id = inventory.operator_id
      WHERE ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ${validLimit} OFFSET ${offset}
    `;

    const [employees] = await this.executeQuery(dataQuery, params);

    // 格式化数据
    const formattedEmployees = employees.map(row => ({
      id: parseInt(row.id),
      username: String(row.username || '').trim(),
      name: String(row.name || '').trim(),
      phone: row.phone ? String(row.phone).trim() : null,
      email: row.email ? String(row.email).trim() : null,
      role: String(row.role || '').trim(),
      status: parseInt(row.status) || 0,
      last_login: row.last_login ? new Date(row.last_login).toISOString() : null,
      created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
      updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
      hire_date: row.hire_date ? new Date(row.hire_date).toISOString().split('T')[0] : null,
      store_id: row.store_id ? parseInt(row.store_id) : null,
      store_name: row.store_name ? String(row.store_name).trim() : null,
      salary_template_id: row.salary_template_id ? parseInt(row.salary_template_id) : null,
      salary_template_name: row.salary_template_name ? String(row.salary_template_name).trim() : null,
      stats: {
        total_sales: parseInt(row.total_sales) || 0,
        total_sales_amount: parseFloat(row.total_sales_amount) || 0,
        inventory_operations: parseInt(row.inventory_operations) || 0
      }
    }));

    // 查询总数
    const countQuery = `
      SELECT COUNT(*) as total FROM users u
      WHERE ${whereClause}
    `;
    const [countResult] = await this.executeQuery(countQuery, params);
    const total = countResult[0].total;

    return {
      employees: formattedEmployees,
      pagination: {
        page: validPage,
        limit: validLimit,
        total: total,
        totalPages: Math.ceil(total / validLimit),
        hasNextPage: validPage < Math.ceil(total / validLimit),
        hasPrevPage: validPage > 1
      }
    };
  }

  /**
   * 根据ID获取员工详情
   */
  async getEmployeeById(id) {
    const employeeQuery = `
      SELECT
        u.*,
        s.name as store_name,
        st.name as salary_template_name,
        st.base_salary,
        st.commission_new,
        st.commission_used,
        st.commission_profit_percentage,
        st.overtime_rate,
        st.deduction_absent,
        st.bonus_attendance
      FROM users u
      LEFT JOIN stores s ON u.store_id = s.id
      LEFT JOIN salary_templates st ON u.salary_template_id = st.id
      WHERE u.id = ? AND u.role IN (${LEGACY_USER_ROLE_SQL_LIST})
    `;
    const [employees] = await this.executeQuery(employeeQuery, [id]);

    if (employees.length === 0) {
      return null;
    }

    const employee = employees[0];

    // 获取员工工作统计
    const [salesStats] = await this.executeQuery(`
      SELECT
        COUNT(*) as total_sales,
        SUM(total_amount) as total_amount,
        SUM(CASE WHEN type = 'new' THEN 1 ELSE 0 END) as new_sales,
        SUM(CASE WHEN type = 'used' THEN 1 ELSE 0 END) as used_sales
      FROM sales
      WHERE operator_id = ?
    `, [id]);

    const [inventoryStats] = await this.executeQuery(`
      SELECT
        COUNT(*) as total_operations,
        SUM(CASE WHEN operation_type = 'in' THEN 1 ELSE 0 END) as in_operations,
        SUM(CASE WHEN operation_type = 'out' THEN 1 ELSE 0 END) as out_operations
      FROM inventory_logs
      WHERE operator_id = ?
    `, [id]);

    return {
      id: parseInt(employee.id),
      username: String(employee.username || '').trim(),
      name: String(employee.name || '').trim(),
      phone: employee.phone ? String(employee.phone).trim() : null,
      email: employee.email ? String(employee.email).trim() : null,
      role: String(employee.role || '').trim(),
      status: parseInt(employee.status) || 0,
      last_login: employee.last_login ? new Date(employee.last_login).toISOString() : null,
      created_at: employee.created_at ? new Date(employee.created_at).toISOString() : null,
      updated_at: employee.updated_at ? new Date(employee.updated_at).toISOString() : null,
      store_id: employee.store_id ? parseInt(employee.store_id) : null,
      store_name: employee.store_name ? String(employee.store_name).trim() : null,
      salary_template: employee.salary_template_id ? {
        id: parseInt(employee.salary_template_id),
        name: String(employee.salary_template_name || '').trim(),
        base_salary: parseFloat(employee.base_salary) || 0,
        commission_new: parseFloat(employee.commission_new) || 0,
        commission_used: parseFloat(employee.commission_used) || 0,
        commission_profit_percentage: parseFloat(employee.commission_profit_percentage) || 0,
        overtime_rate: parseFloat(employee.overtime_rate) || 0,
        deduction_absent: parseFloat(employee.deduction_absent) || 0,
        bonus_attendance: parseFloat(employee.bonus_attendance) || 0
      } : null,
      stats: {
        sales: {
          total_sales: parseInt(salesStats[0].total_sales) || 0,
          total_amount: parseFloat(salesStats[0].total_amount) || 0,
          new_sales: parseInt(salesStats[0].new_sales) || 0,
          used_sales: parseInt(salesStats[0].used_sales) || 0
        },
        inventory: {
          total_operations: parseInt(inventoryStats[0].total_operations) || 0,
          in_operations: parseInt(inventoryStats[0].in_operations) || 0,
          out_operations: parseInt(inventoryStats[0].out_operations) || 0
        }
      }
    };
  }

  /**
   * 创建员工
   */
  async createEmployee(employeeData) {
    const {
      username,
      password,
      name,
      phone,
      email,
      role = 'employee',
      status = 1,
      store_id,
      salary_template_id,
      hire_date
    } = employeeData;

    const query = `
      INSERT INTO users (
        username, password, name, phone, email, role, status, store_id,
        salary_template_id, hire_date, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    const params = [
      username,
      password,
      name,
      phone || null,
      email || null,
      role,
      parseInt(status) || 1,
      store_id ? parseInt(store_id) : null,
      salary_template_id ? parseInt(salary_template_id) : null,
      hire_date || null
    ];

    const [result] = await this.executeQuery(query, params);
    return result.insertId;
  }

  /**
   * 更新员工
   */
  async updateEmployee(id, employeeData) {
    const {
      username,
      password,
      name,
      phone,
      email,
      role,
      status,
      store_id,
      salary_template_id,
      hire_date
    } = employeeData;

    let query, params;

    if (password) {
      // 更新密码
      query = `
        UPDATE users SET
          username = ?, password = ?, name = ?, phone = ?, email = ?,
          role = ?, status = ?, store_id = ?, salary_template_id = ?,
          hire_date = ?, updated_at = NOW()
        WHERE id = ? AND role IN (${LEGACY_USER_ROLE_SQL_LIST})
      `;
      params = [
        username,
        password,
        name,
        phone || null,
        email || null,
        role,
        parseInt(status) || 0,
        store_id ? parseInt(store_id) : null,
        salary_template_id ? parseInt(salary_template_id) : null,
        hire_date || null,
        parseInt(id)
      ];
    } else {
      // 不更新密码
      query = `
        UPDATE users SET
          username = ?, name = ?, phone = ?, email = ?, role = ?, status = ?,
          store_id = ?, salary_template_id = ?, hire_date = ?, updated_at = NOW()
        WHERE id = ? AND role IN (${LEGACY_USER_ROLE_SQL_LIST})
      `;
      params = [
        username,
        name,
        phone || null,
        email || null,
        role,
        parseInt(status) || 0,
        store_id ? parseInt(store_id) : null,
        salary_template_id ? parseInt(salary_template_id) : null,
        hire_date || null,
        parseInt(id)
      ];
    }

    const [result] = await this.executeQuery(query, params);
    return result.affectedRows > 0;
  }

  /**
   * 删除员工
   */
  async deleteEmployee(id) {
    // 检查是否有关联记录
    const [salesCount] = await this.executeQuery(
      'SELECT COUNT(*) as count FROM sales WHERE operator_id = ?',
      [id]
    );
    const [inventoryCount] = await this.executeQuery(
      'SELECT COUNT(*) as count FROM inventory_logs WHERE operator_id = ?',
      [id]
    );

    if (salesCount[0].count > 0 || inventoryCount[0].count > 0) {
      return {
        canDelete: false,
        reason: `该员工还有关联的销售记录(${salesCount[0].count}条)或库存记录(${inventoryCount[0].count}条)，无法删除`,
        salesCount: salesCount[0].count,
        inventoryCount: inventoryCount[0].count
      };
    }

    const [result] = await this.executeQuery(
      `DELETE FROM users WHERE id = ? AND role IN (${LEGACY_USER_ROLE_SQL_LIST})`,
      [id]
    );

    return {
      canDelete: true,
      deleted: result.affectedRows > 0
    };
  }

  /**
   * 批量更新员工状态
   */
  async batchUpdateStatus(ids, status) {
    const placeholders = ids.map(() => '?').join(',');
    const query = `
      UPDATE users
      SET status = ?, updated_at = NOW()
      WHERE id IN (${placeholders}) AND role IN (${LEGACY_USER_ROLE_SQL_LIST})
    `;

    const params = [parseInt(status), ...ids.map(id => parseInt(id))];
    const [result] = await this.executeQuery(query, params);
    return result.affectedRows;
  }

  /**
   * 搜索员工
   */
  async searchEmployees(keyword, filters = {}) {
    const { page = 1, limit = 20, role, status, store_id } = filters;
    const validLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
    const validPage = Math.max(parseInt(page) || 1, 1);
    const offset = (validPage - 1) * validLimit;

    const whereConditions = [
      `(u.role IN (${LEGACY_USER_ROLE_SQL_LIST}))`,
      '(u.name LIKE ? OR u.username LIKE ? OR u.phone LIKE ?)'
    ];
    const params = [
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`
    ];

    if (role) {
      whereConditions.push('u.role = ?');
      params.push(role);
    }

    if (status !== undefined) {
      whereConditions.push('u.status = ?');
      params.push(parseInt(status));
    }

    if (store_id) {
      whereConditions.push('u.store_id = ?');
      params.push(parseInt(store_id));
    }

    const whereClause = whereConditions.join(' AND ');

    const query = `
      SELECT
        u.*,
        s.name as store_name,
        st.name as salary_template_name
      FROM users u
      LEFT JOIN stores s ON u.store_id = s.id
      LEFT JOIN salary_templates st ON u.salary_template_id = st.id
      WHERE ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT ${validLimit} OFFSET ${offset}
    `;

    const [employees] = await this.executeQuery(query, params);

    // 查询总数
    const countQuery = `
      SELECT COUNT(*) as total FROM users u
      WHERE ${whereClause}
    `;
    const [countResult] = await this.executeQuery(countQuery, params);
    const total = countResult[0].total;

    return {
      employees: employees.map(row => ({
        id: parseInt(row.id),
        username: String(row.username || '').trim(),
        name: String(row.name || '').trim(),
        phone: row.phone ? String(row.phone).trim() : null,
        email: row.email ? String(row.email).trim() : null,
        role: String(row.role || '').trim(),
        status: parseInt(row.status) || 0,
        store_id: row.store_id ? parseInt(row.store_id) : null,
        store_name: row.store_name ? String(row.store_name).trim() : null,
        salary_template_name: row.salary_template_name ? String(row.salary_template_name).trim() : null,
        created_at: row.created_at ? new Date(row.created_at).toISOString() : null
      })),
      pagination: {
        page: validPage,
        limit: validLimit,
        total: total,
        totalPages: Math.ceil(total / validLimit),
        hasNextPage: validPage < Math.ceil(total / validLimit),
        hasPrevPage: validPage > 1
      }
    };
  }

  /**
   * 检查用户名是否可用
   */
  async checkUsernameAvailability(username, excludeId = null) {
    let query = `
      SELECT id FROM users
      WHERE username = ? AND role IN (${LEGACY_USER_ROLE_SQL_LIST})
    `;
    let params = [username];

    if (excludeId) {
      query += ' AND id != ?';
      params.push(parseInt(excludeId));
    }

    const [result] = await this.executeQuery(query, params);
    return result.length === 0;
  }

  /**
   * 获取员工统计信息
   */
  async getEmployeeStats() {
    const [totalStats] = await this.executeQuery(`
      SELECT
        COUNT(*) as total_employees,
        COUNT(CASE WHEN status = 1 THEN 1 END) as active_employees,
        COUNT(CASE WHEN status = 0 THEN 1 END) as inactive_employees,
        COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_count,
        COUNT(CASE WHEN role = 'manager' THEN 1 END) as manager_count,
        COUNT(CASE WHEN role = 'employee' THEN 1 END) as employee_count
      FROM users
      WHERE role IN (${LEGACY_USER_ROLE_SQL_LIST})
    `);

    const [storeStats] = await this.executeQuery(`
      SELECT
        s.id as store_id,
        s.name as store_name,
        COUNT(u.id) as employee_count
      FROM stores s
      LEFT JOIN users u ON s.id = u.store_id AND u.status = 1 AND u.role IN (${LEGACY_USER_ROLE_SQL_LIST})
      GROUP BY s.id, s.name
      ORDER BY employee_count DESC
    `);

    return {
      total_employees: parseInt(totalStats[0].total_employees) || 0,
      active_employees: parseInt(totalStats[0].active_employees) || 0,
      inactive_employees: parseInt(totalStats[0].inactive_employees) || 0,
      admin_count: parseInt(totalStats[0].admin_count) || 0,
      manager_count: parseInt(totalStats[0].manager_count) || 0,
      employee_count: parseInt(totalStats[0].employee_count) || 0,
      store_distribution: storeStats.map(row => ({
        store_id: parseInt(row.store_id),
        store_name: String(row.store_name || '').trim(),
        employee_count: parseInt(row.employee_count) || 0
      }))
    };
  }

  /**
   * 获取活跃员工
   */
  async getActiveEmployees() {
    const query = `
      SELECT
        id, username, name, role, store_id
      FROM users
      WHERE status = 1 AND role IN (${LEGACY_USER_ROLE_SQL_LIST})
      ORDER BY name
    `;

    const [employees] = await this.executeQuery(query);
    return employees.map(row => ({
      id: parseInt(row.id),
      username: String(row.username || '').trim(),
      name: String(row.name || '').trim(),
      role: String(row.role || '').trim(),
      store_id: row.store_id ? parseInt(row.store_id) : null
    }));
  }

  /**
   * 获取员工排行榜
   */
  async getEmployeeRanking(filters = {}) {
    const { type = 'sales', period = 'month', limit = 10 } = filters;

    let dateFilter = '';
    const params = [];

    if (period === 'today') {
      dateFilter = 'AND DATE(s.created_at) = CURDATE()';
    } else if (period === 'week') {
      dateFilter = 'AND s.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
    } else if (period === 'month') {
      dateFilter = 'AND s.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
    }

    let query = '';
    if (type === 'sales') {
      query = `
        SELECT
          u.id,
          u.name,
          u.role,
          COUNT(s.id) as total_sales,
          SUM(s.total_amount) as total_amount,
          AVG(s.total_amount) as avg_amount
        FROM users u
        LEFT JOIN sales s ON u.id = s.operator_id ${dateFilter}
        WHERE u.status = 1 AND u.role IN (${LEGACY_USER_ROLE_SQL_LIST})
        GROUP BY u.id, u.name, u.role
        HAVING total_sales > 0
        ORDER BY total_amount DESC
        LIMIT ?
      `;
    } else if (type === 'inventory') {
      query = `
        SELECT
          u.id,
          u.name,
          u.role,
          COUNT(il.id) as total_operations
        FROM users u
        LEFT JOIN inventory_logs il ON u.id = il.operator_id ${dateFilter}
        WHERE u.status = 1 AND u.role IN (${LEGACY_USER_ROLE_SQL_LIST})
        GROUP BY u.id, u.name, u.role
        HAVING total_operations > 0
        ORDER BY total_operations DESC
        LIMIT ?
      `;
    }

    params.push(parseInt(limit));
    const [results] = await this.executeQuery(query, params);

    return results.map(row => ({
      employee_id: parseInt(row.id),
      employee_name: String(row.name || '').trim(),
      role: String(row.role || '').trim(),
      total_sales: row.total_sales ? parseInt(row.total_sales) : 0,
      total_amount: row.total_amount ? parseFloat(row.total_amount) : 0,
      avg_amount: row.avg_amount ? parseFloat(row.avg_amount) : 0,
      total_operations: row.total_operations ? parseInt(row.total_operations) : 0,
      rank: 0 // 将在业务逻辑层设置
    }));
  }

  /**
   * 导出员工数据
   */
  async exportEmployees(filters = {}) {
    const { name, role, status, store_id } = filters;

    const whereConditions = [
      `(u.role IN (${LEGACY_USER_ROLE_SQL_LIST}))`
    ];
    const params = [];

    if (name) {
      whereConditions.push('(u.name LIKE ? OR u.username LIKE ?)');
      params.push(`%${name}%`, `%${name}%`);
    }

    if (role) {
      whereConditions.push('u.role = ?');
      params.push(role);
    }

    if (status !== undefined) {
      whereConditions.push('u.status = ?');
      params.push(parseInt(status));
    }

    if (store_id) {
      whereConditions.push('u.store_id = ?');
      params.push(parseInt(store_id));
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const query = `
      SELECT
        u.id,
        u.username,
        u.name,
        u.phone,
        u.email,
        u.role,
        u.status,
        u.last_login,
        u.created_at,
        s.name as store_name,
        st.name as salary_template_name,
        COALESCE(sales.total_sales, 0) as total_sales,
        COALESCE(sales.total_amount, 0) as total_sales_amount
      FROM users u
      LEFT JOIN stores s ON u.store_id = s.id
      LEFT JOIN salary_templates st ON u.salary_template_id = st.id
      LEFT JOIN (
        SELECT
          operator_id,
          COUNT(*) as total_sales,
          SUM(total_amount) as total_amount
        FROM sales
        GROUP BY operator_id
      ) sales ON u.id = sales.operator_id
      ${whereClause}
      ORDER BY u.created_at DESC
    `;

    const [employees] = await this.executeQuery(query, params);

    return employees.map(row => ({
      ID: parseInt(row.id),
      用户名: String(row.username || '').trim(),
      姓名: String(row.name || '').trim(),
      联系电话: row.phone ? String(row.phone).trim() : '',
      邮箱: row.email ? String(row.email).trim() : '',
      角色: String(row.role || '').trim(),
      状态: parseInt(row.status) === 1 ? '启用' : '禁用',
      所属商店: row.store_name ? String(row.store_name).trim() : '',
      薪资模板: row.salary_template_name ? String(row.salary_template_name).trim() : '',
      总销售数量: parseInt(row.total_sales) || 0,
      总销售金额: parseFloat(row.total_sales_amount) || 0,
      最后登录: row.last_login ? new Date(row.last_login).toLocaleString() : '',
      创建时间: row.created_at ? new Date(row.created_at).toLocaleString() : ''
    }));
  }
}

module.exports = EmployeeRepository;
