const express = require('express');
const router = express.Router();
const ModuleScanner = require('../services/moduleScanner_simple');
const MenuModuleLinker = require('../services/menuModuleLinker');
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth');
const { getDatabase } = require('../config/database');
const log = require('../utils/log');

const moduleScanner = new ModuleScanner();
const menuLinker = new MenuModuleLinker();

// 权限验证中间件
router.use(unifiedAuth);

/**
 * 获取所有模块列表（用于菜单管理中的模块选择）
 */
router.get('/', requirePermission('permissions:admin'), async (req, res) => {
  try {
    const pool = getDatabase();

    const [modules] = await pool.execute(`
      SELECT id, \`key\`, name, description, icon, is_active
      FROM modules
      ORDER BY name ASC
    `);

    res.json({
      success: true,
      message: '获取模块列表成功',
      data: modules
    });
  } catch (error) {
    log.error('获取模块列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取模块列表失败',
      data: []
    });
  }
});

/**
 * 扫描并获取所有发现的模块
 */
router.get('/scan', requirePermission('permissions:admin'), async (req, res) => {
  try {
    const allModules = await moduleScanner.scanViewsDirectory();

    log.debug(`🔍 模块扫描结果: 总共${allModules.length}个模块`);

    res.json({
      success: true,
      message: '扫描成功',
      data: {
        total: allModules.length,
        modules: allModules
      }
    });
  } catch (error) {
    log.error('扫描模块失败:', error);
    res.status(500).json({
      success: false,
      message: '扫描模块失败: ' + error.message,
      data: []
    });
  }
});

/**
 * 获取未注册的模块列表
 */
router.get('/unregistered', requirePermission('permissions:admin'), async (req, res) => {
  try {
    const allUnregisteredModules = await moduleScanner.getUnregisteredModules();
    const modulesArray = Array.isArray(allUnregisteredModules?.data?.modules)
      ? allUnregisteredModules.data.modules
      : [];

    res.json({
      success: true,
      message: '获取未注册模块成功',
      data: {
        total: modulesArray.length,
        modules: modulesArray
      }
    });
  } catch (error) {
    log.error('获取未注册模块失败:', error);
    res.status(500).json({
      success: false,
      message: '获取未注册模块失败: ' + error.message,
      data: []
    });
  }
});

/**
 * 注册单个模块
 */
router.post('/register', requirePermission('permissions:admin'), async (req, res) => {
  try {
    const { moduleKey } = req.body;

    if (!moduleKey) {
      return res.status(400).json({
        success: false,
        message: '模块标识不能为空'
      });
    }

    // 先扫描获取模块信息
    const modules = await moduleScanner.scanViewsDirectory();
    const targetModule = modules.find(m => m.key === moduleKey);

    if (!targetModule) {
      return res.status(404).json({
        success: false,
        message: '未找到指定的模块'
      });
    }

    const result = await moduleScanner.registerModule(targetModule);

    res.json(result);
  } catch (error) {
    log.error('注册模块失败:', error);
    res.status(500).json({
      success: false,
      message: '注册模块失败: ' + error.message
    });
  }
});

/**
 * 批量注册模块
 */
router.post('/register-batch', requirePermission('permissions:admin'), async (req, res) => {
  try {
    const { moduleKeys } = req.body;

    if (!Array.isArray(moduleKeys) || moduleKeys.length === 0) {
      return res.status(400).json({
        success: false,
        message: '模块标识列表不能为空'
      });
    }

    // 获取所有模块信息
    const allModules = await moduleScanner.scanViewsDirectory();
    const targetModules = allModules.filter(m => moduleKeys.includes(m.key));

    if (targetModules.length !== moduleKeys.length) {
      return res.status(404).json({
        success: false,
        message: '部分模块未找到'
      });
    }

    const result = await moduleScanner.registerModules(targetModules);

    res.json({
      success: true,
      message: '批量注册完成',
      data: result
    });
  } catch (error) {
    log.error('批量注册模块失败:', error);
    res.status(500).json({
      success: false,
      message: '批量注册模块失败: ' + error.message
    });
  }
});

/**
 * 同步所有模块
 */
