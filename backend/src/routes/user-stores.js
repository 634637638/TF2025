const express = require('express');
const router = express.Router();
const ApiResponse = require('../utils/response');
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth');
const UserStoreRepository = require('../repositories/user-store.repository');
const log = require('../utils/log');

const userStoreRepository = new UserStoreRepository();

/**
 * 获取用户关联的所有门店
 * GET /api/user-stores/user/:userId
 */
router.get('/user/:userId', unifiedAuth, requirePermission('users:view'), async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return ApiResponse.error(res, '用户ID不能为空', 400);
    }

    const stores = await userStoreRepository.getUserStores(userId);

    return ApiResponse.success(res, stores, '获取用户门店列表成功');
  } catch (error) {
    log.error('获取用户门店列表失败:', error);
    return ApiResponse.error(res, '获取用户门店列表失败', 500);
  }
});

/**
 * 获取门店关联的所有用户
 * GET /api/user-stores/store/:storeId
 */
router.get('/store/:storeId', unifiedAuth, requirePermission('stores:view'), async (req, res) => {
  try {
    const { storeId } = req.params;

    if (!storeId) {
      return ApiResponse.error(res, '门店ID不能为空', 400);
    }

    const users = await userStoreRepository.getStoreUsers(storeId);

    return ApiResponse.success(res, users, '获取门店用户列表成功');
  } catch (error) {
    log.error('获取门店用户列表失败:', error);
    return ApiResponse.error(res, '获取门店用户列表失败', 500);
  }
});

/**
 * 为用户关联门店（支持多选）
 * POST /api/user-stores/assign
 * Body: { userId: number, storeIds: number[], isPrimary?: boolean }
 */
router.post('/assign', unifiedAuth, requirePermission('users:edit'), async (req, res) => {
  try {
    const { userId, storeIds, isPrimary } = req.body;
    const assignedBy = req.user.id;

    if (!userId || !storeIds || !Array.isArray(storeIds) || storeIds.length === 0) {
      return ApiResponse.error(res, '用户ID和门店ID列表不能为空', 400);
    }

    const result = await userStoreRepository.assignStoresToUser(
      userId,
      storeIds,
      assignedBy,
      isPrimary ? 1 : 0
    );

    return ApiResponse.success(res, result, result.message);
  } catch (error) {
    log.error('关联用户门店失败:', error);
    return ApiResponse.error(res, '关联用户门店失败', 500);
  }
});

/**
 * 设置用户的主门店
 * PUT /api/user-stores/primary
 * Body: { userId: number, storeId: number }
 */
router.put('/primary', unifiedAuth, requirePermission('users:edit'), async (req, res) => {
  try {
    const { userId, storeId } = req.body;

    if (!userId || !storeId) {
      return ApiResponse.error(res, '用户ID和门店ID不能为空', 400);
    }

    const result = await userStoreRepository.setPrimaryStore(userId, storeId);

    return ApiResponse.success(res, result, result.message);
  } catch (error) {
    log.error('设置用户主门店失败:', error);
    return ApiResponse.error(res, '设置用户主门店失败', 500);
  }
});

/**
 * 移除用户的门店关联
 * DELETE /api/user-stores/remove
 * Body: { userId: number, storeId: number }
 */
router.delete('/remove', unifiedAuth, requirePermission('users:edit'), async (req, res) => {
  try {
    const { userId, storeId } = req.body;

    if (!userId || !storeId) {
      return ApiResponse.error(res, '用户ID和门店ID不能为空', 400);
    }

    const result = await userStoreRepository.removeUserStore(userId, storeId);

    return ApiResponse.success(res, result, result.message);
  } catch (error) {
    log.error('移除用户门店关联失败:', error);
    return ApiResponse.error(res, '移除用户门店关联失败', 500);
  }
});

/**
 * 移除用户的所有门店关联
 * DELETE /api/user-stores/user/:userId/all
 */
router.delete('/user/:userId/all', unifiedAuth, requirePermission('users:edit'), async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return ApiResponse.error(res, '用户ID不能为空', 400);
    }

    const result = await userStoreRepository.removeAllUserStores(userId);

    return ApiResponse.success(res, result, result.message);
  } catch (error) {
    log.error('移除用户所有门店关联失败:', error);
    return ApiResponse.error(res, '移除用户所有门店关联失败', 500);
  }
});

module.exports = router;
