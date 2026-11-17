'use strict'

const { hasUnifiedPermission, invalidateAuthProfiles } = require('../middleware/unified-auth')
const { getDatabase } = require('../config/database')
const { withConnection } = require('../core/db/connection')
const UserRoleAssignmentRepository = require('../repositories/user-role-assignment.repository')
const PermissionLogsService = require('./permission-logs.service')

class UserRoleAssignmentService {
  constructor({
    databaseProvider = getDatabase,
    repository = new UserRoleAssignmentRepository(),
    permissionLogs = new PermissionLogsService(),
    permissionCheck = hasUnifiedPermission,
    logger = require('../utils/log')
  } = {}) {
    this.permissionCheck = permissionCheck
    this.databaseProvider = databaseProvider
    this.repository = repository
    this.permissionLogs = permissionLogs
    this.logger = logger
  }

  normalizeRoleIds(roleIds) {
    if (!Array.isArray(roleIds)) {
      const error = new Error('角色ID列表必须是数组')
      error.code = 'INVALID_ROLE_LIST'
      throw error
    }
    const normalizedRoleIds = [...new Set(roleIds.map(roleId => Number(roleId)))]
    if (normalizedRoleIds.some(roleId => !Number.isSafeInteger(roleId) || roleId <= 0)) {
      const error = new Error('角色ID列表包含无效值')
      error.code = 'INVALID_ROLE_ID'
      throw error
    }
    return normalizedRoleIds
  }

  async assertCanAssign(actor) {
    if (!await this.permissionCheck(actor, 'permissions:admin')) {
      throw Object.assign(new Error('修改系统角色需要权限管理授权'), { statusCode: 403, code: 'INSUFFICIENT_PERMISSIONS' })
    }
  }

  async assertAccountAccess(id, actor) {
    if (Number(id) === Number(actor?.id)) return
    if (await this.permissionCheck({ id: Number(id) }, 'permissions:admin')) {
      await this.assertCanAssign(actor)
    }
  }

  /** 由调用方持有事务；账号与角色必须一起提交或回滚。 */
  async assignInTransaction(connection, { userId, roleIds, user }) {
    const normalizedRoleIds = this.normalizeRoleIds(roleIds)
    user = user || await this.repository.findUser(connection, userId)
    if (!user) return { status: 'not_found' }
    const previousRoles = await this.repository.listPreviousRoles(connection, userId)
    const existingRoleIds = await this.repository.listExistingRoleIds(connection, normalizedRoleIds)
    if (existingRoleIds.length !== normalizedRoleIds.length) return { status: 'invalid_roles' }
    await this.repository.removeUserRoles(connection, userId)
    await this.repository.assignUserRoles(connection, userId, normalizedRoleIds)
    return { status: 'updated', user, previousRoles, normalizedRoleIds }
  }

  async afterCommit(userId, result, requestContext) {
    invalidateAuthProfiles([userId])
    try {
      await this.permissionLogs.logUserRoleOperation(
        requestContext, userId, result.user.username, result.normalizedRoleIds,
        {
          role_count: result.normalizedRoleIds.length,
          previous_role_ids: result.previousRoles.map(role => role.id),
          previous_role_names: result.previousRoles.map(role => role.name)
        }
      )
    } catch (auditError) {
      this.logger.error('用户角色已更新，但权限操作日志记录失败:', auditError)
    }
  }

  async assign({ userId, roleIds, requestContext }) {
    await this.assertCanAssign(requestContext?.user)
    const normalizedRoleIds = this.normalizeRoleIds(roleIds)
    const result = await withConnection(this.databaseProvider, async connection => {
      try {
        await connection.beginTransaction()
        const result = await this.assignInTransaction(connection, { userId, roleIds: normalizedRoleIds })
        if (result.status === 'updated') await connection.commit()
        else await connection.rollback()
        return result
      } catch (error) {
        await connection.rollback().catch(() => {})
        throw error
      }
    })
    if (result.status === 'updated') await this.afterCommit(userId, result, requestContext)
    return { status: result.status }
  }
}

module.exports = UserRoleAssignmentService
