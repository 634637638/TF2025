const express = require('express');
const { getDatabase } = require('../config/database');
const log = require('../utils/log');
const { unifiedAuth, requireAnyPermission } = require('../middleware/unified-auth');

const router = express.Router();

/**
 * 获取操作员列表（销售员）
 * GET /api/operators
 */
router.get(
  '/',
  unifiedAuth,
  requireAnyPermission(['sales:view', 'inventory:view']),
  async (req, res) => {
  try {
    const { store_id } = req.query;
    log.debug('操作员API被调用, store_id:', store_id);

    // 使用统一的数据库连接池
    const db = getDatabase();

    // 查询有角色的用户作为操作员 (通过user_roles和roles表关联查询)
    // 使用 GROUP_CONCAT 合并多个角色，避免重复用户
    const [operators] = await db.execute(`
      SELECT
        u.id,
        u.username,
        u.name,
        u.status
      FROM users u
      INNER JOIN user_roles ur ON u.id = ur.user_id
      INNER JOIN roles r ON ur.role_id = r.id
      WHERE u.status = 1 AND r.is_active = 1
      GROUP BY u.id, u.username, u.name, u.status
      ORDER BY COALESCE(NULLIF(u.name, ''), u.username) ASC, u.id ASC
    `);

    // 转换为前端需要的格式 - 使用name字段作为显示名称
    const formattedOperators = operators.map(user => ({
      id: user.id,
      name: user.name || user.username, // 优先使用真实姓名，没有则使用用户名
      username: user.username
    }));

    log.debug('操作员列表加载完成:', {
      storeId: store_id || null,
      count: formattedOperators.length
    });

    // 手动构造成功响应
    res.json({
      success: true,
      message: '获取操作员列表成功',
      data: formattedOperators
    });
  } catch (error) {
    log.error('获取操作员列表失败:', error);
    // 手动构造错误响应
    res.status(500).json({
      success: false,
      message: '获取操作员列表失败',
      error: error.message
    });
  }
  }
);

module.exports = router;
