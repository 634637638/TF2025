const log = require('../utils/log');
/**
 * 统一角色管理控制器
 * 合并原有的角色管理和操作员管理功能
 */

const mysql = require('mysql2/promise');

// 创建数据库连接池
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'TF2025',
  password: process.env.DB_PASSWORD || 'TF2025',
  database: process.env.DB_NAME || 'TF2025',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4'
});

class UnifiedRoleController {
  /**
   * 获取所有角色（系统+业务）
   */
  async getAllRoles(req, res) {
    try {
      const { type, page = 1, limit = 50, search } = req.query;

      // 简化查询，先获取所有角色
      const query = `
        SELECT
          r.id,
          r.name,
          r.description,
          r.role_type,
          r.group_name,
          r.hierarchy_level,
          r.status,
          r.is_active,
          r.created_at,
          r.updated_at,
          (SELECT COUNT(*) FROM user_roles ur WHERE ur.role_id = r.id) as user_count
        FROM roles r
        ORDER BY r.hierarchy_level DESC, r.role_type, r.name
      `;

      const [rolesResult] = await pool.execute(query);

      // 客户端过滤和分页
      let filteredRoles = rolesResult;

      // 角色类型过滤
      if (type && ['system', 'business'].includes(type)) {
        filteredRoles = filteredRoles.filter(role => role.role_type === type);
      }

      // 搜索功能
      if (search) {
        const searchLower = search.toLowerCase();
        filteredRoles = filteredRoles.filter(role =>
          role.name.toLowerCase().includes(searchLower) ||
          (role.description && role.description.toLowerCase().includes(searchLower))
        );
      }

      // 分页
      const total = filteredRoles.length;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const paginatedRoles = filteredRoles.slice(offset, offset + parseInt(limit));

      res.json({
        success: true,
        data: paginatedRoles,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      log.error('获取角色列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取角色列表失败',
        error: error.message
      });
    }
  }

  /**
   * 获取角色详情
   */
  async getRoleById(req, res) {
    try {
      const { id } = req.params;

      const query = `
        SELECT
          r.*,
          COUNT(ur.user_id) as user_count
        FROM roles r
        LEFT JOIN user_roles ur ON r.id = ur.role_id
        WHERE r.id = ?
        GROUP BY r.id
      `;

      const [result] = await pool.execute(query, [id]);

      if (result.length === 0) {
        return res.status(404).json({
          success: false,
          message: '角色不存在'
        });
      }

      // 获取角色权限
      const permissionsQuery = `
        SELECT module_key, permission_type, module_category
        FROM role_permissions
        WHERE role_id = ?
      `;

      const [permissionsResult] = await pool.execute(permissionsQuery, [id]);

      const role = result[0];
      role.permissions = permissionsResult;

      res.json({
        success: true,
        data: role
      });
    } catch (error) {
      log.error('获取角色详情失败:', error);
      res.status(500).json({
        success: false,
        message: '获取角色详情失败',
        error: error.message
      });
    }
  }

  /**
   * 创建角色
   */
  async createRole(req, res) {
    const connection = await pool.getConnection();

    try {
      const {
        name,
        description,
        role_type = 'system',
        group_name = null,
        hierarchy_level = 50,
        permissions = [],
        status = 'active'
      } = req.body;

      // 验证必填字段
      if (!name || !description) {
        return res.status(400).json({
          success: false,
          message: '角色名称和描述不能为空'
        });
      }

      await connection.beginTransaction();

      // 检查角色名称是否已存在
      const [existingRoleResult] = await connection.execute(
        'SELECT id FROM roles WHERE name = ?',
        [name]
      );

      if (existingRoleResult.length > 0) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: '角色名称已存在'
        });
      }

      // 创建角色
      const [roleResult] = await connection.execute(`
        INSERT INTO roles (name, description, role_type, group_name, hierarchy_level, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
      `, [name, description, role_type, group_name, hierarchy_level, status]);

      const newRoleId = roleResult.insertId;

      // 添加权限
      if (permissions && permissions.length > 0) {
        for (const perm of permissions) {
          await connection.execute(`
            INSERT INTO role_permissions (role_id, module_key, permission_type, module_category, created_at, updated_at)
            VALUES (?, ?, ?, ?, NOW(), NOW())
          `, [newRoleId, perm.module_key, perm.permission_type, perm.module_category || role_type]);
        }
      }

      await connection.commit();

      // 返回完整的角色信息
      const fullRoleQuery = `
        SELECT
          r.*,
          COUNT(ur.user_id) as user_count
        FROM roles r
        LEFT JOIN user_roles ur ON r.id = ur.role_id
        WHERE r.id = ?
        GROUP BY r.id
      `;

      const [fullRoleResult] = await pool.execute(fullRoleQuery, [newRoleId]);

