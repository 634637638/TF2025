const express = require('express');
const router = express.Router();
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth');
const { getDatabase } = require('../config/database');
const getMenuWithPermissionFilter = require('../permissions/menuPermissionFilter');
const { manualCleanup } = require('../services/permissionCleanupService');
const { logRoleOperation, logUserRoleOperation, logPermissionModification } = require('./permission-logs');
const {
  getModulePermissionMetadata,
  getModulePermissionTypes
} = require('../config/module-permission-actions');
const {
  getRoleMenuVisibility,
  getUserAccessProfile,
  hasUserPermission,
  listPermissionActions
} = require('../services/accessControl.service');
const { normalizeModuleKey } = require('../utils/moduleKeyNormalizer');
const log = require('../utils/log');

const ENSURED_PERMISSION_MODULE_KEYS = [
  'attendance_attendanceview',
  'attendance_myattendanceview',
  'system_gitmanagement',
  'data_optimization_dataoptimizationview',
  'permissions_modulemanagementview',
  'salary_salaryview',
  'salary_mysalaryview',
  'salary_salaryrecordsview',
  'salary_salarytemplatesview',
  'price_list_synclogview',
  'h5_admin_h5_adminview',
  'h5_admin_templatesview',
  'h5_admin_configview',
  'h5_admin_homesectionsview',
  'h5_admin_bannersview',
  'h5_admin_ordersview'
];

const { hasColumn, hasTable } = require('../services/schemaInspector.service');

async function getPermissionRouteSchemaSupport(db) {
  const [
    supportsRoleCode,
    supportsRoleType,
    supportsRoleIsActive,
    supportsRoleHierarchyLevel,
    supportsUserStatus,
    supportsUserLastLogin,
    supportsModuleIsActive,
    supportsRolePermissionMenuVisible,
    supportsRolePermissionModuleId,
    supportsRolePermissionCreatedAt
  ] = await Promise.all([
    hasColumn('roles', 'code', db),
    hasColumn('roles', 'role_type', db),
    hasColumn('roles', 'is_active', db),
    hasColumn('roles', 'hierarchy_level', db),
    hasColumn('users', 'status', db),
    hasColumn('users', 'last_login', db),
    hasColumn('modules', 'is_active', db),
    hasColumn('role_permissions', 'menu_visible', db),
    hasColumn('role_permissions', 'module_id', db),
    hasColumn('role_permissions', 'created_at', db)
  ]);

  return {
    supportsRoleCode,
    supportsRoleType,
    supportsRoleIsActive,
    supportsRoleHierarchyLevel,
    supportsUserStatus,
    supportsUserLastLogin,
    supportsModuleIsActive,
    supportsRolePermissionMenuVisible,
    supportsRolePermissionModuleId,
    supportsRolePermissionCreatedAt
  };
}

function normalizeManagedModuleKey(moduleKey) {
  return normalizeModuleKey(moduleKey);
}

function buildManagedModuleRow(moduleKey) {
  const normalizedModuleKey = normalizeManagedModuleKey(moduleKey);
  const metadata = getModulePermissionMetadata(normalizedModuleKey) || {};
  return {
    module_key: normalizedModuleKey,
    key: normalizedModuleKey,
    module_name: metadata.name || normalizedModuleKey,
    name: metadata.name || normalizedModuleKey,
    module_description: metadata.description || '',
    description: metadata.description || '',
    module_category: metadata.category || 'business',
    category: metadata.category || 'business',
    icon: metadata.icon || 'fas fa-cube',
    permission_type: 'view',
    field_count: 0
  };
}

function mergeManagedModules(rows = [], keyField = 'module_key') {
  const moduleMap = new Map();

  rows.forEach(row => {
    const rawModuleKey = row[keyField] || row.module_key || row.key;
    const moduleKey = normalizeManagedModuleKey(rawModuleKey);
    if (!moduleKey) {
      return;
    }

    const metadata = getModulePermissionMetadata(moduleKey) || {};
    moduleMap.set(moduleKey, {
      ...row,
      module_key: row.module_key || moduleKey,
      key: row.key || moduleKey,
      module_name: row.module_name || row.name || metadata.name || moduleKey,
      name: row.name || row.module_name || metadata.name || moduleKey,
      module_description: row.module_description || row.description || metadata.description || '',
      description: row.description || row.module_description || metadata.description || '',
      module_category: row.module_category || row.category || metadata.category || 'business',
      category: row.category || row.module_category || metadata.category || 'business',
      icon: row.icon || metadata.icon || 'fas fa-cube'
    });
  });

  ENSURED_PERMISSION_MODULE_KEYS.forEach(moduleKey => {
    if (!moduleMap.has(moduleKey)) {
      moduleMap.set(moduleKey, buildManagedModuleRow(moduleKey));
    }
  });

  return Array.from(moduleMap.values()).sort((a, b) => {
    const categoryA = a.module_category || a.category || '';
    const categoryB = b.module_category || b.category || '';
    if (categoryA !== categoryB) {
      return categoryA.localeCompare(categoryB, 'zh-CN');
    }

    const nameA = a.module_name || a.name || a.module_key || a.key || '';
    const nameB = b.module_name || b.name || b.module_key || b.key || '';
    return nameA.localeCompare(nameB, 'zh-CN');
  });
}

// 权限验证中间件
router.use(unifiedAuth);

router.get('/actions', requirePermission('permissions:admin'), async (_req, res) => {
  try {
    const actions = await listPermissionActions();
    res.json({
      success: true,
      message: '获取权限动作成功',
      data: actions
    });
  } catch (error) {
    log.error('获取权限动作失败:', error);
    res.status(500).json({
      success: false,
      message: '获取权限动作失败: ' + error.message,
      data: []
    });
  }
});

/**
 * 获取所有权限（包含模块信息）
 */
router.get('/all', requirePermission('permissions:admin'), async (req, res) => {
  try {
    const pool = getDatabase();
    const { supportsModuleIsActive, supportsRolePermissionCreatedAt } = await getPermissionRouteSchemaSupport(pool);
    const [rows] = await pool.execute(`
      SELECT DISTINCT
        rp.permission_type,
        rp.module_key,
        m.name as module_name,
        m.description as module_description,
        m.category as module_category,
        m.icon as module_icon,
        ${supportsRolePermissionCreatedAt ? 'rp.created_at,' : 'NULL as created_at,'}
        rp.permission_type as description
      FROM role_permissions rp
      JOIN modules m ON rp.module_key = m.\`key\` COLLATE utf8mb4_unicode_ci
      ${supportsModuleIsActive ? 'WHERE m.is_active = 1' : ''}
      ORDER BY m.category, m.sort_order, rp.module_key, rp.permission_type
    `);

    res.json({
      success: true,
      message: '获取权限列表成功',
      data: {
        total: rows.length,
        permissions: rows
      }
    });
  } catch (error) {
    log.error('获取权限列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取权限列表失败: ' + error.message,
      data: []
    });
  }
});

/**
 * 批量分配权限给角色
 */
