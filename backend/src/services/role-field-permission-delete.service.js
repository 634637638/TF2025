'use strict'

const { clearCache } = require('../middleware/cache')
const RoleFieldPermissionDeleteRepository = require('../repositories/role-field-permission-delete.repository')

class RoleFieldPermissionDeleteService {
  constructor({ repository = new RoleFieldPermissionDeleteRepository(), invalidateCache = clearCache } = {}) {
    this.repository = repository
    this.invalidateCache = invalidateCache
  }

  async remove(roleId, moduleKey) {
    const deletedCount = await this.repository.delete(roleId, moduleKey)
    this.invalidateCache()
    return deletedCount
  }
}

module.exports = RoleFieldPermissionDeleteService
