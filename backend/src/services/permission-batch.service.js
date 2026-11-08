'use strict'

const PermissionBatchRepository = require('../repositories/permission-batch.repository')
const { withConnection } = require('../core/db/connection')
const { getDatabase } = require('../config/database')
const { hasColumn } = require('./schema-inspector.service')
const { normalizeManagedModuleKey } = require('../utils/managed-permission-modules')
const { normalizePermissionType } = require('../config/module-permission-actions')

class PermissionBatchService {
  constructor({ repository = new PermissionBatchRepository(), databaseProvider = getDatabase, columnExists = hasColumn } = {}) {
    this.repository = repository
    this.databaseProvider = databaseProvider
    this.columnExists = columnExists
  }

  async revoke(roleId, permissions) {
    return withConnection(this.databaseProvider, async connection => {
      try {
        await connection.beginTransaction()
        for (const permission of permissions) {
          await this.repository.revokePermission(connection, roleId, permission)
        }
        await connection.commit()
      } catch (error) {
        await connection.rollback()
        throw error
      }
    })
  }

  async assign(roleId, permissions) {
    return withConnection(this.databaseProvider, async connection => {
      try {
        await connection.beginTransaction()
        const supportsCreatedAt = await this.columnExists('role_permissions', 'created_at', connection)
        await this.repository.deleteRolePermissions(connection, roleId)

        const values = permissions.map(permission => [
          roleId,
          normalizeManagedModuleKey(permission.module_key),
          normalizePermissionType(permission.permission_type)
        ])
        if (values.length > 0) {
          await this.repository.insertRolePermissions(connection, values, supportsCreatedAt)
        }

        await connection.commit()
      } catch (error) {
        await connection.rollback()
        throw error
      }
    })
  }

  async copy(fromRoleId, toRoleId) {
    return withConnection(this.databaseProvider, async connection => {
      let transactionStarted = false
      try {
        await connection.beginTransaction()
        transactionStarted = true
        const sourcePermissions = await this.repository.listRolePermissions(connection, fromRoleId)
        if (sourcePermissions.length === 0) {
          await connection.rollback()
          transactionStarted = false
          return { copiedCount: 0, sourceEmpty: true }
        }

        await this.repository.deleteRolePermissions(connection, toRoleId)
        const supportsCreatedAt = await this.columnExists('role_permissions', 'created_at', connection)
        await this.repository.copyRolePermissions(connection, toRoleId, sourcePermissions, supportsCreatedAt)
        await connection.commit()
        transactionStarted = false
        return { copiedCount: sourcePermissions.length, sourceEmpty: false }
      } catch (error) {
        if (transactionStarted) await connection.rollback()
        throw error
      }
    })
  }
}

module.exports = PermissionBatchService