router.post('/assign-batch', requirePermission('permissions:admin'), async (req, res) => {
  try {
    const { roleId, permissions } = req.body;

    if (!roleId || !Array.isArray(permissions) || permissions.length === 0) {
      return res.status(400).json({
        success: false,
        message: '角色ID和权限列表不能为空'
      });
    }

    const pool = getDatabase();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      const { supportsRolePermissionCreatedAt } = await getPermissionRouteSchemaSupport(connection);

      // 删除该角色的现有权限
      await connection.execute(
        'DELETE FROM role_permissions WHERE role_id = ?',
        [roleId]
      );

      // 批量插入新权限
      const values = permissions.map(p => [roleId, p.moduleKey, p.permissionType]);

      if (values.length > 0) {
        const placeholders = values.map(() => `(?, ?, ?${supportsRolePermissionCreatedAt ? ', NOW()' : ''})`).join(', ');
        const flatValues = values.flat();

        await connection.execute(`
          INSERT INTO role_permissions (role_id, module_key, permission_type${supportsRolePermissionCreatedAt ? ', created_at' : ''})
          VALUES ${placeholders}
        `, flatValues);
      }

      await connection.commit();

      res.json({
        success: true,
        message: `成功为角色分配 ${permissions.length} 个权限`
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    log.error('批量分配权限失败:', error);
    res.status(500).json({
      success: false,
      message: '批量分配权限失败: ' + error.message
    });
  }
});

/**
 * 批量回收角色权限
 */
router.post('/revoke-batch', requirePermission('permissions:admin'), async (req, res) => {
  try {
    const { roleId, permissions } = req.body;

    if (!roleId || !Array.isArray(permissions) || permissions.length === 0) {
      return res.status(400).json({
        success: false,
        message: '角色ID和权限列表不能为空'
      });
    }

    const pool = getDatabase();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 批量删除指定权限
      for (const permission of permissions) {
        await connection.execute(`
          DELETE FROM role_permissions
          WHERE role_id = ? AND module_key = ? AND permission_type = ?
        `, [roleId, permission.moduleKey, permission.permissionType]);
      }

      await connection.commit();

      res.json({
        success: true,
        message: `成功回收 ${permissions.length} 个权限`
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    log.error('批量回收权限失败:', error);
    res.status(500).json({
      success: false,
      message: '批量回收权限失败: ' + error.message
    });
  }
});

/**
 * 复制角色权限
 */
router.post('/copy', requirePermission('permissions:admin'), async (req, res) => {
  try {
    const { fromRoleId, toRoleId } = req.body;

    if (!fromRoleId || !toRoleId) {
      return res.status(400).json({
        success: false,
        message: '源角色ID和目标角色ID不能为空'
      });
    }

    if (fromRoleId === toRoleId) {
      return res.status(400).json({
        success: false,
        message: '源角色和目标角色不能相同'
      });
    }

    const pool = getDatabase();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 获取源角色的所有权限
      const [sourcePermissions] = await connection.execute(
        'SELECT module_key, permission_type FROM role_permissions WHERE role_id = ?',
        [fromRoleId]
      );

      if (sourcePermissions.length === 0) {
        await connection.rollback();
        return res.json({
          success: true,
          message: '源角色没有任何权限，操作完成',
          copiedCount: 0
        });
      }

      // 清空目标角色现有权限
      await connection.execute(
        'DELETE FROM role_permissions WHERE role_id = ?',
        [toRoleId]
      );

      // 复制权限到目标角色
      const { supportsRolePermissionCreatedAt } = await getPermissionRouteSchemaSupport(connection);
      const values = sourcePermissions.map(p => [toRoleId, p.module_key, p.permission_type]);
      const placeholders = values.map(() => `(?, ?, ?${supportsRolePermissionCreatedAt ? ', NOW()' : ''})`).join(', ');
      const flatValues = values.flat();

      await connection.execute(`
        INSERT INTO role_permissions (role_id, module_key, permission_type${supportsRolePermissionCreatedAt ? ', created_at' : ''})
        VALUES ${placeholders}
      `, flatValues);

      await connection.commit();

      res.json({
        success: true,
        message: `成功复制 ${sourcePermissions.length} 个权限`,
        copiedCount: sourcePermissions.length
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    log.error('复制角色权限失败:', error);
    res.status(500).json({
      success: false,
      message: '复制角色权限失败: ' + error.message
    });
  }
});

/**
 * 获取权限使用统计
 */
router.get('/stats', requirePermission('permissions:admin'), async (req, res) => {
  try {
    const pool = getDatabase();
    const { supportsRoleIsActive, supportsModuleIsActive } = await getPermissionRouteSchemaSupport(pool);

    // 简化的统计查询
    const [moduleStats] = await pool.execute(
      `SELECT COUNT(*) as total FROM modules ${supportsModuleIsActive ? 'WHERE is_active = 1' : ''}`
    );

    // 简化的角色统计
    const [roleStats] = await pool.execute(
      `SELECT COUNT(*) as total FROM roles ${supportsRoleIsActive ? 'WHERE is_active = 1' : ''}`
    );

    // 简化的权限类型统计
    const [typeStats] = await pool.execute(
      'SELECT COUNT(*) as total FROM role_permissions'
    );

    res.json({
      success: true,
      message: '获取权限统计成功',
      data: {
        moduleStats,
        roleStats,
        typeStats
      }
    });
  } catch (error) {
    log.error('获取权限统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取权限统计失败: ' + error.message
    });
  }
});

/**
 * 获取简化的统计数据（用于权限页面统计卡片）
 */
router.get('/overview', requirePermission('permissions:admin'), async (req, res) => {
  try {
    const pool = getDatabase();
    const {
      supportsRoleIsActive,
      supportsRoleHierarchyLevel,
      supportsUserStatus,
      supportsModuleIsActive
    } = await getPermissionRouteSchemaSupport(pool);
    const roleHasHierarchyLevel = supportsRoleHierarchyLevel;
    const hierarchyExpr = roleHasHierarchyLevel ? 'COALESCE(hierarchy_level, 0)' : '0';

    // 获取角色统计
    const [roleStats] = await pool.execute(`
      SELECT
        COUNT(*) as total_roles,
        COUNT(CASE WHEN ${hierarchyExpr} >= 70 THEN 1 END) as system_roles,
        COUNT(CASE WHEN ${hierarchyExpr} < 70 THEN 1 END) as business_roles
      FROM roles ${supportsRoleIsActive ? 'WHERE is_active = 1' : ''}
    `);

    // 获取用户统计
    const [userStats] = await pool.execute(`
      SELECT
        COUNT(*) as total_users,
        COUNT(CASE WHEN ${supportsUserStatus ? "(status = 'active' OR status = 1)" : '1 = 1'} THEN 1 END) as active_users,
        COUNT(CASE WHEN id IN (SELECT DISTINCT user_id FROM user_roles) THEN 1 END) as users_with_roles
      FROM users
    `);

    // 获取模块统计
    const [moduleStats] = await pool.execute(`
      SELECT
        COUNT(*) as total_modules,
        COUNT(CASE WHEN ${supportsModuleIsActive ? 'is_active = 0' : '0 = 1'} THEN 1 END) as unregistered_modules
      FROM modules
    `);

    // 获取权限总数统计
    const [permissionStats] = await pool.execute(
      'SELECT COUNT(*) as total_permissions FROM role_permissions'
    );

    const data = {
      total_roles: roleStats[0].total_roles || 0,
      total_users: userStats[0].total_users || 0,
      active_users: userStats[0].active_users || 0,
      users_with_roles: userStats[0].users_with_roles || 0,
      system_roles: roleStats[0].system_roles || 0,
      business_roles: roleStats[0].business_roles || 0,
      total_modules: moduleStats[0].total_modules || 0,
      registered_modules: (moduleStats[0].total_modules || 0) - (moduleStats[0].unregistered_modules || 0),
      unregistered_modules: moduleStats[0].unregistered_modules || 0,
      total_permissions: permissionStats[0].total_permissions || 0
    };

    log.debug('📊 权限统计数据:', data);

    res.json({
      success: true,
      message: '获取权限统计成功',
      data
    });

  } catch (error) {
    log.error('获取权限统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取权限统计失败: ' + error.message
    });
  }
});

/**
 * 获取权限冲突检测
 */
router.get('/conflicts/check', requirePermission('permissions:admin'), async (req, res) => {
  try {
    const pool = getDatabase();
    const { supportsModuleIsActive } = await getPermissionRouteSchemaSupport(pool);

    // 检查重复的权限分配
    const [duplicates] = await pool.execute(`
      SELECT
        role_id,
        module_key,
        permission_type,
        COUNT(*) as count
      FROM role_permissions
      GROUP BY role_id, module_key, permission_type
      HAVING count > 1
    `);

    // 检查孤立的权限（模块已不存在）
    const [orphaned] = await pool.execute(`
      SELECT DISTINCT rp.module_key
      FROM role_permissions rp
      LEFT JOIN modules m ON rp.module_key = m.\`key\`
      WHERE m.\`key\` IS NULL ${supportsModuleIsActive ? 'OR m.is_active = 0' : ''}
    `);

    res.json({
      success: true,
      message: '权限冲突检测完成',
      data: {
        duplicates,
        orphanedModules: orphaned.map(o => o.module_key),
        hasConflicts: duplicates.length > 0 || orphaned.length > 0
      }
    });
  } catch (error) {
    log.error('权限冲突检测失败:', error);
    res.status(500).json({
      success: false,
      message: '权限冲突检测失败: ' + error.message
    });
  }
});

/**
 * 清理权限冲突
 */
router.post('/conflicts/cleanup', requirePermission('permissions:admin'), async (req, res) => {
  try {
    const pool = getDatabase();
    const connection = await pool.getConnection();
    const { supportsModuleIsActive } = await getPermissionRouteSchemaSupport(connection);

    try {
      await connection.beginTransaction();

      // 清理重复的权限分配
      const [duplicates] = await connection.execute(`
        SELECT
          role_id,
          module_key,
          permission_type,
          COUNT(*) as count,
          MIN(id) as keep_id
        FROM role_permissions
        GROUP BY role_id, module_key, permission_type
        HAVING count > 1
      `);

      let cleanedDuplicates = 0;
      for (const dup of duplicates) {
        await connection.execute(`
          DELETE FROM role_permissions
          WHERE role_id = ? AND module_key = ? AND permission_type = ? AND id != ?
        `, [dup.role_id, dup.module_key, dup.permission_type, dup.keep_id]);
        cleanedDuplicates += dup.count - 1;
      }

      // 清理孤立的权限
      const [result] = await connection.execute(`
        DELETE rp FROM role_permissions rp
        LEFT JOIN modules m ON rp.module_key = m.\`key\`
        WHERE m.\`key\` IS NULL ${supportsModuleIsActive ? 'OR m.is_active = 0' : ''}
      `);

      await connection.commit();

      res.json({
        success: true,
        message: '权限冲突清理完成',
        data: {
          cleanedDuplicates,
          cleanedOrphaned: result.affectedRows
        }
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    log.error('清理权限冲突失败:', error);
    res.status(500).json({
      success: false,
      message: '清理权限冲突失败: ' + error.message
    });
  }
});

/**
 * 导出权限配置
 */
router.get('/export', requirePermission('permissions:admin'), async (req, res) => {
  try {
    const { format = 'json' } = req.query;
    const pool = getDatabase();
    const { supportsRoleIsActive, supportsModuleIsActive } = await getPermissionRouteSchemaSupport(pool);

    // 获取完整的权限配置
    const [rolePermissions] = await pool.execute(`
      SELECT
        r.name as role_name,
        m.\`key\` as module_key,
        m.name as module_name,
        rp.permission_type
      FROM roles r
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN modules m ON rp.module_key = m.\`key\`
      ${supportsRoleIsActive || supportsModuleIsActive ? `WHERE ${[
        supportsRoleIsActive ? 'r.is_active = 1' : null,
        supportsModuleIsActive ? 'm.is_active = 1' : null
      ].filter(Boolean).join(' AND ')}` : ''}
      ORDER BY r.name, m.category, m.sort_order, rp.permission_type
    `);

    const config = {
      exportTime: new Date().toISOString(),
      version: '1.0',
      roles: {}
    };

    // 按角色组织数据
    rolePermissions.forEach(row => {
      if (!config.roles[row.role_name]) {
        config.roles[row.role_name] = {
          modules: {}
        };
      }

      if (!config.roles[row.role_name].modules[row.module_key]) {
        config.roles[row.role_name].modules[row.module_key] = {
          moduleName: row.module_name,
          permissions: []
        };
      }

      config.roles[row.role_name].modules[row.module_key].permissions.push(row.permission_type);
    });

    if (format === 'csv') {
      // CSV格式导出
      const csvData = [];
      csvData.push(['角色', '模块', '权限类型']);

      Object.keys(config.roles).forEach(roleName => {
        Object.keys(config.roles[roleName].modules).forEach(moduleKey => {
          const module = config.roles[roleName].modules[moduleKey];
          module.permissions.forEach(permission => {
            csvData.push([roleName, module.moduleName, permission]);
          });
        });
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="permissions_export_${Date.now()}.csv"`);
      res.send(csvData.map(row => row.join(',')).join('\n'));
    } else {
      // JSON格式导出
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="permissions_export_${Date.now()}.json"`);
      res.json(config);
    }
  } catch (error) {
    log.error('导出权限配置失败:', error);
    res.status(500).json({
      success: false,
      message: '导出权限配置失败: ' + error.message
    });
  }
});

/**
 * 导入权限配置
 */
router.post('/import', requirePermission('permissions:admin'), async (req, res) => {
  try {
    const { config, overwrite = false } = req.body;

    if (!config || !config.roles) {
      return res.status(400).json({
        success: false,
        message: '权限配置格式错误'
      });
    }

    const pool = getDatabase();
    const connection = await pool.getConnection();
    const { supportsRoleIsActive, supportsModuleIsActive, supportsRolePermissionCreatedAt } = await getPermissionRouteSchemaSupport(connection);

    try {
      await connection.beginTransaction();

      let importedCount = 0;

      for (const [roleName, roleConfig] of Object.entries(config.roles)) {
        // 获取角色ID
        const [roleRows] = await connection.execute(
          `SELECT id FROM roles WHERE name = ? ${supportsRoleIsActive ? 'AND is_active = 1' : ''}`,
          [roleName]
        );

        if (roleRows.length === 0) {
          log.warn(`角色 ${roleName} 不存在，跳过`);
          continue;
        }

        const roleId = roleRows[0].id;

        // 如果不是覆盖模式，先清理现有权限
        if (overwrite) {
          await connection.execute(
            'DELETE FROM role_permissions WHERE role_id = ?',
            [roleId]
          );
        }

        // 导入权限
        for (const [moduleKey, moduleConfig] of Object.entries(roleConfig.modules)) {
          // 检查模块是否存在
          const [moduleRows] = await connection.execute(
            `SELECT \`key\` FROM modules WHERE \`key\` = ? ${supportsModuleIsActive ? 'AND is_active = 1' : ''}`,
            [moduleKey]
          );

          if (moduleRows.length === 0) {
            log.warn(`模块 ${moduleKey} 不存在，跳过`);
            continue;
          }

          for (const permission of moduleConfig.permissions) {
            // 检查权限是否已存在（非覆盖模式）
            if (!overwrite) {
              const [existingRows] = await connection.execute(
                'SELECT id FROM role_permissions WHERE role_id = ? AND module_key = ? AND permission_type = ?',
                [roleId, moduleKey, permission]
              );

              if (existingRows.length > 0) {
                continue; // 跳过已存在的权限
              }
            }

            await connection.execute(`
              INSERT INTO role_permissions (role_id, module_key, permission_type${supportsRolePermissionCreatedAt ? ', created_at' : ''})
              VALUES (?, ?, ?${supportsRolePermissionCreatedAt ? ', NOW()' : ''})
            `, [roleId, moduleKey, permission]);

            importedCount++;
          }
        }
      }

      await connection.commit();

      res.json({
        success: true,
        message: `成功导入 ${importedCount} 个权限`,
        data: {
          importedCount,
          overwrite
        }
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    log.error('导入权限配置失败:', error);
    res.status(500).json({
      success: false,
      message: '导入权限配置失败: ' + error.message
    });
  }
});

/**
 * 获取角色的菜单权限
 */
router.get('/menu/:roleId', requirePermission('permissions:admin'), async (req, res) => {
  try {
    const { roleId } = req.params;
    const pool = getDatabase();
    const { supportsModuleIsActive } = await getPermissionRouteSchemaSupport(pool);

    const [modules] = await pool.execute(`
      SELECT
        m.\`key\` AS module_key,
        m.name AS module_name,
        m.category,
        m.icon,
        m.description AS module_description
      FROM modules m
      ${supportsModuleIsActive ? 'WHERE m.is_active = 1' : ''}
      ORDER BY m.category, m.sort_order, m.name
    `);

    const visibilityMap = await getRoleMenuVisibility(roleId, pool);
    const rows = modules.map((module) => ({
      module_key: module.module_key,
      module_name: module.module_name,
      menu_visible: visibilityMap[module.module_key] ? 1 : 0,
      category: module.category,
      icon: module.icon,
      description: module.module_description || ''
    }));

    res.json({
      success: true,
      message: '获取角色菜单权限成功',
      data: {
        roleId,
        menuPermissions: rows
      }
    });
  } catch (error) {
    log.error('获取角色菜单权限失败:', error);
    res.status(500).json({
      success: false,
      message: '获取角色菜单权限失败: ' + error.message,
      data: []
    });
  }
});

/**
 * 更新角色的菜单权限
 */
router.put('/menu/:roleId', requirePermission('permissions:admin'), async (req, res) => {
  try {
    const { roleId } = req.params;
    const { menuPermissions } = req.body; // 格式: [{ module_key: 'xxx', menu_visible: true/false }]

    log.debug('🔧 菜单权限保存调试信息:');
    log.debug(`  角色ID: ${roleId}`);
    log.debug(`  收到的菜单权限数量: ${menuPermissions ? menuPermissions.length : 0}`);
    if (menuPermissions && menuPermissions.length > 0) {
      log.debug('  前3个菜单权限数据:', menuPermissions.slice(0, 3));
    }

    if (!Array.isArray(menuPermissions)) {
      return res.status(400).json({
        success: false,
        message: '菜单权限格式错误'
      });
    }

    const pool = getDatabase();
    const connection = await pool.getConnection();

    try {
      await connection.query('START TRANSACTION');
      const [roleRows] = await connection.execute('SELECT id FROM roles WHERE id = ?', [roleId]);
      if (roleRows.length === 0) {
        throw new Error('角色不存在');
      }

      const normalizedMenuPermissions = menuPermissions
        .filter((perm) => perm && perm.module_key)
        .map((perm) => ({
          module_key: perm.module_key,
          menu_visible: perm.menu_visible ? 1 : 0
        }));

      const {
        supportsModuleIsActive,
        supportsRolePermissionMenuVisible,
        supportsRolePermissionModuleId,
        supportsRolePermissionCreatedAt
      } = await getPermissionRouteSchemaSupport(connection);
      const [moduleRows] = await connection.execute(
        `SELECT id, \`key\` FROM modules ${supportsModuleIsActive ? 'WHERE is_active = 1' : ''}`
      );
      const moduleIdMap = new Map(moduleRows.map((row) => [row.key, row.id]));

      await connection.execute(
        'DELETE FROM role_permissions WHERE role_id = ? AND permission_type = ?',
        [roleId, 'menu_view']
      );

      if (normalizedMenuPermissions.length > 0) {
        const rolePermissionColumns = ['role_id', 'module_key'];
        if (supportsRolePermissionModuleId) {
          rolePermissionColumns.push('module_id');
        }
        rolePermissionColumns.push('permission_type');
        if (supportsRolePermissionMenuVisible) {
          rolePermissionColumns.push('menu_visible');
        }

        const placeholders = normalizedMenuPermissions.map(() =>
          `(${rolePermissionColumns.map(() => '?').join(', ')}${supportsRolePermissionCreatedAt ? ', NOW()' : ''})`
        ).join(', ');

        const values = normalizedMenuPermissions.flatMap((perm) => {
          const rowValues = [roleId, perm.module_key];
          if (supportsRolePermissionModuleId) {
            rowValues.push(moduleIdMap.get(perm.module_key) || null);
          }
          rowValues.push('menu_view');
          if (supportsRolePermissionMenuVisible) {
            rowValues.push(perm.menu_visible);
          }
          return rowValues;
        });

        await connection.execute(
          `INSERT INTO role_permissions (${rolePermissionColumns.join(', ')}${supportsRolePermissionCreatedAt ? ', created_at' : ''})
           VALUES ${placeholders}`,
          values
        );
      }

      const roleMenuVisibilityTableExists = await hasTable('role_menu_visibility', connection);

      if (roleMenuVisibilityTableExists) {
        const [hasRoleMenuVisibilityCreatedAt, hasRoleMenuVisibilityUpdatedAt] = await Promise.all([
          hasColumn('role_menu_visibility', 'created_at', connection),
          hasColumn('role_menu_visibility', 'updated_at', connection)
        ]);
        await connection.execute(
          'DELETE FROM role_menu_visibility WHERE role_id = ?',
          [roleId]
        );

        if (normalizedMenuPermissions.length > 0) {
          const placeholders = normalizedMenuPermissions.map(() =>
            `(?, ?, ?${hasRoleMenuVisibilityCreatedAt ? ', NOW()' : ''}${hasRoleMenuVisibilityUpdatedAt ? ', NOW()' : ''})`
          ).join(', ');
          const values = normalizedMenuPermissions.flatMap((perm) => [
            roleId,
            perm.module_key,
            perm.menu_visible
          ]);
          await connection.execute(
            `INSERT INTO role_menu_visibility (role_id, module_key, visible${hasRoleMenuVisibilityCreatedAt ? ', created_at' : ''}${hasRoleMenuVisibilityUpdatedAt ? ', updated_at' : ''})
             VALUES ${placeholders}`,
            values
          );
        }
      }

      await connection.query('COMMIT');

      res.json({
        success: true,
        message: '更新菜单权限成功',
        data: {
          roleId,
          receivedCount: normalizedMenuPermissions.length
        }
      });
    } catch (error) {
      await connection.query('ROLLBACK');
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    log.error('更新菜单权限失败:', error);
    res.status(500).json({
      success: false,
      message: '更新菜单权限失败: ' + error.message
    });
  }
});

/**
 * 获取用户的菜单权限（用于前端显示控制）
 */
router.get('/user-menu', getMenuWithPermissionFilter);

/**
 * 检查用户的模块权限（用于前端权限验证）
 */
router.get('/check-module-permission', async (req, res) => {
  try {
    const { moduleKey, permissionType } = req.query;

    if (!moduleKey || !permissionType) {
      return res.status(400).json({
        success: false,
        message: '模块key和权限类型不能为空'
      });
    }

    // 真实用户认证
    let userId = req.user?.id || req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: '用户未认证，请使用真实登录'
      });
    }

    const hasPermission = await hasUserPermission(userId, moduleKey, permissionType);

    log.debug(`🔐 权限检查: 用户${userId} - ${moduleKey}:${permissionType} = ${hasPermission}`);

    res.json({
      success: true,
      message: '权限检查完成',
      data: {
        hasPermission,
        userId,
        moduleKey,
        permissionType
      }
    });
  } catch (error) {
    log.error('检查模块权限失败:', error);
    res.status(500).json({
      success: false,
      message: '检查模块权限失败: ' + error.message,
      data: {
        hasPermission: false
      }
    });
  }
});

/**
 * 获取用户的完整权限信息（包含菜单和功能权限）
 */
router.get('/user-permissions', async (req, res) => {
  try {
    // 真实用户认证
    let userId = req.user?.id || req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: '用户未认证，请使用真实登录'
      });
    }

    const permissionData = await getUserAccessProfile(userId);

    res.json({
      success: true,
      message: '获取用户权限成功',
      data: permissionData
    });
  } catch (error) {
    log.error('获取用户权限失败:', error);
    res.status(500).json({
      success: false,
      message: '获取用户权限失败: ' + error.message,
      data: {}
    });
  }
});

/**
 * 获取角色列表（分页）
 */
router.get('/roles', requirePermission('permissions:admin'), async (req, res) => {
  try {
    const normalizedPage = Number.parseInt(req.query.page, 10);
    const normalizedLimit = Number.parseInt(req.query.limit, 10);
    const page = Number.isInteger(normalizedPage) && normalizedPage > 0 ? normalizedPage : 1;
    const limit = Number.isInteger(normalizedLimit) && normalizedLimit > 0
      ? Math.min(normalizedLimit, 10000)
      : 10000;
    const offset = (page - 1) * limit;

    const pool = getDatabase();
    const { supportsRoleCode, supportsRoleIsActive } = await getPermissionRouteSchemaSupport(pool);
    const selectCodeColumn = supportsRoleCode ? 'r.code' : 'NULL as code';
    const selectIsActiveColumn = supportsRoleIsActive ? 'r.is_active' : '1 as is_active';
    const groupByColumns = [
      'r.id',
      'r.name',
      ...(supportsRoleCode ? ['r.code'] : []),
      'r.description',
      'r.created_at',
      'r.updated_at',
      ...(supportsRoleIsActive ? ['r.is_active'] : [])
    ].join(', ');

    // 获取角色总数
    const [countResult] = await pool.execute('SELECT COUNT(*) as total FROM roles');
    const total = countResult[0].total;

    // LIMIT/OFFSET 经过严格整数校验后直接内联，规避部分 MySQL 环境下预处理分页参数异常
    const rolesQuery = `
      SELECT
        r.id,
        r.name,
        ${selectCodeColumn},
        r.description,
        r.created_at,
        r.updated_at,
        ${selectIsActiveColumn},
        COUNT(ur.user_id) as user_count
      FROM roles r
      LEFT JOIN user_roles ur ON r.id = ur.role_id
      GROUP BY ${groupByColumns}
      ORDER BY r.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const [roles] = await pool.query(rolesQuery);

    res.json({
      success: true,
      message: '获取角色列表成功',
      data: {
        roles,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    log.error('获取角色列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取角色列表失败: ' + error.message,
      data: {
        roles: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0
      }
    });
  }
});

/**
 * 获取用户及其角色信息（分页）
 */
router.get('/users-with-roles', requirePermission('permissions:admin'), async (req, res) => {
  try {
    // 安全参数验证：强制转换为正整数并限制范围
    const normalizedPage = Number.parseInt(req.query.page, 10);
    const normalizedLimit = Number.parseInt(req.query.limit, 10);
    const page = Number.isInteger(normalizedPage) && normalizedPage > 0 ? normalizedPage : 1;
    const limit = Number.isInteger(normalizedLimit) && normalizedLimit > 0
      ? Math.min(normalizedLimit, 10000)
      : 10000;
    const offset = (page - 1) * limit;

    const pool = getDatabase();
    const { supportsUserStatus, supportsUserLastLogin } = await getPermissionRouteSchemaSupport(pool);
    const selectStatusColumn = supportsUserStatus ? 'u.status' : '1 as status';
    const selectLastLoginColumn = supportsUserLastLogin ? 'u.last_login' : 'NULL as last_login';
    const groupByColumns = [
      'u.id',
      'u.username',
      'u.name',
      'u.email',
      ...(supportsUserStatus ? ['u.status'] : []),
      ...(supportsUserLastLogin ? ['u.last_login'] : []),
      'u.created_at',
      'u.updated_at'
    ].join(', ');

    // 获取用户总数
    const [countResult] = await pool.execute('SELECT COUNT(*) as total FROM users');
    const total = countResult[0].total;

    // LIMIT/OFFSET 经过严格整数校验后直接内联，规避部分 MySQL 环境下预处理分页参数异常
    const usersQuery = `
      SELECT
        u.id,
        u.username,
        u.name as full_name,
        u.email,
        ${selectStatusColumn},
        ${selectLastLoginColumn},
        u.created_at,
        u.updated_at,
        GROUP_CONCAT(r.name SEPARATOR ', ') as roles
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      GROUP BY ${groupByColumns}
      ORDER BY u.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const [users] = await pool.query(usersQuery);

    // 调试：检查查询结果中的last_login字段
    log.debug('🔍 权限管理页面用户查询调试:');
    log.debug(`  查询到用户数量: ${users.length}`);
    if (users.length > 0) {
      log.debug('  前3个用户的last_login字段:');
      users.slice(0, 3).forEach((user, index) => {
        log.debug(`    用户${index + 1} (${user.username}): last_login = ${user.last_login}`);
      });
    }

    res.json({
      success: true,
      message: '获取用户角色列表成功',
      data: {
        users,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    log.error('获取用户角色列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取用户角色列表失败: ' + error.message,
      data: {
        users: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0
      }
    });
  }
});

/**
 * 创建新角色
 */
router.post('/roles', requirePermission('permissions:admin'), async (req, res) => {
  try {
    const { name, description, code } = req.body;

    // 验证必填字段
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: '角色名称不能为空'
      });
    }

    if (!description || !description.trim()) {
      return res.status(400).json({
        success: false,
        message: '角色描述不能为空'
      });
    }

    const pool = getDatabase();
    const supportsRoleCode = await hasColumn('roles', 'code', pool);
    const normalizedCode = typeof code === 'string' && code.trim() ? code.trim() : null;

    // 检查角色名称是否已存在
    const [existingRole] = await pool.execute(
      'SELECT id FROM roles WHERE name = ?',
      [name.trim()]
    );

    if (existingRole.length > 0) {
      return res.status(400).json({
        success: false,
        message: '角色名称已存在'
      });
    }

    if (supportsRoleCode && normalizedCode) {
      const [existingRoleCode] = await pool.execute(
        'SELECT id FROM roles WHERE code = ?',
        [normalizedCode]
      );

      if (existingRoleCode.length > 0) {
        return res.status(400).json({
          success: false,
          message: '角色编码已存在'
        });
      }
    }

    // 创建新角色
    const [result] = supportsRoleCode
      ? await pool.execute(
          'INSERT INTO roles (name, code, description, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
          [name.trim(), normalizedCode, description.trim()]
        )
      : await pool.execute(
          'INSERT INTO roles (name, description, created_at, updated_at) VALUES (?, ?, NOW(), NOW())',
          [name.trim(), description.trim()]
        );

    const finalCode = supportsRoleCode ? (normalizedCode || `role_${result.insertId}`) : null;
    if (supportsRoleCode && !normalizedCode) {
      await pool.execute(
        'UPDATE roles SET code = ? WHERE id = ?',
        [finalCode, result.insertId]
      );
    }

    // 记录权限操作日志
    await logRoleOperation(req, 'create', result.insertId, name.trim(), {
      description: description.trim(),
      code: finalCode
    });

    res.json({
      success: true,
      message: '角色创建成功',
      data: {
        id: result.insertId,
        name: name.trim(),
        code: finalCode,
        description: description.trim()
      }
    });
  } catch (error) {
    log.error('创建角色失败:', error);
    res.status(500).json({
      success: false,
      message: '创建角色失败: ' + error.message
    });
  }
});

/**
 * 更新角色
 */
router.put('/roles/:id', requirePermission('permissions:admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, role_type, code } = req.body;

    // 验证必填字段
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: '角色名称不能为空'
      });
    }

    if (!description || !description.trim()) {
      return res.status(400).json({
        success: false,
        message: '角色描述不能为空'
      });
    }

    const pool = getDatabase();
    const supportsRoleCode = await hasColumn('roles', 'code', pool);
    const supportsRoleType = await hasColumn('roles', 'role_type', pool);
    const normalizedCode = typeof code === 'string' && code.trim() ? code.trim() : null;

    // 获取当前角色信息
    const [currentRole] = await pool.execute(
      `SELECT id, name, description${supportsRoleType ? ', role_type' : ', NULL as role_type'}${supportsRoleCode ? ', code' : ''} FROM roles WHERE id = ?`,
      [id]
    );

    if (currentRole.length === 0) {
      return res.status(404).json({
        success: false,
        message: '角色不存在'
      });
    }

    const role = currentRole[0];

    // 检查角色名称是否被其他角色使用
    const [nameCheck] = await pool.execute(
      'SELECT id FROM roles WHERE name = ? AND id != ?',
      [name.trim(), id]
    );

    if (nameCheck.length > 0) {
      return res.status(400).json({
        success: false,
        message: '角色名称已存在'
      });
    }

    if (supportsRoleCode && normalizedCode) {
      const [codeCheck] = await pool.execute(
        'SELECT id FROM roles WHERE code = ? AND id != ?',
        [normalizedCode, id]
      );

      if (codeCheck.length > 0) {
        return res.status(400).json({
          success: false,
          message: '角色编码已存在'
        });
      }
    }

    // 检查role_type是否有效
    if (role_type) {
      const validRoleTypes = ['super_admin', 'admin', 'manager', 'employee', 'system', 'business'];
      if (!validRoleTypes.includes(role_type)) {
        return res.status(400).json({
          success: false,
          message: '无效的角色类型'
        });
      }
    }

    // 更新角色
    const finalCode = supportsRoleCode ? (normalizedCode || role.code || `role_${id}`) : null;
    if (supportsRoleCode && supportsRoleType) {
      await pool.execute(
        'UPDATE roles SET name = ?, code = ?, description = ?, role_type = COALESCE(?, role_type), updated_at = NOW() WHERE id = ?',
        [name.trim(), finalCode, description.trim(), role_type || null, id]
      );
    } else if (supportsRoleCode) {
      await pool.execute(
        'UPDATE roles SET name = ?, code = ?, description = ?, updated_at = NOW() WHERE id = ?',
        [name.trim(), finalCode, description.trim(), id]
      );
    } else if (supportsRoleType) {
      await pool.execute(
        'UPDATE roles SET name = ?, description = ?, role_type = COALESCE(?, role_type), updated_at = NOW() WHERE id = ?',
        [name.trim(), description.trim(), role_type || null, id]
      );
    } else {
      await pool.execute(
        'UPDATE roles SET name = ?, description = ?, updated_at = NOW() WHERE id = ?',
        [name.trim(), description.trim(), id]
      );
    }

    // 记录权限操作日志
    await logRoleOperation(req, 'edit', id, name.trim(), {
      description: description.trim(),
      code: finalCode,
      previous_name: role.name,
      previous_description: role.description,
      role_type_change: role_type !== role.role_type ? `${role.role_type} -> ${role_type}` : null
    });

    res.json({
      success: true,
      message: '角色更新成功',
      data: {
        id: parseInt(id),
        name: name.trim(),
        code: finalCode,
        description: description.trim(),
        role_type: role_type || role.role_type,
        previous_role_type: role.role_type
      }
    });
  } catch (error) {
    log.error('更新角色失败:', error);
    res.status(500).json({
      success: false,
      message: '更新角色失败: ' + error.message
    });
  }
});

/**
 * 删除角色
 */
router.delete('/roles/:id', requirePermission('permissions:admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const pool = getDatabase();
    const { supportsModuleIsActive } = await getPermissionRouteSchemaSupport(pool);

    // 检查角色是否存在
    const [existingRole] = await pool.execute(
      'SELECT name FROM roles WHERE id = ?',
      [id]
    );

    if (existingRole.length === 0) {
      return res.status(404).json({
        success: false,
        message: '角色不存在'
      });
    }

    const roleName = existingRole[0].name;

    // 检查是否有用户使用该角色
    const [userCount] = await pool.execute(
      'SELECT COUNT(*) as count FROM user_roles WHERE role_id = ?',
      [id]
    );

    if (userCount[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: '无法删除该角色，仍有用户使用该角色'
      });
    }

    // 删除角色的权限分配
    await pool.execute('DELETE FROM role_permissions WHERE role_id = ?', [id]);

    // 删除角色
    await pool.execute('DELETE FROM roles WHERE id = ?', [id]);

    // 记录权限操作日志
    await logRoleOperation(req, 'delete', id, roleName);

    res.json({
      success: true,
      message: '角色删除成功'
    });
  } catch (error) {
    log.error('删除角色失败:', error);
    res.status(500).json({
      success: false,
      message: '删除角色失败: ' + error.message
    });
  }
});

