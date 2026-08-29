const express = require('express')
const router = express.Router()
const ApiResponse = require('../utils/response')
const { unifiedAuth, requirePermission, requireAnyPermission } = require('../middleware/unified-auth')
const { getDatabase } = require('../config/database')
const UserStoreRepository = require('../repositories/user-store.repository')
const { logPermissionOperation } = require('./permission-logs')
const log = require('../utils/log')

const userStoreRepository = new UserStoreRepository()

async function getUserAuditInfo(userId) {
  const db = getDatabase()
  const [users] = await db.execute(
    'SELECT id, username, name FROM users WHERE id = ?',
    [userId]
  )
  return users[0] || { id: Number(userId), username: String(userId), name: '' }
}

function normalizeStoreAuditRows(stores = []) {
  return stores.map((store) => ({
    store_id: Number(store.store_id || store.id),
    store_name: store.store_name || store.name || String(store.store_id || store.id),
    is_primary: Number(store.is_primary) === 1
  }))
}

function buildStoreBindingDetails(previousStores, stores, extraDetails = {}) {
  const previous = normalizeStoreAuditRows(previousStores)
  const current = normalizeStoreAuditRows(stores)
  const previousIds = new Set(previous.map((store) => store.store_id))
  const currentIds = new Set(current.map((store) => store.store_id))

  const previousPrimaryStore = previous.find((store) => store.is_primary) || null
  const primaryStore = current.find((store) => store.is_primary) || null

  return {
    audit_type: 'user_store_binding',
    ...extraDetails,
    previous_stores: previous,
    stores: current,
    added_stores: current.filter((store) => !previousIds.has(store.store_id)),
    removed_stores: previous.filter((store) => !currentIds.has(store.store_id)),
    previous_primary_store: previousPrimaryStore,
    primary_store: primaryStore
  }
}

async function logStoreBindingChange(req, userId, previousStores, stores, actionLabel, extraDetails = {}) {
  const user = await getUserAuditInfo(userId)
  const details = buildStoreBindingDetails(previousStores, stores, extraDetails)
  const primaryChanged = details.previous_primary_store?.store_id !== details.primary_store?.store_id
  if (details.added_stores.length === 0 && details.removed_stores.length === 0 && !primaryChanged) {
    return
  }
  await logPermissionOperation(
    req,
    'assign',
    'user_store',
    userId,
    user.name || user.username,
    `${actionLabel}：${user.name || user.username}`,
    details
  )
}

/**
 * 获取用户关联的所有门店
 * GET /api/user-stores/user/:user_id
 */
router.get('/user/:user_id', unifiedAuth, requirePermission('users:view'), async (req, res) => {
  try {
    const { user_id } = req.params

    if (!user_id) {
      return ApiResponse.error(res, '用户ID不能为空', 400)
    }

    const stores = await userStoreRepository.getUserStores(user_id)

    return ApiResponse.success(res, stores, '获取用户门店列表成功')
  } catch (error) {
    log.error('获取用户门店列表失败:', error)
    return ApiResponse.error(res, '获取用户门店列表失败', 500)
  }
})

/**
 * 获取门店关联的所有用户
 * GET /api/user-stores/store/:store_id
 */
router.get('/store/:store_id', unifiedAuth, requirePermission('stores:view'), async (req, res) => {
  try {
    const { store_id } = req.params

    if (!store_id) {
      return ApiResponse.error(res, '门店ID不能为空', 400)
    }

    const users = await userStoreRepository.getStoreUsers(store_id)

    return ApiResponse.success(res, users, '获取门店用户列表成功')
  } catch (error) {
    log.error('获取门店用户列表失败:', error)
    return ApiResponse.error(res, '获取门店用户列表失败', 500)
  }
})

/**
 * 为用户关联门店（支持多选）
 * POST /api/user-stores/assign
 * Body: { user_id: number, store_ids: number[], is_primary?: boolean }
 */
