const { getDatabase } = require('../config/database');
const { hasColumn } = require('./schemaInspector.service');
const log = require('../utils/log');

class PermissionService {
  get pool() {
    return getDatabase();
  }

  /**
   * 获取所有角色
   */
  async getAllRoles() {
    try {
      const [rows] = await this.pool.execute(`
        SELECT
          id,
          name,
          description,
          role_type,
          is_active,
          (SELECT COUNT(*) FROM user_roles ur WHERE ur.role_id = roles.id) as user_count,
          created_at,
          updated_at
        FROM roles
        ORDER BY id
      `);

      // 为每个角色添加status字段以兼容前端
      return rows.map(role => ({
        ...role,
        status: role.is_active === 1 ? 'active' : 'inactive'
      }));
    } catch (error) {
      log.error('获取角色列表失败:', error);
      throw error;
    }
  }

  /**
   * 创建新角色
   */
  async createRole(roleData) {
    try {
      const { name, description, role_type, is_active } = roleData;

      const [result] = await this.pool.execute(
        'INSERT INTO roles (name, description, role_type, is_active) VALUES (?, ?, ?, ?)',
        [name, description || '', role_type || 'employee', is_active !== undefined ? is_active : 1]
      );

      return { id: result.insertId, name, description, role_type: role_type || 'employee', is_active: 1 };
    } catch (error) {
      log.error('创建角色失败:', error);
      throw error;
    }
  }

  /**
   * 更新角色
   */
  async updateRole(id, roleData) {
    try {
      const { name, description, role_type, is_active, status } = roleData;

      // 兼容前端发送的status字段，转换为is_active
      let finalIsActive = is_active !== undefined ? is_active : 1;
      if (status !== undefined) {
        finalIsActive = status === 'active' ? 1 : 0;
      }

      await this.pool.execute(
        'UPDATE roles SET name = ?, description = ?, role_type = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [name, description || '', role_type || 'employee', finalIsActive, id]
      );

      return {
        id,
        name,
        description,
        role_type: role_type || 'employee',
        is_active: finalIsActive,
        status: finalIsActive === 1 ? 'active' : 'inactive' // 同时返回status字段供前端使用
      };
    } catch (error) {
      log.error('更新角色失败:', error);
      throw error;
    }
  }

  /**
   * 删除角色
   */
  async deleteRole(id) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();

      // 检查是否有用户使用该角色
      const [userRoles] = await connection.execute(
        'SELECT COUNT(*) as count FROM user_roles WHERE role_id = ?',
        [id]
      );

      if (userRoles[0].count > 0) {
        await connection.rollback();
        throw new Error('该角色下还有用户，无法删除');
      }

      // 删除角色权限
      await connection.execute('DELETE FROM role_permissions WHERE role_id = ?', [id]);

      // 删除菜单权限
      await connection.execute('DELETE FROM menu_roles WHERE role_id = ?', [id]);

      // 删除角色
      await connection.execute('DELETE FROM roles WHERE id = ?', [id]);

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 获取所有模块
   */
  async getAllModules() {
    try {
      const [rows] = await this.pool.execute(`
        SELECT * FROM modules ORDER BY sort_order ASC, name ASC
      `);

      return rows;
    } catch (error) {
      log.error('获取模块列表失败:', error);
      throw error;
    }
  }

  /**
   * 获取角色权限
   */
  async getRolePermissions(roleId) {
    try {
      const [rows] = await this.pool.execute(`
        SELECT
          rp.id,
          rp.module_key,
          rp.permission_type,
          m.name as module_name,
          m.description as module_description
        FROM role_permissions rp
        LEFT JOIN modules m ON rp.module_key COLLATE utf8mb4_unicode_ci = m.\`key\` COLLATE utf8mb4_unicode_ci
        WHERE rp.role_id = ?
        ORDER BY m.sort_order ASC, m.name ASC
      `, [roleId]);

      return rows;
    } catch (error) {
      log.error('获取角色权限失败:', error);
      throw error;
    }
  }

