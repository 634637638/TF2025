const express = require('express')
const router = express.Router()
const { unifiedAuth, requirePermission, requireAnyPermission } = require('../middleware/unified-auth')
const UserStoreController = require('../controllers/user-store.controller')
const userStoreController = new UserStoreController()

/**
 * 获取用户关联的所有门店
 * GET /api/user-stores/user/:user_id
 */
router.get('/user/:user_id', unifiedAuth, requirePermission('users:view'), userStoreController.getUserStores.bind(userStoreController))

/**
 * 获取门店关联的所有用户
 * GET /api/user-stores/store/:store_id
 */
router.get('/store/:store_id', unifiedAuth, requirePermission('stores:view'), userStoreController.getStoreUsers.bind(userStoreController))

/**
 * 为用户关联门店（支持多选）
 * POST /api/user-stores/assign
 * Body: { user_id: number, store_ids: number[], is_primary?: boolean }
 */
router.post('/assign', unifiedAuth, requireAnyPermission(['users:edit', 'permissions:admin']), userStoreController.assignStores.bind(userStoreController))

/**
 * 设置用户的主门店
 * PUT /api/user-stores/primary
 * Body: { user_id: number, store_id: number }
 */
router.put('/primary', unifiedAuth, requireAnyPermission(['users:edit', 'permissions:admin']), userStoreController.setPrimaryStore.bind(userStoreController))

/**
 * 移除用户的门店关联
 * DELETE /api/user-stores/remove
 * Body: { user_id: number, store_id: number }
 */
router.delete('/remove', unifiedAuth, requireAnyPermission(['users:edit', 'permissions:admin']), userStoreController.removeStore.bind(userStoreController))

/**
 * 移除用户的所有门店关联
 * DELETE /api/user-stores/user/:user_id/all
 */
router.delete('/user/:user_id/all', unifiedAuth, requireAnyPermission(['users:edit', 'permissions:admin']), userStoreController.removeAllStores.bind(userStoreController))

module.exports = router
