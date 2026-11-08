'use strict'

const { getDatabase } = require('../config/database')
const { hasColumn } = require('./schema-inspector.service')
const { getRoleMenuVisibility } = require('./access-control.service')
const PermissionMenuRepository = require('../repositories/permission-menu.repository')

class PermissionMenuService {
  constructor({
    repository = new PermissionMenuRepository(),
    databaseProvider = getDatabase,
    columnExists = hasColumn,
    visibilityReader = getRoleMenuVisibility
  } = {}) {
    this.repository = repository
    this.databaseProvider = databaseProvider
    this.columnExists = columnExists
    this.visibilityReader = visibilityReader
  }

  async getByRole(roleId) {
    const database = await this.databaseProvider()
    const supportsModuleIsActive = await this.columnExists('modules', 'is_active', database)
    const modules = await this.repository.listModules(database, supportsModuleIsActive)
    const visibility = await this.visibilityReader(roleId, database)
    return modules.map(module => ({
      module_key: module.module_key,
      module_name: module.module_name,
      menu_visible: visibility[module.module_key] ? 1 : 0,
      category: module.category,
      icon: module.icon,
      description: module.module_description || ''
    }))
  }
}

module.exports = PermissionMenuService
