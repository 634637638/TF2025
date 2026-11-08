'use strict'

const { getDatabase } = require('../config/database')
const { hasColumn } = require('./schema-inspector.service')
const { normalizeFieldConfig } = require('../utils/field-permission-normalizer')
const RoleFieldPermissionsRepository = require('../repositories/role-field-permissions.repository')
const { withConnection } = require('../core/db/connection')
const PermissionLogsService = require('./permission-logs.service')
const { clearCache } = require('../middleware/cache')

const EMPTY_FIELD_CONFIG = { hidden_fields: [] }

class RoleFieldPermissionsService {
  constructor({
    databaseProvider = getDatabase,
    columnExists = hasColumn,
    repository = new RoleFieldPermissionsRepository(),
    permissionLogs = new PermissionLogsService(),
    clearPermissionCache = clearCache,
    logger = require('../utils/log'),
    now = () => new Date()
  } = {}) {
    this.databaseProvider = databaseProvider
    this.columnExists = columnExists
    this.repository = repository
    this.permissionLogs = permissionLogs
    this.clearPermissionCache = clearPermissionCache
    this.logger = logger
    this.now = now
  }

  parseFieldConfig(value, moduleKey) {
    if (!value) return { ...EMPTY_FIELD_CONFIG }

    let parsed
    try {
      parsed = typeof value === 'string' ? JSON.parse(value) : value
    } catch {
      this.logger.warn('解析 field_config 失败:', value)
      return { ...EMPTY_FIELD_CONFIG }
    }

    const normalized = normalizeFieldConfig(parsed)
    const fieldConfig = normalized || { ...EMPTY_FIELD_CONFIG }
    this.logger.debug(`🔍 解析字段配置 ${moduleKey}:`, fieldConfig)
    return fieldConfig
  }

  async getByRole(roleId, moduleKey) {
    const database = this.databaseProvider()
    const supportsRoleIsActive = await this.columnExists('roles', 'is_active', database)
    const role = await this.repository.findRole(database, roleId, supportsRoleIsActive)
    if (!role) return null

    const rows = await this.repository.listFieldPermissions(database, roleId, moduleKey)
    const fieldPermissions = {}

    if (rows.length === 0 && moduleKey) {
      fieldPermissions[moduleKey] = {
        module_key: moduleKey,
        module_name: moduleKey,
        field_config: { ...EMPTY_FIELD_CONFIG },
        created_at: this.now(),
        updated_at: this.now()
      }
    } else {
      for (const row of rows) {
        if (fieldPermissions[row.module_key]) continue
        fieldPermissions[row.module_key] = {
          module_key: row.module_key,
          module_name: row.module_key,
          field_config: this.parseFieldConfig(row.field_config, row.module_key),
          created_at: row.created_at,
          updated_at: row.updated_at
        }
      }
    }

    this.logger.debug(`📋 获取角色 ${roleId} 字段权限配置: ${Object.keys(fieldPermissions).length} 个模块`)
    return {
      role_id: parseInt(roleId),
      role_name: role.name,
      field_permissions: fieldPermissions,
      total_modules: Object.keys(fieldPermissions).length
    }
  }

