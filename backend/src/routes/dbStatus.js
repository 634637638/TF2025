const express = require('express');
const router = express.Router();
const { getDatabase } = require('../config/database');
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth');

/**
 * 获取数据库状态信息
 */
router.get('/status', unifiedAuth, requirePermission('system:view'), async (req, res) => {
  try {
    const db = getDatabase();

    // 测试连接
    await db.execute('SELECT 1');

    // 获取所有表
    const [tables] = await db.execute('SHOW TABLES');
    const allTables = tables.map(row => Object.values(row)[0]);

    // 检查字段权限相关表
    const fieldTables = [
      'field_definitions',
      'module_field_mappings',
      'role_field_permissions',
      'field_scan_logs',
      'field_config_snapshots'
    ];

    const tableStatus = {};
    for (const tableName of fieldTables) {
      try {
        const [count] = await db.execute(`SELECT COUNT(*) as count FROM ${tableName}`);
        tableStatus[tableName] = {
          exists: true,
          count: count[0].count
        };
      } catch (error) {
        tableStatus[tableName] = {
          exists: false,
          count: 0,
          error: error.message
        };
      }
    }

    res.json({
      success: true,
      data: {
        connected: true,
        totalTables: allTables.length,
        fieldTables: tableStatus
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '数据库连接失败',
      error: error.message
    });
  }
});

module.exports = router;
