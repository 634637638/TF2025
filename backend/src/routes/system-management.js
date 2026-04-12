const express = require('express');
const router = express.Router();
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth');
const fs = require('fs');
const path = require('path');
const { getDatabase } = require('../config/database');
const log = require('../utils/log');

// 权限验证中间件
router.use(unifiedAuth);

/**
 * 初始化模块管理数据库
 */
router.post('/init-module-management', requirePermission('permissions:admin'), async (req, res) => {
  try {
    log.debug('🚀 开始初始化模块管理系统...');

    // 读取SQL文件
    const sqlFile = path.join(__dirname, '../migrations/create_module_management_tables.sql');

    if (!fs.existsSync(sqlFile)) {
      return res.status(404).json({
        success: false,
        message: 'SQL文件不存在'
      });
    }

    const sqlContent = fs.readFileSync(sqlFile, 'utf8');

    // 分割SQL语句
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && !stmt.startsWith('CREATE'));

    log.debug(`📋 找到 ${statements.length} 个SQL语句`);

    // 执行SQL语句
    const pool = getDatabase();
    const connection = await pool.getConnection();

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    try {
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        if (statement.trim()) {
          try {
            log.debug(`⚡ 执行语句 ${i + 1}/${statements.length}...`);
            await connection.execute(statement);
            successCount++;
          } catch (error) {
            log.error(`❌ 语句 ${i + 1} 执行失败:`, error.message);
            errorCount++;
            errors.push({
              statement: i + 1,
              error: error.message,
              sql: statement.substring(0, 100) + '...'
            });
          }
        }
      }

      log.debug(`✅ 执行完成: ${successCount} 成功, ${errorCount} 失败`);

    } finally {
      connection.release();
    }

    // 验证结果
    const verification = await verifyTables();

    res.json({
      success: successCount > 0,
      message: `初始化完成: ${successCount} 成功, ${errorCount} 失败`,
      data: {
        successCount,
        errorCount,
        errors,
        verification
      }
    });

  } catch (error) {
    log.error('❌ 初始化失败:', error);
    res.status(500).json({
      success: false,
      message: '初始化失败: ' + error.message
    });
  }
});

/**
 * 验证表结构
 */
async function verifyTables() {
  try {
    const pool = getDatabase();
    const connection = await pool.getConnection();

    try {
      // 检查关键表是否存在
      const [tables] = await connection.execute(`
        SELECT TABLE_NAME
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN ('modules', 'role_permissions', 'roles', 'module_sync_log')
      `);

      const existingTables = tables.map(t => t.TABLE_NAME);

      // 检查基础数据
      const [moduleCount] = await connection.execute(
        'SELECT COUNT(*) as count FROM modules WHERE is_active = 1'
      );

      const [permissionCount] = await connection.execute(
        'SELECT COUNT(*) as count FROM role_permissions'
      );

      return {
        tables: existingTables,
        moduleCount: moduleCount[0].count,
        permissionCount: permissionCount[0].count,
        allTablesExist: existingTables.length >= 4
      };
    } finally {
      connection.release();
    }
  } catch (error) {
    log.error('验证失败:', error);
    return {
      tables: [],
      moduleCount: 0,
      permissionCount: 0,
      allTablesExist: false,
      error: error.message
    };
  }
}

/**
 * 验证模块管理系统状态
 */
router.get('/verify-module-management', requirePermission('permissions:admin'), async (req, res) => {
  try {
    const verification = await verifyTables();

    res.json({
      success: verification.allTablesExist,
      message: verification.allTablesExist ? '验证成功' : '验证失败',
      data: verification
    });
  } catch (error) {
    log.error('验证失败:', error);
    res.status(500).json({
      success: false,
      message: '验证失败: ' + error.message
    });
  }
});

/**
 * 同步扫描发现的模块
 */
router.post('/sync-modules', requirePermission('permissions:admin'), async (req, res) => {
  try {
    const ModuleScanner = require('../services/moduleScanner_simple');
    const scanner = new ModuleScanner();

    log.debug('🔄 开始同步模块...');
    const result = await scanner.syncAllModules();

    // 记录同步日志
    await logSyncOperation('sync', null, 'success',
      `同步完成: 总数${result.total}, 成功${result.success}, 失败${result.errors}`,
      result);

    res.json({
      success: result.success > 0,
      message: '模块同步完成',
      data: result
    });
  } catch (error) {
    log.error('同步模块失败:', error);

    // 记录错误日志
    await logSyncOperation('sync', null, 'error',
      `同步失败: ${error.message}`,
      { error: error.message });

    res.status(500).json({
      success: false,
      message: '同步失败: ' + error.message
    });
  }
});

/**
 * 记录同步日志（module_sync_log表不存在，暂时记录到控制台）
 */
async function logSyncOperation(operationType, moduleKey, status, message, details = null) {
  try {
    log.debug(`[同步日志] ${operationType} ${moduleKey || 'ALL'} ${status}: ${message}`);
    if (details) {
      log.debug('[同步详情]', details);
    }
  } catch (error) {
    log.error('记录同步日志失败:', error);
  }
}

/**
 * 获取同步日志
 */
router.get('/sync-logs', requirePermission('permissions:admin'), async (req, res) => {
  try {
    const { page = 1, limit = 20, operationType } = req.query;
    const offset = (page - 1) * limit;

    const pool = getDatabase();

    let whereClause = '';
    const params = [];

    if (operationType) {
      whereClause = 'WHERE operation_type = ?';
      params.push(operationType);
    }

    // module_sync_log表不存在，暂时返回空数据
    const [logs] = [];

    // module_sync_log表不存在，暂时返回0
    const totalCount = [{ total: 0 }];

    res.json({
      success: true,
      message: '获取同步日志成功',
      data: {
        logs: logs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount[0].total,
          pages: Math.ceil(totalCount[0].total / limit)
        }
      }
    });
  } catch (error) {
    log.error('获取同步日志失败:', error);
    res.status(500).json({
      success: false,
      message: '获取同步日志失败: ' + error.message
    });
  }
});

module.exports = router;
