'use strict'

const { getDatabase } = require('../config/database')
const { hasColumn } = require('./schema-inspector.service')
const { normalizeFieldConfig } = require('../utils/field-permission-normalizer')
const UserFieldPermissionsRepository = require('../repositories/user-field-permissions.repository')
const log = require('../utils/log')

const EMPTY_FIELD_CONFIG = { hidden_fields: [] }

class UserFieldPermissionsService {
  constructor({
    databaseProvider = getDatabase,
    columnExists = hasColumn,
    repository = new UserFieldPermissionsRepository(),
    logger = log
  } = {}) {
    this.databaseProvider = databaseProvider
    this.columnExists = columnExists
    this.repository = repository
    this.logger = logger
  }

  parseFieldConfig(value, moduleKey) {
    if (value === null || value === undefined) return { ...EMPTY_FIELD_CONFIG }

    try {
      const parsed = typeof value === 'string' ? JSON.parse(value || '{}') : value
      return normalizeFieldConfig(parsed) || { ...EMPTY_FIELD_CONFIG }
    } catch (error) {
      this.logger.warn(`解析用户字段权限配置失败: ${moduleKey}`, error)
      return null
    }
  }

  async getForUser(userId, moduleKey) {
    const database = this.databaseProvider()
    const supportsRoleIsActive = await this.columnExists('roles', 'is_active', database)
    const roles = await this.repository.listUserRoles(database, userId, supportsRoleIsActive)
    if (roles.length === 0) {
      return { user_id: userId, roles: [], field_permissions: {} }
    }

    const roleIds = roles.map(role => role.role_id)
    const rows = await this.repository.listRoleFieldPermissions(database, roleIds, moduleKey)
    const merged = {}

    for (const row of rows) {
      const fieldConfig = this.parseFieldConfig(row.field_config, row.module_key)
      if (!fieldConfig) continue
      if (!merged[row.module_key]) {
        merged[row.module_key] = {
          module_key: row.module_key,
          hidden_fields: new Set(),
          editable_fields: new Set(),
          role_sources: []
        }
      }

      const permission = merged[row.module_key]
      for (const field of fieldConfig.hidden_fields || []) permission.hidden_fields.add(field)
      for (const field of fieldConfig.editable_fields || []) permission.editable_fields.add(field)

      const role = roles.find(item => item.role_id === row.role_id)
      if (role) permission.role_sources.push({ role_id: role.role_id, role_name: role.role_name })
    }

    for (const permission of Object.values(merged)) {
      permission.hidden_fields = Array.from(permission.hidden_fields)
      permission.editable_fields = Array.from(permission.editable_fields)
    }

    return {
      user_id: userId,
      roles: roles.map(role => ({ role_id: role.role_id, role_name: role.role_name })),
      field_permissions: merged,
      total_modules: Object.keys(merged).length
    }
  }
}

module.exports = UserFieldPermissionsService