router.post('/sync-all', requirePermission('permissions:admin'), async (req, res) => {
  try {
    const result = await moduleScanner.syncAllModules();

    res.json({
      success: true,
      message: '同步所有模块完成',
      data: result
    });
  } catch (error) {
    log.error('同步所有模块失败:', error);
    res.status(500).json({
      success: false,
      message: '同步所有模块失败: ' + error.message
    });
  }
});

/**
 * 获取已注册的模块列表
 */
router.get('/registered', requirePermission('permissions:admin'), async (req, res) => {
  try {
    const pool = getDatabase();

    // 获取所有已注册的模块
    const [rows] = await pool.execute(`
      SELECT m.*,
             CASE WHEN m.is_custom_name = 1 THEN "🔒 自定义" ELSE "🤖 自动" END as name_status
      FROM modules m
      WHERE m.is_active = 1
      ORDER BY m.category, m.sort_order, m.\`key\`
    `);

    log.debug(`🔍 已注册模块查询结果: ${rows.length}个模块`);

    res.json({
      success: true,
      message: '获取已注册模块成功',
      data: {
        total: rows.length,
        modules: rows
      }
    });
  } catch (error) {
    log.error('获取已注册模块失败:', error);
    res.status(500).json({
      success: false,
      message: '获取已注册模块失败: ' + error.message,
      data: []
    });
  }
});

/**
 * 获取模块详细信息
 */
router.get('/:moduleKey', requirePermission('permissions:admin'), async (req, res) => {
  try {
    const { moduleKey } = req.params;
    const pool = getDatabase();

    // 获取模块基本信息
    const [moduleRows] = await pool.execute(
      'SELECT * FROM modules WHERE `key` = ? AND is_active = 1',
      [moduleKey]
    );

    if (moduleRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '模块不存在'
      });
    }

    // 获取模块权限（从role_permissions获取）
    const [permissionRows] = await pool.execute(
      'SELECT DISTINCT permission_type, description FROM role_permissions WHERE module_key = ?',
      [moduleKey]
    );

    // 获取模块的角色权限分配情况
    const [rolePermissionRows] = await pool.execute(`
      SELECT rp.role_id, r.name as role_name, rp.permission_type
      FROM role_permissions rp
      JOIN roles r ON rp.role_id = r.id
      WHERE rp.module_key = ?
      ORDER BY r.name
    `, [moduleKey]);

    res.json({
      success: true,
      message: '获取模块详情成功',
      data: {
        module: moduleRows[0],
        permissions: permissionRows,
        rolePermissions: rolePermissionRows
      }
    });
  } catch (error) {
    log.error('获取模块详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取模块详情失败: ' + error.message
    });
  }
});

/**
 * 更新模块信息
 */
router.put('/:moduleKey', requirePermission('permissions:admin'), async (req, res) => {
  try {
    const { moduleKey } = req.params;
    const { name, description, category, icon, sortOrder } = req.body;

    const pool = getDatabase();
    const [result] = await pool.execute(`
      UPDATE modules
      SET name = ?, description = ?, category = ?, icon = ?, sort_order = ?, updated_at = NOW()
      WHERE \`key\` = ?
    `, [name, description, category, icon, sortOrder, moduleKey]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: '模块不存在或未更新'
      });
    }

    res.json({
      success: true,
      message: '模块更新成功'
    });
  } catch (error) {
    log.error('更新模块失败:', error);
    res.status(500).json({
      success: false,
      message: '更新模块失败: ' + error.message
    });
  }
});

/**
 * 启用/禁用模块
 */
router.patch('/:moduleKey/toggle', requirePermission('permissions:admin'), async (req, res) => {
  try {
    const { moduleKey } = req.params;
    const { isActive } = req.body;

    const pool = getDatabase();
    const [result] = await pool.execute(
      'UPDATE modules SET is_active = ?, updated_at = NOW() WHERE `key` = ?',
      [isActive, moduleKey]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: '模块不存在'
      });
    }

    res.json({
      success: true,
      message: `模块${isActive ? '启用' : '禁用'}成功`
    });
  } catch (error) {
    log.error('切换模块状态失败:', error);
    res.status(500).json({
      success: false,
      message: '切换模块状态失败: ' + error.message
    });
  }
});

/**
 * 删除模块
 */
