'use strict'

const { hasColumn } = require('./schema-inspector.service')
const { normalizePermissionType } = require('../config/module-permission-actions')
const { normalizeManagedModuleKey } = require('../utils/managed-permission-modules')
const PermissionImportRepository = require('../repositories/permission-import.repository')

class PermissionImportService {
  constructor({ repository = new PermissionImportRepository(), columnExists = hasColumn, logger = require('../utils/log') } = {}) {
    this.repository = repository
    this.columnExists = columnExists
    this.logger = logger
  }

  async import(config, overwrite = false) {
    if (!config || !config.roles) return { status: 400 }

    return this.repository.withConnection(async connection => {
      const [supportsRoleIsActive, supportsModuleIsActive, supportsCreatedAt] = await Promise.all([
        this.columnExists('roles', 'is_active', connection),
        this.columnExists('modules', 'is_active', connection),
        this.columnExists('role_permissions', 'created_at', connection)
      ])
      let transactionStarted = false
      try {
        await connection.beginTransaction()
        transactionStarted = true
        let importedCount = 0

        for (const [roleName, roleConfig] of Object.entries(config.roles)) {
          const roleId = await this.repository.findRoleId(connection, roleName, supportsRoleIsActive)
          if (roleId === null) {
            this.logger.warn(`角色 ${roleName} 不存在，跳过`)
            continue
          }
          if (overwrite) await this.repository.deleteRolePermissions(connection, roleId)

          for (const [rawModuleKey, moduleConfig] of Object.entries(roleConfig.modules)) {
            const moduleKey = normalizeManagedModuleKey(rawModuleKey)
            const exists = await this.repository.moduleExists(connection, moduleKey, supportsModuleIsActive)
            if (!exists) {
              this.logger.warn(`模块 ${moduleKey} 不存在，跳过`)
              continue
            }
            for (const permission of moduleConfig.permissions) {
              const permissionType = normalizePermissionType(permission)
              if (!overwrite && await this.repository.permissionExists(connection, roleId, moduleKey, permissionType)) continue
              await this.repository.insertPermission(connection, roleId, moduleKey, permissionType, supportsCreatedAt)
              importedCount += 1
            }
          }
        }

        await connection.commit()
        transactionStarted = false
        return { status: 200, importedCount, overwrite }
      } catch (error) {
        if (transactionStarted) await connection.rollback()
        throw error
      }
    })
  }
}

module.exports = PermissionImportService