/**
 * 更新角色状态
 */
router.put('/roles/:id/status', requirePermission('permissions:admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    if (!is_active || (is_active !== '0' && is_active !== '1')) {
      return res.status(400).json({
        success: false,
        message: '状态值必须是0或1'
      });
    }

    const pool = getDatabase();
    const { supportsRoleIsActive } = await getPermissionRouteSchemaSupport(pool);

    if (!supportsRoleIsActive) {
      return res.status(400).json({
        success: false,
        message: '当前数据库结构不支持角色启停'
      });
    }

    // 检查角色是否存在
    const [existingRole] = await pool.execute(
      'SELECT id, name, is_active FROM roles WHERE id = ?',
      [id]
    );

    if (existingRole.length === 0) {
      return res.status(404).json({
        success: false,
        message: '角色不存在'
      });
    }

    const role = existingRole[0];

    // 系统角色（ID 1和9）不能停用
    if ((role.id == 1 || role.id == 9) && is_active === '0') {
      return res.status(403).json({
        success: false,
        message: '系统角色不能停用'
      });
    }

    // 更新角色状态
    await pool.execute(
      'UPDATE roles SET is_active = ?, updated_at = NOW() WHERE id = ?',
      [is_active, id]
    );

    let affectedUsersCount = 0;

    // 如果是停用操作，需要将该角色的所有用户token失效
    if (is_active === '0') {
      // 获取所有使用该角色的用户
      const [usersWithRole] = await pool.execute(
        `SELECT DISTINCT u.id FROM users u
         INNER JOIN user_roles ur ON u.id = ur.user_id
         WHERE ur.role_id = ?`,
        [id]
      );

      affectedUsersCount = usersWithRole.length;

      // 删除这些用户的refresh token，强制重新登录
      if (usersWithRole.length > 0) {
        const userIds = usersWithRole.map(u => u.id);
        const placeholders = userIds.map(() => '?').join(',');

        try {
          await pool.execute(
            `DELETE FROM refresh_tokens WHERE user_id IN (${placeholders})`,
            userIds
          );
        } catch (tokenError) {
          // 如果refresh_tokens表不存在，记录警告但不影响主流程
          if (tokenError.code === 'ER_NO_SUCH_TABLE') {
            log.warn('refresh_tokens表不存在，跳过token清理操作');
          } else {
            // 其他错误则重新抛出
            throw tokenError;
          }
        }
      }
    }

    const action = is_active === '1' ? '启用' : '停用';
    res.json({
      success: true,
      message: `角色${action}成功`,
      data: {
        affected_users: affectedUsersCount
      }
    });

  } catch (error) {
    log.error('更新角色状态失败:', error);
    res.status(500).json({
      success: false,
      message: '更新角色状态失败: ' + error.message
    });
  }
});