router.delete('/:moduleKey', requirePermission('permissions:admin'), async (req, res) => {
  try {
    const { moduleKey } = req.params;
    const pool = getDatabase();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 删除模块权限（从role_permissions删除）
      await connection.execute(
        'DELETE FROM role_permissions WHERE module_key = ?',
        [moduleKey]
      );

      // 软删除模块（标记为非活跃状态）
      await connection.execute(
        'UPDATE modules SET is_active = 0, updated_at = NOW() WHERE `key` = ?',
        [moduleKey]
      );

      await connection.commit();

      res.json({
        success: true,
        message: '模块删除成功'
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    log.error('删除模块失败:', error);
    res.status(500).json({
      success: false,
      message: '删除模块失败: ' + error.message
    });
  }
});

/**
 * 获取模块统计信息
 */
router.get('/stats/overview', requirePermission('permissions:admin'), async (req, res) => {
  try {
    const pool = getDatabase();

    // 获取模块总数
    const [totalRows] = await pool.execute(
      'SELECT COUNT(*) as total FROM modules WHERE is_active = 1'
    );

      // 获取权限总数 - 从 role_permissions 表计算
    const [permissionRows] = await pool.execute(
      'SELECT COUNT(DISTINCT CONCAT(module_key, permission_type)) as total FROM role_permissions'
    );

    // 获取角色总数
    const [roleRows] = await pool.execute(
      'SELECT COUNT(*) as total FROM roles WHERE is_active = 1'
    );

    // 获取活跃用户总数
    const [userRows] = await pool.execute(
      'SELECT COUNT(*) as total FROM users WHERE status = 1'
    );

    // 按分类统计模块
    const [categoryRows] = await pool.execute(`
      SELECT category, COUNT(*) as count
      FROM modules
      WHERE is_active = 1
      GROUP BY category
    `);

    // 获取最近的同步记录（module_sync_log表不存在，暂时返回空数组）
    const [syncRows] = [];

    res.json({
      success: true,
      message: '获取统计信息成功',
      data: {
        totalModules: totalRows[0].total,
        totalPermissions: permissionRows[0].total,
        totalRoles: roleRows[0].total,
        activeUsers: userRows[0].total,
        categoryStats: categoryRows,
        recentSyncs: syncRows
      }
    });
  } catch (error) {
    log.error('获取统计信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取统计信息失败: ' + error.message
    });
  }
});

/**
 * 修改模块名称
 */
router.put('/:moduleKey/name', requirePermission('permissions:admin'), async (req, res) => {
  try {
    const { moduleKey } = req.params;
    const { name, isCustom = true } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: '模块名称不能为空'
      });
    }

    const pool = getDatabase();

    // 获取当前模块信息
    const [currentModule] = await pool.execute(
      'SELECT * FROM modules WHERE `key` = ? AND is_active = 1',
      [moduleKey]
    );

    if (currentModule.length === 0) {
      return res.status(404).json({
        success: false,
        message: '模块不存在'
      });
    }

    const module = currentModule[0];

    // 如果是自定义名称且不是首次设置，记录日志
    if (module.is_custom_name === 1 && isCustom === true) {
      log.debug(`🔓 更改自定义名称: "${module.name}" -> "${name}" (模块: ${moduleKey})`);
    } else if (module.is_custom_name === 0 && isCustom === true) {
      log.debug(`🔒 设为自定义名称: "${module.name}" -> "${name}" (模块: ${moduleKey})`);
    }

    // 更新模块名称
    await pool.execute(
      'UPDATE modules SET name = ?, is_custom_name = ?, updated_at = NOW() WHERE `key` = ?',
      [name.trim(), isCustom ? 1 : 0, moduleKey]
    );

    res.json({
      success: true,
      message: `模块名称修改成功`,
      data: {
        moduleKey,
        oldName: module.name,
        newName: name.trim(),
        isCustomName: isCustom,
        originalName: module.original_name
      }
    });
  } catch (error) {
    log.error('修改模块名称失败:', error);
    res.status(500).json({
      success: false,
      message: '修改模块名称失败: ' + error.message
    });
  }
});

/**
 * 恢复模块原始名称
 */
