'use strict'

const { getModulePermissionMetadata, normalizePermissionType } = require('../config/module-permission-actions')
const { normalizeManagedModuleKey } = require('../utils/managed-permission-modules')
const PermissionChangeAuditRepository = require('../repositories/permission-change-audit.repository')

class PermissionChangeAuditService {
  constructor({ repository = new PermissionChangeAuditRepository() } = {}) {
    this.repository = repository
  }

  normalizePermissions(rows = []) {
    const permissionMap = new Map()
    rows.forEach(row => {
      const moduleKey = normalizeManagedModuleKey(row?.module_key)
      const permissionType = normalizePermissionType(row?.permission_type)
      if (!moduleKey || !permissionType || moduleKey === 'undefined' || permissionType === 'undefined') return
      permissionMap.set(`${moduleKey}:${permissionType}`, {
        module_key: moduleKey,
        permission_type: permissionType
      })
    })
    return Array.from(permissionMap.values()).sort((a, b) => (
      a.module_key.localeCompare(b.module_key) || a.permission_type.localeCompare(b.permission_type)
    ))
  }

  async build(database, previousRows, nextRows, auditType = 'role_action_permissions') {
    const previousPermissions = this.normalizePermissions(previousRows)
    const permissions = this.normalizePermissions(nextRows)
    const previousSet = new Set(previousPermissions.map(item => `${item.module_key}:${item.permission_type}`))
    const nextSet = new Set(permissions.map(item => `${item.module_key}:${item.permission_type}`))
    const addedPermissions = permissions.filter(item => !previousSet.has(`${item.module_key}:${item.permission_type}`))
    const removedPermissions = previousPermissions.filter(item => !nextSet.has(`${item.module_key}:${item.permission_type}`))
    const moduleKeys = Array.from(new Set([...previousPermissions, ...permissions].map(item => item.module_key)))
    const moduleRows = await this.repository.getModuleNames(database, moduleKeys)
    const moduleNameMap = new Map(moduleRows.map(module => [module.key, module.name || module.key]))

    moduleKeys.forEach(moduleKey => {
      if (!moduleNameMap.has(moduleKey)) {
        const metadata = getModulePermissionMetadata(moduleKey) || {}
        moduleNameMap.set(moduleKey, metadata.name || moduleKey)
      }
    })

    const withModuleName = item => ({
      ...item,
      module_name: moduleNameMap.get(item.module_key) || item.module_key
    })
    const affectedModuleKeys = Array.from(new Set(
      [...addedPermissions, ...removedPermissions].map(item => item.module_key)
    ))
    const moduleChanges = affectedModuleKeys.map(moduleKey => ({
      module_key: moduleKey,
      module_name: moduleNameMap.get(moduleKey) || moduleKey,
      added_permissions: addedPermissions.filter(item => item.module_key === moduleKey).map(item => item.permission_type),
      removed_permissions: removedPermissions.filter(item => item.module_key === moduleKey).map(item => item.permission_type)
    })).sort((a, b) => a.module_name.localeCompare(b.module_name, 'zh-CN'))

    return {
      audit_type: auditType,
      previous_permissions_count: previousPermissions.length,
      permissions_count: permissions.length,
      added_count: addedPermissions.length,
      removed_count: removedPermissions.length,
      affected_modules_count: affectedModuleKeys.length,
      previous_permissions: previousPermissions.map(withModuleName),
      permissions: permissions.map(withModuleName),
      added_permissions: addedPermissions.map(withModuleName),
      removed_permissions: removedPermissions.map(withModuleName),
      module_changes: moduleChanges
    }
  }
}

module.exports = PermissionChangeAuditService
