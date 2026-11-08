'use strict'

const { hasColumn } = require('./schema-inspector.service')
const RolePermissionVisibilityRepository = require('../repositories/role-permission-visibility.repository')
const { withConnection } = require('../core/db/connection')
const { getDatabase } = require('../config/database')

class RolePermissionVisibilityService {
  constructor({
    repository = new RolePermissionVisibilityRepository(),
    supportsVisibility = () => hasColumn('role_permissions', 'menu_visible'),
    columnExists = hasColumn,
    databaseProvider = getDatabase,
    connectionRunner = withConnection
  } = {}) {
    this.repository = repository
    this.supportsVisibility = supportsVisibility
    this.columnExists = columnExists
    this.databaseProvider = databaseProvider
    this.connectionRunner = connectionRunner
  }

  async getVisibility(roleId) {
    if (!(await this.supportsVisibility())) return null
    return this.repository.getVisibility(roleId)
  }

  async toggleVisibility({ roleId, moduleKey, permissionType, visible }) {
    return this.connectionRunner(this.databaseProvider, async connection => {
      let transactionStarted = false
      try {
        await connection.beginTransaction()
        transactionStarted = true
        const supportsMenuVisible = await this.columnExists('role_permissions', 'menu_visible', connection)
        const supportsCreatedAt = await this.columnExists('role_permissions', 'created_at', connection)
        if (!supportsMenuVisible) {
          await connection.rollback()
          transactionStarted = false
          return { supported: false }
        }

        const permissionExists = await this.repository.findPermission(connection, {
          roleId, moduleKey, permissionType
        })
        if (permissionExists) {
          await this.repository.updatePermissionVisibility(connection, {
            roleId, moduleKey, permissionType, visible
          })
        } else {
          await this.repository.insertPermission(connection, {
            roleId, moduleKey, permissionType, visible, supportsCreatedAt
          })
        }

        await connection.commit()
        transactionStarted = false
        return { supported: true }
      } catch (error) {
        if (transactionStarted) await connection.rollback()
        throw error
      }
    })
  }
}

module.exports = RolePermissionVisibilityService
