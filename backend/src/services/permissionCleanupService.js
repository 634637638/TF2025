const { getDatabase } = require('../config/database');
const log = require('../utils/log');

// 强制重新加载

function normalizePermissionType(permissionType) {
  if (!permissionType) {
    return permissionType;
  }

  if (permissionType.endsWith('_permission')) {
    return permissionType.replace(/_permission$/, '');
  }

  return permissionType;
}

/**
 * 权限清理工具 - 自动清理和同步角色权限
 */
class PermissionCleanupService {
  constructor() {
    this.connection = null;
  }

  /**
   * 初始化数据库连接
   */
  async initConnection() {
    if (!this.connection) {
      this.connection = getDatabase();
    }
    return this.connection;
  }

  /**
   * 关闭数据库连接
   */
  async closeConnection() {
    this.connection = null;
  }

  /**
   * 清理角色的无效权限
   * @param {number} roleId - 角色ID
   * @returns {object} 清理结果
   */
  async cleanupRolePermissions(roleId) {
    await this.initConnection();

    try {
      log.debug(`🧹 开始清理角色 ${roleId} 的权限...`);

      // 1. 获取角色信息
      const [roleInfo] = await this.connection.execute(
        'SELECT id, name FROM roles WHERE id = ?',
        [roleId]
      );

      if (roleInfo.length === 0) {
        throw new Error(`角色 ${roleId} 不存在`);
      }

      const role = roleInfo[0];
      log.debug(`📋 处理角色: ${role.name}`);

      // 2. 获取所有活跃的模块
      const [activeModules] = await this.connection.execute(
        'SELECT `key`, name, category FROM modules WHERE is_active = 1'
      );

      const activeModuleKeys = activeModules.map(m => m.key);
      log.debug(`📦 当前活跃模块数量: ${activeModuleKeys.length}`);

      // 3. 只做安全清理，不再根据角色类型或角色名称自动灌权限
      const cleanupResult = await this.cleanupPermissionRecords(role.id, activeModuleKeys);

      // 4. 记录清理日志
      await this.logCleanup(roleId, cleanupResult);

      return {
        success: true,
        roleId: roleId,
        roleName: role.name,
        ...cleanupResult
      };

    } catch (error) {
      log.error(`❌ 清理角色 ${roleId} 权限失败:`, error);
      throw error;
    } finally {
      await this.closeConnection();
    }
  }

  async hasTable(tableName) {
    const [rows] = await this.connection.execute(
      `SELECT 1
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ?
       LIMIT 1`,
      [tableName]
    );

    return rows.length > 0;
  }

  async cleanupPermissionRecords(roleId, activeModuleKeys) {
    const result = {
      action: '仅清理无效模块、旧权限编码和重复记录，不自动增删业务权限',
      deletedMenuVisibility: 0,
      normalizedPermissions: 0,
      duplicatePermissions: 0,
      deletedPermissions: 0,
      keptPermissions: 0,
      menuPermissions: 0,
      actionPermissions: 0
    };

    if (activeModuleKeys.length === 0) {
      const [deletedAllPermissions] = await this.connection.execute(
        'DELETE FROM role_permissions WHERE role_id = ?',
        [roleId]
      );
      result.deletedPermissions += deletedAllPermissions.affectedRows;

      if (await this.hasTable('role_menu_visibility')) {
        const [deletedAllMenuVisibility] = await this.connection.execute(
          'DELETE FROM role_menu_visibility WHERE role_id = ?',
          [roleId]
        );
        result.deletedMenuVisibility += deletedAllMenuVisibility.affectedRows;
      }
    } else {
      const placeholders = activeModuleKeys.map(() => '?').join(', ');
      const [deletedInvalidPermissions] = await this.connection.execute(
        `DELETE FROM role_permissions
         WHERE role_id = ?
           AND module_key NOT IN (${placeholders})`,
        [roleId, ...activeModuleKeys]
      );
      result.deletedPermissions += deletedInvalidPermissions.affectedRows;

      if (await this.hasTable('role_menu_visibility')) {
        const [deletedInvalidMenuVisibility] = await this.connection.execute(
          `DELETE FROM role_menu_visibility
           WHERE role_id = ?
             AND module_key NOT IN (${placeholders})`,
          [roleId, ...activeModuleKeys]
        );
        result.deletedMenuVisibility += deletedInvalidMenuVisibility.affectedRows;
      }
    }

    const [legacyPermissionRows] = await this.connection.execute(
      `SELECT id, permission_type
       FROM role_permissions
       WHERE role_id = ?
         AND permission_type LIKE ?`,
      [roleId, '%\\_permission']
    );

    for (const row of legacyPermissionRows) {
      const normalizedType = normalizePermissionType(row.permission_type);
      if (normalizedType !== row.permission_type) {
        await this.connection.execute(
          'UPDATE role_permissions SET permission_type = ? WHERE id = ?',
          [normalizedType, row.id]
        );
        result.normalizedPermissions += 1;
      }
    }

    const [duplicateRows] = await this.connection.execute(
      `SELECT module_key, permission_type, COUNT(*) AS count, MIN(id) AS keep_id
       FROM role_permissions
       WHERE role_id = ?
       GROUP BY module_key, permission_type
       HAVING COUNT(*) > 1`,
      [roleId]
    );

    for (const row of duplicateRows) {
      const [deletedDuplicateRows] = await this.connection.execute(
        `DELETE FROM role_permissions
         WHERE role_id = ?
           AND module_key = ?
           AND permission_type = ?
           AND id != ?`,
        [roleId, row.module_key, row.permission_type, row.keep_id]
      );
      result.duplicatePermissions += deletedDuplicateRows.affectedRows;
      result.deletedPermissions += deletedDuplicateRows.affectedRows;
    }

    const [finalPermissions] = await this.connection.execute(
      'SELECT permission_type, COUNT(*) as count FROM role_permissions WHERE role_id = ? GROUP BY permission_type',
      [roleId]
    );

    finalPermissions.forEach(p => {
      if (p.permission_type === 'menu_view') result.menuPermissions = p.count;
      else result.actionPermissions += p.count;
    });

    if (await this.hasTable('role_menu_visibility')) {
      const [menuVisibilityRows] = await this.connection.execute(
        'SELECT COUNT(*) AS count FROM role_menu_visibility WHERE role_id = ? AND visible = 1',
        [roleId]
      );
      result.menuPermissions = Number(menuVisibilityRows[0]?.count || 0);
    }

    result.keptPermissions = result.menuPermissions + result.actionPermissions;
    return result;
  }

