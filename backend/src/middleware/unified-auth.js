/**
 * 统一认证中间件
 * 合并原有的双轨权限系统（roles + operators）为单一角色系统
 *
 * 功能特性：
 * - 支持角色层级权限检查（从数据库动态获取）
 * - 支持具体权限检查
 * - 支持模块类型分类（system/business）
 * - 支持权限缓存
 * - 完整的错误处理
 * - 模块化权限统一管理
 */

const { getDatabase } = require('../config/database');
const { verifyToken } = require('./jwt-blacklist');
const { getRoleHierarchyFromDB } = require('../services/accessControl.service');
const { normalizePermissionType } = require('../config/module-permission-actions');
const { CACHE_TTL } = require('../config/constants');
const { isDatabaseAvailabilityError } = require('../utils/database-errors');
const log = require('../utils/log');

// 开发环境检测
const isDevelopment = process.env.NODE_ENV === 'development';

// 调试日志函数（仅在开发环境输出）
const debugLog = (...args) => {
  if (isDevelopment) {
    log.debug(...args);
  }
};

// 模块权限映射
const MODULE_PERMISSIONS = {
  'system': {
    'all': ['view', 'create', 'edit', 'delete'],
    'users': ['view', 'create', 'edit', 'delete'],
    'roles': ['view', 'create', 'edit', 'delete'],
    'permissions': ['view', 'create', 'edit', 'delete'],
    'settings': ['view', 'edit'],
    'logs': ['view'],
    'fields': ['view', 'edit'],  // 字段管理权限
  },
  'business': {
    'procurement': ['view', 'create', 'edit', 'delete'],
    'sales': ['view', 'create', 'edit', 'delete'],
    'maintenance': ['view', 'create', 'edit', 'delete'],
    'inventory': ['view', 'create', 'edit', 'delete'],
    'reports': ['view', 'export'],
    'profile': ['view', 'edit'],
  }
};

const PERMISSION_ADMIN_REQUIREMENTS = [
  'permissions_permissionsview:view',
  'permissions_permissionsview:create',
  'permissions_permissionsview:edit',
  'permissions_permissionsview:delete'
];

const INVALID_TOKEN_MARKERS = new Set(['', 'null', 'undefined']);

const normalizePermissionToken = (permission) => {
  if (!permission || typeof permission !== 'string') {
    return null;
  }

  const [moduleKey, permissionType] = permission.split(':');
  if (!moduleKey || !permissionType) {
    return permission;
  }

  return `${moduleKey}:${permissionType.endsWith('_permission')
    ? permissionType.replace(/_permission$/, '')
    : permissionType}`;
};

const getUserPermissionSet = (user) => {
  if (!user || !Array.isArray(user.permissions)) {
    return new Set();
  }

  return new Set(
    user.permissions
      .map((permission) => normalizePermissionToken(permission))
      .filter(Boolean)
  );
};

const hasAllPermissionTokens = (user, requiredPermissions = []) => {
  const permissionSet = getUserPermissionSet(user);
  return requiredPermissions.every((permission) => permissionSet.has(normalizePermissionToken(permission)));
};

let rolesHierarchyColumnExists = null;
const authProfileCache = new Map();

const getAuthProfileCacheKey = (decoded) => {
  const userId = decoded?.sub ?? decoded?.id;
  const issuedAt = decoded?.iat || 0;
  return `${userId}:${issuedAt}`;
};

const cloneAuthProfile = (profile) => ({
  ...profile,
  user: {
    ...profile.user,
    user_roles: [...(profile.user.user_roles || [])],
    role_codes: [...(profile.user.role_codes || [])],
    store_ids: [...(profile.user.store_ids || [])],
    permissions: [...(profile.user.permissions || [])],
    permissionObjects: (profile.user.permissionObjects || []).map(permission => ({ ...permission }))
  }
});

const getCachedAuthProfile = (cacheKey) => {
  const cached = authProfileCache.get(cacheKey);
  if (!cached) {
    return null;
  }

  if (Date.now() > cached.expiresAt) {
    authProfileCache.delete(cacheKey);
    return null;
  }

  return cloneAuthProfile(cached.profile);
};

const setCachedAuthProfile = (cacheKey, profile) => {
  authProfileCache.set(cacheKey, {
    expiresAt: Date.now() + CACHE_TTL.AUTH_PROFILE,
    profile: cloneAuthProfile(profile)
  });

  if (authProfileCache.size > 500) {
    const firstKey = authProfileCache.keys().next().value;
    if (firstKey) {
      authProfileCache.delete(firstKey);
    }
  }
};

