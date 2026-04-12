/**
 * 统一认证中间件
 * 合并原有的双轨权限系统（roles + operators）为单一角色系统
 *
 * 功能特性：
 * - 支持角色层级权限检查
 * - 支持具体权限检查
 * - 支持模块类型分类（system/business）
 * - 支持权限缓存
 * - 完整的错误处理
 * - 模块化权限统一管理
 */

const { getDatabase } = require('../config/database');
const { verifyToken } = require('./jwt-blacklist');
const { ROLE_HIERARCHY } = require('../services/accessControl.service');
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
      tokenLength: token ? token.length : 0,
      tokenPreview: token ? token.substring(0, 30) + '...' : 'null'
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
        tokenPreview: token ? token.substring(0, 16) : 'null',
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
      username: decoded.username,
      name: decoded.name,
      role: decoded.role,
      type: decoded.type,
      iat: decoded.iat,
      exp: decoded.exp,
      iss: decoded.iss,
      aud: decoded.aud
    });

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

    // 调试：记录用户权限
    debugLog(`🔑 用户 ${decoded.username} (ID: ${decoded.sub}) 权限列表:`);
    debugLog(`   总权限数: ${permissions.length}`);
    debugLog(`   考勤权限:`, permissions.filter(p => p.includes('attendance')));

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
      permissions: permissions  // 添加权限数组
    };

    debugLog('🔍 用户门店信息:', {
      user_id: req.user.id,
      store_id: req.user.store_id,
      store_ids: req.user.store_ids
    });

    next();
  } catch (error) {
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

        // 如果没有所需角色，再检查层级
        if (!hasRequiredRole) {
          const userHierarchy = req.user.maxHierarchy || 0;
          const requiredHierarchy = Math.max(
            ...requiredRoles.map(role => ROLE_HIERARCHY[role] || 0)
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
        if (req.user.permissions && Array.isArray(req.user.permissions) && req.user.permissions.length > 0) {
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
              userPermissions: userPermissions.map(p =>
                p.module_key && p.permission_type
                  ? `${p.module_key}:${p.permission_type}`
                  : p
              ),
              user: req.user.username,
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
        userPermissions = await getUserPermissions(req.user.id);
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

/**
 * 权限映射表 - 将标准权限字符串映射到数据库中的权限格式
 */
const PERMISSION_MAPPING = {
  // 入库权限映射
  // 兼容多种历史/来源的模块 key（views 扫描、菜单 URL 绑定、旧权限系统）
  'stock-in:view': ['inventory_stockinpage:view', 'inventory_stock-in:view', 'stockin_stockinview:view'],
  'stock-in:create': ['inventory_stockinpage:create', 'inventory_stock-in:create', 'stockin_stockinview:create'],
  'stock-in:edit': ['inventory_stockinpage:edit', 'inventory_stock-in:edit', 'stockin_stockinview:edit'],
  'stock-in:delete': ['inventory_stockinpage:delete', 'inventory_stock-in:delete', 'stockin_stockinview:delete'],

  // 库存权限映射
  'inventory:view': ['inventory_inventoryview:view'],
  'inventory:create': ['inventory_inventoryview:create'],
  'inventory:edit': ['inventory_inventoryview:edit'],
  'inventory:delete': ['inventory_inventoryview:delete'],

  // 销售权限映射
  'sales:view': ['sales_salesview:view', 'sales_phonesaleview:view'],
  'sales:create': ['sales_salesview:create', 'sales_phonesaleview:create'],
  'sales:wholesale': ['sales_salesview:wholesale'],
  'sales:proxy-transfer': ['sales_salesview:proxy-transfer'],
  'sales:edit': ['sales_salesview:edit', 'sales_phonesaleview:edit'],
  'sales:delete': ['sales_salesview:delete', 'sales_phonesaleview:delete'],
  'sales:export': ['sales_salesview:export'],
  'sales-editphoneview:view': ['sales_editphoneview:view'],
  'sales-editphoneview:edit': ['sales_editphoneview:edit'],
  'sales-editphoneview:create': ['sales_editphoneview:create'],
  'sales-editphoneview:delete': ['sales_editphoneview:delete'],

  // 菜单管理权限映射
  'menus:view': ['menu_menumanagementview:view'],
  'menus:create': ['menu_menumanagementview:create'],
  'menus:edit': ['menu_menumanagementview:edit'],
  'menus:delete': ['menu_menumanagementview:delete'],
  'menus:export': ['menu_menumanagementview:export'],
  'menus:import': ['menu_menumanagementview:import'],

  // 品牌管理权限映射
  'brands:view': ['brands_brandsview:view'],
  'brands:create': ['brands_brandsview:create'],
  'brands:edit': ['brands_brandsview:edit'],
  'brands:delete': ['brands_brandsview:delete'],

  // 型号管理权限映射
  'models:view': ['models_modelsview:view'],
  'models:create': ['models_modelsview:create'],
  'models:edit': ['models_modelsview:edit'],
  'models:delete': ['models_modelsview:delete'],

  // 颜色管理权限映射
  'colors:view': ['colors_colorsview:view'],
  'colors:create': ['colors_colorsview:create'],
  'colors:edit': ['colors_colorsview:edit'],
  'colors:delete': ['colors_colorsview:delete'],

  // 内存管理权限映射
  'memories:view': ['memories_memoriesview:view'],
  'memories:create': ['memories_memoriesview:create'],
  'memories:edit': ['memories_memoriesview:edit'],
  'memories:delete': ['memories_memoriesview:delete'],

  // 店铺管理权限映射
  'stores:view': ['stores_storesview:view', 'stores_storesview:menu_view'],
  'stores:create': ['stores_storesview:create'],
  'stores:edit': ['stores_storesview:edit'],
  'stores:delete': ['stores_storesview:delete'],
  'stores:export': ['stores_storesview:export'],

  // 用户管理权限映射（合并）
  'users:view': ['users_usersview:view', 'users_usersview:menu_view', 'employees_employeesview:view'],
  'users:create': ['users_usersview:create'],
  'users:edit': ['users_usersview:edit'],
  'users:delete': ['users_usersview:delete'],
  'users:view:own': ['users_usersview:view:own'],

  // 员工管理权限映射
  'query:view': ['query_queryview:view', 'query_queryview:menu_view', 'query:view'],
  'query:create': ['query_queryview:create', 'query:create'],
  'query:edit': ['query_queryview:edit', 'query:edit'],
  'query:export': ['query_queryview:export', 'query:export'],
  'query:return-to-stock': ['query_queryview:return-to-stock', 'query:return-to-stock'],
  'query:delete': ['query_queryview:delete', 'query:delete'],

  // 字段扫描权限映射
  'fieldscannerview:view': ['fieldscannerview:view'],
  'fieldscannerview:scan': ['fieldscannerview:scan'],
  'fieldscannerview:sync': ['fieldscannerview:sync'],
  'fieldscannerview:export': ['fieldscannerview:export'],
  'fieldscannerview:edit': ['fieldscannerview:edit'],
  'fieldscannerview:delete': ['fieldscannerview:delete'],

  // 客户管理权限映射
  'customers:view': ['customers_customersview:view', 'customers_customersview:menu_view'],
  'customers:create': ['customers_customersview:create'],
  'customers:edit': ['customers_customersview:edit'],
  'customers:delete': ['customers_customersview:delete'],
  'customers:export': ['customers_customersview:export'],
  'customers:manage': ['customers_customersview:edit', 'customers_customersview:manage'],

  // 配件管理权限映射
  'accessories:view': ['accessories_accessoriesview:view'],
  'accessories:create': ['accessories_accessoriesview:create'],
  'accessories:edit': ['accessories_accessoriesview:edit'],
  'accessories:delete': ['accessories_accessoriesview:delete'],

  // 首页推荐区域权限映射
  'home-sections:view': ['h5_admin_homesectionsview:view'],
  'home-sections:create': ['h5_admin_homesectionsview:create'],
  'home-sections:edit': ['h5_admin_homesectionsview:edit'],
  'home-sections:delete': ['h5_admin_homesectionsview:delete'],

  // H5 商城后台权限映射
  'h5-admin:view': ['h5_admin_h5_adminview:view'],
  'h5-admin:create': ['h5_admin_h5_adminview:create'],
  'h5-admin:edit': ['h5_admin_h5_adminview:edit'],
  'h5-admin:delete': ['h5_admin_h5_adminview:delete'],
  'h5-config:view': ['h5_admin_configview:view'],
  'h5-config:edit': ['h5_admin_configview:edit'],
  'h5-banners:view': ['h5_admin_bannersview:view'],
  'h5-banners:create': ['h5_admin_bannersview:create'],
  'h5-banners:edit': ['h5_admin_bannersview:edit'],
  'h5-banners:delete': ['h5_admin_bannersview:delete'],
  'h5-templates:view': ['h5_admin_templatesview:view'],
  'h5-templates:create': ['h5_admin_templatesview:create'],
  'h5-templates:edit': ['h5_admin_templatesview:edit'],
  'h5-templates:delete': ['h5_admin_templatesview:delete'],
  'h5-orders:view': ['h5_admin_ordersview:view'],
  'h5-orders:edit': ['h5_admin_ordersview:edit'],

  // 数据检查权限映射
  'data-check:view': ['data_optimization_dataoptimizationview:view'],
  'data-check:edit': ['data_optimization_dataoptimizationview:edit'],
  'data-check:delete': ['data_optimization_dataoptimizationview:delete'],
  'data-check:create': ['data_optimization_dataoptimizationview:create'],

  // 退库记录权限映射
  'return-goods:view': ['system_returngoods:view'],
  'return-goods:edit': ['system_returngoods:edit'],
  'return-goods:delete': ['system_returngoods:delete'],

  // 数据导入权限映射
  'data-import:view': ['data-import:view'],
  'data-import:upload': ['data-import:upload'],
  'data-import:execute': ['data-import:execute'],
  'data-import:edit': ['data-import:edit'],
  'data-import:delete': ['data-import:delete'],

  // 考勤权限映射
  'attendance:view:all': ['attendance_attendanceview:view'],
  'attendance:view': ['attendance_attendanceview:view', 'attendance_myattendanceview:view'],
  'attendance:view:own': ['attendance_attendanceview:view:own', 'attendance_myattendanceview:view'],
  'attendance:create': ['attendance_attendanceview:create', 'attendance_myattendanceview:create'],
  'attendance:edit': ['attendance_attendanceview:edit'],
  'attendance:delete': ['attendance_attendanceview:delete'],
  'attendance:approve': ['attendance_attendanceview:approve'],
  'attendance:manage': ['attendance_attendanceview:manage'],

  // 员工管理权限映射
  'employee:view': ['employees_employeesview:view'],
  'employee:create': ['employees_employeesview:create'],
  'employee:edit': ['employees_employeesview:edit'],
  'employee:delete': ['employees_employeesview:delete'],

  // 供应商管理权限映射
  'suppliers:view': ['suppliers_suppliersview:view'],
  'suppliers:create': ['suppliers_suppliersview:create'],
  'suppliers:edit': ['suppliers_suppliersview:edit'],
  'suppliers:delete': ['suppliers_suppliersview:delete'],
  'suppliers:export': ['suppliers_suppliersview:export'],
  'supplier:view': ['suppliers_suppliersview:view'],
  'supplier:create': ['suppliers_suppliersview:create'],
  'supplier:edit': ['suppliers_suppliersview:edit'],
  'supplier:delete': ['suppliers_suppliersview:delete'],
  'supplier:export': ['suppliers_suppliersview:export'],

  // 手机管理权限映射
  'phone:view': ['phones_phonesview:view'],
  'phone:create': ['phones_phonesview:create'],
  'phone:edit': ['phones_phonesview:edit'],
  'phone:delete': ['phones_phonesview:delete'],
  'phone:export': ['phones_phonesview:export'],
  // 复数形式（兼容前端）
  'phones:view': ['phones_phonesview:view'],
  'phones:create': ['phones_phonesview:create'],
  'phones:edit': ['phones_phonesview:edit'],
  'phones:delete': ['phones_phonesview:delete'],
  'phones:export': ['phones_phonesview:export'],

  // 权限管理权限映射
  'permissions:view': ['permissions_permissionsview:view'],
  'permissions:admin': ['permissions_permissionsview:view', 'permissions_permissionsview:create', 'permissions_permissionsview:edit', 'permissions_permissionsview:delete', 'permissions_modulemanagementview:view'],
  'permissions:edit': ['permissions_permissionsview:edit'],
  'permissions:delete': ['permissions_permissionsview:delete'],

  // 薪资管理权限映射
  'salary:view': ['salary_salaryview:view', 'salary_mysalaryview:view'],
  'salary:view:own': ['salary_salaryview:view:own', 'salary_mysalaryview:view'],
  'salary:create': ['salary_salaryview:create'],
  'salary:edit': ['salary_salaryview:edit'],
  'salary:delete': ['salary_salaryview:delete'],
  'salary:approve': ['salary_salaryview:approve'],
  'salary:manage': ['salary_salaryview:manage'],

  // 工资模板权限映射
  'salary-templates:view': ['salary_salarytemplatesview:view'],
  'salary-templates:create': ['salary_salarytemplatesview:create'],
  'salary-templates:edit': ['salary_salarytemplatesview:edit'],
  'salary-templates:delete': ['salary_salarytemplatesview:delete'],

  // 工资记录权限映射
  'salary-records:view:all': ['salary_salaryrecordsview:view'],
  'salary-records:view': ['salary_salaryrecordsview:view', 'salary_mysalaryview:view'],
  'salary-records:view:own': ['salary_mysalaryview:view'],
  'salary-records:create': ['salary_salaryrecordsview:create'],
  'salary-records:edit': ['salary_salaryrecordsview:edit'],
  'salary-records:delete': ['salary_salaryrecordsview:delete'],
  'salary-records:approve': ['salary_salaryrecordsview:approve'],

  // 国补管理权限映射
  'subsidy:view': ['subsidy_subsidyview:view', 'subsidy:view'],
  'subsidy:create': ['subsidy_subsidyview:create', 'subsidy:create'],
  'subsidy:update': ['subsidy_subsidyview:update', 'subsidy:update', 'subsidy_subsidyview:edit', 'subsidy:edit'],
  'subsidy:edit': ['subsidy_subsidyview:edit', 'subsidy:edit'],
  'subsidy:delete': ['subsidy_subsidyview:delete', 'subsidy:delete'],
  'subsidy:approve': ['subsidy_subsidyview:approve', 'subsidy:approve'],
  'subsidy:export': ['subsidy_subsidyview:export', 'subsidy:export'],

  // 供应商付款管理权限映射
  'supplier-payments:view': ['payments_supplierphonepaymentsview:view'],
  'supplier-payments:create': ['payments_supplierphonepaymentsview:create'],
  'supplier-payments:edit': ['payments_supplierphonepaymentsview:edit'],
  'supplier-payments:delete': ['payments_supplierphonepaymentsview:delete'],
  'supplier-payments:approve': ['payments_supplierphonepaymentsview:approve'],
  'supplier-payments:export': ['payments_supplierphonepaymentsview:export'],

  // 预定管理权限映射
  'preorders:view': ['preorders_preordersview:view', 'preorders_preordersview:menu_view'],
  'preorders:create': ['preorders_preordersview:create'],
  'preorders:edit': ['preorders_preordersview:edit'],
  'preorders:delete': ['preorders_preordersview:delete'],
  'preorders:match': ['preorders_preordersview:match'],
  'preorders:deliver': ['preorders_preordersview:deliver'],
  'preorders:cancel': ['preorders_preordersview:cancel'],

  // 价目表管理权限映射
  'price-list:view': ['price_list_pricelistview:view', 'price_list_pricelistview:menu_view'],
  'price-list:create': ['price_list_pricelistview:create'],
  'price-list:edit': ['price_list_pricelistview:edit'],
  'price-list:delete': ['price_list_pricelistview:delete'],
  'price-list:import': ['price_list_pricelistview:import'],
  'price-list:export': ['price_list_pricelistview:export'],
  'price-list:sync': ['price_list_pricelistview:sync'],

  // 仪表盘权限映射
  'dashboard:view': ['dashboard_dashboardview:view', 'dashboard_dashboardview:menu_view'],

  // 系统管理权限映射
  'system:view': ['system_systemview:view', 'system_systemview:menu_view'],
  'system:create': ['system_systemview:create'],
  'system:edit': ['system_systemview:edit'],
  'system:delete': ['system_systemview:delete'],

  // 通用映射规则
};

/**
 * 检查用户是否为某个模块的管理员
 * 模块管理员定义：拥有该模块的 view, create, edit, delete 所有权限
 */
const normalizePermissionType = (permissionType) => {
  if (!permissionType) return permissionType;
  if (permissionType.endsWith('_permission')) {
    return permissionType.replace('_permission', '');
  }
  return permissionType;
};

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
  debugLog('🔍 权限检查详情:');
  debugLog('   需要权限:', requiredPermission);
  debugLog('   标准化用户权限:', normalizedUserPermissions);

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

  // 常量
  ROLE_HIERARCHY,
  MODULE_PERMISSIONS
};
