'use strict'

const { getDatabase } = require('../config/database')
const { withConnection } = require('../core/db/connection')
const UserRoleAssignmentRepository = require('../repositories/user-role-assignment.repository')
const PermissionLogsService = require('./permission-logs.service')

class UserRoleAssignmentService {
  constructor({
    databaseProvider = getDatabase,
    repository = new UserRoleAssignmentRepository(),
    permissionLogs = new PermissionLogsService(),
    logger = require('../utils/log')
  } = {}) {
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

  async assign({ userId, roleIds, requestContext }) {
    const normalizedRoleIds = this.normalizeRoleIds(roleIds)
    let auditPayload
    const result = await withConnection(this.databaseProvider, async (connection) => {
      try {
        await connection.beginTransaction()
        const user = await this.repository.findUser(connection, userId)
        if (!user) {
          await connection.rollback()
          return { status: 'not_found' }
        }

        const previousRoles = await this.repository.listPreviousRoles(connection, userId)
        const existingRoleIds = await this.repository.listExistingRoleIds(connection, normalizedRoleIds)
        if (existingRoleIds.length !== normalizedRoleIds.length) {
          await connection.rollback()
          return { status: 'invalid_roles' }
        }

        await this.repository.removeUserRoles(connection, userId)
        await this.repository.assignUserRoles(connection, userId, normalizedRoleIds)
        await connection.commit()
        auditPayload = {
          user,
          previousRoles,
          normalizedRoleIds
        }
        return { status: 'updated' }
      } catch (error) {
        await connection.rollback().catch(() => {})
        throw error
      }
    })

    if (result.status === 'updated') {
      try {
        await this.permissionLogs.logUserRoleOperation(
          requestContext,
          userId,
          auditPayload.user.username,
          auditPayload.normalizedRoleIds,
          {
            role_count: auditPayload.normalizedRoleIds.length,
            previous_role_ids: auditPayload.previousRoles.map(role => role.id),
            previous_role_names: auditPayload.previousRoles.map(role => role.name)
          }
        )
      } catch (auditError) {
        this.logger.error('用户角色已更新，但权限操作日志记录失败:', auditError)
      }
    }
    return result
  }
}

module.exports = UserRoleAssignmentService