const hasRolesHierarchyColumn = async (db) => {
  if (rolesHierarchyColumnExists !== null) {
    return rolesHierarchyColumnExists;
  }

  try {
    const [rows] = await db.execute("SHOW COLUMNS FROM roles LIKE 'hierarchy_level'");
    rolesHierarchyColumnExists = rows.length > 0;
  } catch (error) {
    log.warn('检查 roles.hierarchy_level 字段失败，按不存在处理', error.message);
    rolesHierarchyColumnExists = false;
  }

  return rolesHierarchyColumnExists;
};

/**
 * 统一认证中间件
 */
const unifiedAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const rawToken = authHeader && authHeader.split(' ')[1];
    const token = typeof rawToken === 'string' ? rawToken.trim() : '';

    // 🔍 调试：记录接收到的认证信息（仅开发环境）
    debugLog('🔍 认证调试 - 收到请求:', {
      url: req.url,
      method: req.method,
      authHeader: authHeader ? `Bearer [${token ? token.length : 0} chars]` : 'MISSING',
      tokenExists: !!token,
      tokenLength: token ? token.length : 0
    });

    if (!token || INVALID_TOKEN_MARKERS.has(token.toLowerCase())) {
      return res.status(401).json({
        success: false,
        message: '缺少访问令牌',
        code: 'TOKEN_MISSING'
      });
    }

    
    // 验证JWT token
    let decoded;
    try {
      // 确保token格式正确
      if (typeof token !== 'string' || token.trim() === '') {
        throw new Error('Token must be a non-empty string');
      }

      // 检查token基本格式
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
      }

      decoded = await verifyToken(token, 'access');
    } catch (jwtError) {
      log.warn('JWT验证失败', {
        name: jwtError.name,
        message: jwtError.message,
        tokenType: typeof token,
        tokenLength: token ? token.length : 0,
        path: req.originalUrl || req.url
      });
      throw jwtError;
    }

    // 验证解码后的token包含必要的信息
    if (!decoded || decoded.sub === undefined || decoded.sub === null) {
      return res.status(401).json({
        success: false,
        message: '无效的访问令牌：缺少用户标识',
        code: 'INVALID_TOKEN'
      });
    }

    debugLog('JWT验证成功，用户:', {
      sub: decoded.sub,
      type: decoded.type,
      iat: decoded.iat,
      exp: decoded.exp
    });

    const cacheKey = getAuthProfileCacheKey(decoded);
    const cachedProfile = getCachedAuthProfile(cacheKey);
    if (cachedProfile) {
      req.user = cachedProfile.user;
      req.token = token;
      return next();
    }

    const pool = getDatabase();
    const hierarchyExpr = await hasRolesHierarchyColumn(pool)
      ? 'COALESCE(r.hierarchy_level, 0)'
      : '0';

    // 从数据库获取最新用户信息（使用新的user_roles表结构）
    const userQuery = `
      SELECT u.id, u.username, u.name, u.email, u.phone, u.status,
             COALESCE(
               (SELECT GROUP_CONCAT(DISTINCT r.name SEPARATOR ',')
                FROM user_roles ur
                JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = u.id
                  AND ur.status = 'active'
                  AND r.is_active = 1
                  AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
               ), ''
             ) as user_roles,
             COALESCE(
               (SELECT GROUP_CONCAT(DISTINCT COALESCE(r.code, CONCAT('role_', r.id)) SEPARATOR ',')
                FROM user_roles ur
                JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = u.id
                  AND ur.status = 'active'
                  AND r.is_active = 1
                  AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
               ), ''
             ) as user_role_codes,
             COALESCE(
               (SELECT MAX(${hierarchyExpr})
                FROM user_roles ur
                JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = u.id
                  AND ur.status = 'active'
                  AND r.is_active = 1
                  AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
               ), 0
             ) as max_hierarchy
      FROM users u
      WHERE u.id = ?
        AND (u.status = 1 OR u.status = 'active')
    `;

    const [userResult] = await pool.execute(userQuery, [decoded.sub]);

    if (userResult.length === 0) {
      return res.status(401).json({
        success: false,
        message: '用户不存在或已禁用',
        code: 'USER_INACTIVE'
      });
    }

    const user = userResult[0];

    // 获取用户权限列表并转换为字符串数组格式
    const userPermissionsResult = await pool.execute(`
      SELECT DISTINCT rp.module_key, rp.permission_type
      FROM role_permissions rp
      JOIN user_roles ur ON rp.role_id = ur.role_id
      WHERE ur.user_id = ?
        AND ur.status = 'active'
        AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
    `, [decoded.sub]);

    // 将权限转换为字符串数组格式，如 ['attendance_attendanceview:view', ...]
    const permissions = userPermissionsResult[0].map(p => `${p.module_key}:${p.permission_type}`);
    const permissionObjects = userPermissionsResult[0].map(p => ({
      module_key: p.module_key,
      permission_type: p.permission_type
    }));

    debugLog('用户权限加载完成:', {
      userId: decoded.sub,
      permissionCount: permissions.length
    });

    req.user = {
      ...user,
      id: user.id,  // 确保id字段存在
      username: user.username,
      name: user.name,
      store_id: decoded.store_id || null,  // 从JWT获取主门店ID
      store_ids: decoded.store_ids || [],  // 从JWT获取所有门店ID
      user_roles: user.user_roles ? user.user_roles.split(',') : [],
      role_codes: user.user_role_codes ? user.user_role_codes.split(',') : [],
      maxHierarchy: user.max_hierarchy || 0,
      permissions: permissions,  // 添加权限数组
      permissionObjects
    };

    setCachedAuthProfile(cacheKey, { user: req.user });

    debugLog('🔍 用户门店信息:', {
      user_id: req.user.id,
      store_id: req.user.store_id,
      store_ids: req.user.store_ids
    });

    next();
  } catch (error) {
    // 数据库暂时不可用不代表令牌失效。返回 503 让前端保留登录态，
    // 避免远程数据库抖动时把所有受保护请求误判为 401。
    if (isDatabaseAvailabilityError(error)) {
      log.error('Authentication database unavailable', error);
      return res.status(503).json({
        success: false,
        message: '数据库连接暂时不可用，请稍后重试',
        code: 'DB_CONNECTION_ERROR'
      });
    }

    let message = '认证失败';
    let code = 'AUTH_ERROR';
    const isExpectedAuthError =
      error.message === '令牌已过期' ||
      error.message === 'Token已被吊销' ||
      error.name === 'JsonWebTokenError' ||
      error.message === '无效的令牌' ||
      error.message === 'Invalid JWT format' ||
      error.message === 'Token must be a non-empty string';

    if (error.message === '令牌已过期') {
      message = '访问令牌已过期';
      code = 'TOKEN_EXPIRED';
    } else if (error.message === 'Token已被吊销') {
      message = '访问令牌已失效';
      code = 'TOKEN_REVOKED';
    } else if (
      error.name === 'JsonWebTokenError' ||
      error.message === '无效的令牌' ||
      error.message === 'Invalid JWT format' ||
      error.message === 'Token must be a non-empty string'
    ) {
      message = '无效的访问令牌';
      code = 'TOKEN_INVALID';
    }

    if (isExpectedAuthError) {
      log.warn('Authentication rejected', {
        message,
        code,
        path: req.originalUrl || req.url
      });
    } else {
      log.error('Authentication error', error);
    }

    return res.status(401).json({
      success: false,
      message,
      code
    });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const rawToken = authHeader && authHeader.split(' ')[1];
    const token = typeof rawToken === 'string' ? rawToken.trim() : '';

    if (!token || INVALID_TOKEN_MARKERS.has(token.toLowerCase())) {
      return next();
    }

    const decoded = await verifyToken(token, 'access');
    if (!decoded || decoded.sub === undefined || decoded.sub === null) {
      return next();
    }

    req.user = {
      id: decoded.sub || decoded.id,
      username: decoded.username,
      name: decoded.name,
      store_id: decoded.store_id || null,
      store_ids: decoded.store_ids || [],
      user_roles: decoded.roles || [],
      role_codes: decoded.role_codes || [],
      permissions: []
    };
    req.token = token;
  } catch (error) {
    debugLog('可选认证跳过，令牌无效:', error.message);
  }

  next();
};