  /**
   * 获取角色权限矩阵（完整格式）
   */
  async getRolePermissionMatrix(roleId) {
    try {
      // 获取所有模块
      const [modules] = await this.pool.execute(`
        SELECT
          \`key\`,
          name,
          description,
          icon,
          sort_order
        FROM modules
        ORDER BY sort_order ASC, name ASC
      `);

      // 获取角色已有的权限
      const [permissions] = await this.pool.execute(`
        SELECT module_key, permission_type
        FROM role_permissions
        WHERE role_id = ?
      `, [roleId]);

      // 创建权限映射
      const permissionMap = new Map();
      permissions.forEach(perm => {
        permissionMap.set(`${perm.module_key}:${perm.permission_type}`, true);
      });

      // 定义所有可能的权限类型
      const permissionTypes = ['view', 'create', 'edit', 'delete', 'export', 'import', 'sell'];

      // 构建权限矩阵
      const permissionMatrix = modules.map(module => {
        const modulePermissions = permissionTypes.map(type => ({
          type: type,
          granted: permissionMap.has(`${module.key}:${type}`)
        }));

        return {
          key: module.key,
          name: module.name,
          description: module.description || '',
          icon: module.icon || 'fas fa-cog',
          permissions: modulePermissions
        };
      });

      return permissionMatrix;
    } catch (error) {
      log.error('获取角色权限矩阵失败:', error);
      throw error;
    }
  }

  /**
   * 设置角色权限
   */
  async setRolePermissions(roleId, permissions) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();

      // 删除现有权限
      await connection.execute('DELETE FROM role_permissions WHERE role_id = ?', [roleId]);