  /**
   * 记录清理日志
   */
  async logCleanup(roleId, result) {
    try {
      await this.connection.execute(
        'INSERT INTO system_logs (action, target_type, target_id, details, created_at) VALUES (?, ?, ?, ?, NOW())',
        [
          'permission_cleanup',
          'role',
          roleId,
          JSON.stringify({
            result: result,
            timestamp: new Date().toISOString()
          })
        ]
      );
    } catch (error) {
      log.warn('记录清理日志失败:', error.message);
    }
  }

  /**
   * 清理所有角色的权限
   */
  async cleanupAllRolePermissions() {
    await this.initConnection();

    try {
      const [roles] = await this.connection.execute(
        'SELECT id FROM roles WHERE is_active = 1'
      );

      log.debug(`🧹 开始清理 ${roles.length} 个角色的权限...`);

      const results = [];
      for (const role of roles) {
        try {
          const result = await this.cleanupRolePermissions(role.id);
          results.push(result);
          log.debug(`✅ 角色 ${role.id} 清理完成`);
        } catch (error) {
          log.error(`❌ 角色 ${role.id} 清理失败:`, error.message);
          results.push({
            success: false,
            roleId: role.id,
            error: error.message
          });
        }
      }

      return {
        success: true,
        total: roles.length,
        results: results
      };

    } catch (error) {
      log.error('❌ 批量清理权限失败:', error);
      throw error;
    } finally {
      await this.closeConnection();
    }
  }
}

/**
 * 触发权限清理的中间件
 */
async function triggerPermissionCleanup(req, res, next) {
  const cleanupService = new PermissionCleanupService();

  try {
    // 检查是否是角色相关的操作
    if (req.path.includes('/roles') && (req.method === 'PUT' || req.method === 'DELETE' || req.method === 'POST')) {
      const roleId = req.params.id || req.body.role_id;

      if (roleId) {
        // 异步执行权限清理，不阻塞当前请求
        setImmediate(async () => {
          try {
            await cleanupService.cleanupRolePermissions(roleId);
            log.debug(`🔄 角色变更后自动清理权限完成: 角色ID ${roleId}`);
          } catch (error) {
            log.error(`🔄 自动清理权限失败: 角色ID ${roleId}`, error);
          }
        });
      }
    }
  } catch (error) {
    log.warn('权限清理触发失败:', error);
  }

  next();
}

/**
 * 手动触发权限清理的API端点
 */
async function manualCleanup(req, res) {
  const cleanupService = new PermissionCleanupService();
  const { roleId, cleanupAll = false } = req.body;

  try {
    let result;

    if (cleanupAll) {
      result = await cleanupService.cleanupAllRolePermissions();
    } else if (roleId) {
      result = await cleanupService.cleanupRolePermissions(roleId);
    } else {
      return res.status(400).json({
        success: false,
        message: '请提供角色ID或设置cleanupAll为true'
      });
    }

    res.json({
      success: true,
      message: '权限清理完成',
      data: result
    });

  } catch (error) {
    log.error('手动权限清理失败:', error);
    res.status(500).json({
      success: false,
      message: '权限清理失败: ' + error.message
    });
  }
}

module.exports = {
  PermissionCleanupService,
  triggerPermissionCleanup,
  manualCleanup
};