/**
 * 角色校验中间件
 */
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: '需要登录',
        code: 'AUTHENTICATION_REQUIRED'
      });
    }

    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    let hasRequiredRole = false;

    if (req.user.role && allowedRoles.includes(req.user.role)) {
      hasRequiredRole = true;
    }

    if (!hasRequiredRole && req.user.roles && Array.isArray(req.user.roles)) {
      hasRequiredRole = req.user.roles.some(role => allowedRoles.includes(role));
    }

    if (!hasRequiredRole && req.user.role_codes && Array.isArray(req.user.role_codes)) {
      hasRequiredRole = req.user.role_codes.some(roleCode => allowedRoles.includes(roleCode));
    }

    if (!hasRequiredRole) {
      log.debug('[角色检查] 权限不足', {
        user: req.user.username,
        requiredRoles: allowedRoles,
        userRole: req.user.role,
        userRoles: req.user.roles,
        userRoleCodes: req.user.role_codes
      });

      return res.status(403).json({
        success: false,
        message: '权限不足',
        code: 'INSUFFICIENT_PERMISSIONS',
        debug: {
          requiredRoles: allowedRoles,
          userRole: req.user.role,
          userRoles: req.user.roles,
          userRoleCodes: req.user.role_codes
        }
      });
    }

    next();
  };
};