      // 添加新权限
      if (permissions && permissions.length > 0) {
        for (const permission of permissions) {
          await connection.execute(
            'INSERT INTO role_permissions (role_id, module_key, permission_type) VALUES (?, ?, ?)',
            [roleId, permission.module_key, permission.permission_type]
          );
        }
      }

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      log.error('设置角色权限失败:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 为角色选择所有权限
   */
  async selectAllPermissions(roleId) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();

      // 删除现有权限
      await connection.execute('DELETE FROM role_permissions WHERE role_id = ?', [roleId]);

      // 获取所有模块
      const [modules] = await connection.execute(`
        SELECT \`key\` FROM modules ORDER BY sort_order ASC, name ASC
      `);

      // 定义所有权限类型
      const permissionTypes = ['view', 'create', 'edit', 'delete', 'export', 'import', 'sell'];

      // 为每个模块添加所有权限
      for (const module of modules) {
        for (const permissionType of permissionTypes) {
          await connection.execute(
            'INSERT INTO role_permissions (role_id, module_key, permission_type) VALUES (?, ?, ?)',
            [roleId, module.key, permissionType]
          );
        }
      }

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      log.error('选择所有权限失败:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 清空角色所有权限
   */
  async clearAllPermissions(roleId) {
    try {
      await this.pool.execute('DELETE FROM role_permissions WHERE role_id = ?', [roleId]);
      return true;
    } catch (error) {
      log.error('清空所有权限失败:', error);
      throw error;
    }
  }

  /**
   * 获取角色菜单权限
   */
  async getRoleMenus(roleId) {
    try {
      const [rows] = await this.pool.execute(`
        SELECT
          mr.menu_id,
          m.name,
          m.url,
          m.icon,
          m.parent_id
        FROM menu_roles mr
        LEFT JOIN menus m ON mr.menu_id = m.id
        WHERE mr.role_id = ? AND m.is_active = 1
        ORDER BY m.sort_order ASC, m.id ASC
      `, [roleId]);

      return rows;
    } catch (error) {
      log.error('获取角色菜单权限失败:', error);
      throw error;
    }
  }

  /**
   * 设置角色菜单权限
   */
  async setRoleMenus(roleId, menuIds) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();

      // 删除现有菜单权限
      await connection.execute('DELETE FROM menu_roles WHERE role_id = ?', [roleId]);

      // 添加新菜单权限
      if (menuIds && menuIds.length > 0) {
        for (const menuId of menuIds) {
          await connection.execute(
            'INSERT INTO menu_roles (role_id, menu_id) VALUES (?, ?)',
            [roleId, menuId]
          );
        }
      }

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      log.error('设置角色菜单权限失败:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 获取用户角色（统一实现）
   */
  async getUserRoles(userId) {
    try {
      const [rows] = await this.pool.execute(`
        SELECT
          ur.role_id,
          ur.assigned_by,
          ur.assigned_at,
          ur.expires_at,
          ur.status as ur_status,
          r.id,
          r.name,
          r.description,
          r.role_type,
          r.is_active as r_is_active
        FROM user_roles ur
        LEFT JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = ? AND ur.status = 'active'
        ORDER BY ur.assigned_at DESC
      `, [userId]);

      // 统一返回格式
      return rows.map(row => ({
        role_id: row.role_id,
        id: row.id,
        name: row.name,
        description: row.description,
        role_type: row.role_type,
        is_active: row.r_is_active,
        assigned_by: row.assigned_by,
        assigned_at: row.assigned_at,
        expires_at: row.expires_at,
        status: row.ur_status,
        // 兼容性字段
        active: row.r_is_active === 1 && row.ur_status === 'active',
        valid: !row.expires_at || new Date(row.expires_at) > new Date()
      }));
    } catch (error) {
      log.error('获取用户角色失败:', error);
      throw error;
    }
  }

  /**
   * 设置用户角色（简化版本）
   */
  async setUserRoles(userId, roleIds, assignedBy = null) {
    log.debug(`🔧 开始设置用户 ${userId} 的角色:`, roleIds);

    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();

      // 先删除所有现有角色
      log.debug(`🗑️ 删除用户 ${userId} 的现有角色...`);
      await connection.execute(
        'DELETE FROM user_roles WHERE user_id = ?',
        [userId]
      );

      // 插入新角色
      if (roleIds && roleIds.length > 0) {
        log.debug(`➕ 为用户 ${userId} 插入 ${roleIds.length} 个角色...`);

        for (const roleId of roleIds) {
          await connection.execute(
            'INSERT INTO user_roles (user_id, role_id, assigned_by, assigned_at, status) VALUES (?, ?, ?, NOW(), ?)',
            [userId, roleId, assignedBy || userId, 'active']
          );
        }
      }

      await connection.commit();
      log.debug(`✅ 用户 ${userId} 角色设置成功`);
      return true;
    } catch (error) {
      await connection.rollback();
      log.error('❌ 设置用户角色失败:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 检查用户权限
   */
  async checkUserPermission(userId, moduleKey, permissionType) {
    try {
      const [rows] = await this.pool.execute(`
        SELECT COUNT(*) as count
        FROM user_roles ur
        JOIN role_permissions rp ON ur.role_id = rp.role_id
        WHERE ur.user_id = ? AND rp.module_key = ? AND rp.permission_type = ?
      `, [userId, moduleKey, permissionType]);

      return rows[0].count > 0;
    } catch (error) {
      log.error('检查用户权限失败:', error);
      return false;
    }
  }

  /**
   * 获取权限统计信息
   */
  async getPermissionStats() {
    try {
      const roleHasHierarchyLevel = await hasColumn('roles', 'hierarchy_level', this.pool);
      const hierarchyExpr = roleHasHierarchyLevel ? 'COALESCE(hierarchy_level, 0)' : '0';

      const [stats] = await this.pool.execute(`
        SELECT
          (SELECT COUNT(*) FROM roles WHERE is_active = 1) as total_roles,
          (SELECT COUNT(*) FROM users) as total_users,
          (SELECT COUNT(*) FROM users WHERE status = 'active' OR status = 1) as active_users,
          (SELECT COUNT(*) FROM users WHERE id IN (
            SELECT DISTINCT user_id FROM user_roles
          )) as users_with_roles,
          (SELECT COUNT(*) FROM roles WHERE is_active = 1 AND ${hierarchyExpr} >= 70) as system_roles,
          (SELECT COUNT(*) FROM roles WHERE is_active = 1 AND ${hierarchyExpr} < 70) as business_roles,
          (SELECT COUNT(*) FROM role_permissions) as total_permissions,
          (SELECT COUNT(*) FROM modules WHERE is_active = 1) as total_modules
      `);

      return stats[0];
    } catch (error) {
      log.error('获取权限统计失败:', error);
      throw error;
    }
  }
}

module.exports = PermissionService;