/**
 * 分配用户角色
 */
router.put('/users/:id/roles', requirePermission('permissions:admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { roleIds } = req.body;

    if (!Array.isArray(roleIds)) {
      return res.status(400).json({
        success: false,
        message: '角色ID列表必须是数组'
      });
    }

    const pool = getDatabase();

    // 检查用户是否存在
    const [existingUser] = await pool.execute(
      'SELECT id FROM users WHERE id = ?',
      [id]
    );

    if (existingUser.length === 0) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 验证所有角色ID是否存在
    if (roleIds.length > 0) {
      const placeholders = roleIds.map(() => '?').join(',');
      const checkRolesSql = `SELECT id FROM roles WHERE id IN (${placeholders})`;
      const [validRoles] = await pool.execute(checkRolesSql, roleIds);

      if (validRoles.length !== roleIds.length) {
        return res.status(400).json({
          success: false,
          message: '部分角色ID无效'
        });
      }
    }

    // 删除用户现有的所有角色
    await pool.execute('DELETE FROM user_roles WHERE user_id = ?', [id]);

    // 分配新的角色
    if (roleIds.length > 0) {
      const values = roleIds.map(roleId => `(${id}, ${roleId})`).join(',');
      await pool.execute(
        `INSERT INTO user_roles (user_id, role_id) VALUES ${values}`
      );
    }

    // 记录权限操作日志
    await logUserRoleOperation(req, 'assign', id, null, { role_ids: roleIds, role_count: roleIds.length });

    res.json({
      success: true,
      message: '用户角色分配成功'
    });
  } catch (error) {
    log.error('分配用户角色失败:', error);
    res.status(500).json({
      success: false,
      message: '分配用户角色失败: ' + error.message
    });
  }
});

