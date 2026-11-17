'use strict'

const { getDatabase } = require('../config/database')
const { hasColumn } = require('./schema-inspector.service')
const { normalizeFieldConfig, normalizeStoredFieldConfig, resolveQueryGoodsFieldConfigs } = require('../utils/field-permission-normalizer')
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
    if (value === undefined) return { ...EMPTY_FIELD_CONFIG }

    let parsed
    try {
      parsed = typeof value === 'string' ? JSON.parse(value) : value
    } catch {
      this.logger.warn('解析 field_config 失败:', { moduleKey })
      throw new Error('字段权限配置无效')
    }

    const normalized = normalizeFieldConfig(parsed, { strict: true })
    if (!normalized) throw new Error('字段权限配置无效')
    const fieldConfig = normalized || { ...EMPTY_FIELD_CONFIG }
    this.logger.debug(`🔍 解析字段配置 ${moduleKey}:`, fieldConfig)
    return fieldConfig
  }

  async getByRole(roleId, moduleKey, fieldScope) {
    this.validateFieldScope(moduleKey, fieldScope)
    const database = this.databaseProvider()
    const supportsRoleIsActive = await this.columnExists('roles', 'is_active', database)
    const role = await this.repository.findRole(database, roleId, supportsRoleIsActive)
    if (!role) return null

    const rows = await this.repository.listFieldPermissions(database, roleId, moduleKey)
    const fieldPermissions = {}
    if (fieldScope === 'goods') {
      const config = await this.getGoodsConfig(database, roleId, rows)
      return { role_id: parseInt(roleId), role_name: role.name, total_modules: 1,
        field_permissions: { [moduleKey]: { module_key: moduleKey, field_scope: 'goods', field_config: config } } }
    }

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

  validateFieldScope(moduleKey, fieldScope) {
    if (fieldScope !== undefined && (fieldScope !== 'goods' || moduleKey !== 'query_queryview')) {
      throw Object.assign(new Error('字段页面范围无效'), { statusCode: 400 })
    }
  }

  async getGoodsConfig(database, roleId, queryRows = []) {
    const legacy = await this.repository.listFieldPermissions(database, roleId, 'accessories_accessoriesview')
    const configs = resolveQueryGoodsFieldConfigs([...queryRows, ...legacy].map(row => ({ ...row, role_id: roleId })))
    const config = { hidden_fields: [...new Set(configs.flatMap(row => row.normalized.config.hidden_fields || []))] }
    if (configs.some(row => row.normalized.hasEditableScope)) {
      config.editable_fields = [...new Set(configs.flatMap(row => row.normalized.config.editable_fields || []))]
    }
    const readonly = [...new Set(configs.flatMap(row => row.normalized.readonlyFields))]
    if (readonly.length) config.readonly_fields = readonly
    return config
  }

  async saveForRole(roleId, moduleKey, fieldConfig, requestContext = null, fieldScope) {
    this.validateFieldScope(moduleKey, fieldScope)
    if (!normalizeFieldConfig(fieldConfig, { strict: true })) throw Object.assign(new Error('字段配置格式错误'), { statusCode: 400 })
    if (fieldScope && (!normalizeFieldConfig(fieldConfig, { strict: true }) || Object.hasOwn(fieldConfig, 'scopes'))) {
      throw Object.assign(new Error('商品字段配置无效'), { statusCode: 400 })
    }
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

        const existing = await this.repository.findExistingFieldPermission(connection, roleId, moduleKey, true)
        const previousConfig = existing
          ? normalizeStoredFieldConfig(existing, { strict: true })?.config
          : { ...EMPTY_FIELD_CONFIG }
        if (!previousConfig) throw new Error('原字段权限配置无效，不能覆盖')
        const selectedPreviousConfig = fieldScope
          ? previousConfig.scopes?.[fieldScope] || await this.getGoodsConfig(connection, roleId)
          : previousConfig
        const storedConfig = fieldScope
          ? { ...previousConfig, scopes: { ...previousConfig.scopes, [fieldScope]: { ...selectedPreviousConfig, ...fieldConfig } } }
          : { ...previousConfig, ...fieldConfig, ...(previousConfig.scopes ? { scopes: previousConfig.scopes } : {}) }
        const serializedConfig = JSON.stringify(storedConfig)
        if (existing) await this.repository.updateFieldPermission(connection, roleId, moduleKey, serializedConfig)
        else await this.repository.insertFieldPermission(connection, roleId, moduleKey, serializedConfig)
        await connection.commit()
        const result = { role_id: parseInt(roleId), module_key: moduleKey, field_config: fieldConfig, action: existing ? 'updated' : 'created' }
        if (requestContext) {
          this.clearPermissionCache()
          const previousHiddenFields = Array.isArray(selectedPreviousConfig.hidden_fields) ? selectedPreviousConfig.hidden_fields : []
          const nextConfig = fieldScope ? storedConfig.scopes[fieldScope] : storedConfig
          const hiddenFields = nextConfig.hidden_fields || []
          const writeChanges = {}
          for (const key of ['readonly_fields', 'editable_fields']) {
            const before = selectedPreviousConfig[key]
            const after = nextConfig[key]
            if (JSON.stringify(before) !== JSON.stringify(after)) {
              writeChanges[`previous_${key}`] = before ?? null
              writeChanges[key] = after ?? null
            }
          }
          const addedHiddenFields = hiddenFields.filter(field => !previousHiddenFields.includes(field))
          const removedHiddenFields = previousHiddenFields.filter(field => !hiddenFields.includes(field))
          if (addedHiddenFields.length > 0 || removedHiddenFields.length > 0 || Object.keys(writeChanges).length) {
            await this.permissionLogs.logPermissionOperation(
              requestContext,
              'permission',
              'role',
              roleId,
              role.name,
              `修改角色 ${role.name} 的字段权限：隐藏 ${addedHiddenFields.length} 项，恢复显示 ${removedHiddenFields.length} 项${Object.keys(writeChanges).length ? '，调整字段编辑范围' : ''}`,
              {
                audit_type: 'role_field_permissions',
                ...writeChanges,
                ...(fieldScope ? { field_scope: fieldScope } : {}),
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
          let fieldConfig = normalizeFieldConfig(rawFieldConfig, { strict: true })
          if (!moduleKey || !fieldConfig) throw new Error(`模块 ${moduleKey || '(empty)'} 的字段配置无效`)
          const module = await this.repository.findModuleForWrite(connection, moduleKey, true)
          if (!module) throw new Error(`模块不存在或已停用: ${moduleKey}`)
          const existing = await this.repository.findExistingFieldPermission(connection, roleId, moduleKey, true)
          if (existing) {
            const previous = existing.field_config === undefined
              ? { ...EMPTY_FIELD_CONFIG }
              : normalizeStoredFieldConfig(existing, { strict: true })?.config
            if (!previous) throw new Error('原字段权限配置无效，不能覆盖')
            fieldConfig = { ...previous, ...fieldConfig, ...(previous.scopes ? { scopes: previous.scopes } : {}) }
          }
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
