const express = require('express')
const router = express.Router()
const { verifyToken } = require('../middleware/jwt-blacklist')
const { unifiedAuth } = require('../middleware/unified-auth')
const { validateBody } = require('../middleware/validation')
const { getUserAccessProfile } = require('../services/access-control.service')
const AuthSessionController = require('../controllers/auth-session.controller')
const AuthController = require('../controllers/auth.controller')
const log = require('../utils/log')
const authSessionController = new AuthSessionController()
const authController = new AuthController({ buildUserPayload: buildAuthenticatedUserPayload })

const EMPTY_ACCESS_PROFILE = Object.freeze({
  summary: {},
  userPermissions: [],
  rolePermissions: {},
  roles: [],
  menuVisibility: {}
})

const cloneEmptyAccessProfile = () => ({
  summary: {},
  userPermissions: [],
  rolePermissions: {},
  roles: [],
  menuVisibility: {}
})

const normalizeAccessProfile = (accessProfile = null) => {
  if (!accessProfile || typeof accessProfile !== 'object') {
    return cloneEmptyAccessProfile()
  }

  return {
    summary: accessProfile.summary && typeof accessProfile.summary === 'object'
      ? accessProfile.summary
      : {},
    userPermissions: Array.isArray(accessProfile.userPermissions)
      ? accessProfile.userPermissions
      : [],
    rolePermissions: accessProfile.rolePermissions && typeof accessProfile.rolePermissions === 'object'
      ? accessProfile.rolePermissions
      : {},
    roles: Array.isArray(accessProfile.roles)
      ? accessProfile.roles
      : [],
    menuVisibility: accessProfile.menuVisibility && typeof accessProfile.menuVisibility === 'object'
      ? accessProfile.menuVisibility
      : {}
  }
}

async function getUserStoreBindings(database, userId) {
  try {
    const [stores] = await database.execute(`
      SELECT
        us.store_id,
        us.is_primary,
        s.name as store_name
      FROM user_stores us
      INNER JOIN stores s ON us.store_id = s.id
      WHERE us.user_id = ?
      ORDER BY us.is_primary DESC, us.assigned_at ASC
    `, [userId])

    const primaryStore = stores.find(store => store.is_primary === 1) || stores[0] || null

    return {
      stores,
      primaryStoreId: primaryStore ? primaryStore.store_id : null,
      storeIds: stores.map(store => store.store_id)
    }
  } catch (error) {
    log.warn('⚠️ 获取用户门店失败，使用空门店信息:', error)
    return {
      stores: [],
      primaryStoreId: null,
      storeIds: []
    }
  }
}

async function buildAuthenticatedUserPayload(database, user) {
  let accessProfile = EMPTY_ACCESS_PROFILE

  try {
    // 并行获取权限和门店信息，减少等待时间
    const [accessProfileResult] = await Promise.all([
      getUserAccessProfile(user.id, database)
    ])
    accessProfile = normalizeAccessProfile(accessProfileResult)
  } catch (error) {
    log.warn('⚠️ 获取用户权限汇总失败，使用空权限:', error)
    accessProfile = cloneEmptyAccessProfile()
  }

  const { stores, primaryStoreId, storeIds } = await getUserStoreBindings(database, user.id)
  const roleNames = accessProfile.roles.map(role => role.roleName).filter(Boolean)
  const roleIds = accessProfile.roles
    .map(role => role.roleId)
    .filter(roleId => roleId !== null && roleId !== undefined)
  const roleCodes = accessProfile.roles.map(role => role.roleCode).filter(Boolean)

  return {
    accessProfile,
    tokenPayload: {
      id: user.id,
      username: user.username,
      name: user.name,
      store_id: primaryStoreId,
      store_ids: storeIds,
      roles: roleNames,
      role_ids: roleIds,
      role_codes: roleCodes
    },
    userPayload: {
      id: user.id,
      username: user.username,
      name: user.name,
      phone: user.phone || '',
      email: user.email || '',
      status: user.status,
      store_id: primaryStoreId,
      store_ids: storeIds,
      stores,
      roles: roleNames,
      role: roleNames[0] || null,
      role_ids: roleIds,
      role_id: roleIds[0] || null,
      role_codes: roleCodes,
      permissions: accessProfile.userPermissions,
      access_profile: accessProfile,
      permission_summary: accessProfile.summary,
      menu_visibility: accessProfile.menuVisibility
    }
  }
}

// 用户登录接口
router.post('/login', validateBody({
  username: { type: 'string', required: true, minLength: 3, maxLength: 50 },
  password: { type: 'string', required: true, minLength: 4, maxLength: 100 }
}), authController.login.bind(authController))

// 获取当前用户信息
router.get('/user', unifiedAuth, authController.getCurrentUser.bind(authController))

// 刷新访问令牌不要求有效 access token；refresh token 自身负责认证。
router.post('/refresh', authController.getRefreshHandler(verifyToken))

// 用户退出登录
router.post('/logout', unifiedAuth, authSessionController.logout.bind(authSessionController))

// 退出所有设备
router.post('/logout-all', unifiedAuth, authSessionController.logoutAll.bind(authSessionController))

// 初始化管理员用户（仅开发环境）
router.post('/init-admin', authController.getAdminInitializationHandler(
  process.env.NODE_ENV,
  process.env.ENABLE_DEV_INIT_ADMIN
))

module.exports = router
