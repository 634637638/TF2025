const express = require('express');
const router = express.Router();
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth');
const { getDatabase } = require('../config/database');
const log = require('../utils/log');

/**
 * 调试接口：获取当前登录用户的详细权限信息
 */
router.get('/current-user', unifiedAuth, requirePermission('permissions:admin'), async (req, res) => {
  try {
    const userId = req.user.id;
    const pool = getDatabase();

    // 获取用户基本信息
    const [userInfos] = await pool.execute(`
      SELECT id, username, name, status
      FROM users
      WHERE id = ?
    `, [userId]);

    // 获取用户的所有角色
    const [userRoles] = await pool.execute(`
      SELECT
        r.id as role_id,
        r.name as role_name,
        COALESCE(r.code, CONCAT('role_', r.id)) AS role_code,
        ur.status,
        ur.expires_at
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = ?
      ORDER BY ur.assigned_at DESC
    `, [userId]);

    // 获取用户所有角色的权限（包括未激活的）
    const [allRolePerms] = await pool.execute(`
      SELECT
        r.name as role_name,
        rp.module_key,
        rp.permission_type,
        rp.menu_visible
      FROM role_permissions rp
      JOIN user_roles ur ON rp.role_id = ur.role_id
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = ?
      ORDER BY r.name, rp.module_key, rp.permission_type
    `, [userId]);

    // 获取用户所有激活角色的权限
    const [activeRolePerms] = await pool.execute(`
      SELECT DISTINCT
        rp.module_key,
        rp.permission_type
      FROM role_permissions rp
      JOIN user_roles ur ON rp.role_id = ur.role_id
      WHERE ur.user_id = ?
        AND ur.status = 'active'
        AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
      ORDER BY rp.module_key, rp.permission_type
    `, [userId]);

    // 检查是否有users:edit相关的权限
    const usersEditPerms = activeRolePerms.filter(p =>
      p.module_key.includes('users') && p.permission_type === 'edit'
    );

    res.json({
      success: true,
      data: {
        user: userInfos[0],
        roles: userRoles,
        all_role_permissions: allRolePerms,
        active_permissions: activeRolePerms,
        users_edit_permissions: usersEditPerms,
        permissions_summary: {
          total_roles: userRoles.length,
          active_roles: userRoles.filter(r => r.status === 'active').length,
          total_permissions: allRolePerms.length,
          active_permissions: activeRolePerms.length,
          has_users_edit: usersEditPerms.length > 0
        }
      }
    });
  } catch (error) {
    log.error('调试权限信息失败:', error);
    res.status(500).json({
      success: false,
      message: '调试权限信息失败: ' + error.message
    });
  }
});

/**
 * 调试接口：获取某个角色的所有权限
 */
router.get('/role/:roleId', unifiedAuth, requirePermission('permissions:admin'), async (req, res) => {
  try {
    const { roleId } = req.params;
    const pool = getDatabase();

    // 获取角色信息
    const [roleInfos] = await pool.execute(`
      SELECT id, name, COALESCE(code, CONCAT('role_', id)) AS role_code, is_active
      FROM roles
      WHERE id = ?
    `, [roleId]);

    if (roleInfos.length === 0) {
      return res.status(404).json({
        success: false,
        message: '角色不存在'
      });
    }

    // 获取角色权限
    const [rolePerms] = await pool.execute(`
      SELECT module_key, permission_type, menu_visible
      FROM role_permissions
      WHERE role_id = ?
      ORDER BY module_key, permission_type
    `, [roleId]);

    // 筛选users相关权限
    const usersPerms = rolePerms.filter(p => p.module_key.includes('users'));

    res.json({
      success: true,
      data: {
        role: roleInfos[0],
        permissions: rolePerms,
        users_permissions: usersPerms,
        summary: {
          total_permissions: rolePerms.length,
          users_permissions_count: usersPerms.length
        }
      }
    });
  } catch (error) {
    log.error('调试角色权限失败:', error);
    res.status(500).json({
      success: false,
      message: '调试角色权限失败: ' + error.message
    });
  }
});

module.exports = router;
