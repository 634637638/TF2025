'use strict'

const { hasColumn } = require('./schema-inspector.service')
const PermissionModuleMappingRepository = require('../repositories/permission-module-mapping.repository')
const { mergeManagedModules, normalizeManagedModuleKey } = require('../utils/managed-permission-modules')
const { sortModulesByMenu } = require('../utils/menu-hierarchy')
const log = require('../utils/log')


class PermissionModuleMappingService {
  constructor({ repository = new PermissionModuleMappingRepository(), columnExists = hasColumn, logger = log } = {}) {
    this.repository = repository
    this.columnExists = columnExists
    this.logger = logger
  }

  async list() {
    const supportsModuleIsActive = await this.columnExists('modules', 'is_active')
    const dbModules = await this.repository.list({ supportsModuleIsActive })
    if (dbModules.length === 0) this.logger.warn('数据库中没有已注册的模块，使用默认模块列表')
    const menus = await this.repository.listMenuOrder()
    const modules = sortModulesByMenu(mergeManagedModules(dbModules, 'key'), menus, normalizeManagedModuleKey)
    return modules.map(module => ({
      module_key: module.module_key,
      key: module.key,
      name: module.name,
      category: module.category,
      icon: module.icon,
      field_count: module.field_count || 0
    }))
  }
}

module.exports = PermissionModuleMappingService