/**
 * 获取用户的角色列表
 */
router.get('/users/:id/roles', requirePermission('permissions:admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const pool = getDatabase();

    // 检查用户是否存在
    const [existingUser] = await pool.execute(
      'SELECT id FROM users WHERE id = ?',
      [id]
    );

    if (existingUser.length === 0) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 获取用户的角色
    const [userRoles] = await pool.execute(`
      SELECT r.id, r.name, r.description
      FROM roles r
      INNER JOIN user_roles ur ON r.id = ur.role_id
      WHERE ur.user_id = ?
      ORDER BY r.id
    `, [id]);

    res.json({
      success: true,
      message: '获取用户角色成功',
      data: userRoles
    });
  } catch (error) {
    log.error('获取用户角色失败:', error);
    res.status(500).json({
      success: false,
      message: '获取用户角色失败: ' + error.message
    });
  }
});

/**
 * 获取角色的权限列表 - 返回所有权限及分配状态
 */
router.get('/roles/:id/permissions', requirePermission('permissions:admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const pool = getDatabase();
    const { supportsModuleIsActive } = await getPermissionRouteSchemaSupport(pool);

    // 检查角色是否存在
    const [existingRole] = await pool.execute(
      'SELECT id FROM roles WHERE id = ?',
      [id]
    );

    if (existingRole.length === 0) {
      return res.status(404).json({
        success: false,
        message: '角色不存在'
      });
    }

    // 查询数据库中已注册的模块
    const [rawDbModules] = await pool.execute(`
      SELECT DISTINCT
        m.\`key\` as module_key,
        m.name as module_name,
        m.description as module_description,
        m.category as module_category,
        'view' as permission_type
      FROM modules m
      ${supportsModuleIsActive ? 'WHERE m.is_active = 1' : ''}
      ORDER BY m.category, m.\`key\`
    `);
    const dbModules = mergeManagedModules(rawDbModules);

    // 如果数据库中没有模块，尝试从扫描中获取模块
    let allPermissions = dbModules;
    if (rawDbModules.length === 0) {
      try {
        const ModuleScanner = require('../services/moduleScanner_simple');
        const scanner = new ModuleScanner();
        const scannedModules = await scanner.scanViewsDirectory();

        allPermissions = mergeManagedModules(scannedModules.map(module => ({
          module_key: module.key,
          module_name: module.name || module.key,
          module_description: module.description || '',
          module_category: module.category || 'scanned',
          permission_type: 'view'
        })));

        log.debug(`数据库中没有模块，从扫描中获取了 ${allPermissions.length} 个模块`);
      } catch (scanError) {
        log.warn('模块扫描失败，使用备用权限列表:', scanError.message);
        // 提供基本的系统权限作为后备
        allPermissions = mergeManagedModules([
          { module_key: 'dashboard', module_name: '仪表盘', module_description: '系统主界面', module_category: 'system', permission_type: 'view' },
          { module_key: 'users', module_name: '用户管理', module_description: '用户账户管理', module_category: 'system', permission_type: 'view' },
          { module_key: 'roles', module_name: '角色管理', module_description: '角色权限管理', module_category: 'system', permission_type: 'view' },
          { module_key: 'permissions', module_name: '权限管理', module_description: '系统权限配置', module_category: 'system', permission_type: 'view' },
          { module_key: 'inventory', module_name: '库存管理', module_description: '商品库存管理', module_category: 'business', permission_type: 'view' },
          { module_key: 'stock-in', module_name: '入库管理', module_description: '商品入库管理', module_category: 'business', permission_type: 'view' },
          { module_key: 'sales', module_name: '销售管理', module_description: '销售订单管理', module_category: 'business', permission_type: 'view' }
        ]);
      }
    }

    // 获取系统中已存在的权限类型
    const [allModulePermissionTypes] = await pool.execute(`
      SELECT DISTINCT
        module_key,
        permission_type
      FROM role_permissions
      WHERE permission_type != 'menu_view'
    `);

    const modulePermissionTypeMap = new Map();
    allModulePermissionTypes.forEach(perm => {
      const normalizedModuleKey = normalizeManagedModuleKey(perm.module_key);
      if (!modulePermissionTypeMap.has(normalizedModuleKey)) {
        modulePermissionTypeMap.set(normalizedModuleKey, new Set());
      }
      modulePermissionTypeMap.get(normalizedModuleKey).add(perm.permission_type);
    });

    const actionUniverse = await listPermissionActions(pool);

    // 获取角色当前拥有的权限
    const [rolePermissions] = await pool.execute(`
      SELECT
        rp.module_key,
        rp.permission_type
      FROM role_permissions rp
      WHERE rp.role_id = ?
    `, [id]);

    // 创建权限映射以便快速查找
    const rolePermissionMap = new Set();
    rolePermissions.forEach(perm => {
      const normalizedModuleKey = normalizeManagedModuleKey(perm.module_key);
      rolePermissionMap.add(`${normalizedModuleKey}:${perm.permission_type}`);
    });

    // 按模块分组所有权限，并标注分配状态
    const moduleMap = new Map();
    allPermissions.forEach(perm => {
      const key = perm.module_key;
      if (!moduleMap.has(key)) {
        moduleMap.set(key, {
          module_key: key,
          name: perm.module_name || key,
          description: perm.module_description || '',
          category: perm.module_category || 'unknown',
          permissions: []
        });
      }

      // 为每个模块添加统一定义的权限类型
      const permissionTypes = getModulePermissionTypes(
        key,
        [...actionUniverse, ...Array.from(modulePermissionTypeMap.get(key) || [])]
      );

      permissionTypes.forEach(type => {
        const permissionKey = `${key}:${type}`;
        moduleMap.get(key).permissions.push({
          type: type,  // 前端期望的是 type 字段
          permission_type: type,  // 保留原有字段以兼容性
          assigned: rolePermissionMap.has(permissionKey)
        });
      });
    });

    const modules = Array.from(moduleMap.values());

    let message = '获取角色权限成功';
    if (rawDbModules.length === 0) {
      message = `获取角色权限成功（显示 ${allPermissions.length} 个扫描到的模块，建议先在模块管理中同步模块到数据库）`;
    } else {
      message = `获取角色权限成功（显示 ${dbModules.length} 个数据库中的模块）`;
    }

    res.json({
      success: true,
      message: message,
      data: modules,
      meta: {
        totalModules: modules.length,
        fromDatabase: rawDbModules.length > 0,
        dbModuleCount: rawDbModules.length,
        scannedModuleCount: allPermissions.length
      }
    });
  } catch (error) {
    log.error('获取角色权限失败:', error);
    res.status(500).json({
      success: false,
      message: '获取角色权限失败: ' + error.message
    });
  }
});

/**
 * 更新角色权限
 */
router.put('/roles/:id/permissions', requirePermission('permissions:admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { permissions } = req.body;

    const pool = getDatabase();

    // 检查角色是否存在并获取角色名称
    const [existingRole] = await pool.execute(
      'SELECT id, name FROM roles WHERE id = ?',
      [id]
    );

    if (existingRole.length === 0) {
      return res.status(404).json({
        success: false,
        message: '角色不存在'
      });
    }

    const roleName = existingRole[0].name;

    // 删除角色现有的非菜单权限（保留菜单权限）
    await pool.execute(
      'DELETE FROM role_permissions WHERE role_id = ? AND permission_type != ?',
      [id, 'menu_view']
    );

    // 添加新的权限
    let addedCount = 0;
    if (permissions && permissions.length > 0) {
      // 过滤掉无效的权限数据
      const validPermissions = permissions.filter(perm => {
        if (!perm.module_key || perm.module_key === 'undefined' || perm.module_key === null) {
          log.warn(`跳过无效的权限数据:`, perm);
          return false;
        }
        if (!perm.permission_type || perm.permission_type === 'undefined' || perm.permission_type === null) {
          log.warn(`跳过无效的权限类型:`, perm);
          return false;
        }
        return true;
      });

      if (validPermissions.length > 0) {
        const values = validPermissions.map(perm => [id, perm.module_key, perm.permission_type]);
        const placeholders = values.map(() => '(?, ?, ?)').join(', ');
        const flatValues = values.flat();

        await pool.execute(
          `REPLACE INTO role_permissions (role_id, module_key, permission_type) VALUES ${placeholders}`,
          flatValues
        );

        addedCount = validPermissions.length;
        log.debug(`成功为角色 ${id} 更新了 ${validPermissions.length} 个权限（保留原有菜单权限）`);
      } else {
        log.warn(`没有有效的权限数据可以更新给角色 ${id}`);
      }
    }

    // 记录权限修改日志
    await logPermissionModification(req, id, roleName, permissions, { permissions_count: addedCount });

    // 🔥 清除所有拥有该角色的用户的权限缓存
    const { permissionCache } = require('../config/redis');

    // 获取拥有该角色的所有用户
    const [roleUsers] = await pool.execute(
      'SELECT DISTINCT user_id FROM user_roles WHERE role_id = ?',
      [id]
    );

    // 清除这些用户的权限缓存
    for (const user of roleUsers) {
      await permissionCache.deleteUserPermissions(user.user_id);
      log.debug(`✅ 已清除用户 ${user.user_id} 的权限缓存（角色 ${roleName} 权限变更）`);
    }

    res.json({
      success: true,
      message: '角色权限更新成功'
    });
  } catch (error) {
    log.error('更新角色权限失败:', error);
    res.status(500).json({
      success: false,
      message: '更新角色权限失败: ' + error.message
    });
  }
});