/**
 * 获取用户权限列表（使用新的user_roles表结构）
 */
const getUserPermissions = async (userId) => {
  try {
    const pool = getDatabase();
    const permissionsQuery = `
      SELECT DISTINCT
        rp.module_key,
        rp.permission_type,
        r.name as role_name,
        ur.assigned_at,
        ur.expires_at
      FROM role_permissions rp
      JOIN roles r ON rp.role_id = r.id
      JOIN user_roles ur ON r.id = ur.role_id
      WHERE ur.user_id = ?
        AND ur.status = 'active'
        AND r.is_active = 1
        AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
      ORDER BY ur.assigned_at DESC
    `;

    const [result] = await pool.execute(permissionsQuery, [userId]);
    return result;
  } catch (error) {
    log.error('Error getting user permissions', error);
    return [];
  }
};

/**
 * 检查用户是否具有所需权限
 */
const checkUnifiedPermission = (options = {}) => {
  const {
    requiredRoles = [],           // 所需角色列表
    requiredPermissions = [],      // 所需权限列表 ['users:view', 'sales:create']
    moduleType = 'system',        // 模块类型 'system' | 'business'
    requireAll = false            // 是否需要所有权限（false表示只需要其中一个）
    // 🔒 移除 bypassForDev 参数以增强安全性
  } = options;

  return async (req, res, next) => {
    try {
      
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: '用户未认证',
          code: 'USER_NOT_AUTHENTICATED'
        });
      }

      // 1. 角色层级检查 - 检查用户是否有任何一个所需角色
      if (requiredRoles.length > 0) {
        const userRoles = [
          ...(Array.isArray(req.user.user_roles) ? req.user.user_roles : []),
          ...(Array.isArray(req.user.role_codes) ? req.user.role_codes : [])
        ];

        // 检查用户是否有任何一个所需角色
        const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));

        // 如果没有所需角色，再检查层级（从数据库缓存获取）
        if (!hasRequiredRole) {
          const pool = getDatabase();
          const userHierarchy = req.user.maxHierarchy || 0;
          const roleHierarchy = await getRoleHierarchyFromDB(pool);
          const requiredHierarchy = Math.max(
            ...requiredRoles.map(role => roleHierarchy[role] || 0)
          );

          if (userHierarchy < requiredHierarchy) {
            return res.status(403).json({
              success: false,
              message: '权限等级不足',
              code: 'INSUFFICIENT_ROLE_LEVEL',
              required: requiredRoles,
              current: userRoles
            });
          }
        }
      }

      // 2. 具体权限检查
      // 优先使用 unifiedAuth 中已获取的权限（字符串数组格式）
      // 如果 req.user.permissions 存在，转换为对象数组格式供 checkSinglePermission 使用
      let userPermissions = [];
      if (requiredPermissions.length > 0) {
        // 复用 unifiedAuth 中已获取的权限
        if (req.user.permissionObjects && Array.isArray(req.user.permissionObjects) && req.user.permissionObjects.length > 0) {
          userPermissions = req.user.permissionObjects;
        } else if (req.user.permissions && Array.isArray(req.user.permissions) && req.user.permissions.length > 0) {
          // 将字符串数组权限转换为对象数组格式
          userPermissions = req.user.permissions.map(permStr => {
            const [module_key, permission_type] = permStr.split(':');
            return { module_key, permission_type };
          });
        } else {
          // 如果没有缓存权限，从数据库重新获取
          userPermissions = await getUserPermissions(req.user.id);
        }

        // 检查是否具有全部权限或任一权限
        const hasPermissions = requireAll
          ? requiredPermissions.every(perm => checkSinglePermission(userPermissions, perm, moduleType))
          : requiredPermissions.some(perm => checkSinglePermission(userPermissions, perm, moduleType));

        if (!hasPermissions) {
          // 输出调试信息帮助排查权限问题
          if (process.env.NODE_ENV === 'development') {
            log.debug('权限检查失败', {
              required: requiredPermissions,
              permissionCount: userPermissions.length,
              userId: req.user.id
            });
          }

          return res.status(403).json({
            success: false,
            message: '权限不足',
            code: 'INSUFFICIENT_PERMISSIONS',
            required: requiredPermissions,
            moduleType
          });
        }
      }

      // 权限检查通过，添加权限信息到请求对象（复用已获取的权限）
      if (userPermissions.length === 0) {
        userPermissions = req.user.permissionObjects && Array.isArray(req.user.permissionObjects)
          ? req.user.permissionObjects
          : await getUserPermissions(req.user.id);
      }
      req.userPermissions = userPermissions;
      next();
    } catch (error) {
      log.error('Permission check error', error);
      return res.status(500).json({
        success: false,
        message: '权限检查失败',
        code: 'PERMISSION_CHECK_ERROR'
      });
    }
  };
};

