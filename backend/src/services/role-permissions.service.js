'use strict'

const { invalidateAuthProfiles } = require('../middleware/unified-auth')

const { getDatabase } = require('../config/database')
const { getModulePermissionTypes, normalizePermissionType, MODULE_PERMISSION_METADATA } = require('../config/module-permission-actions')
const { hasColumn } = require('./schema-inspector.service')
const { mergeManagedModules, normalizeManagedModuleKey } = require('../utils/managed-permission-modules')
const RolePermissionsRepository = require('../repositories/role-permissions.repository')
const PermissionChangeAuditService = require('./permission-change-audit.service')
const { permissionCache } = require('../config/redis')
const PermissionLogsService = require('./permission-logs.service')
const { ENSURED_PERMISSION_MODULE_KEYS } = require('../utils/managed-permission-modules')
const { sortModulesByMenu } = require('../utils/menu-hierarchy')

const FALLBACK_MODULES = Object.entries(MODULE_PERMISSION_METADATA).map(([moduleKey, metadata]) => ({
  module_key: moduleKey,
  module_name: metadata.name,
  module_description: metadata.description,
  module_category: metadata.category,
  permission_type: 'view'
}))

class RolePermissionsService {
  constructor({
    databaseProvider = getDatabase,
    columnExists = hasColumn,
    repository = new RolePermissionsRepository(),
    auditService = new PermissionChangeAuditService(),
    permissionCacheService = permissionCache,
    permissionLogs = new PermissionLogsService(),
    moduleScannerFactory = () => {
      const ModuleScanner = require('./module-scanner.service')
      return new ModuleScanner()
    },
    mergeModules = mergeManagedModules,
    permissionTypesForModule = getModulePermissionTypes,
    normalizeModuleKey = normalizeManagedModuleKey,
    normalizeType = normalizePermissionType,
    logger = require('../utils/log')
  } = {}) {
    this.databaseProvider = databaseProvider
    this.columnExists = columnExists
    this.repository = repository
    this.auditService = auditService
    this.permissionCache = permissionCacheService
    this.permissionLogs = permissionLogs
    this.moduleScannerFactory = moduleScannerFactory
    this.mergeModules = mergeModules
    this.permissionTypesForModule = permissionTypesForModule
    this.normalizeModuleKey = normalizeModuleKey
    this.normalizeType = normalizeType
    this.logger = logger
  }

  async getModules(database, supportsModuleIsActive) {
    const rawModules = await this.repository.listModules(database, supportsModuleIsActive)
    const databaseModules = this.mergeModules(rawModules)
    if (rawModules.length > 0) {
      return { rawModules, modules: databaseModules }
    }

    try {
      const scannedModules = await this.moduleScannerFactory().scanViewsDirectory()
      const modules = this.mergeModules(scannedModules.map(module => ({
        module_key: module.key,
        module_name: module.name || module.key,
        module_description: module.description || '',
        module_category: module.category || 'scanned',
        permission_type: 'view'
      })))
      this.logger.debug(`数据库中没有模块，从扫描中获取了 ${modules.length} 个模块`)
      return { rawModules, modules }
    } catch (error) {
      this.logger.warn('模块扫描失败，使用备用权限列表:', error.message)
      return { rawModules, modules: this.mergeModules(FALLBACK_MODULES) }
    }
  }

  buildRoleModulePermissions(modules, rows) {
    const assigned = new Set(rows.map(permission => {
      const moduleKey = this.normalizeModuleKey(permission.module_key)
      const permissionType = this.normalizeType(permission.permission_type)
      return `${moduleKey}:${permissionType}`
    }))
    const moduleMap = new Map()

    for (const permission of modules) {
      const key = permission.module_key
      if (!moduleMap.has(key)) {
        moduleMap.set(key, {
          module_key: key,
          name: permission.module_name || key,
          description: permission.module_description || '',
          category: permission.module_category || 'unknown',
          permissions: []
        })
      }

      for (const type of this.permissionTypesForModule(key)) {
        moduleMap.get(key).permissions.push({
          type,
          permission_type: type,
          assigned: assigned.has(`${key}:${type}`)
        })
      }
    }

    return Array.from(moduleMap.values())
  }

  async getByRole(roleId) {
    const database = this.databaseProvider()
    const supportsModuleIsActive = await this.columnExists('modules', 'is_active', database)
    const role = await this.repository.findRole(database, roleId)
    if (!role) return null

    const { rawModules, modules } = await this.getModules(database, supportsModuleIsActive)
    const rolePermissions = await this.repository.listRolePermissions(database, roleId)
    const menus = await this.repository.listMenuOrder(database)
    const resultModules = sortModulesByMenu(this.buildRoleModulePermissions(modules, rolePermissions), menus, this.normalizeModuleKey)
    const message = rawModules.length === 0
      ? `获取角色权限成功（显示 ${modules.length} 个扫描到的模块，建议先在模块管理中同步模块到数据库）`
      : `获取角色权限成功（显示 ${modules.length} 个数据库中的模块）`

    return {
      modules: resultModules,
      message,
      meta: {
        total_modules: resultModules.length,
        from_database: rawModules.length > 0,
        db_module_count: rawModules.length,
        scanned_module_count: modules.length
      }
    }
  }

