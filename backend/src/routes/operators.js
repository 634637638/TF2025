const express = require('express');
const { getDatabase } = require('../config/database');
require('dotenv').config();
const log = require('../utils/log');

const router = express.Router();

/**
 * 获取操作员列表 (销售员) - 公开接口，不需要认证
 * GET /api/operators
 */
router.get('/', async (req, res) => {
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
        u.status,
        GROUP_CONCAT(DISTINCT r.name SEPARATOR ', ') as role_name,
        GROUP_CONCAT(DISTINCT COALESCE(r.code, CONCAT('role_', r.id)) SEPARATOR ', ') as role_codes
      FROM users u
      INNER JOIN user_roles ur ON u.id = ur.user_id
      INNER JOIN roles r ON ur.role_id = r.id
      WHERE u.status = 1 AND r.is_active = 1
      GROUP BY u.id, u.username, u.name, u.status
      ORDER BY u.created_at DESC
    `);

    // 转换为前端需要的格式 - 使用name字段作为显示名称
    const formattedOperators = operators.map(user => ({
      id: user.id,
      name: user.name || user.username, // 优先使用真实姓名，没有则使用用户名
      username: user.username,
      role: user.role_name,
      role_codes: user.role_codes ? user.role_codes.split(', ') : [],
      store_id: store_id || null,
      store_name: store_id ? `店铺${store_id}` : '默认店铺'
    }));

    log.debug('获取到的操作员列表:', formattedOperators);

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
});

module.exports = router;
