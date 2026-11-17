'use strict'

const { getDatabase } = require('../config/database')
const { getActiveUserRoles } = require('./access-control.service')
const { normalizeStoredFieldConfig, resolveQueryGoodsFieldConfigs } = require('../utils/field-permission-normalizer')
const UserFieldPermissionsRepository = require('../repositories/user-field-permissions.repository')
const log = require('../utils/log')

class UserFieldPermissionsService {
  constructor({
    databaseProvider = getDatabase,
    getActiveRoles = getActiveUserRoles,
    repository = new UserFieldPermissionsRepository(),
    logger = log
  } = {}) {
    this.databaseProvider = databaseProvider
    this.getActiveRoles = getActiveRoles
    this.repository = repository
    this.logger = logger
  }

  parseFieldConfig(row) {
    try {
      return normalizeStoredFieldConfig(row)
    } catch {
      this.logger.warn('解析用户字段权限配置失败:', { moduleKey: row.module_key, roleId: row.role_id })
      return null
    }
  }

  async getForUser(userId, moduleKey) {
    const database = this.databaseProvider()
    const roles = await this.getActiveRoles(userId, database)
    if (roles.length === 0) {
      return { user_id: userId, roles: [], field_permissions: {} }
    }

    const roleIds = roles.map(role => role.role_id)
    const rows = await this.repository.listRoleFieldPermissions(database, roleIds, moduleKey === 'query_goods' ? undefined : moduleKey)
    const merged = {}
    const readonlyFields = new Map()
    const editableScopes = new Set()

    for (const row of rows) {
      const normalized = this.parseFieldConfig(row)
      if (!normalized) continue
      const fieldConfig = normalized.config
      if (!merged[row.module_key]) {
        merged[row.module_key] = {
          module_key: row.module_key,
          hidden_fields: new Set(),
          editable_fields: new Set(),
          role_sources: []
        }
        readonlyFields.set(row.module_key, new Set())
      }

      if (normalized.hasEditableScope) editableScopes.add(row.module_key)
      const permission = merged[row.module_key]
      for (const field of fieldConfig.hidden_fields || []) permission.hidden_fields.add(field)
      for (const field of fieldConfig.editable_fields || []) permission.editable_fields.add(field)
      for (const field of normalized.readonlyFields) readonlyFields.get(row.module_key).add(field)

      const role = roles.find(item => item.role_id === row.role_id)
      if (role) permission.role_sources.push({ role_id: role.role_id, role_name: role.role_name })
    }

    for (const permission of Object.values(merged)) {
      const readonly = Array.from(readonlyFields.get(permission.module_key))
      if (readonly.length) permission.readonly_fields = readonly
      if (editableScopes.has(permission.module_key)) permission.has_editable_scope = true
      permission.hidden_fields = Array.from(permission.hidden_fields)
      permission.editable_fields = Array.from(permission.editable_fields).filter(field =>
        !permission.hidden_fields.includes(field) && !readonlyFields.get(permission.module_key).has(field))
    }

    // 虚拟字段入口只用于商品查询，存储与动作仍归综合查询，不创建额外页面权限。
    if ((!moduleKey || moduleKey === 'query_goods') && rows.some(row =>
      ['query_queryview', 'accessories_accessoriesview'].includes(row.module_key))) {
      const configs = resolveQueryGoodsFieldConfigs(rows)
      const hidden = new Set(), editable = new Set(), readonly = new Set()
      let hasEditableScope = false
      for (const { normalized } of configs) {
        for (const field of normalized.config.hidden_fields || []) hidden.add(field)
        for (const field of normalized.config.editable_fields || []) editable.add(field)
        for (const field of normalized.readonlyFields) readonly.add(field)
        hasEditableScope ||= normalized.hasEditableScope
      }
      merged.query_goods = {
        module_key: 'query_goods', hidden_fields: [...hidden],
        editable_fields: [...editable].filter(field => !hidden.has(field) && !readonly.has(field)),
        ...(readonly.size ? { readonly_fields: [...readonly] } : {}),
        ...(hasEditableScope ? { has_editable_scope: true } : {}),
        role_sources: roles.filter(role => configs.some(row => row.role_id === role.role_id))
          .map(role => ({ role_id: role.role_id, role_name: role.role_name }))
      }
      if (moduleKey === 'query_goods') {
        for (const key of Object.keys(merged)) if (key !== moduleKey) delete merged[key]
      }
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
