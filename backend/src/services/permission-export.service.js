'use strict'

const { hasColumn } = require('./schema-inspector.service')
const PermissionExportRepository = require('../repositories/permission-export.repository')

class PermissionExportService {
  constructor({ repository = new PermissionExportRepository(), columnExists = hasColumn, clock = () => new Date() } = {}) {
    this.repository = repository
    this.columnExists = columnExists
    this.clock = clock
  }

  async export(format = 'json') {
    const [supportsRoleIsActive, supportsModuleIsActive] = await Promise.all([
      this.columnExists('roles', 'is_active'),
      this.columnExists('modules', 'is_active')
    ])
    const rows = await this.repository.getPermissions({ supportsRoleIsActive, supportsModuleIsActive })
    const config = {
      export_time: this.clock().toISOString(),
      version: '1.0',
      roles: {}
    }

    for (const row of rows) {
      config.roles[row.role_name] ||= { modules: {} }
      config.roles[row.role_name].modules[row.module_key] ||= {
        module_name: row.module_name,
        permissions: []
      }
      config.roles[row.role_name].modules[row.module_key].permissions.push(row.permission_type)
    }

    if (format !== 'csv') return { format: 'json', body: config }
    const csvRows = [['角色', '模块', '权限类型']]
    for (const roleName of Object.keys(config.roles)) {
      for (const moduleKey of Object.keys(config.roles[roleName].modules)) {
        const module = config.roles[roleName].modules[moduleKey]
        for (const permission of module.permissions) {
          csvRows.push([roleName, module.module_name, permission])
        }
      }
    }
    return { format: 'csv', body: csvRows.map(row => row.join(',')).join('\n') }
  }
}

module.exports = PermissionExportService