  async saveForRole(roleId, moduleKey, fieldConfig, requestContext = null) {
    return withConnection(this.databaseProvider, async connection => {
      const supportsRoleIsActive = await this.columnExists('roles', 'is_active', connection)
      const supportsModuleIsActive = await this.columnExists('modules', 'is_active', connection)
      let transactionStarted = false
      try {
        await connection.beginTransaction()
        transactionStarted = true
        const role = await this.repository.findRoleForWrite(connection, roleId, supportsRoleIsActive, Boolean(requestContext))
        if (!role) throw Object.assign(new Error('角色不存在'), { statusCode: 404 })
        const module = await this.repository.findModuleForWrite(connection, moduleKey, supportsModuleIsActive, Boolean(requestContext))
        if (!module) throw Object.assign(new Error('模块不存在或已停用'), { statusCode: 400 })

        const existing = await this.repository.findExistingFieldPermission(connection, roleId, moduleKey, Boolean(requestContext))
        const previousConfig = this.parseFieldConfig(existing?.field_config, moduleKey)
        const serializedConfig = JSON.stringify(fieldConfig)
        if (existing) await this.repository.updateFieldPermission(connection, roleId, moduleKey, serializedConfig)
        else await this.repository.insertFieldPermission(connection, roleId, moduleKey, serializedConfig)
        await connection.commit()
        const result = { role_id: parseInt(roleId), module_key: moduleKey, field_config: fieldConfig, action: existing ? 'updated' : 'created' }
        if (requestContext) {
          this.clearPermissionCache()
          const previousHiddenFields = Array.isArray(previousConfig.hidden_fields) ? previousConfig.hidden_fields : []
          const hiddenFields = Array.isArray(fieldConfig.hidden_fields) ? fieldConfig.hidden_fields : []
          const addedHiddenFields = hiddenFields.filter(field => !previousHiddenFields.includes(field))
          const removedHiddenFields = previousHiddenFields.filter(field => !hiddenFields.includes(field))
          if (addedHiddenFields.length > 0 || removedHiddenFields.length > 0) {
            await this.permissionLogs.logPermissionOperation(
              requestContext,
              'permission',
              'role',
              roleId,
              role.name,
              `修改角色 ${role.name} 的字段权限：隐藏 ${addedHiddenFields.length} 项，恢复显示 ${removedHiddenFields.length} 项`,
              {
                audit_type: 'role_field_permissions',
                module_key: moduleKey,
                module_name: module.name || moduleKey,
                previous_hidden_fields: previousHiddenFields,
                hidden_fields: hiddenFields,
                added_count: addedHiddenFields.length,
                removed_count: removedHiddenFields.length,
                affected_modules_count: 1,
                module_changes: [{
                  module_key: moduleKey,
                  module_name: module.name || moduleKey,
                  added_permissions: addedHiddenFields,
                  removed_permissions: removedHiddenFields
                }]
              }
            )
          }
        }
        return result
      } catch (error) {
        if (transactionStarted) await connection.rollback()
        throw error
      }
    })
  }

  async saveBatchForRole(roleId, modulePermissions) {
    return withConnection(this.databaseProvider, async connection => {
      const supportsRoleIsActive = await this.columnExists('roles', 'is_active', connection)
      let transactionStarted = false
      try {
        await connection.beginTransaction()
        transactionStarted = true
        const role = await this.repository.findRoleForWrite(connection, roleId, supportsRoleIsActive)
        if (!role) throw Object.assign(new Error('角色不存在'), { statusCode: 404 })

        let updatedCount = 0
        let createdCount = 0
        for (const [moduleKey, rawFieldConfig] of Object.entries(modulePermissions)) {
          const fieldConfig = normalizeFieldConfig(rawFieldConfig)
          if (!moduleKey || !fieldConfig) throw new Error(`模块 ${moduleKey || '(empty)'} 的字段配置无效`)
          const module = await this.repository.findModuleForWrite(connection, moduleKey, true)
          if (!module) throw new Error(`模块不存在或已停用: ${moduleKey}`)
          const existing = await this.repository.findExistingFieldPermission(connection, roleId, moduleKey)
          const serializedConfig = JSON.stringify(fieldConfig)
          if (existing) {
            await this.repository.updateFieldPermission(connection, roleId, moduleKey, serializedConfig)
            updatedCount += 1
          } else {
            await this.repository.insertFieldPermission(connection, roleId, moduleKey, serializedConfig)
            createdCount += 1
          }
        }

        await connection.commit()
        return { role_id: parseInt(roleId), total_modules: Object.keys(modulePermissions).length, updated_count: updatedCount, created_count: createdCount }
      } catch (error) {
        if (transactionStarted) await connection.rollback()
        throw error
      }
    })
  }
}

module.exports = RoleFieldPermissionsService