router.put('/:moduleKey/restore-name', requirePermission('permissions:admin'), async (req, res) => {
  try {
    const { moduleKey } = req.params;
    const pool = getDatabase();

    // 获取当前模块信息
    const [currentModule] = await pool.execute(
      'SELECT * FROM modules WHERE `key` = ? AND is_active = 1',
      [moduleKey]
    );

    if (currentModule.length === 0) {
      return res.status(404).json({
        success: false,
        message: '模块不存在'
      });
    }

    const module = currentModule[0];

    if (!module.original_name) {
      return res.status(400).json({
        success: false,
        message: '该模块没有原始名称记录'
      });
    }

    log.debug(`🔄 恢复原始名称: "${module.name}" -> "${module.original_name}" (模块: ${moduleKey})`);

    // 恢复原始名称
    await pool.execute(
      'UPDATE modules SET name = ?, is_custom_name = 0, updated_at = NOW() WHERE `key` = ?',
      [module.original_name, moduleKey]
    );

    res.json({
      success: true,
      message: `模块名称已恢复为原始名称`,
      data: {
        moduleKey,
        oldName: module.name,
        newName: module.original_name,
        isCustomName: false
      }
    });
  } catch (error) {
    log.error('恢复模块名称失败:', error);
    res.status(500).json({
      success: false,
      message: '恢复模块名称失败: ' + error.message
    });
  }
});

/**
 * 获取模块名称状态
 */
router.get('/:moduleKey/name-status', requirePermission('permissions:admin'), async (req, res) => {
  try {
    const { moduleKey } = req.params;
    const pool = getDatabase();

    const [module] = await pool.execute(
      'SELECT `key`, name, is_custom_name, original_name, created_at, updated_at FROM modules WHERE `key` = ? AND is_active = 1',
      [moduleKey]
    );

    if (module.length === 0) {
      return res.status(404).json({
        success: false,
        message: '模块不存在'
      });
    }

    const moduleInfo = module[0];
    const status = {
      moduleKey: moduleInfo.key,
      currentName: moduleInfo.name,
      isCustomName: moduleInfo.is_custom_name === 1,
      originalName: moduleInfo.original_name,
      canRestore: moduleInfo.is_custom_name === 1 && moduleInfo.original_name !== null,
      status: moduleInfo.is_custom_name === 1 ? '🔒 自定义名称' : '🤖 自动生成',
      createdAt: moduleInfo.created_at,
      updatedAt: moduleInfo.updated_at
    };

    res.json({
      success: true,
      message: '获取模块名称状态成功',
      data: status
    });
  } catch (error) {
    log.error('获取模块名称状态失败:', error);
    res.status(500).json({
      success: false,
      message: '获取模块名称状态失败: ' + error.message
    });
  }
});

/**
 * 获取菜单-模块关联统计信息
 */
router.get('/menu-link/stats', requirePermission('permissions:admin'), async (req, res) => {
  try {
    const stats = await menuLinker.getLinkStats();
    res.json(stats);
  } catch (error) {
    log.error('获取关联统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取关联统计失败: ' + error.message
    });
  }
});

/**
 * 获取未关联的菜单列表
 */
router.get('/menu-link/unlinked', requirePermission('permissions:admin'), async (req, res) => {
  try {
    const result = await menuLinker.getUnlinkedMenus();
    res.json(result);
  } catch (error) {
    log.error('获取未关联菜单失败:', error);
    res.status(500).json({
      success: false,
      message: '获取未关联菜单失败: ' + error.message
    });
  }
});

/**
 * 同步所有菜单-模块关联
 */
router.post('/menu-link/sync', requirePermission('permissions:admin'), async (req, res) => {
  try {
    log.debug('🔄 开始同步菜单-模块关联...');
    const result = await menuLinker.syncAllMenusToModules();
    res.json(result);
  } catch (error) {
    log.error('同步菜单-模块关联失败:', error);
    res.status(500).json({
      success: false,
      message: '同步失败: ' + error.message
    });
  }
});

/**
 * 手动关联单个菜单到模块
 */