router.post('/assign', unifiedAuth, requireAnyPermission(['users:edit', 'permissions:admin']), async (req, res) => {
  try {
    const user_id = req.body?.user_id
    const store_ids = req.body?.store_ids
    const is_primary = req.body?.is_primary
    const replace_existing = req.body?.replace_existing ?? false
    const userId = user_id
    const storeIds = store_ids
    const isPrimary = is_primary
    const replaceExisting = replace_existing
    const assignedBy = req.user.id

    if (!userId || !storeIds || !Array.isArray(storeIds) || storeIds.length === 0) {
      return ApiResponse.error(res, '用户ID和门店ID列表不能为空', 400)
    }

    const previousStores = await userStoreRepository.getUserStores(userId)
    if (replaceExisting) {
      await userStoreRepository.removeAllUserStores(userId)
    }
    const result = await userStoreRepository.assignStoresToUser(
      userId,
      storeIds,
      assignedBy,
      isPrimary ? 1 : 0
    )
    const currentStores = await userStoreRepository.getUserStores(userId)
    await logStoreBindingChange(req, userId, previousStores, currentStores, '更新用户门店绑定')

    return ApiResponse.success(res, result, result.message)
  } catch (error) {
    log.error('关联用户门店失败:', error)
    return ApiResponse.error(res, '关联用户门店失败', 500)
  }
})

/**
 * 设置用户的主门店
 * PUT /api/user-stores/primary
 * Body: { user_id: number, store_id: number }
 */
router.put('/primary', unifiedAuth, requireAnyPermission(['users:edit', 'permissions:admin']), async (req, res) => {
  try {
    const { user_id, store_id } = req.body

    if (!user_id || !store_id) {
      return ApiResponse.error(res, '用户ID和门店ID不能为空', 400)
    }

    const previousStores = await userStoreRepository.getUserStores(user_id)
    const result = await userStoreRepository.setPrimaryStore(user_id, store_id)
    const currentStores = await userStoreRepository.getUserStores(user_id)
    await logStoreBindingChange(
      req,
      user_id,
      previousStores,
      currentStores,
      '设置用户主门店',
      { primary_store_id: Number(store_id) }
    )

    return ApiResponse.success(res, result, result.message)
  } catch (error) {
    log.error('设置用户主门店失败:', error)
    return ApiResponse.error(res, '设置用户主门店失败', 500)
  }
})

/**
 * 移除用户的门店关联
 * DELETE /api/user-stores/remove
 * Body: { user_id: number, store_id: number }
 */
router.delete('/remove', unifiedAuth, requireAnyPermission(['users:edit', 'permissions:admin']), async (req, res) => {
  try {
    const { user_id, store_id } = req.body

    if (!user_id || !store_id) {
      return ApiResponse.error(res, '用户ID和门店ID不能为空', 400)
    }

    const previousStores = await userStoreRepository.getUserStores(user_id)
    const result = await userStoreRepository.removeUserStore(user_id, store_id)
    const currentStores = await userStoreRepository.getUserStores(user_id)
    await logStoreBindingChange(req, user_id, previousStores, currentStores, '移除用户门店绑定')

    return ApiResponse.success(res, result, result.message)
  } catch (error) {
    log.error('移除用户门店关联失败:', error)
    return ApiResponse.error(res, '移除用户门店关联失败', 500)
  }
})

/**
 * 移除用户的所有门店关联
 * DELETE /api/user-stores/user/:user_id/all
 */
router.delete('/user/:user_id/all', unifiedAuth, requireAnyPermission(['users:edit', 'permissions:admin']), async (req, res) => {
  try {
    const { user_id } = req.params

    if (!user_id) {
      return ApiResponse.error(res, '用户ID不能为空', 400)
    }

    const previousStores = await userStoreRepository.getUserStores(user_id)
    const result = await userStoreRepository.removeAllUserStores(user_id)
    if (result.affectedRows > 0) {
      await logStoreBindingChange(req, user_id, previousStores, [], '清空用户门店绑定')
    }

    return ApiResponse.success(res, result, result.message)
  } catch (error) {
    log.error('移除用户所有门店关联失败:', error)
    return ApiResponse.error(res, '移除用户所有门店关联失败', 500)
  }
})

module.exports = router