const PERMISSION_MAPPING = require('../config/permission-mapping');

/**
 * 检查用户是否为某个模块的管理员
 * 模块管理员定义：拥有该模块的 view, create, edit, delete 所有权限
 */
const normalizePermissionString = (perm) => {
  if (!perm) return perm;
  if (typeof perm === 'string') {
    const [moduleKey, permType] = perm.split(':');
    if (permType) {
      return `${moduleKey}:${normalizePermissionType(permType)}`;
    }
    return perm;
  }
  if (perm.module_key && perm.permission_type) {
    return `${perm.module_key}:${normalizePermissionType(perm.permission_type)}`;
  }
  return perm;
};

const isModuleAdmin = (userPermissions, modulePrefix) => {
  const normalizedPermissions = userPermissions.map(normalizePermissionString);

  const requiredActions = ['view', 'create', 'edit', 'delete'];
  const hasAllActions = requiredActions.every(action =>
    normalizedPermissions.some(perm => perm.startsWith(`${modulePrefix}:`) && perm.endsWith(`:${action}`))
  );

  return hasAllActions;
};

/**
 * 检查单个权限 - 使用统一权限映射器
 * 增强的权限检查：如果用户是某个模块的管理员，则拥有该模块的所有权限
 */
const checkSinglePermission = (userPermissions, requiredPermission, _moduleType) => {
  // 将用户权限转换为标准格式
  const normalizedUserPermissions = userPermissions.map(normalizePermissionString);

  // 开发环境输出详细权限检查日志，避免污染生产日志
  debugLog('权限检查:', {
    requiredPermission,
    permissionCount: normalizedUserPermissions.length
  });

  // 提取所需权限的模块前缀
  const moduleMatch = requiredPermission.match(/^([^:]+):/);
  if (moduleMatch) {
    const modulePrefix = moduleMatch[1];

    // 检查用户是否为该模块的管理员（拥有完整权限）
    if (isModuleAdmin(userPermissions, modulePrefix)) {
      debugLog(`   ✅ 用户是 ${modulePrefix} 模块管理员`);
      return true;
    }
  }

  // 检查直接权限匹配
  if (normalizedUserPermissions.includes(requiredPermission)) {
    debugLog(`   ✅ 直接权限匹配成功: ${requiredPermission}`);
    return true;
  }

  // 检查映射权限
  const mappedPermissions = PERMISSION_MAPPING[requiredPermission] || [];
  debugLog(`   🔄 检查映射权限:`, mappedPermissions);

  for (const mappedPerm of mappedPermissions) {
    if (normalizedUserPermissions.includes(mappedPerm)) {
      debugLog(`   ✅ 映射权限匹配成功: ${mappedPerm}`);
      return true;
    }
  }

  debugLog(`   ❌ 权限检查失败`);
  return false;
};

/**
 * 快捷权限检查中间件
 */

const PERMISSION_ACTIONS = new Set([
  'view',
  'create',
  'edit',
  'delete',
  'approve',
  'manage',
  'export',
  'import',
  'sell',
  'sync',
  'match',
  'deliver',
  'cancel',
  'menu_view'
]);

