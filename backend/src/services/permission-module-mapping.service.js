'use strict'

const { hasColumn } = require('./schema-inspector.service')
const PermissionModuleMappingRepository = require('../repositories/permission-module-mapping.repository')
const { mergeManagedModules } = require('../utils/managed-permission-modules')
const log = require('../utils/log')

const DEFAULT_MODULES = [
  { module_key: 'dashboard', key: 'dashboard', name: '仪表盘', category: 'system', icon: 'fas fa-tachometer-alt', field_count: 0 },
  { module_key: 'users', key: 'users', name: '用户管理', category: 'system', icon: 'fas fa-users', field_count: 0 },
  { module_key: 'roles', key: 'roles', name: '角色管理', category: 'system', icon: 'fas fa-user-tag', field_count: 0 },
  { module_key: 'permissions', key: 'permissions', name: '权限管理', category: 'system', icon: 'fas fa-shield-alt', field_count: 0 },
  { module_key: 'inventory', key: 'inventory', name: '库存管理', category: 'business', icon: 'fas fa-warehouse', field_count: 0 },
  { module_key: 'stock-in', key: 'stock-in', name: '入库管理', category: 'business', icon: 'fas fa-plus-circle', field_count: 0 },
  { module_key: 'sales', key: 'sales', name: '销售管理', category: 'business', icon: 'fas fa-dollar-sign', field_count: 0 },
  { module_key: 'query', key: 'query', name: '综合查询', category: 'business', icon: 'fas fa-search', field_count: 0 }
]

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
    const modules = mergeManagedModules(dbModules.length ? dbModules : DEFAULT_MODULES, 'key')
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
