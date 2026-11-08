'use strict'

const { hasColumn } = require('./schema-inspector.service')
const PermissionUsersListRepository = require('../repositories/permission-users-list.repository')
const {
  PERMISSION_LIST_DEFAULT_PAGE_SIZE,
  PERMISSION_LIST_MAX_PAGE_SIZE
} = require('../config/permission-list.constants')

class PermissionUsersListService {
  constructor({ repository = new PermissionUsersListRepository(), columnExists = hasColumn } = {}) {
    this.repository = repository
    this.columnExists = columnExists
  }

  async list(query = {}) {
    const search = String(query.search || '').trim().slice(0, 100)
    const requestedRoleId = Number.parseInt(String(query.role_id || ''), 10)
    const normalizedPage = Number.parseInt(query.page, 10)
    const normalizedLimit = Number.parseInt(query.page_size, 10)
    const page = Number.isInteger(normalizedPage) && normalizedPage > 0 ? normalizedPage : 1
    const pageSize = Number.isInteger(normalizedLimit) && normalizedLimit > 0
      ? Math.min(normalizedLimit, PERMISSION_LIST_MAX_PAGE_SIZE)
      : PERMISSION_LIST_DEFAULT_PAGE_SIZE
    const requestedStoreId = Number.parseInt(String(query.store_id || ''), 10)
    const hasStore = String(query.has_store || '')
    const filters = {
      search,
      roleId: Number.isInteger(requestedRoleId) && requestedRoleId > 0 ? requestedRoleId : null,
      storeId: Number.isInteger(requestedStoreId) && requestedStoreId > 0 ? requestedStoreId : null,
      hasStore: hasStore === 'true' || hasStore === 'false' ? hasStore : null,
      page,
      pageSize,
      includeStores: query.include_stores === 'true' || query.include_stores === true
    }
    const [supportsUserStatus, supportsUserLastLogin] = await Promise.all([
      this.columnExists('users', 'status'),
      this.columnExists('users', 'last_login')
    ])
    const result = await this.repository.list({ ...filters, supportsUserStatus, supportsUserLastLogin })
    return {
      users: result.users,
      total: result.total,
      page,
      page_size: pageSize,
      total_pages: Math.ceil(result.total / pageSize),
      has_next: page * pageSize < result.total,
      has_prev: page > 1
    }
  }
}

module.exports = PermissionUsersListService
