/**
 * 开发环境权限豁免中间件
 * 在开发环境中，为某些基础数据API提供权限豁免
 */

const isDevelopment = process.env.NODE_ENV === 'development';
const log = require('../utils/log');

const LEGACY_ADMIN_PERMISSIONS = [
  'permissions_permissionsview:view',
  'permissions_permissionsview:create',
  'permissions_permissionsview:edit',
  'permissions_permissionsview:delete'
];

const hasAdminPermission = (user) => {
  if (!user || !Array.isArray(user.permissions)) {
    return false;
  }

  const permissionSet = new Set(user.permissions);
  return (
    permissionSet.has('permissions:admin') ||
    LEGACY_ADMIN_PERMISSIONS.every((permission) => permissionSet.has(permission))
  );
};

/**
 * 开发环境权限检查豁免
 * @param {string} permission - 需要的权限
 * @returns {Function} 中间件函数
 */
const devPermissionCheck = (permission) => {
  return (req, res, next) => {
    // 如果不是开发环境，继续正常权限检查
    if (!isDevelopment) {
      return require('./unified-auth').requirePermission(permission)(req, res, next);
    }

    // 开发环境下的特殊处理
    log.debug(`🔓 开发环境权限豁免检查: ${permission}`);

    // 基础认证检查 - 确保用户已登录
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: '用户未认证',
        code: 'USER_NOT_AUTHENTICATED'
      });
    }

    // 开发环境下，如果用户拥有权限管理模块的完整权限，直接通过
    if (req.user.isAdmin || hasAdminPermission(req.user)) {
      log.debug(`✅ 开发环境权限通过: 用户 ${req.user.username} 拥有管理员级权限`);
      return next();
    }

    // 对于基础数据API（如colors, memories, brands等），在开发环境下放宽限制
    const relaxedPermissions = [
      'colors:view',
      'memories:view',
      'brands:view',
      'models:view',
      'suppliers:view',
      'stores:view'
    ];

    if (relaxedPermissions.includes(permission)) {
      log.debug(`✅ 开发环境权限豁免: ${permission}`);
      return next();
    }

    // 其他权限正常检查
    return require('./unified-auth').requirePermission(permission)(req, res, next);
  };
};

module.exports = {
  devPermissionCheck
};
