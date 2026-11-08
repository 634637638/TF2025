'use strict'

const { getDatabase } = require('../config/database')
const UserStoreRepository = require('../repositories/user-store.repository')
const PermissionLogsService = require('./permission-logs.service')

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
const BaseService = require('../core/base/base.service')

class UserStoreService extends BaseService {
  async logStoreBindingChange(context, userId, previousStores, stores, actionLabel, extraDetails = {}) {
    const [users] = await this.auditRepository.findAuditUser(userId)
    const user = users[0] || { id: Number(userId), username: String(userId), name: '' }
    const details = buildStoreBindingDetails(previousStores, stores, extraDetails)
    const primaryChanged = details.previous_primary_store?.store_id !== details.primary_store?.store_id
    if (details.added_stores.length === 0 && details.removed_stores.length === 0 && !primaryChanged) return

    await this.auditOperation(
      context,
      'assign',
      'user_store',
      userId,
      user.name || user.username,
      `${actionLabel}：${user.name || user.username}`,
      details
    )
  }

  constructor({
    repository = new UserStoreRepository(),
    database = getDatabase,
    auditOperation
  } = {}) {
    super()
    this.repository = repository
    this.auditRepository = new UserStoreRepository({ database })
    const permissionLogsService = new PermissionLogsService()
    this.auditOperation = auditOperation || permissionLogsService.logPermissionOperation.bind(permissionLogsService)
  }

  async getUserStores(params) {
    
    const { user_id } = params
    if (!user_id) throw this.createError('用户ID不能为空', 400)
    const stores = await this.repository.getUserStores(user_id)
    return { data: stores, message: '获取用户门店列表成功' }
  }

  async getStoreUsers(params) {
    
    const { store_id } = params
    if (!store_id) throw this.createError('门店ID不能为空', 400)
    const users = await this.repository.getStoreUsers(store_id)
    return { data: users, message: '获取门店用户列表成功' }
  }

  async assignStores(actor, body, context) {
    
    const userId = body?.user_id
    const storeIds = body?.store_ids
    const isPrimary = body?.is_primary
    const replaceExisting = body?.replace_existing ?? false
    const assignedBy = this.getActorId(actor)
    if (!userId || !storeIds || !Array.isArray(storeIds) || storeIds.length === 0) {
      throw this.createError('用户ID和门店ID列表不能为空', 400)
    }

    const previousStores = await this.repository.getUserStores(userId)
    if (replaceExisting) await this.repository.removeAllUserStores(userId)
    const result = await this.repository.assignStoresToUser(userId, storeIds, assignedBy, isPrimary ? 1 : 0)
    const currentStores = await this.repository.getUserStores(userId)
    await this.logStoreBindingChange(context, userId, previousStores, currentStores, '更新用户门店绑定')
    return { data: result, message: result.message }
  }

  async setPrimaryStore(body, context) {
    
    const { user_id, store_id } = body
    if (!user_id || !store_id) throw this.createError('用户ID和门店ID不能为空', 400)
    const previousStores = await this.repository.getUserStores(user_id)
    const result = await this.repository.setPrimaryStore(user_id, store_id)
    const currentStores = await this.repository.getUserStores(user_id)
    await this.logStoreBindingChange(context, user_id, previousStores, currentStores, '设置用户主门店', {
      primary_store_id: Number(store_id)
    })
    return { data: result, message: result.message }
  }

  async removeStore(body, context) {
    
    const { user_id, store_id } = body
    if (!user_id || !store_id) throw this.createError('用户ID和门店ID不能为空', 400)
    const previousStores = await this.repository.getUserStores(user_id)
    const result = await this.repository.removeUserStore(user_id, store_id)
    const currentStores = await this.repository.getUserStores(user_id)
    await this.logStoreBindingChange(context, user_id, previousStores, currentStores, '移除用户门店绑定')
    return { data: result, message: result.message }
  }

  async removeAllStores(params, context) {
    
    const { user_id } = params
    if (!user_id) throw this.createError('用户ID不能为空', 400)
    const previousStores = await this.repository.getUserStores(user_id)
    const result = await this.repository.removeAllUserStores(user_id)
    if (result.affectedRows > 0) {
      await this.logStoreBindingChange(context, user_id, previousStores, [], '清空用户门店绑定')
    }
    return { data: result, message: result.message }
  }
}

module.exports = UserStoreService
