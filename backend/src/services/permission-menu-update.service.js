'use strict'

const { getDatabase } = require('../config/database')
const { hasColumn, hasTable } = require('./schema-inspector.service')
const { getRoleMenuVisibility } = require('./access-control.service')
const PermissionChangeAuditService = require('./permission-change-audit.service')
const PermissionLogsService = require('./permission-logs.service')
const { normalizeManagedModuleKey } = require('../utils/managed-permission-modules')
const PermissionMenuUpdateRepository = require('../repositories/permission-menu-update.repository')

const visibilityMapToMenuPermissionRows = (visibility = {}) => {
  if (visibility instanceof Map) {
    return Array.from(visibility.entries()).filter(([, visible]) => Boolean(visible)).map(([moduleKey]) => ({
      module_key: normalizeManagedModuleKey(moduleKey), permission_type: 'menu_view'
    })).filter(permission => permission.module_key)
  }
  if (Array.isArray(visibility)) {
    return visibility.filter(item => item && (item.menu_visible === true || item.menu_visible === 1 || item.visible === true || item.visible === 1)).map(item => ({
      module_key: normalizeManagedModuleKey(item.module_key || item.key), permission_type: 'menu_view'
    })).filter(permission => permission.module_key)
  }
  if (visibility && typeof visibility === 'object') {
    return Object.entries(visibility).filter(([, visible]) => Boolean(visible)).map(([moduleKey]) => ({
      module_key: normalizeManagedModuleKey(moduleKey), permission_type: 'menu_view'
    })).filter(permission => permission.module_key)
  }
  return []
}

class PermissionMenuUpdateService {
  constructor({
    repository = new PermissionMenuUpdateRepository(),
    databaseProvider = getDatabase,
    columnExists = hasColumn,
    tableExists = hasTable,
    visibilityReader = getRoleMenuVisibility,
    auditService = new PermissionChangeAuditService(),
    permissionLogs = new PermissionLogsService()
  } = {}) {
    this.repository = repository
    this.databaseProvider = databaseProvider
    this.columnExists = columnExists
    this.tableExists = tableExists
    this.visibilityReader = visibilityReader
    this.auditService = auditService
    this.permissionLogs = permissionLogs
  }

  async update(roleId, menuPermissions, request) {
    const database = await this.databaseProvider()
    return this.repository.withConnection(database, async connection => {
      await connection.query('START TRANSACTION')
      try {
        const role = await this.repository.findRole(connection, roleId)
        if (!role) throw new Error('角色不存在')
        const normalized = menuPermissions
          .filter(permission => permission && permission.module_key)
          .map(permission => ({
            module_key: normalizeManagedModuleKey(permission.module_key),
            menu_visible: permission.menu_visible ? 1 : 0
          }))
        const schema = {
          moduleIsActive: await this.columnExists('modules', 'is_active', connection),
          rolePermissionMenuVisible: await this.columnExists('role_permissions', 'menu_visible', connection),
          rolePermissionModuleId: await this.columnExists('role_permissions', 'module_id', connection),
          rolePermissionCreatedAt: await this.columnExists('role_permissions', 'created_at', connection),
          visibilityTable: await this.tableExists('role_menu_visibility', connection)
        }
        if (schema.visibilityTable) {
          [schema.visibilityCreatedAt, schema.visibilityUpdatedAt] = await Promise.all([
            this.columnExists('role_menu_visibility', 'created_at', connection),
            this.columnExists('role_menu_visibility', 'updated_at', connection)
          ])
        }
        const modules = await this.repository.listModuleIds(connection, schema.moduleIsActive)
        const moduleIdMap = new Map(modules.map(module => [module.key, module.id]))
        const previous = visibilityMapToMenuPermissionRows(await this.visibilityReader(roleId, connection))
        await this.repository.replaceRoleMenuPermissions(connection, roleId, normalized, moduleIdMap, schema)
        if (schema.visibilityTable) {
          await this.repository.replaceMenuVisibility(connection, roleId, normalized, schema)
        }
        const next = normalized.filter(permission => permission.menu_visible === 1).map(permission => ({
          module_key: permission.module_key, permission_type: 'menu_view'
        }))
        const auditDetails = await this.auditService.build(connection, previous, next, 'role_menu_permissions')
        await connection.query('COMMIT')
        if (auditDetails.added_count > 0 || auditDetails.removed_count > 0) {
          await this.permissionLogs.logPermissionModification(request, roleId, role.name, next, auditDetails)
        }
        return { receivedCount: normalized.length }
      } catch (error) {
        await connection.query('ROLLBACK')
        throw error
      }
    })
  }
}

module.exports = PermissionMenuUpdateService
