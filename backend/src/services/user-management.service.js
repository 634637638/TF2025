'use strict'

const { isSuperAdmin: defaultIsSuperAdmin } = require('../middleware/unified-auth')
const UserManagementRepository = require('../repositories/user-management.repository')
const UserRepository = require('../repositories/user.repository')
const { searchOperators: defaultSearchOperators } = require('./operator-search.service')
const { getDatabase: defaultGetDatabase, isConnected: defaultIsConnected } = require('../config/database')
const {
  getAttendanceAccessScope: defaultGetAttendanceAccessScope,
  hasUserPermission: defaultHasUserPermission
} = require('./access-control.service')
const UserMutationService = require('./user-mutation.service')
const BaseService = require('../core/base/base.service')

class UserManagementService extends BaseService {
  selectPublicUser(connection, filters) { return this.mutationService.selectPublicUser(connection, filters) }

  constructor({
    userRepository = new UserRepository(),
    searchOperators = defaultSearchOperators,
    isSuperAdmin = defaultIsSuperAdmin,
    getDatabase = defaultGetDatabase,
    isConnected = defaultIsConnected,
    getAttendanceAccessScope = defaultGetAttendanceAccessScope,
    hasUserPermission = defaultHasUserPermission,
    passwordHasher = (password, rounds) => require('bcryptjs').hash(password, rounds),
    mutationService
  } = {}) {
    super()
    this.employeeRepository = new UserManagementRepository({ database: getDatabase })
    this.userRepository = userRepository
    this.searchOperators = searchOperators
    this.isSuperAdmin = isSuperAdmin
    this.getDatabase = getDatabase
    this.isConnected = isConnected
    this.getAttendanceAccessScope = getAttendanceAccessScope
    this.hasUserPermission = hasUserPermission
    this.mutationService = mutationService || new UserMutationService({ database: getDatabase, passwordHasher })
  }

  async operators(actor, query) {
    
    const result = await this.searchOperators({
      user: actor,
      superAdmin: this.isSuperAdmin(actor),
      keyword: query.keyword,
      page: query.page,
      page_size: query.page_size,
      store_id: query.store_id,
      status: query.status,
      strict_scope: query.strict_scope,
      includeDetails: true
    })
    const formattedOperators = result.records.map(user => ({
      id: user.id,
      name: user.name || user.username,
      username: user.username,
      phone: user.phone,
      salary_template_id: user.salary_template_id,
      role: user.role_name,
      role_codes: user.role_codes ? user.role_codes.split(', ') : []
    }))

    return { data: formattedOperators, message: '获取操作员列表成功', extra: result.usePagination ? { pagination: result.pagination } : {} }
  }

  async employees(actor, query) {
    
    const {
      status = '1',
      keyword = '',
      page,
      page_size: pageSizeParam,
      store_id: storeIdParam,
      strict_scope: strictScopeParam = false
    } = query
    const userId = this.getActorId(actor)

    const [attendanceScope, hasQueryPermission] = await Promise.all([
      this.getAttendanceAccessScope(userId),
      this.hasUserPermission(userId, 'query_queryview', 'view')
    ])
    const isAdmin = attendanceScope.isAdmin || hasQueryPermission
    const normalizedKeyword = String(keyword || '').trim()
    const requestedStoreId = storeIdParam === undefined || storeIdParam === ''
      ? null
      : Number(storeIdParam)
    if (requestedStoreId !== null && (!Number.isInteger(requestedStoreId) || requestedStoreId <= 0)) {
      throw this.createError('store_id 参数无效', 400)
    }

    const userStoreIds = Array.isArray(actor?.store_ids)
      ? actor.store_ids.map(Number).filter(id => Number.isInteger(id) && id > 0)
      : []
    const superAdmin = this.isSuperAdmin(actor)
    const strictStoreScope = strictScopeParam === 'true' || strictScopeParam === true
    const scopedStoreIds = requestedStoreId === null ? userStoreIds : [requestedStoreId]
    if (strictStoreScope && !superAdmin && requestedStoreId !== null && !userStoreIds.includes(requestedStoreId)) {
      throw this.createError('无权访问该门店员工', 403)
    }

    const usePagination = page !== undefined || pageSizeParam !== undefined || normalizedKeyword !== ''
    const pageInt = Math.max(1, Number.parseInt(String(page || 1), 10) || 1)
    const pageSizeInt = Math.min(100, Math.max(1, Number.parseInt(String(pageSizeParam || 50), 10) || 50))
    const { users, total } = await this.employeeRepository.listEmployees({
      status, normalizedKeyword, strictStoreScope, superAdmin, scopedStoreIds, requestedStoreId, isAdmin, usePagination, pageSizeInt, pageInt, userId
    })

    const employees = users.map(user => ({
      id: user.id,
      name: user.name || user.username,
      username: user.username,
      status: user.status,
      has_salary_template: Boolean(user.has_salary_template)
    }))

    return { data: {
      employees,
      total: usePagination ? total : employees.length,
      pagination: usePagination ? {
        page: pageInt,
        page_size: pageSizeInt,
        total,
        total_pages: Math.ceil(total / pageSizeInt),
        has_next: pageInt * pageSizeInt < total,
        has_prev: pageInt > 1
      } : undefined,
      is_admin: isAdmin
    }, message: '获取员工列表成功' }
  }