// 特定权限检查
const requirePermission = (permission, actionOrModuleType = 'system') => {
  const usesLegacySignature =
    typeof permission === 'string' &&
    !permission.includes(':') &&
    PERMISSION_ACTIONS.has(actionOrModuleType);

  return checkUnifiedPermission({
    requiredPermissions: [usesLegacySignature ? `${permission}:${actionOrModuleType}` : permission],
    moduleType: usesLegacySignature ? 'system' : actionOrModuleType
  });
};

// 多权限检查（需要所有权限）
const requireAllPermissions = (permissions, moduleType = 'system') => checkUnifiedPermission({
  requiredPermissions: permissions,
  moduleType,
  requireAll: true
});

// 多权限检查（只需要其中一个权限）
const requireAnyPermission = (permissions, moduleType = 'system') => checkUnifiedPermission({
  requiredPermissions: permissions,
  moduleType,
  requireAll: false
});

const createPermissionGate = (validator, deniedMessage) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: '用户未认证',
        code: 'USER_NOT_AUTHENTICATED'
      });
    }

    if (validator(req.user)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: deniedMessage,
      code: 'INSUFFICIENT_PERMISSIONS'
    });
  };
};

const isBusinessPermission = (permission) => {
  const normalizedPermission = normalizePermissionToken(permission);
  if (!normalizedPermission) {
    return false;
  }

  if (normalizedPermission.endsWith(':menu_view')) {
    return false;
  }

  return !normalizedPermission.startsWith('permissions_');
};

const hasBusinessAccess = (user) => {
  const permissionSet = getUserPermissionSet(user);
  return Array.from(permissionSet).some((permission) => isBusinessPermission(permission));
};

const hasManagerAccess = (user) => {
  if (hasAllPermissionTokens(user, PERMISSION_ADMIN_REQUIREMENTS)) {
    return true;
  }

  const permissionSet = getUserPermissionSet(user);
  const elevatedActions = ['create', 'edit', 'delete', 'approve', 'manage'];

  return Array.from(permissionSet).some((permission) => {
    if (!isBusinessPermission(permission)) {
      return false;
    }

    return elevatedActions.some((action) => permission.endsWith(`:${action}`));
  });
};

// 系统管理员权限
const requireSystemAdmin = checkUnifiedPermission({
  requiredPermissions: ['permissions:admin'],
  moduleType: 'system'
});

// 管理员权限
const requireAdmin = checkUnifiedPermission({
  requiredPermissions: ['permissions:admin'],
  moduleType: 'system'
});

// 经理权限
const requireManager = createPermissionGate(
  (user) => hasManagerAccess(user),
  '权限不足，需要经理级权限'
);

// 业务用户权限
const requireBusinessUser = createPermissionGate(
  (user) => hasBusinessAccess(user),
  '权限不足，需要业务访问权限'
);

/**
 * 权限工具函数
 */

// 检查用户是否有某个角色
const hasRole = (user, role) => {
  if (!user || !role) {
    return false;
  }

  const roleNames = Array.isArray(user.user_roles) ? user.user_roles : [];
  const roleCodes = Array.isArray(user.role_codes) ? user.role_codes : [];
  return roleNames.includes(role) || roleCodes.includes(role);
};

// 检查用户权限等级
const getPermissionLevel = (user) => {
  return user.maxHierarchy || 0;
};

// 检查是否为超级管理员
const isSuperAdmin = (user) => {
  return hasAllPermissionTokens(user, PERMISSION_ADMIN_REQUIREMENTS);
};

// 检查用户是否为某个模块的管理员（异步版本，需要从数据库获取权限）
const checkModuleAdmin = async (userId, modulePrefix) => {
  const userPermissions = await getUserPermissions(userId);
  return isModuleAdmin(userPermissions, modulePrefix);
};

module.exports = {
  // 核心中间件
  unifiedAuth,
  optionalAuth,
  checkUnifiedPermission,

  // 快捷中间件
  requireSystemAdmin,
  requireAdmin,
  requireManager,
  requireRole,
  requireBusinessUser,
  requirePermission,
  requireAllPermissions,
  requireAnyPermission,

  // 工具函数
  getUserPermissions,
  hasRole,
  getPermissionLevel,
  isSuperAdmin,
  isModuleAdmin,
  checkModuleAdmin,

  // 常量（移除 ROLE_HIERARCHY 硬编码，改为数据库配置）
  MODULE_PERMISSIONS
};
