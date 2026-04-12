const express = require('express');
const router = express.Router();
const { getDatabase } = require('../config/database');
const { unifiedAuth, optionalAuth, requirePermission } = require('../middleware/unified-auth');
const log = require('../utils/log');

/**
 * 权限操作日志中间件 - 记录权限相关操作
 */
async function logPermissionOperation(req, action, targetType, targetId, targetName, description, details = null, status = 'success') {
  try {
    const db = getDatabase();
    const userId = req.user?.id || null;
    const username = req.user?.username || 'system';
    const ipAddress = req.ip || req.connection.remoteAddress;

    await db.execute(
      `INSERT INTO permission_operation_logs
       (user_id, username, action, target_type, target_id, target_name, description, details, ip_address, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, username, action, targetType, targetId, targetName, description,
       details ? JSON.stringify(details) : null, ipAddress, status]
    );
  } catch (error) {
    log.error('记录权限操作日志失败:', error);
  }
}

/**
 * 记录角色操作
 */
async function logRoleOperation(req, action, roleId, roleName, extraDetails = {}) {
  await logPermissionOperation(
    req,
    action,
    'role',
    roleId,
    roleName,
    `${action === 'create' ? '创建' : action === 'edit' ? '修改' : action === 'delete' ? '删除' : '操作'}角色: ${roleName}`,
    extraDetails
  );
}

/**
 * 记录用户角色分配操作
 */
async function logUserRoleOperation(req, userId, username, roleIds, extraDetails = {}) {
  const db = getDatabase();

  // 获取角色名称
  const [roles] = await db.execute(
    'SELECT id, name FROM roles WHERE id IN (?)',
    [roleIds]
  );

  const roleNames = roles.map(r => r.name).join(', ');

  await logPermissionOperation(
    req,
    'assign',
    'user',
    userId,
    username,
    `为用户 ${username} 分配角色: ${roleNames}`,
    { ...extraDetails, role_ids: roleIds, role_names: roleNames }
  );
}

/**
 * 记录权限修改操作
 */
async function logPermissionModification(req, roleId, roleName, permissions, extraDetails = {}) {
  await logPermissionOperation(
    req,
    'permission',
    'role',
    roleId,
    roleName,
    `修改角色 ${roleName} 的权限配置`,
    { ...extraDetails, permissions_count: permissions?.length || 0 }
  );
}

/**
 * GET /api/permission-logs/logs - 获取权限操作日志
 */
router.get('/logs', optionalAuth, async (req, res) => {
  try {
    const db = getDatabase();
    const {
      page = 1,
      size = 10,
      action = '',
      username = '',
      startDate = '',
      endDate = ''
    } = req.query;

    const pageNum = parseInt(page) || 1;
    const sizeNum = parseInt(size) || 10;
    const offset = (pageNum - 1) * sizeNum;

    // 构建查询条件
    let whereConditions = [];
    let params = [];

    if (action) {
      whereConditions.push('action = ?');
      params.push(action);
    }

    if (username) {
      whereConditions.push('username LIKE ?');
      params.push(`%${username}%`);
    }

    if (startDate) {
      whereConditions.push('created_at >= ?');
      params.push(startDate);
    }

    if (endDate) {
      whereConditions.push('created_at <= ?');
      params.push(endDate);
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    // 获取总数
    const [countResult] = await db.execute(
      `SELECT COUNT(*) as total FROM permission_operation_logs ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    // 获取日志列表 - 将 LIMIT 和 OFFSET 直接嵌入 SQL
    const limitSql = `SELECT * FROM permission_operation_logs ${whereClause} ORDER BY created_at DESC LIMIT ${sizeNum} OFFSET ${offset}`;
    const [logs] = await db.execute(limitSql, params);

    res.json({
      success: true,
      data: {
        logs: logs,
        pagination: {
          page: parseInt(page),
          size: parseInt(size),
          total: total
        }
      }
    });
  } catch (error) {
    log.error('获取权限操作日志失败:', error);
    res.status(500).json({
      success: false,
      message: '获取权限操作日志失败',
      error: error.message
    });
  }
});

/**
 * GET /api/permission-logs/stats - 获取日志统计
 */
router.get('/stats', optionalAuth, async (req, res) => {
  try {
    const db = getDatabase();

    // 获取统计数据
    const [stats] = await db.execute(`
      SELECT
        COUNT(*) as total_logs,
        COUNT(CASE WHEN action = 'create' THEN 1 END) as create_count,
        COUNT(CASE WHEN action = 'edit' THEN 1 END) as edit_count,
        COUNT(CASE WHEN action = 'delete' THEN 1 END) as delete_count,
        COUNT(CASE WHEN action = 'assign' THEN 1 END) as assign_count,
        COUNT(CASE WHEN action = 'permission' THEN 1 END) as permission_count,
        COUNT(CASE WHEN status = 'success' THEN 1 END) as success_count,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count
      FROM permission_operation_logs
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `);

    res.json({
      success: true,
      data: stats[0]
    });
  } catch (error) {
    log.error('获取日志统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取日志统计失败',
      error: error.message
    });
  }
});

/**
 * POST /api/permission-logs/log - 手动记录日志（供内部调用）
 */
router.post('/log', optionalAuth, async (req, res) => {
  try {
    const {
      action,
      targetType,
      targetId,
      targetName,
      description,
      details,
      status = 'success'
    } = req.body;

    if (!action || !targetType || !description) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数: action, targetType, description'
      });
    }

    await logPermissionOperation(
      req,
      action,
      targetType,
      targetId,
      targetName,
      description,
      details,
      status
    );

    res.json({
      success: true,
      message: '日志记录成功'
    });
  } catch (error) {
    log.error('记录日志失败:', error);
    res.status(500).json({
      success: false,
      message: '记录日志失败',
      error: error.message
    });
  }
});

/**
 * DELETE /api/permission-logs/logs/:id - 删除日志（仅管理员）
 */
router.delete('/logs/:id', unifiedAuth, requirePermission('permissions:admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    await db.execute('DELETE FROM permission_operation_logs WHERE id = ?', [id]);

    res.json({
      success: true,
      message: '日志删除成功'
    });
  } catch (error) {
    log.error('删除日志失败:', error);
    res.status(500).json({
      success: false,
      message: '删除日志失败',
      error: error.message
    });
  }
});

module.exports = {
  router,
  logPermissionOperation,
  logRoleOperation,
  logUserRoleOperation,
  logPermissionModification
};
