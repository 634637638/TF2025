'use strict'

const { hasColumn } = require('./schema-inspector.service')
const PermissionListRepository = require('../repositories/permission-list.repository')

class PermissionListService {
  constructor({ repository = new PermissionListRepository(), columnExists = hasColumn } = {}) {
    this.repository = repository
    this.columnExists = columnExists
  }

  async list() {
    const [supportsModuleIsActive, supportsRolePermissionCreatedAt] = await Promise.all([
      this.columnExists('modules', 'is_active'),
      this.columnExists('role_permissions', 'created_at')
    ])
    return this.repository.list({ supportsModuleIsActive, supportsRolePermissionCreatedAt })
  }
}

module.exports = PermissionListService