/**
 * 为角色分配所有权限
 */
router.put('/roles/:id/permissions/select-all', requirePermission('permissions:admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const pool = getDatabase();
    const { supportsModuleIsActive } = await getPermissionRouteSchemaSupport(pool);

    // 检查角色是否存在
    const [existingRole] = await pool.execute(
      'SELECT id FROM roles WHERE id = ?',
      [id]
    );

    if (existingRole.length === 0) {
      return res.status(404).json({
        success: false,
        message: '角色不存在'
      });
    }

    // 获取所有模块（优先从数据库，如果为空则从扫描获取）
    let allModules = [];
    const [dbModules] = await pool.execute(`
      SELECT DISTINCT \`key\` as module_key
      FROM modules
      ${supportsModuleIsActive ? 'WHERE is_active = 1' : ''}
    `);

    if (dbModules.length === 0) {
      try {
        const ModuleScanner = require('../services/moduleScanner_simple');
        const scanner = new ModuleScanner();
        const scannedModules = await scanner.scanViewsDirectory();
        allModules = Array.from(new Set([
          ...scannedModules.map(module => module.key),
          ...ENSURED_PERMISSION_MODULE_KEYS
        ]));
        log.debug(`数据库中没有模块，从扫描中获取了 ${allModules.length} 个模块用于全选权限`);
      } catch (scanError) {
        log.warn('模块扫描失败，无法分配权限:', scanError.message);
        return res.status(500).json({
          success: false,
          message: '无法获取模块列表，请先在模块管理中同步模块到数据库'
        });
      }
    } else {
      allModules = Array.from(new Set([
        ...dbModules.map(module => module.module_key),
        ...ENSURED_PERMISSION_MODULE_KEYS
      ]));
    }

    // 删除角色现有的非菜单权限（保留菜单权限）
    await pool.execute(
      'DELETE FROM role_permissions WHERE role_id = ? AND permission_type != ?',
      [id, 'menu_view']
    );

    // 为角色分配所有权限类型
    const allPermissions = [];

    // 验证模块key有效性，避免undefined值
    allModules.forEach(moduleKey => {
      if (moduleKey && moduleKey !== 'undefined') {
        getModulePermissionTypes(moduleKey).forEach(type => {
          allPermissions.push([id, moduleKey, type]);
        });
      } else {
        log.warn(`跳过无效的模块key: ${moduleKey}`);
      }
    });

    // 批量插入权限（使用REPLACE INTO避免重复键冲突）
    if (allPermissions.length > 0) {
      const placeholders = allPermissions.map(() => '(?, ?, ?)').join(', ');
      const flatValues = allPermissions.flat();

      await pool.execute(
        `REPLACE INTO role_permissions (role_id, module_key, permission_type) VALUES ${placeholders}`,
        flatValues
      );
    }

    // 🔥 清除所有拥有该角色的用户的权限缓存
    const { permissionCache } = require('../config/redis');
    const [roleUsers] = await pool.execute(
      'SELECT DISTINCT user_id FROM user_roles WHERE role_id = ?',
      [id]
    );

    for (const user of roleUsers) {
      await permissionCache.deleteUserPermissions(user.user_id);
      log.debug(`✅ 已清除用户 ${user.user_id} 的权限缓存（角色 ${id} 全选权限）`);
    }

    res.json({
      success: true,
      message: `已为角色分配所有 ${allPermissions.length} 个权限`,
      data: {
        modulesCount: allModules.length,
        permissionsCount: allPermissions.length
      }
    });
  } catch (error) {
    log.error('分配所有权限失败:', error);
    res.status(500).json({
      success: false,
      message: '分配所有权限失败: ' + error.message
    });
  }
});

/**
 * 清除角色的所有权限
 */
router.put('/roles/:id/permissions/clear-all', requirePermission('permissions:admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const pool = getDatabase();

    // 检查角色是否存在
    const [existingRole] = await pool.execute(
      'SELECT id FROM roles WHERE id = ?',
      [id]
    );

    if (existingRole.length === 0) {
      return res.status(404).json({
        success: false,
        message: '角色不存在'
      });
    }

    // 删除角色的非菜单权限（保留菜单权限）
    const [result] = await pool.execute(
      'DELETE FROM role_permissions WHERE role_id = ? AND permission_type != ?',
      [id, 'menu_view']
    );

    // 🔥 清除所有拥有该角色的用户的权限缓存
    const { permissionCache } = require('../config/redis');
    const [roleUsers] = await pool.execute(
      'SELECT DISTINCT user_id FROM user_roles WHERE role_id = ?',
      [id]
    );

    for (const user of roleUsers) {
      await permissionCache.deleteUserPermissions(user.user_id);
      log.debug(`✅ 已清除用户 ${user.user_id} 的权限缓存（角色 ${id} 清除权限）`);
    }

    res.json({
      success: true,
      message: '已清除角色的所有功能权限（保留菜单权限）',
      deletedCount: result.affectedRows
    });
  } catch (error) {
    log.error('清除权限失败:', error);
    res.status(500).json({
      success: false,
      message: '清除权限失败: ' + error.message
    });
  }
});

/**
 * 切换权限可见性
 */
router.put('/toggle-visibility', requirePermission('permissions:admin'), async (req, res) => {
  try {
    const { roleId, moduleKey, permissionType, visible } = req.body;

    if (!roleId || !moduleKey || !permissionType || typeof visible !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: '参数不完整：需要roleId、moduleKey、permissionType和visible'
      });
    }

    const pool = getDatabase();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      const {
        supportsRolePermissionMenuVisible,
        supportsRolePermissionCreatedAt
      } = await getPermissionRouteSchemaSupport(connection);

      if (!supportsRolePermissionMenuVisible) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: '当前数据库结构不支持权限可见性配置'
        });
      }

      // 检查权限是否存在
      const [existingPerm] = await connection.execute(
        'SELECT id, menu_visible FROM role_permissions WHERE role_id = ? AND module_key = ? AND permission_type = ?',
        [roleId, moduleKey, permissionType]
      );

      if (existingPerm.length === 0) {
        // 权限不存在，创建新权限
        await connection.execute(
          `INSERT INTO role_permissions (role_id, module_key, permission_type, menu_visible${supportsRolePermissionCreatedAt ? ', created_at' : ''}) VALUES (?, ?, ?, ?${supportsRolePermissionCreatedAt ? ', NOW()' : ''})`,
          [roleId, moduleKey, permissionType, visible ? 1 : 0]
        );
      } else {
        // 更新现有权限的可见性
        await connection.execute(
          'UPDATE role_permissions SET menu_visible = ? WHERE role_id = ? AND module_key = ? AND permission_type = ?',
          [visible ? 1 : 0, roleId, moduleKey, permissionType]
        );
      }

      await connection.commit();

      res.json({
        success: true,
        message: `成功${visible ? '启用' : '禁用'}权限 ${moduleKey}:${permissionType} 的可见性`,
        data: {
          roleId,
          moduleKey,
          permissionType,
          visible
        }
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    log.error('切换权限可见性失败:', error);
    res.status(500).json({
      success: false,
      message: '切换权限可见性失败: ' + error.message
    });
  }
});

/**
 * 获取权限可见性状态
 */
router.get('/visibility/:roleId', requirePermission('permissions:admin'), async (req, res) => {
  try {
    const { roleId } = req.params;

    const pool = getDatabase();
    const { supportsRolePermissionMenuVisible } = await getPermissionRouteSchemaSupport(pool);

    if (!supportsRolePermissionMenuVisible) {
      return res.json({
        success: true,
        message: '当前数据库结构不支持权限可见性配置',
        data: {
          roleId,
          permissions: []
        }
      });
    }

    const [permissions] = await pool.execute(`
      SELECT module_key, permission_type, menu_visible
      FROM role_permissions
      WHERE role_id = ? AND menu_visible IS NOT NULL
      ORDER BY module_key, permission_type
    `, [roleId]);

    res.json({
      success: true,
      message: '获取权限可见性状态成功',
      data: {
        roleId,
        permissions: permissions.map(perm => ({
          moduleKey: perm.module_key,
          permissionType: perm.permission_type,
          visible: Boolean(perm.menu_visible)
        }))
      }
    });
  } catch (error) {
    log.error('获取权限可见性状态失败:', error);
    res.status(500).json({
      success: false,
      message: '获取权限可见性状态失败: ' + error.message
    });
  }
});

/**
 * 获取角色字段权限配置
 */