router.post('/menu-link/link', requirePermission('permissions:admin'), async (req, res) => {
  try {
    const { menuId, moduleKey } = req.body;

    if (!menuId || !moduleKey) {
      return res.status(400).json({
        success: false,
        message: '菜单ID和模块标识不能为空'
      });
    }

    const result = await menuLinker.linkMenuToModule(menuId, moduleKey);
    res.json(result);
  } catch (error) {
    log.error('关联菜单到模块失败:', error);
    res.status(500).json({
      success: false,
      message: '关联失败: ' + error.message
    });
  }
});

/**
 * 切换模块启用/禁用状态
 */
router.put('/:id/status', requirePermission('permissions:admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    if (typeof is_active !== 'number') {
      return res.status(400).json({
        success: false,
        message: '状态值必须是数字 (0 或 1)'
      });
    }

    const pool = getDatabase();

    // 检查模块是否存在
    const [modules] = await pool.execute(
      'SELECT * FROM modules WHERE id = ?',
      [id]
    );

    if (modules.length === 0) {
      return res.status(404).json({
        success: false,
        message: '模块不存在'
      });
    }

    // 更新模块状态
    await pool.execute(
      'UPDATE modules SET is_active = ?, updated_at = NOW() WHERE id = ?',
      [is_active, id]
    );

    res.json({
      success: true,
      message: `模块已${is_active === 1 ? '启用' : '禁用'}`,
      data: {
        id,
        is_active
      }
    });
  } catch (error) {
    log.error('切换模块状态失败:', error);
    res.status(500).json({
      success: false,
      message: '操作失败: ' + error.message
    });
  }
});

/**
 * 手动创建模块
 */
router.post('/manual-create', requirePermission('permissions:admin'), async (req, res) => {
  const connection = await getDatabase().getConnection();

  try {
    const { key, name, description, category, icon, is_active } = req.body;

    // 验证必填字段
    if (!key || !name || !category) {
      return res.status(400).json({
        success: false,
        message: '模块标识、名称和分类为必填项'
      });
    }

    // 验证模块标识格式
    const keyRegex = /^[a-z0-9_]+$/;
    if (!keyRegex.test(key)) {
      return res.status(400).json({
        success: false,
        message: '模块标识只能包含小写字母、数字和下划线'
      });
    }

    await connection.beginTransaction();

    // 检查模块是否已存在
    const [existingModules] = await connection.execute(
      'SELECT * FROM modules WHERE `key` = ?',
      [key]
    );

    if (existingModules.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `模块标识 "${key}" 已存在，请使用其他标识`
      });
    }

    // 插入新模块
    const [result] = await connection.execute(
      `INSERT INTO modules (\`key\`, name, description, category, icon, sort_order, is_active, is_custom_name, original_name, created_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, 1, ?, NOW())`,
      [key, name, description || `${name}管理模块`, category, icon || 'fas fa-cube', is_active !== undefined ? (is_active ? 1 : 0) : 1, name]
    );

    const moduleId = result.insertId;

    await connection.commit();

    log.debug(`✅ 手动创建模块成功: ${key} (${name})`);

    // 自动修复菜单关联
    try {
      const scanner = new ModuleScanner();
      await scanner.autoFixAllMenuLinks();
    } catch (fixError) {
      log.error('自动修复菜单关联失败:', fixError);
      // 不影响创建操作的成功
    }

    res.json({
      success: true,
      message: `模块 "${name}" 创建成功`,
      data: {
        id: moduleId,
        key,
        name,
        category,
        is_active: is_active !== undefined ? (is_active ? 1 : 0) : 1
      }
    });
  } catch (error) {
    await connection.rollback();
    log.error('手动创建模块失败:', error);
    res.status(500).json({
      success: false,
      message: '创建模块失败: ' + error.message
    });
  } finally {
    connection.release();
  }
});

/**
 * 手动触发菜单关联修复
 */
router.post('/fix-menu-links', requirePermission('permissions:admin'), async (req, res) => {
  try {
    log.debug('🔧 手动触发菜单关联修复...');

    const scanner = new ModuleScanner();
    const result = await scanner.autoFixAllMenuLinks();

    res.json({
      success: true,
      message: `菜单关联修复完成，更新了 ${result.updatedCount} 个菜单关联`,
      data: result
    });
  } catch (error) {
    log.error('菜单关联修复失败:', error);
    res.status(500).json({
      success: false,
      message: '修复失败: ' + error.message
    });
  }
});

module.exports = router;
