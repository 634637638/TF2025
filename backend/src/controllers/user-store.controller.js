'use strict'

const ApiResponse = require('../utils/response')
const { getDatabase } = require('../config/database')
const UserStoreRepository = require('../repositories/user-store.repository')
const PermissionLogsService = require('../services/permission-logs.service')
const log = require('../utils/log')

const normalizeStoreAuditRows = (stores = []) => stores.map(store => ({
  store_id: Number(store.store_id || store.id),
  store_name: store.store_name || store.name || String(store.store_id || store.id),
  is_primary: Number(store.is_primary) === 1
}))

const buildStoreBindingDetails = (previousStores, stores, extraDetails = {}) => {
  const previous = normalizeStoreAuditRows(previousStores)
  const current = normalizeStoreAuditRows(stores)
  const previousIds = new Set(previous.map(store => store.store_id))
  const currentIds = new Set(current.map(store => store.store_id))
  return {
    audit_type: 'user_store_binding',
    ...extraDetails,
    previous_stores: previous,
    stores: current,
    added_stores: current.filter(store => !previousIds.has(store.store_id)),
    removed_stores: previous.filter(store => !currentIds.has(store.store_id)),
    previous_primary_store: previous.find(store => store.is_primary) || null,
    primary_store: current.find(store => store.is_primary) || null
  }
}

class UserStoreController {
  constructor({
    repository = new UserStoreRepository(),
    database = getDatabase,
    auditOperation
  } = {}) {
    this.repository = repository
    this.database = database
    const permissionLogsService = new PermissionLogsService()
    this.auditOperation = auditOperation || permissionLogsService.logPermissionOperation.bind(permissionLogsService)
  }

  async logStoreBindingChange(req, userId, previousStores, stores, actionLabel, extraDetails = {}) {
    const [users] = await this.database().execute(
      'SELECT id, username, name FROM users WHERE id = ?',
      [userId]
    )
    const user = users[0] || { id: Number(userId), username: String(userId), name: '' }
    const details = buildStoreBindingDetails(previousStores, stores, extraDetails)
    const primaryChanged = details.previous_primary_store?.store_id !== details.primary_store?.store_id
    if (details.added_stores.length === 0 && details.removed_stores.length === 0 && !primaryChanged) return

    await this.auditOperation(
      req,
      'assign',
      'user_store',
      userId,
      user.name || user.username,
      `${actionLabel}：${user.name || user.username}`,
      details
    )
  }

  async getUserStores(req, res) {
    try {
      const { user_id } = req.params
      if (!user_id) return ApiResponse.error(res, '用户ID不能为空', 400)
      const stores = await this.repository.getUserStores(user_id)
      return ApiResponse.success(res, stores, '获取用户门店列表成功')
    } catch (error) {
      log.error('获取用户门店列表失败:', error)
      return ApiResponse.error(res, '获取用户门店列表失败', 500)
    }
  }

  async getStoreUsers(req, res) {
    try {
      const { store_id } = req.params
      if (!store_id) return ApiResponse.error(res, '门店ID不能为空', 400)
      const users = await this.repository.getStoreUsers(store_id)
      return ApiResponse.success(res, users, '获取门店用户列表成功')
    } catch (error) {
      log.error('获取门店用户列表失败:', error)
      return ApiResponse.error(res, '获取门店用户列表失败', 500)
    }
  }

  async assignStores(req, res) {
    try {
      const userId = req.body?.user_id
      const storeIds = req.body?.store_ids
      const isPrimary = req.body?.is_primary
      const replaceExisting = req.body?.replace_existing ?? false
      const assignedBy = req.user.id
      if (!userId || !storeIds || !Array.isArray(storeIds) || storeIds.length === 0) {
        return ApiResponse.error(res, '用户ID和门店ID列表不能为空', 400)
      }

      const previousStores = await this.repository.getUserStores(userId)
      if (replaceExisting) await this.repository.removeAllUserStores(userId)
      const result = await this.repository.assignStoresToUser(userId, storeIds, assignedBy, isPrimary ? 1 : 0)
      const currentStores = await this.repository.getUserStores(userId)
      await this.logStoreBindingChange(req, userId, previousStores, currentStores, '更新用户门店绑定')
      return ApiResponse.success(res, result, result.message)
    } catch (error) {
      log.error('关联用户门店失败:', error)
      return ApiResponse.error(res, '关联用户门店失败', 500)
    }
  }

  async setPrimaryStore(req, res) {
    try {
      const { user_id, store_id } = req.body
      if (!user_id || !store_id) return ApiResponse.error(res, '用户ID和门店ID不能为空', 400)
      const previousStores = await this.repository.getUserStores(user_id)
      const result = await this.repository.setPrimaryStore(user_id, store_id)
      const currentStores = await this.repository.getUserStores(user_id)
      await this.logStoreBindingChange(req, user_id, previousStores, currentStores, '设置用户主门店', {
        primary_store_id: Number(store_id)
      })
      return ApiResponse.success(res, result, result.message)
    } catch (error) {
      log.error('设置用户主门店失败:', error)
      return ApiResponse.error(res, '设置用户主门店失败', 500)
    }
  }

  async removeStore(req, res) {
    try {
      const { user_id, store_id } = req.body
      if (!user_id || !store_id) return ApiResponse.error(res, '用户ID和门店ID不能为空', 400)
      const previousStores = await this.repository.getUserStores(user_id)
      const result = await this.repository.removeUserStore(user_id, store_id)
      const currentStores = await this.repository.getUserStores(user_id)
      await this.logStoreBindingChange(req, user_id, previousStores, currentStores, '移除用户门店绑定')
      return ApiResponse.success(res, result, result.message)
    } catch (error) {
      log.error('移除用户门店关联失败:', error)
      return ApiResponse.error(res, '移除用户门店关联失败', 500)
    }
  }

  async removeAllStores(req, res) {
    try {
      const { user_id } = req.params
      if (!user_id) return ApiResponse.error(res, '用户ID不能为空', 400)
      const previousStores = await this.repository.getUserStores(user_id)
      const result = await this.repository.removeAllUserStores(user_id)
      if (result.affectedRows > 0) {
        await this.logStoreBindingChange(req, user_id, previousStores, [], '清空用户门店绑定')
      }
      return ApiResponse.success(res, result, result.message)
    } catch (error) {
      log.error('移除用户所有门店关联失败:', error)
      return ApiResponse.error(res, '移除用户所有门店关联失败', 500)
    }
  }
}

module.exports = UserStoreController