router.get('/field-permissions/:roleId', requirePermission('permissions:admin'), async (req, res) => {
  try {
    const { roleId } = req.params;
    const { moduleKey } = req.query;

    log.debug(`🔍 获取角色字段权限: roleId=${roleId}, moduleKey=${moduleKey}`);

    if (!roleId) {
      return res.status(400).json({
        success: false,
        message: '角色ID不能为空'
      });
    }

    const pool = getDatabase();
    const { supportsRoleIsActive } = await getPermissionRouteSchemaSupport(pool);

    // 检查角色是否存在
    const [existingRole] = await pool.execute(
      `SELECT id, name FROM roles WHERE id = ? ${supportsRoleIsActive ? 'AND is_active = 1' : ''}`,
      [roleId]
    );

    if (existingRole.length === 0) {
      return res.status(404).json({
        success: false,
        message: '角色不存在'
      });
    }

    // 获取角色的字段权限配置（使用实际表结构）
    const [fieldPermissions] = await pool.execute(`
      SELECT
        rfp.module_key,
        rfp.field_config,
        rfp.created_at,
        rfp.updated_at
      FROM role_field_permissions rfp
      WHERE rfp.role_id = ?
      ${moduleKey ? 'AND rfp.module_key = ?' : ''}
      ORDER BY rfp.module_key
    `, moduleKey ? [roleId, moduleKey] : [roleId]);

    // 组织字段权限数据
    const fieldPermissionsMap = {};

    // 如果没有具体的字段权限配置，返回空的字段配置
    if (fieldPermissions.length === 0) {
      // 创建空的字段配置，由前端根据本地模块配置进行处理
      if (moduleKey) {
        fieldPermissionsMap[moduleKey] = {
          moduleKey: moduleKey,
          moduleName: moduleKey,
          fieldConfig: { hiddenFields: [] },
          createdAt: new Date(),
          updatedAt: new Date()
        };
      }
    } else {
      // 使用数据库中的具体权限配置
      fieldPermissions.forEach(perm => {
        if (!fieldPermissionsMap[perm.module_key]) {
          // 解析 field_config JSON
          let fieldConfig = { hiddenFields: [] };
          if (perm.field_config) {
            try {
              fieldConfig = typeof perm.field_config === 'string'
                ? JSON.parse(perm.field_config)
                : perm.field_config;
              log.debug(`🔍 解析字段配置 ${perm.module_key}:`, fieldConfig);
            } catch (e) {
              log.warn(`解析 field_config 失败:`, perm.field_config);
            }
          }

          fieldPermissionsMap[perm.module_key] = {
            moduleKey: perm.module_key,
            moduleName: perm.module_key,
            fieldConfig: fieldConfig,
            createdAt: perm.created_at,
            updatedAt: perm.updated_at
          };
        }
      });
    }

    log.debug(`📋 获取角色 ${roleId} 字段权限配置: ${Object.keys(fieldPermissionsMap).length} 个模块`);

    res.json({
      success: true,
      message: '获取角色字段权限成功',
      data: {
        roleId: parseInt(roleId),
        roleName: existingRole[0].name,
        fieldPermissions: fieldPermissionsMap,
        totalModules: Object.keys(fieldPermissionsMap).length
      }
    });
  } catch (error) {
    log.error('获取角色字段权限失败:', error);
    res.status(500).json({
      success: false,
      message: '获取角色字段权限失败: ' + error.message,
      data: {
        roleId: req.params.roleId,
        fieldPermissions: {}
      }
    });
  }
});

/**
 * 更新角色字段权限配置
 */
