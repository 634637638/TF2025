const { getDatabase } = require('../config/database');
const { sortPermissionTypes } = require('../config/module-permission-actions');
const { hasTable, hasColumn } = require('./schemaInspector.service');
const { normalizeModuleKey } = require('../utils/moduleKeyNormalizer');
const log = require('../utils/log');

const DEFAULT_PERMISSION_ACTIONS = [
  'view',
  'create',
  'edit',
  'delete',
  'export',
  'import',
  'approve',
  'manage',
  'sell',
  'sync'
];

const ROLE_HIERARCHY = {
  '超级管理员': 100,
  'webadmin': 90,
  '管理员': 80,
  '经理': 70,
  '采购员': 60,
  '销售员': 60,
  '维修师': 60,
  '库管员': 60,
  '员工': 50,
  '普通用户': 40,
  'user': 30
};

const LEGACY_USER_ROLE_CODES = ['employee', 'admin', 'manager'];
const LEGACY_USER_ROLE_SQL_LIST = LEGACY_USER_ROLE_CODES.map((roleCode) => `'${roleCode}'`).join(', ');

const GLOBAL_ADMIN_ROLE_NAMES = new Set(
  Object.entries(ROLE_HIERARCHY)
    .filter(([, level]) => level >= 80)
    .map(([roleName]) => roleName)
);
const GLOBAL_ADMIN_ROLE_CODES = new Set(['super_admin', 'webadmin', 'admin']);
const MODULE_MANAGE_ACTIONS = new Set(['create', 'edit', 'delete', 'approve', 'manage']);

function getExecutor(executor = null) {
  return executor || getDatabase();
}