  async clearAllActionPermissions(roleId, requestContext) {
    const database = this.databaseProvider()
    const role = await this.repository.findRole(database, roleId)
    if (!role) return null

    const previousPermissions = await this.repository.listActionPermissions(database, roleId)
    const deletedCount = await this.repository.deleteActionPermissions(database, roleId)
    const auditDetails = await this.auditService.build(database, previousPermissions, [])
    if (auditDetails.removed_count > 0) {
      await this.permissionLogs.logPermissionModification(
        requestContext,
        roleId,
        role.name,
        [],
        { ...auditDetails, batch_action: 'clear_all' }
      )
    }
    const users = await this.repository.listUsersWithRole(database, roleId)

    for (const user of users) {
      invalidateAuthProfiles([user.user_id])
      await this.permissionCache.deleteUserPermissions(user.user_id)
      this.logger.debug(`已清除用户 ${user.user_id} 的权限缓存（角色 ${roleId} 清除权限）`)
    }

    return { role, deletedCount, auditDetails }
  }

  async updateActionPermissions(roleId, permissions, requestContext) {
    const database = this.databaseProvider()
    const role = await this.repository.findRole(database, roleId)
    if (!role) return null

    const previousPermissions = await this.repository.listActionPermissions(database, roleId)
    const validPermissions = this.auditService.normalizePermissions(Array.isArray(permissions) ? permissions : [])
    await this.repository.deleteActionPermissions(database, roleId)
    await this.repository.replaceActionPermissions(database, roleId, validPermissions)
    if (validPermissions.length > 0) {
      this.logger.debug(`成功为角色 ${roleId} 更新了 ${validPermissions.length} 个权限（保留原有菜单权限）`)
    }

    const auditDetails = await this.auditService.build(database, previousPermissions, validPermissions)
    if (auditDetails.added_count > 0 || auditDetails.removed_count > 0) {
      await this.permissionLogs.logPermissionModification(
        requestContext,
        roleId,
        role.name,
        validPermissions,
        auditDetails
      )
    }

    const users = await this.repository.listUsersWithRole(database, roleId)
    for (const user of users) {
      invalidateAuthProfiles([user.user_id])
      await this.permissionCache.deleteUserPermissions(user.user_id)
      this.logger.debug(`已清除用户 ${user.user_id} 的权限缓存（角色 ${role.name} 权限变更）`)
    }

    return { role }
  }

  async selectAllActionPermissions(roleId, requestContext) {
    const database = this.databaseProvider()
    const supportsModuleIsActive = await this.columnExists('modules', 'is_active', database)
    const role = await this.repository.findRole(database, roleId)
    if (!role) return null

    const previousPermissions = await this.repository.listActionPermissions(database, roleId)
    const databaseModuleKeys = await this.repository.listPermissionModuleKeys(database, supportsModuleIsActive)
    let moduleKeys = databaseModuleKeys
    if (databaseModuleKeys.length === 0) {
      try {
        const scannedModules = await this.moduleScannerFactory().scanViewsDirectory()
        moduleKeys = scannedModules.map(module => module.key)
        this.logger.debug(`数据库中没有模块，从扫描中获取了 ${moduleKeys.length} 个模块用于全选权限`)
      } catch (error) {
        this.logger.warn('模块扫描失败，无法分配权限:', error.message)
        throw Object.assign(
          new Error('无法获取模块列表，请先在模块管理中同步模块到数据库'),
          { code: 'PERMISSION_MODULE_SCAN_FAILED' }
        )
      }
    }

    const allModules = Array.from(new Set([...moduleKeys, ...ENSURED_PERMISSION_MODULE_KEYS]))
    const permissions = []
    for (const moduleKey of allModules) {
      if (!moduleKey || moduleKey === 'undefined') {
        this.logger.warn(`跳过无效的模块key: ${moduleKey}`)
        continue
      }
      for (const permissionType of this.permissionTypesForModule(moduleKey)) {
        permissions.push({
          module_key: this.normalizeModuleKey(moduleKey),
          permission_type: this.normalizeType(permissionType)
        })
      }
    }

    await this.repository.deleteActionPermissions(database, roleId)
    await this.repository.replaceActionPermissions(database, roleId, permissions)
    const auditDetails = await this.auditService.build(database, previousPermissions, permissions)
    if (auditDetails.added_count > 0 || auditDetails.removed_count > 0) {
      await this.permissionLogs.logPermissionModification(
        requestContext,
        roleId,
        role.name,
        permissions,
        { ...auditDetails, batch_action: 'select_all' }
      )
    }

    const users = await this.repository.listUsersWithRole(database, roleId)
    for (const user of users) {
      invalidateAuthProfiles([user.user_id])
      await this.permissionCache.deleteUserPermissions(user.user_id)
      this.logger.debug(`已清除用户 ${user.user_id} 的权限缓存（角色 ${roleId} 全选权限）`)
    }

    return { role, modulesCount: allModules.length, permissionsCount: permissions.length }
  }
}

module.exports = RolePermissionsService