router.put('/field-permissions/:roleId', requirePermission('permissions:admin'), async (req, res) => {
  try {
    const { roleId } = req.params;
    const { moduleKey, fieldConfig } = req.body;

    log.debug('🔄 更新角色字段权限配置:');
    log.debug(`  角色ID: ${roleId}`);
    log.debug(`  模块Key: ${moduleKey}`);
    log.debug(`  字段配置:`, fieldConfig);

    if (!roleId || !moduleKey) {
      return res.status(400).json({
        success: false,
        message: '角色ID和模块Key不能为空'
      });
    }

    if (!fieldConfig || typeof fieldConfig !== 'object') {
      return res.status(400).json({
        success: false,
        message: '字段配置格式错误'
      });
    }

    const pool = getDatabase();
    const connection = await pool.getConnection();
    const { supportsRoleIsActive, supportsModuleIsActive } = await getPermissionRouteSchemaSupport(connection);

    try {
      await connection.beginTransaction();

      // 检查角色是否存在
      const [existingRole] = await connection.execute(
        `SELECT id FROM roles WHERE id = ? ${supportsRoleIsActive ? 'AND is_active = 1' : ''}`,
        [roleId]
      );

      if (existingRole.length === 0) {
        await connection.rollback();
        return res.status(404).json({
          success: false,
          message: '角色不存在'
        });
      }

      // 检查模块是否存在
      const [existingModule] = await connection.execute(
        `SELECT \`key\` FROM modules WHERE \`key\` = ? ${supportsModuleIsActive ? 'AND is_active = 1' : ''}`,
        [moduleKey]
      );

      if (existingModule.length === 0) {
        log.warn(`模块 ${moduleKey} 不在数据库中，但仍允许保存字段权限配置`);
      }

      // 检查是否已存在字段权限配置
      const [existingFieldPerm] = await connection.execute(
        'SELECT id FROM role_field_permissions WHERE role_id = ? AND module_key = ?',
        [roleId, moduleKey]
      );

      const fieldConfigJson = JSON.stringify(fieldConfig);

      if (existingFieldPerm.length > 0) {
        // 更新现有配置
        await connection.execute(`
          UPDATE role_field_permissions
          SET field_config = ?, updated_at = NOW()
          WHERE role_id = ? AND module_key = ?
        `, [fieldConfigJson, roleId, moduleKey]);
        log.debug(`🔄 更新角色 ${roleId} 模块 ${moduleKey} 的字段权限配置`);
      } else {
        // 创建新配置
        await connection.execute(`
          INSERT INTO role_field_permissions (role_id, module_key, field_config, created_at, updated_at)
          VALUES (?, ?, ?, NOW(), NOW())
        `, [roleId, moduleKey, fieldConfigJson]);
        log.debug(`➕ 创建角色 ${roleId} 模块 ${moduleKey} 的字段权限配置`);
      }

      // 🔧 自动同步到简短模块名（如果存在）
      // 例如: subsidy_subsidyview -> subsidy
      const shortModuleKey = moduleKey.split('_').slice(0, -1).join('_');
      if (shortModuleKey && shortModuleKey !== moduleKey) {
        log.debug(`🔄 自动同步字段权限到简短模块名: ${shortModuleKey}`);

        const [existingShort] = await connection.execute(
          'SELECT id FROM role_field_permissions WHERE role_id = ? AND module_key = ?',
          [roleId, shortModuleKey]
        );

        if (existingShort.length > 0) {
          await connection.execute(`
            UPDATE role_field_permissions
            SET field_config = ?, updated_at = NOW()
            WHERE role_id = ? AND module_key = ?
          `, [fieldConfigJson, roleId, shortModuleKey]);
          log.debug(`  ✅ 已同步到 ${shortModuleKey}`);
        } else {
          await connection.execute(`
            INSERT INTO role_field_permissions (role_id, module_key, field_config, created_at, updated_at)
            VALUES (?, ?, ?, NOW(), NOW())
          `, [roleId, shortModuleKey, fieldConfigJson]);
          log.debug(`  ✅ 已创建 ${shortModuleKey}`);
        }
      }

      await connection.commit();

      res.json({
        success: true,
        message: '字段权限配置更新成功',
        data: {
          roleId: parseInt(roleId),
          moduleKey,
          fieldConfig,
          syncedModuleKey: shortModuleKey || null,
          action: existingFieldPerm.length > 0 ? 'updated' : 'created'
        }
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    log.error('更新角色字段权限失败:', error);
    res.status(500).json({
      success: false,
      message: '更新角色字段权限失败: ' + error.message
    });
  }
});

/**
 * 保存角色字段权限配置
 */
router.post('/field-permissions/:roleId', requirePermission('permissions:admin'), async (req, res) => {
  try {
    const { roleId } = req.params;
    const { moduleKey, fieldConfig } = req.body;

    log.debug('💾 保存角色字段权限配置:');
    log.debug(`  角色ID: ${roleId}`);
    log.debug(`  模块Key: ${moduleKey}`);
    log.debug(`  字段配置:`, fieldConfig);

    if (!roleId || !moduleKey) {
      return res.status(400).json({
        success: false,
        message: '角色ID和模块Key不能为空'
      });
    }

    if (!fieldConfig || typeof fieldConfig !== 'object') {
      return res.status(400).json({
        success: false,
        message: '字段配置格式错误'
      });
    }

    const pool = getDatabase();
    const connection = await pool.getConnection();
    const { supportsRoleIsActive, supportsModuleIsActive } = await getPermissionRouteSchemaSupport(connection);

    try {
      await connection.beginTransaction();

      // 检查角色是否存在
      const [existingRole] = await connection.execute(
        `SELECT id FROM roles WHERE id = ? ${supportsRoleIsActive ? 'AND is_active = 1' : ''}`,
        [roleId]
      );

      if (existingRole.length === 0) {
        await connection.rollback();
        return res.status(404).json({
          success: false,
          message: '角色不存在'
        });
      }

      // 检查模块是否存在
      const [existingModule] = await connection.execute(
        `SELECT \`key\` FROM modules WHERE \`key\` = ? ${supportsModuleIsActive ? 'AND is_active = 1' : ''}`,
        [moduleKey]
      );

      if (existingModule.length === 0) {
        log.warn(`模块 ${moduleKey} 不在数据库中，但仍允许保存字段权限配置`);
      }

      // 检查是否已存在字段权限配置
      const [existingFieldPerm] = await connection.execute(
        'SELECT id FROM role_field_permissions WHERE role_id = ? AND module_key = ?',
        [roleId, moduleKey]
      );

      const fieldConfigJson = JSON.stringify(fieldConfig);

      if (existingFieldPerm.length > 0) {
        // 更新现有配置
        await connection.execute(`
          UPDATE role_field_permissions
          SET field_config = ?, updated_at = NOW()
          WHERE role_id = ? AND module_key = ?
        `, [fieldConfigJson, roleId, moduleKey]);
        log.debug(`🔄 更新角色 ${roleId} 模块 ${moduleKey} 的字段权限配置`);
      } else {
        // 创建新配置
        await connection.execute(`
          INSERT INTO role_field_permissions (role_id, module_key, field_config, created_at, updated_at)
          VALUES (?, ?, ?, NOW(), NOW())
        `, [roleId, moduleKey, fieldConfigJson]);
        log.debug(`➕ 创建角色 ${roleId} 模块 ${moduleKey} 的字段权限配置`);
      }

      // 🔧 自动同步到简短模块名（如果存在）
      // 例如: subsidy_subsidyview -> subsidy
      const shortModuleKey = moduleKey.split('_').slice(0, -1).join('_');
      if (shortModuleKey && shortModuleKey !== moduleKey) {
        log.debug(`🔄 自动同步字段权限到简短模块名: ${shortModuleKey}`);

        const [existingShort] = await connection.execute(
          'SELECT id FROM role_field_permissions WHERE role_id = ? AND module_key = ?',
          [roleId, shortModuleKey]
        );

        if (existingShort.length > 0) {
          await connection.execute(`
            UPDATE role_field_permissions
            SET field_config = ?, updated_at = NOW()
            WHERE role_id = ? AND module_key = ?
          `, [fieldConfigJson, roleId, shortModuleKey]);
          log.debug(`  ✅ 已同步到 ${shortModuleKey}`);
        } else {
          await connection.execute(`
            INSERT INTO role_field_permissions (role_id, module_key, field_config, created_at, updated_at)
            VALUES (?, ?, ?, NOW(), NOW())
          `, [roleId, shortModuleKey, fieldConfigJson]);
          log.debug(`  ✅ 已创建 ${shortModuleKey}`);
        }
      }

      await connection.commit();

      res.json({
        success: true,
        message: '字段权限配置保存成功',
        data: {
          roleId: parseInt(roleId),
          moduleKey,
          fieldConfig,
          syncedModuleKey: shortModuleKey || null,
          action: existingFieldPerm.length > 0 ? 'updated' : 'created'
        }
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    log.error('保存角色字段权限失败:', error);
    res.status(500).json({
      success: false,
      message: '保存角色字段权限失败: ' + error.message
    });
  }
});

/**
 * 批量保存角色字段权限配置
 */
router.post('/field-permissions/:roleId/batch', requirePermission('permissions:admin'), async (req, res) => {
  try {
    const { roleId } = req.params;
    const { modulePermissions } = req.body; // 格式: { moduleKey: { hiddenFields: [...] } }

    log.debug('📦 批量保存角色字段权限配置:');
    log.debug(`  角色ID: ${roleId}`);
    log.debug(`  模块数量: ${modulePermissions ? Object.keys(modulePermissions).length : 0}`);

    if (!roleId) {
      return res.status(400).json({
        success: false,
        message: '角色ID不能为空'
      });
    }

    if (!modulePermissions || typeof modulePermissions !== 'object') {
      return res.status(400).json({
        success: false,
        message: '模块权限配置格式错误'
      });
    }

    const pool = getDatabase();
    const connection = await pool.getConnection();
    const { supportsRoleIsActive } = await getPermissionRouteSchemaSupport(connection);

    try {
      await connection.beginTransaction();

      // 检查角色是否存在
      const [existingRole] = await connection.execute(
        `SELECT id FROM roles WHERE id = ? ${supportsRoleIsActive ? 'AND is_active = 1' : ''}`,
        [roleId]
      );

      if (existingRole.length === 0) {
        await connection.rollback();
        return res.status(404).json({
          success: false,
          message: '角色不存在'
        });
      }

      let updatedCount = 0;
      let createdCount = 0;

      // 逐个处理每个模块的字段权限配置
      for (const [moduleKey, fieldConfig] of Object.entries(modulePermissions)) {
        if (!moduleKey || !fieldConfig || typeof fieldConfig !== 'object') {
          log.warn(`跳过无效的模块配置: ${moduleKey}`, fieldConfig);
          continue;
        }

        // 检查是否已存在字段权限配置
        const [existingFieldPerm] = await connection.execute(
          'SELECT id FROM role_field_permissions WHERE role_id = ? AND module_key = ?',
          [roleId, moduleKey]
        );

        const fieldConfigJson = JSON.stringify(fieldConfig);

        if (existingFieldPerm.length > 0) {
          // 更新现有配置
          await connection.execute(`
            UPDATE role_field_permissions
            SET field_config = ?, updated_at = NOW()
            WHERE role_id = ? AND module_key = ?
          `, [fieldConfigJson, roleId, moduleKey]);
          updatedCount++;
        } else {
          // 创建新配置
          await connection.execute(`
            INSERT INTO role_field_permissions (role_id, module_key, field_config, created_at, updated_at)
            VALUES (?, ?, ?, NOW(), NOW())
          `, [roleId, moduleKey, fieldConfigJson]);
          createdCount++;
        }
      }

      await connection.commit();

      log.debug(`✅ 批量保存完成: 更新 ${updatedCount} 个，创建 ${createdCount} 个`);

      res.json({
        success: true,
        message: `批量保存字段权限配置成功，更新 ${updatedCount} 个，创建 ${createdCount} 个`,
        data: {
          roleId: parseInt(roleId),
          totalModules: Object.keys(modulePermissions).length,
          updatedCount,
          createdCount
        }
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    log.error('批量保存角色字段权限失败:', error);
    res.status(500).json({
      success: false,
      message: '批量保存角色字段权限失败: ' + error.message
    });
  }
});

/**
 * 删除角色字段权限配置
 */
router.delete('/field-permissions/:roleId/:moduleKey', requirePermission('permissions:admin'), async (req, res) => {
  try {
    const { roleId, moduleKey } = req.params;

    log.debug(`🗑️ 删除角色字段权限配置: roleId=${roleId}, moduleKey=${moduleKey}`);

    if (!roleId || !moduleKey) {
      return res.status(400).json({
        success: false,
        message: '角色ID和模块Key不能为空'
      });
    }

    const pool = getDatabase();

    // 删除字段权限配置
    const [result] = await pool.execute(
      'DELETE FROM role_field_permissions WHERE role_id = ? AND module_key = ?',
      [roleId, moduleKey]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: '字段权限配置不存在'
      });
    }

    log.debug(`✅ 删除角色 ${roleId} 模块 ${moduleKey} 的字段权限配置成功`);

    res.json({
      success: true,
      message: '删除字段权限配置成功',
      data: {
        roleId: parseInt(roleId),
        moduleKey,
        deletedCount: result.affectedRows
      }
    });
  } catch (error) {
    log.error('删除角色字段权限失败:', error);
    res.status(500).json({
      success: false,
      message: '删除角色字段权限失败: ' + error.message
    });
  }
});

/**
 * 获取用户当前生效的字段权限配置
 */
router.get('/user-field-permissions', async (req, res) => {
  try {
    const { moduleKey } = req.query;

    // 真实用户认证
    let userId = req.user?.id || req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: '用户未认证，请使用真实登录'
      });
    }

    log.debug(`👤 获取用户字段权限: userId=${userId}, moduleKey=${moduleKey}`);

    const pool = getDatabase();
    const { supportsRoleIsActive } = await getPermissionRouteSchemaSupport(pool);

    // 获取用户的所有角色
    const [userRoles] = await pool.execute(`
      SELECT DISTINCT ur.role_id, r.name as role_name
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = ? ${supportsRoleIsActive ? 'AND r.is_active = 1' : ''}
    `, [userId]);

    if (userRoles.length === 0) {
      return res.json({
        success: true,
        message: '获取用户字段权限成功（用户无角色）',
        data: {
          userId,
          roles: [],
          fieldPermissions: {}
        }
      });
    }

    // 获取用户所有角色的字段权限配置
    const roleIds = userRoles.map(r => r.role_id);
    const placeholders = roleIds.map(() => '?').join(',');

    const [fieldPermissions] = await pool.execute(`
      SELECT role_id, module_key, field_config
      FROM role_field_permissions
      WHERE role_id IN (${placeholders})
      ${moduleKey ? 'AND module_key = ?' : ''}
      ORDER BY module_key
    `, moduleKey ? [...roleIds, moduleKey] : roleIds);

    // 组织字段权限数据，按模块合并所有角色的配置
    const mergedFieldPermissions = {};

    fieldPermissions.forEach(perm => {
      try {
        // 处理字段配置：可能是对象或字符串
        let fieldConfig;
        if (perm.field_config === null || perm.field_config === undefined) {
          // 处理 null 或 undefined 的情况
          fieldConfig = { hiddenFields: [] };
        } else if (typeof perm.field_config === 'object') {
          fieldConfig = perm.field_config;
        } else if (typeof perm.field_config === 'string') {
          fieldConfig = JSON.parse(perm.field_config || '{}');
        } else {
          fieldConfig = { hiddenFields: [] };
        }

        if (!mergedFieldPermissions[perm.module_key]) {
          mergedFieldPermissions[perm.module_key] = {
            moduleKey: perm.module_key,
            hiddenFields: new Set(),
            roleSources: []
          };
        }

        // 合并隐藏字段（取所有角色隐藏字段的并集）
        if (fieldConfig.hiddenFields && Array.isArray(fieldConfig.hiddenFields)) {
          fieldConfig.hiddenFields.forEach(field => {
            mergedFieldPermissions[perm.module_key].hiddenFields.add(field);
          });
        }

        // 记录权限来源角色
        const roleInfo = userRoles.find(r => r.role_id === perm.role_id);
        if (roleInfo) {
          mergedFieldPermissions[perm.module_key].roleSources.push({
            roleId: perm.role_id,
            roleName: roleInfo.role_name
          });
        }
      } catch (error) {
        log.warn(`解析用户字段权限配置失败: ${perm.module_key}`, error);
        log.warn(`  - field_config 原始值:`, perm.field_config);
        log.warn(`  - field_config 类型:`, typeof perm.field_config);
      }
    });

    // 将Set转换为数组
    Object.keys(mergedFieldPermissions).forEach(moduleKey => {
      mergedFieldPermissions[moduleKey].hiddenFields = Array.from(mergedFieldPermissions[moduleKey].hiddenFields);
    });

    log.debug(`📋 获取用户 ${userId} 字段权限: ${Object.keys(mergedFieldPermissions).length} 个模块`);

    res.json({
      success: true,
      message: '获取用户字段权限成功',
      data: {
        userId,
        roles: userRoles.map(r => ({ roleId: r.role_id, roleName: r.role_name })),
        fieldPermissions: mergedFieldPermissions,
        totalModules: Object.keys(mergedFieldPermissions).length
      }
    });
  } catch (error) {
    log.error('获取用户字段权限失败:', error);
    res.status(500).json({
      success: false,
      message: '获取用户字段权限失败: ' + error.message,
      data: {
        userId: req.user?.id || req.user?.userId,
        roles: [],
        fieldPermissions: {}
      }
    });
  }
});

/**
 * 获取模块映射列表（用于字段权限管理）
 */
router.get('/module-mappings', requirePermission('permissions:admin'), async (req, res) => {
  try {
    const pool = getDatabase();
    const { supportsModuleIsActive } = await getPermissionRouteSchemaSupport(pool);

    // 获取所有已注册的模块（用于字段权限管理）
    const [dbModules] = await pool.execute(`
      SELECT DISTINCT
        m.\`key\` as module_key,
        m.\`key\` as \`key\`,
        m.name as name,
        m.category,
        m.icon,
        0 as field_count
      FROM modules m
      ${supportsModuleIsActive ? 'WHERE m.is_active = 1' : ''}
      ORDER BY m.category, m.sort_order, m.name
    `);

    // 如果数据库中没有模块，提供基本的模块列表作为回退
    let modules = dbModules;
    if (dbModules.length === 0) {
      log.warn('数据库中没有已注册的模块，使用默认模块列表');
      modules = [
        { module_key: 'dashboard', key: 'dashboard', name: '仪表盘', category: 'system', icon: 'fas fa-tachometer-alt', field_count: 0 },
        { module_key: 'users', key: 'users', name: '用户管理', category: 'system', icon: 'fas fa-users', field_count: 0 },
        { module_key: 'roles', key: 'roles', name: '角色管理', category: 'system', icon: 'fas fa-user-tag', field_count: 0 },
        { module_key: 'permissions', key: 'permissions', name: '权限管理', category: 'system', icon: 'fas fa-shield-alt', field_count: 0 },
        { module_key: 'inventory', key: 'inventory', name: '库存管理', category: 'business', icon: 'fas fa-warehouse', field_count: 0 },
        { module_key: 'stock-in', key: 'stock-in', name: '入库管理', category: 'business', icon: 'fas fa-plus-circle', field_count: 0 },
        { module_key: 'sales', key: 'sales', name: '销售管理', category: 'business', icon: 'fas fa-dollar-sign', field_count: 0 },
        { module_key: 'query', key: 'query', name: '综合查询', category: 'business', icon: 'fas fa-search', field_count: 0 }
      ];
    }

    modules = mergeManagedModules(modules, 'key').map(module => ({
      module_key: module.module_key,
      key: module.key,
      name: module.name,
      category: module.category,
      icon: module.icon,
      field_count: module.field_count || 0
    }));

    res.json({
      success: true,
      message: '获取模块映射列表成功',
      data: modules
    });
  } catch (error) {
    log.error('获取模块映射列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取模块映射列表失败: ' + error.message,
      data: []
    });
  }
});

/**
 * 手动清理权限 - 管理员工具
 */
router.post('/cleanup-permissions', requirePermission('permissions:admin'), manualCleanup);

module.exports = router;