function uniqueStrings(values = []) {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizeModuleKeys(moduleKeys = []) {
  const keys = Array.isArray(moduleKeys) ? moduleKeys : [moduleKeys];
  return uniqueStrings(keys.map((moduleKey) => normalizeModuleKey(moduleKey)));
}

function hasGlobalAdminRole(roles = []) {
  return roles.some((role) => {
    const roleName = role?.roleName || role?.name || role;
    const roleCode = role?.roleCode || role?.code || null;
    return GLOBAL_ADMIN_ROLE_NAMES.has(roleName) || GLOBAL_ADMIN_ROLE_CODES.has(roleCode);
  });
}

async function getAccessControlSchemaSupport(db) {
  // 使用并行查询检查多个列是否存在，减少等待时间
  const checks = await Promise.all([
    hasColumn('roles', 'code', db),
    hasColumn('roles', 'role_type', db),
    hasColumn('roles', 'is_active', db),
    hasColumn('user_roles', 'status', db),
    hasColumn('user_roles', 'expires_at', db),
    hasColumn('modules', 'is_active', db)
  ]);

  return {
    hasRoleCode: checks[0],
    hasRoleType: checks[1],
    hasRoleIsActive: checks[2],
    hasUserRoleStatus: checks[3],
    hasUserRoleExpiresAt: checks[4],
    hasModuleIsActive: checks[5]
  };
}

function mergeMenuVisibility(explicitVisibility = {}, fallbackVisibility = {}) {
  return {
    ...fallbackVisibility,
    ...explicitVisibility
  };
}

function rowsToNormalizedVisibilityMap(rows = []) {
  return rows.reduce((map, row) => {
    const moduleKey = normalizeModuleKey(row.module_key);
    if (!moduleKey) {
      return map;
    }

    map[moduleKey] = Number(row.visible) === 1;
    return map;
  }, {});
}

async function getRolePermissionModuleVisibility(roleId, executor = null) {
  const db = getExecutor(executor);
  const [rows] = await db.execute(
    `SELECT module_key, 1 AS visible
     FROM role_permissions
     WHERE role_id = ?
       AND permission_type != 'menu_view'
     GROUP BY module_key`,
    [roleId]
  );

  return rowsToNormalizedVisibilityMap(rows);
}

async function getUserPermissionModuleVisibility(userId, executor = null) {
  const db = getExecutor(executor);
  const { hasRoleIsActive, hasUserRoleStatus, hasUserRoleExpiresAt } = await getAccessControlSchemaSupport(db);
  const [rows] = await db.execute(
    `SELECT rp.module_key, 1 AS visible
     FROM role_permissions rp
     JOIN user_roles ur ON rp.role_id = ur.role_id
     JOIN roles r ON ur.role_id = r.id
     WHERE ur.user_id = ?
       ${hasUserRoleStatus ? "AND ur.status = 'active'" : ''}
       ${hasRoleIsActive ? 'AND r.is_active = 1' : ''}
       ${hasUserRoleExpiresAt ? 'AND (ur.expires_at IS NULL OR ur.expires_at > NOW())' : ''}
       AND rp.permission_type != 'menu_view'
     GROUP BY rp.module_key`,
    [userId]
  );

  return rowsToNormalizedVisibilityMap(rows);
}

async function listPermissionActions(executor = null) {
  const db = getExecutor(executor);
  const tableExists = await hasTable('permission_actions', db);

  if (!tableExists) {
    return sortPermissionTypes(DEFAULT_PERMISSION_ACTIONS);
  }

  const hasIsActive = await hasColumn('permission_actions', 'is_active', db);
  const hasSortOrder = await hasColumn('permission_actions', 'sort_order', db);
  const [rows] = await db.execute(
    `SELECT code
     FROM permission_actions
     ${hasIsActive ? 'WHERE is_active = 1' : ''}
     ORDER BY ${hasSortOrder ? 'sort_order,' : ''} id ASC`
  );

  const dbActions = rows.map((row) => row.code);
  return sortPermissionTypes(uniqueStrings([...DEFAULT_PERMISSION_ACTIONS, ...dbActions]));
}

async function getActiveUserRoles(userId, executor = null) {
  const db = getExecutor(executor);
  const {
    hasRoleCode,
    hasRoleType,
    hasRoleIsActive,
    hasUserRoleStatus,
    hasUserRoleExpiresAt
  } = await getAccessControlSchemaSupport(db);

  const [rows] = await db.execute(
    `SELECT DISTINCT
      ur.role_id,
      r.name AS role_name,
      ${hasRoleCode ? 'r.code AS role_code,' : 'NULL AS role_code,'}
      ${hasRoleType ? 'r.role_type,' : 'NULL AS role_type,'}
      ${hasUserRoleStatus ? 'ur.status,' : "'active' AS status,"}
      ${hasUserRoleExpiresAt ? 'ur.expires_at' : 'NULL AS expires_at'}
     FROM user_roles ur
     JOIN roles r ON ur.role_id = r.id
     WHERE ur.user_id = ?
       ${hasUserRoleStatus ? "AND ur.status = 'active'" : ''}
       ${hasRoleIsActive ? 'AND r.is_active = 1' : ''}
       ${hasUserRoleExpiresAt ? 'AND (ur.expires_at IS NULL OR ur.expires_at > NOW())' : ''}
     ORDER BY r.name ASC`,
    [userId]
  );

  return rows;
}

async function getRoleMenuVisibility(roleId, executor = null) {
  const db = getExecutor(executor);
  const fallbackVisibility = await getRolePermissionModuleVisibility(roleId, db);

  if (await hasTable('role_menu_visibility', db)) {
    const [rows] = await db.execute(
      `SELECT module_key, visible
       FROM role_menu_visibility
       WHERE role_id = ?`,
      [roleId]
    );

    return mergeMenuVisibility(rowsToNormalizedVisibilityMap(rows), fallbackVisibility);
  }

  if (!(await hasColumn('role_permissions', 'menu_visible', db))) {
    return fallbackVisibility;
  }

  const [rows] = await db.execute(
    `SELECT module_key, MAX(COALESCE(menu_visible, 1)) AS visible
     FROM role_permissions
     WHERE role_id = ?
       AND permission_type = 'menu_view'
     GROUP BY module_key`,
    [roleId]
  );

  return mergeMenuVisibility(rowsToNormalizedVisibilityMap(rows), fallbackVisibility);
}

async function getUserMenuVisibility(userId, executor = null) {
  const db = getExecutor(executor);
  const { hasRoleIsActive, hasUserRoleStatus, hasUserRoleExpiresAt } = await getAccessControlSchemaSupport(db);
  const fallbackVisibility = await getUserPermissionModuleVisibility(userId, db);

  // 并行检查表和列是否存在
  const [hasMenuVisibilityTable, hasMenuVisibleColumn] = await Promise.all([
    hasTable('role_menu_visibility', db),
    hasColumn('role_permissions', 'menu_visible', db)
  ]);

  if (hasMenuVisibilityTable) {
    const [rows] = await db.execute(
      `SELECT rmv.module_key, MAX(CASE WHEN rmv.visible = 1 THEN 1 ELSE 0 END) AS visible
       FROM role_menu_visibility rmv
       JOIN user_roles ur ON rmv.role_id = ur.role_id
       JOIN roles r ON ur.role_id = r.id
       WHERE ur.user_id = ?
         ${hasUserRoleStatus ? "AND ur.status = 'active'" : ''}
         ${hasRoleIsActive ? 'AND r.is_active = 1' : ''}
         ${hasUserRoleExpiresAt ? 'AND (ur.expires_at IS NULL OR ur.expires_at > NOW())' : ''}
       GROUP BY rmv.module_key`,
      [userId]
    );

    return mergeMenuVisibility(rowsToNormalizedVisibilityMap(rows), fallbackVisibility);
  }

  if (!hasMenuVisibleColumn) {
    return fallbackVisibility;
  }

  const [rows] = await db.execute(
    `SELECT rp.module_key, MAX(COALESCE(rp.menu_visible, 1)) AS visible
     FROM role_permissions rp
     JOIN user_roles ur ON rp.role_id = ur.role_id
     JOIN roles r ON ur.role_id = r.id
     WHERE ur.user_id = ?
       ${hasUserRoleStatus ? "AND ur.status = 'active'" : ''}
       ${hasRoleIsActive ? 'AND r.is_active = 1' : ''}
       ${hasUserRoleExpiresAt ? 'AND (ur.expires_at IS NULL OR ur.expires_at > NOW())' : ''}
       AND rp.permission_type = 'menu_view'
     GROUP BY rp.module_key`,
    [userId]
  );

  return mergeMenuVisibility(rowsToNormalizedVisibilityMap(rows), fallbackVisibility);
}

async function getUserActionRows(userId, executor = null) {
  const db = getExecutor(executor);
  const {
    hasRoleCode,
    hasRoleIsActive,
    hasUserRoleStatus,
    hasUserRoleExpiresAt,
    hasModuleIsActive
  } = await getAccessControlSchemaSupport(db);

  const [rows] = await db.execute(
    `SELECT DISTINCT
      rp.role_id,
      r.name AS role_name,
      ${hasRoleCode ? 'r.code AS role_code,' : 'NULL AS role_code,'}
      rp.module_key,
      rp.permission_type
     FROM role_permissions rp
     JOIN user_roles ur ON rp.role_id = ur.role_id
     JOIN roles r ON ur.role_id = r.id
      LEFT JOIN modules m ON rp.module_key = m.\`key\` COLLATE utf8mb4_unicode_ci
     WHERE ur.user_id = ?
       ${hasUserRoleStatus ? "AND ur.status = 'active'" : ''}
       ${hasRoleIsActive ? 'AND r.is_active = 1' : ''}
       ${hasUserRoleExpiresAt ? 'AND (ur.expires_at IS NULL OR ur.expires_at > NOW())' : ''}
       AND rp.permission_type != 'menu_view'
       ${hasModuleIsActive ? 'AND (m.is_active = 1 OR m.is_active IS NULL)' : ''}
     ORDER BY rp.module_key, rp.permission_type`,
    [userId]
  );

  return rows;
}

async function getUserAccessProfile(userId, executor = null) {
  // 使用单次复杂查询获取所有需要的数据，减少数据库往返
  const db = getExecutor(executor);

  try {
    // 并行执行多个独立查询
    const [rolesResult, actionRows, menuVisibilityResult] = await Promise.all([
      getActiveUserRoles(userId, db),
      getUserActionRows(userId, db),
      getUserMenuVisibility(userId, db)
    ]);

    const roles = rolesResult;
    const menuVisibility = menuVisibilityResult;

    const summary = {};
    const userPermissions = [];
    const rolePermissions = {};

    actionRows.forEach((row) => {
      const moduleKey = normalizeModuleKey(row.module_key);
      if (!moduleKey) {
        return;
      }

      if (!summary[moduleKey]) {
        summary[moduleKey] = [];
      }
      if (!summary[moduleKey].includes(row.permission_type)) {
        summary[moduleKey].push(row.permission_type);
        userPermissions.push(`${moduleKey}:${row.permission_type}`);
      }

      const roleKey = String(row.role_id);
      if (!rolePermissions[roleKey]) {
        rolePermissions[roleKey] = {
          roleId: row.role_id,
          roleName: row.role_name,
          roleCode: row.role_code || null,
          summary: {}
        };
      }

      if (!rolePermissions[roleKey].summary[moduleKey]) {
        rolePermissions[roleKey].summary[moduleKey] = [];
      }

      if (!rolePermissions[roleKey].summary[moduleKey].includes(row.permission_type)) {
        rolePermissions[roleKey].summary[moduleKey].push(row.permission_type);
      }
    });

    Object.keys(summary).forEach((moduleKey) => {
      summary[moduleKey] = sortPermissionTypes(summary[moduleKey]);
    });

    Object.keys(rolePermissions).forEach((roleKey) => {
      Object.keys(rolePermissions[roleKey].summary).forEach((moduleKey) => {
        rolePermissions[roleKey].summary[moduleKey] = sortPermissionTypes(rolePermissions[roleKey].summary[moduleKey]);
      });
    });

    return {
      summary,
      userPermissions: uniqueStrings(userPermissions),
      rolePermissions,
      roles: roles.map((role) => ({
        roleId: role.role_id,
        roleName: role.role_name,
        roleCode: role.role_code || null,
        roleType: role.role_type || null
      })),
      menuVisibility
    };
  } catch (error) {
    log.error('❌ 获取用户权限配置失败:', error);
    return {
      summary: {},
      userPermissions: [],
      rolePermissions: {},
      roles: [],
      menuVisibility: {}
    };
  }
}

async function hasUserPermission(userId, moduleKey, permissionType, executor = null) {
  const profile = await getUserAccessProfile(userId, executor);
  const normalizedModuleKey = normalizeModuleKey(moduleKey);
  return Array.isArray(profile.summary[normalizedModuleKey]) && profile.summary[normalizedModuleKey].includes(permissionType);
}

async function getModuleAccessScope(userId, moduleKeys, executor = null) {
  const profile = await getUserAccessProfile(userId, executor);
  const normalizedModuleKeys = normalizeModuleKeys(moduleKeys);
  const permissions = uniqueStrings(
    normalizedModuleKeys.flatMap((moduleKey) => profile.summary[moduleKey] || [])
  );
  const sortedPermissions = sortPermissionTypes(permissions);
  const canView = sortedPermissions.includes('view') || sortedPermissions.includes('menu_view');
  const canManage = sortedPermissions.some((permissionType) => MODULE_MANAGE_ACTIONS.has(permissionType));
  const isAdminRole = hasGlobalAdminRole(profile.roles);

  let scope = 'none';
  if (canView) {
    scope = (isAdminRole || canManage) ? 'all' : 'own';
  }

  return {
    scope,
    moduleKeys: normalizedModuleKeys,
    permissions: sortedPermissions,
    canView,
    canManage,
    isAdminRole,
    isAdmin: scope === 'all',
    isOwnOnly: scope === 'own'
  };
}

function resolveScopedTargetId(scopeInfo, currentUserId, requestedTargetId = null) {
  if (scopeInfo?.isAdmin && requestedTargetId !== undefined && requestedTargetId !== null && requestedTargetId !== '') {
    return requestedTargetId;
  }

  if (scopeInfo?.canView) {
    return currentUserId;
  }

  return null;
}

function canAccessScopedTarget(scopeInfo, currentUserId, ownerId) {
  if (!scopeInfo?.canView) {
    return false;
  }

  if (scopeInfo.isAdmin) {
    return true;
  }

  return String(ownerId) === String(currentUserId);
}

module.exports = {
  DEFAULT_PERMISSION_ACTIONS,
  ROLE_HIERARCHY,
  LEGACY_USER_ROLE_CODES,
  LEGACY_USER_ROLE_SQL_LIST,
  GLOBAL_ADMIN_ROLE_NAMES,
  GLOBAL_ADMIN_ROLE_CODES,
  MODULE_MANAGE_ACTIONS,
  listPermissionActions,
  getActiveUserRoles,
  getRoleMenuVisibility,
  getUserMenuVisibility,
  getUserActionRows,
  getUserAccessProfile,
  hasUserPermission,
  hasGlobalAdminRole,
  getModuleAccessScope,
  resolveScopedTargetId,
  canAccessScopedTarget
};
