'use strict'

const UserRolesRepository = require('../repositories/user-roles.repository')
const { hasColumn } = require('./schema-inspector.service')

class UserRolesService {
  constructor({ repository = new UserRolesRepository(), inspectColumn = hasColumn } = {}) {
    this.repository = repository
    this.inspectColumn = inspectColumn
  }

  async getUserRoles(userId) {
    const result = await this.repository.getUserRoles(userId)
    return result.exists ? result.roles : null
  }

  async listRoles({ search, page, pageSize }) {
    const [supportsRoleCode, supportsRoleIsActive] = await Promise.all([
      this.inspectColumn('roles', 'code'),
      this.inspectColumn('roles', 'is_active')
    ])
    return this.repository.listRoles({
      search,
      page,
      pageSize,
      supportsRoleCode,
      supportsRoleIsActive
    })
  }
}

module.exports = UserRolesService