      res.status(201).json({
        success: true,
        message: '角色创建成功',
        data: fullRoleResult[0]
      });
    } catch (error) {
      await connection.rollback();
      log.error('创建角色失败:', error);
      res.status(500).json({
        success: false,
        message: '创建角色失败',
        error: error.message
      });
    } finally {
      connection.release();
    }
  }

  /**
   * 更新角色
   */
  async updateRole(req, res) {
    const connection = await pool.getConnection();

    try {
      const { id } = req.params;
      const {
        name,
        description,
        role_type,
        group_name,
        hierarchy_level,
        permissions,
        status
      } = req.body;

      // 检查角色是否存在
      const [existingRoleResult] = await connection.execute(
        'SELECT * FROM roles WHERE id = ?',
        [id]
      );

      if (existingRoleResult.length === 0) {
        return res.status(404).json({
          success: false,
          message: '角色不存在'
        });
      }

      await connection.beginTransaction();

      // 检查名称是否与其他角色冲突
      if (name && name !== existingRoleResult[0].name) {
        const [nameCheckResult] = await connection.execute(
          'SELECT id FROM roles WHERE name = ? AND id != ?',
          [name, id]
        );

        if (nameCheckResult.length > 0) {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            message: '角色名称已存在'
          });
        }
      }

      // 更新角色基本信息
      const updateRoleQuery = `
        UPDATE roles
        SET name = COALESCE(?, name),
            description = COALESCE(?, description),
            role_type = COALESCE(?, role_type),
            group_name = COALESCE(?, group_name),
            hierarchy_level = COALESCE(?, hierarchy_level),
            status = COALESCE(?, status),
            updated_at = NOW()
        WHERE id = ?
      `;

      await connection.execute(updateRoleQuery, [
        name, description, role_type, group_name, hierarchy_level, status, id
      ]);

      // 更新权限
      if (permissions !== undefined) {
        // 删除现有权限
        await connection.execute('DELETE FROM role_permissions WHERE role_id = ?', [id]);

        // 添加新权限
        if (permissions && permissions.length > 0) {
          for (const perm of permissions) {
            await connection.execute(`
              INSERT INTO role_permissions (role_id, module_key, permission_type, module_category, created_at, updated_at)
              VALUES (?, ?, ?, ?, NOW(), NOW())
            `, [id, perm.module_key, perm.permission_type, perm.module_category || role_type]);
          }
        }
      }

      await connection.commit();

      // 返回更新后的角色信息
      const updatedRoleQuery = `
        SELECT
          r.*,
          COUNT(ur.user_id) as user_count
        FROM roles r
        LEFT JOIN user_roles ur ON r.id = ur.role_id
        WHERE r.id = ?
        GROUP BY r.id
      `;

      const [updatedRoleResult] = await pool.execute(updatedRoleQuery, [id]);

      res.json({
        success: true,
        message: '角色更新成功',
        data: updatedRoleResult[0]
      });
    } catch (error) {
      await connection.rollback();
      log.error('更新角色失败:', error);
      res.status(500).json({
        success: false,
        message: '更新角色失败',
        error: error.message
      });
    } finally {
      connection.release();
    }
  }

  /**
   * 删除角色
   */
  async deleteRole(req, res) {
    const connection = await pool.getConnection();

    try {
      const { id } = req.params;

      // 检查角色是否存在
      const [existingRoleResult] = await connection.execute(
        'SELECT * FROM roles WHERE id = ?',
        [id]
      );

      if (existingRoleResult.length === 0) {
        return res.status(404).json({
          success: false,
          message: '角色不存在'
        });
      }

      // 检查是否有用户在使用该角色
      const [userRolesResult] = await connection.execute(
        'SELECT COUNT(*) as count FROM user_roles WHERE role_id = ?',
        [id]
      );

      if (userRolesResult[0].count > 0) {
        return res.status(400).json({
          success: false,
          message: '无法删除，该角色下还有用户'
        });
      }

      await connection.beginTransaction();

      // 删除角色权限
      await connection.execute('DELETE FROM role_permissions WHERE role_id = ?', [id]);

      // 删除用户角色关联
      await connection.execute('DELETE FROM user_roles WHERE role_id = ?', [id]);

      // 删除角色
      await connection.execute('DELETE FROM roles WHERE id = ?', [id]);

      await connection.commit();

      res.json({
        success: true,
        message: '角色删除成功'
      });
    } catch (error) {
      await connection.rollback();
      log.error('删除角色失败:', error);
      res.status(500).json({
        success: false,
        message: '删除角色失败',
        error: error.message
      });
    } finally {
      connection.release();
    }
  }

  /**
   * 获取角色层级
   */
  async getRoleHierarchy(req, res) {
    try {
      const query = `
        SELECT
          name,
          role_type,
          hierarchy_level,
          group_name,
          description
        FROM roles
        WHERE status = 'active'
        ORDER BY hierarchy_level DESC, role_type, name
      `;

      const [result] = await pool.execute(query);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      log.error('获取角色层级失败:', error);
      res.status(500).json({
        success: false,
        message: '获取角色层级失败',
        error: error.message
      });
    }
  }

  /**
   * 获取用户角色
   */
  async getUserRoles(req, res) {
    try {
      const { userId } = req.params;

      const query = `
        SELECT
          r.*
        FROM roles r
        JOIN user_roles ur ON r.id = ur.role_id
        WHERE ur.user_id = ?
        AND r.status = 'active'
        ORDER BY r.hierarchy_level DESC, r.role_type, r.name
      `;

      const [result] = await pool.execute(query, [userId]);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      log.error('获取用户角色失败:', error);
      res.status(500).json({
        success: false,
        message: '获取用户角色失败',
        error: error.message
      });
    }
  }

  /**
   * 分配用户角色
   */
  async assignUserRoles(req, res) {
    const connection = await pool.getConnection();

    try {
      const { userId } = req.params;
      const { roleIds } = req.body;

      if (!Array.isArray(roleIds)) {
        return res.status(400).json({
          success: false,
          message: '角色ID必须是数组'
        });
      }

      // 检查用户是否存在
      const [userResult] = await connection.execute(
        'SELECT id FROM users WHERE id = ?',
        [userId]
      );

      if (userResult.length === 0) {
        return res.status(404).json({
          success: false,
          message: '用户不存在'
        });
      }

      await connection.beginTransaction();

      // 删除现有角色关联
      await connection.execute('DELETE FROM user_roles WHERE user_id = ?', [userId]);

      // 添加新的角色关联
      if (roleIds.length > 0) {
        for (const roleId of roleIds) {
          await connection.execute(`
            INSERT INTO user_roles (user_id, role_id, assigned_at)
            VALUES (?, ?, NOW())
          `, [userId, roleId]);
        }
      }

      await connection.commit();

      // 返回更新后的用户角色
      const updatedRolesQuery = `
        SELECT
          r.*
        FROM roles r
        JOIN user_roles ur ON r.id = ur.role_id
        WHERE ur.user_id = ?
        ORDER BY r.hierarchy_level DESC
      `;

      const [updatedRolesResult] = await pool.execute(updatedRolesQuery, [userId]);

      res.json({
        success: true,
        message: '用户角色分配成功',
        data: updatedRolesResult
      });
    } catch (error) {
      await connection.rollback();
      log.error('分配用户角色失败:', error);
      res.status(500).json({
        success: false,
        message: '分配用户角色失败',
        error: error.message
      });
    } finally {
      connection.release();
    }
  }

  /**
   * 获取角色下的用户
   */
  async getRoleUsers(req, res) {
    try {
      const { roleId } = req.params;
      const { page = 1, limit = 50 } = req.query;

      const offset = (page - 1) * limit;

      const query = `
        SELECT
          u.id,
          u.username,
          u.name,
          u.real_name,
          u.email,
          u.phone,
          u.status,
          u.id as sort_key
        FROM users u
        JOIN user_roles ur ON u.id = ur.user_id
        WHERE ur.role_id = ?
        ORDER BY sort_key DESC
        LIMIT ? OFFSET ?
      `;

      const countQuery = `
        SELECT COUNT(*) as total
        FROM users u
        JOIN user_roles ur ON u.id = ur.user_id
        WHERE ur.role_id = ?
      `;

      const [usersResult, countResult] = await Promise.all([
        pool.execute(query, [roleId, parseInt(limit), offset]),
        pool.execute(countQuery, [roleId])
      ]);

      const total = countResult[0][0].total;

      res.json({
        success: true,
        data: usersResult[0],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      log.error('获取角色用户失败:', error);
      res.status(500).json({
        success: false,
        message: '获取角色用户失败',
        error: error.message
      });
    }
  }

  /**
   * 获取用户统计信息
   */
  async getUserStats(req, res) {
    try {
      const query = `
        SELECT
          COUNT(DISTINCT u.id) as total_users,
          COUNT(DISTINCT CASE WHEN u.status = 'active' THEN u.id END) as active_users,
          COUNT(DISTINCT r.id) as total_roles,
          COUNT(DISTINCT CASE WHEN r.role_type = 'system' THEN r.id END) as system_roles,
          COUNT(DISTINCT CASE WHEN r.role_type = 'business' THEN r.id END) as business_roles,
          COUNT(DISTINCT ur.user_id) as users_with_roles,
          COUNT(rp.id) as total_permissions
        FROM users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id
        LEFT JOIN roles r ON ur.role_id = r.id
        LEFT JOIN role_permissions rp ON r.id = rp.role_id
      `;

      const [result] = await pool.execute(query);

      res.json({
        success: true,
        data: result[0]
      });
    } catch (error) {
      log.error('获取用户统计失败:', error);
      res.status(500).json({
        success: false,
        message: '获取用户统计失败',
        error: error.message
      });
    }
  }
}

module.exports = UnifiedRoleController;