  async getById(params) {
    
    const user = await this.userRepository.findUserDetailsById(params.id)
    if (!user) throw this.createError('用户不存在', 404)
    return { data: user, message: '获取用户详情成功' }
  }

  async profile(query) {
    
    const { username } = query
    if (!username) throw this.createError('用户名不能为空', 400)

    const user = await this.userRepository.findUserDetailsByUsername(username)
    if (!user || Number(user.status) !== 1) {
      throw this.createError('用户不存在或已禁用', 404)
    }

    const userProfile = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      status: user.status,
      email: user.email,
      phone: user.phone,
      store_id: user.store_id,
      salary_template_id: user.salary_template_id,
      role_ids: user.role_ids,
      created_at: user.created_at,
      updated_at: user.updated_at
    }

    return { data: userProfile, message: '获取用户档案成功' }
  }

  async list(query) {
    
    const { page = 1, page_size, role, status = '1' } = query
    const pageInt = Math.max(1, parseInt(page, 10) || 1)
    const pageSizeInt = Math.min(1000, Math.max(1, parseInt(page_size, 10) || 1000))
    const offset = (pageInt - 1) * pageSizeInt
    const result = await this.userRepository.getUsers(
      { role, status },
      { page: pageInt, page_size: pageSizeInt, offset }
    )
    const formattedUsers = result.data.map(user => ({
      id: user.id,
      name: user.name || user.username,
      username: user.username,
      role: user.role,
      status: user.status,
      store_id: user.store_id || null
    }))

    return { data: {
      users: formattedUsers,
      pagination: {
        page: pageInt,
        page_size: pageSizeInt,
        total: result.pagination.total,
        total_pages: result.pagination.total_pages,
        has_next: result.pagination.has_next,
        has_prev: result.pagination.has_prev
      }
    }, message: '获取用户列表成功' }
  }

  async create(body) {
    
    if (!this.isConnected()) throw this.createError('数据库未连接', 500)
    const result = await this.mutationService.create(body)
    if (result.notFound) throw this.createError('用户不存在', 404)
    return { data: result.user, message: '用户创建成功' }
  }

  async update(params, body) {
    
    if (!this.isConnected()) throw this.createError('数据库未连接', 500)
    const result = await this.mutationService.update(params.id, body)
    if (result.notFound) throw this.createError('用户不存在', 404)
    return { data: result.user, message: '用户更新成功' }
  }

  async remove(params) {
    
    if (!this.isConnected()) throw this.createError('数据库未连接', 500)

    const { id } = params
    const pool = this.getDatabase()
    const userId = Number.parseInt(id, 10)
    const existingUser = await this.selectPublicUser(pool, { id: userId })
    if (!existingUser) throw this.createError('用户不存在', 404)

    await this.employeeRepository.remove(userId)
    return { data: existingUser, message: '用户删除成功' }
  }

  async toggle(params) {
    
    if (!this.isConnected()) throw this.createError('数据库未连接', 500)

    const { id } = params
    const pool = this.getDatabase()
    const userId = Number.parseInt(id, 10)
    const existingUser = await this.selectPublicUser(pool, { id: userId })
    if (!existingUser) throw this.createError('用户不存在', 404)

    const newStatus = Number(existingUser.status) === 1 ? 0 : 1
    await this.employeeRepository.setStatus(userId, newStatus)
    const updatedUser = await this.selectPublicUser(pool, { id: userId })
    const statusText = newStatus === 1 ? '启用' : '禁用'
    return { data: updatedUser, message: `用户${statusText}成功` }
  }
}

module.exports = UserManagementService
