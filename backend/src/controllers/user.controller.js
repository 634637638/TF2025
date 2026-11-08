'use strict'

const ApiResponse = require('../utils/response')
const { isSuperAdmin: defaultIsSuperAdmin } = require('../middleware/unified-auth')
const UserRepository = require('../repositories/user.repository')
const { searchOperators: defaultSearchOperators } = require('../services/operator-search.service')
const { getDatabase: defaultGetDatabase, isConnected: defaultIsConnected } = require('../config/database')
const {
  getAttendanceAccessScope: defaultGetAttendanceAccessScope,
  hasUserPermission: defaultHasUserPermission
} = require('../services/access-control.service')
const log = require('../utils/log')
const UserMutationService = require('../services/user-mutation.service')

class UserController {
  constructor({
    userRepository = new UserRepository(),
    searchOperators = defaultSearchOperators,
    isSuperAdmin = defaultIsSuperAdmin,
    getDatabase = defaultGetDatabase,
    isConnected = defaultIsConnected,
    getAttendanceAccessScope = defaultGetAttendanceAccessScope,
    hasUserPermission = defaultHasUserPermission,
    passwordHasher = (password, rounds) => require('bcryptjs').hash(password, rounds),
    logger = log,
    mutationService
  } = {}) {
    this.userRepository = userRepository
    this.searchOperators = searchOperators
    this.isSuperAdmin = isSuperAdmin
    this.getDatabase = getDatabase
    this.isConnected = isConnected
    this.getAttendanceAccessScope = getAttendanceAccessScope
    this.hasUserPermission = hasUserPermission
    this.mutationService = mutationService || new UserMutationService({ database: getDatabase, passwordHasher })
    this.logger = logger
  }

  selectPublicUser(connection, filters) { return this.mutationService.selectPublicUser(connection, filters) }

  async operators(req, res) {
    try {
      const result = await this.searchOperators({
        user: req.user,
        superAdmin: this.isSuperAdmin(req.user),
        keyword: req.query.keyword,
        page: req.query.page,
        page_size: req.query.page_size,
        store_id: req.query.store_id,
        status: req.query.status,
        strict_scope: req.query.strict_scope,
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

      return ApiResponse.success(
        res,
        formattedOperators,
        '获取操作员列表成功',
        200,
        result.usePagination ? { pagination: result.pagination } : {}
      )
    } catch (error) {
      this.logger.error('获取操作员列表失败:', error)
      return ApiResponse.error(res, '获取操作员列表失败', 500)
    }
  }

  async employees(req, res) {
    try {
      const {
        status = '1',
        keyword = '',
        page,
        page_size: pageSizeParam,
        store_id: storeIdParam,
        strict_scope: strictScopeParam = false
      } = req.query
      const userId = req.user.id

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
        return ApiResponse.error(res, 'store_id 参数无效', 400)
      }

      const userStoreIds = Array.isArray(req.user?.store_ids)
        ? req.user.store_ids.map(Number).filter(id => Number.isInteger(id) && id > 0)
        : []
      const superAdmin = this.isSuperAdmin(req.user)
      const strictStoreScope = strictScopeParam === 'true' || strictScopeParam === true
      const scopedStoreIds = requestedStoreId === null ? userStoreIds : [requestedStoreId]
      if (strictStoreScope && !superAdmin && requestedStoreId !== null && !userStoreIds.includes(requestedStoreId)) {
        return ApiResponse.error(res, '无权访问该门店员工', 403)
      }

      const usePagination = page !== undefined || pageSizeParam !== undefined || normalizedKeyword !== ''
      const pageInt = Math.max(1, Number.parseInt(String(page || 1), 10) || 1)
      const pageSizeInt = Math.min(100, Math.max(1, Number.parseInt(String(pageSizeParam || 50), 10) || 50))
      const whereParts = ['u.status = ?']
      const whereParams = [status]

      if (normalizedKeyword) {
        whereParts.push('(u.name LIKE ? OR u.username LIKE ? OR u.phone LIKE ?)')
        const pattern = `%${normalizedKeyword}%`
        whereParams.push(pattern, pattern, pattern)
      }

      if (strictStoreScope && !superAdmin) {
        if (scopedStoreIds.length === 0) {
          whereParts.push('1 = 0')
        } else {
          const placeholders = scopedStoreIds.map(() => '?').join(',')
          whereParts.push(`(u.store_id IN (${placeholders}) OR EXISTS (SELECT 1 FROM user_stores scope_us WHERE scope_us.user_id = u.id AND scope_us.store_id IN (${placeholders})))`)
          whereParams.push(...scopedStoreIds, ...scopedStoreIds)
        }
      } else if (strictStoreScope && requestedStoreId !== null) {
        whereParts.push('(u.store_id = ? OR EXISTS (SELECT 1 FROM user_stores scope_us WHERE scope_us.user_id = u.id AND scope_us.store_id = ?))')
        whereParams.push(requestedStoreId, requestedStoreId)
      }

      const db = this.getDatabase()
      const whereSql = whereParts.join(' AND ')
      let users
      let total = 0
      if (isAdmin) {
        const countResult = await db.execute(`SELECT COUNT(*) AS total FROM users u WHERE ${whereSql}`, whereParams)
        total = Number(countResult[0][0]?.total || 0)
        const paginationSql = usePagination ? ` LIMIT ${pageSizeInt} OFFSET ${(pageInt - 1) * pageSizeInt}` : ''
        ;[users] = await db.execute(
          `SELECT u.id, u.username, u.name, u.status,
                  EXISTS (SELECT 1 FROM salary_templates st WHERE st.id = u.salary_template_id) AS has_salary_template
           FROM users u
           WHERE ${whereSql}
           ORDER BY COALESCE(NULLIF(u.name, ''), u.username) ASC, u.id ASC${paginationSql}`,
          whereParams
        )
      } else {
        ;[users] = await db.execute(
          `SELECT u.id, u.username, u.name, u.status,
                  EXISTS (SELECT 1 FROM salary_templates st WHERE st.id = u.salary_template_id) AS has_salary_template
           FROM users u
           WHERE u.id = ? AND ${whereSql}`,
          [userId, ...whereParams]
        )
        total = users.length
      }

      const employees = users.map(user => ({
        id: user.id,
        name: user.name || user.username,
        username: user.username,
        status: user.status,
        has_salary_template: Boolean(user.has_salary_template)
      }))

      return ApiResponse.success(res, {
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
      }, '获取员工列表成功')
    } catch (error) {
      this.logger.error('获取员工列表失败:', error)
      return ApiResponse.error(res, '获取员工列表失败', 500)
    }
  }

  async getById(req, res) {
    try {
      const user = await this.userRepository.findUserDetailsById(req.params.id)
      if (!user) return ApiResponse.error(res, '用户不存在', 404)
      return ApiResponse.success(res, user, '获取用户详情成功')
    } catch (error) {
      this.logger.error('获取用户详情失败:', error)
      return ApiResponse.error(res, '获取用户详情失败', 500)
    }
  }

  async profile(req, res) {
    try {
      const { username } = req.query
      if (!username) return ApiResponse.error(res, '用户名不能为空', 400)

      const user = await this.userRepository.findUserDetailsByUsername(username)
      if (!user || Number(user.status) !== 1) {
        return ApiResponse.error(res, '用户不存在或已禁用', 404)
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

      return ApiResponse.success(res, userProfile, '获取用户档案成功')
    } catch (error) {
      this.logger.error('获取用户档案失败:', error)
      return ApiResponse.error(res, '获取用户档案失败', 500)
    }
  }

  async list(req, res) {
    try {
      const { page = 1, page_size, role, status = '1' } = req.query
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

      return ApiResponse.success(res, {
        users: formattedUsers,
        pagination: {
          page: pageInt,
          page_size: pageSizeInt,
          total: result.pagination.total,
          total_pages: result.pagination.total_pages,
          has_next: result.pagination.has_next,
          has_prev: result.pagination.has_prev
        }
      }, '获取用户列表成功')
    } catch (error) {
      this.logger.error('获取用户列表失败:', error)
      return ApiResponse.error(res, '获取用户列表失败', 500)
    }
  }

  async create(req, res) {
    try {
      if (!this.isConnected()) return ApiResponse.error(res, '数据库未连接', 500)
      const result = await this.mutationService.create(req.body)
      if (result.notFound) return ApiResponse.notFound(res, '用户不存在')
      return ApiResponse.created(res, '用户创建成功', result.user)
    } catch (error) {
      if (error.statusCode === 400) return ApiResponse.badRequest(res, error.message)
      this.logger.error('创建用户失败:', error)
      return ApiResponse.serverError(res, '创建用户失败', error)
    }
  }

  async update(req, res) {
    try {
      if (!this.isConnected()) return ApiResponse.error(res, '数据库未连接', 500)
      const result = await this.mutationService.update(req.params.id, req.body)
      if (result.notFound) return ApiResponse.notFound(res, '用户不存在')
      return ApiResponse.success(res, result.user, '用户更新成功')
    } catch (error) {
      if (error.statusCode === 400) return ApiResponse.badRequest(res, error.message)
      this.logger.error('更新用户失败:', error)
      return ApiResponse.serverError(res, '更新用户失败', error)
    }
  }

  async remove(req, res) {
    try {
      if (!this.isConnected()) return ApiResponse.error(res, '数据库未连接', 500)

      const { id } = req.params
      const pool = this.getDatabase()
      const userId = Number.parseInt(id, 10)
      const existingUser = await this.selectPublicUser(pool, { id: userId })
      if (!existingUser) return ApiResponse.notFound(res, '用户不存在')

      await pool.execute('DELETE FROM users WHERE id = ?', [userId])
      return ApiResponse.success(res, existingUser, '用户删除成功')
    } catch (error) {
      this.logger.error('删除用户失败:', error)
      return ApiResponse.serverError(res, '删除用户失败', error)
    }
  }

  async toggle(req, res) {
    try {
      if (!this.isConnected()) return ApiResponse.error(res, '数据库未连接', 500)

      const { id } = req.params
      const pool = this.getDatabase()
      const userId = Number.parseInt(id, 10)
      const existingUser = await this.selectPublicUser(pool, { id: userId })
      if (!existingUser) return ApiResponse.notFound(res, '用户不存在')

      const newStatus = Number(existingUser.status) === 1 ? 0 : 1
      await pool.execute(
        'UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [newStatus, userId]
      )
      const updatedUser = await this.selectPublicUser(pool, { id: userId })
      const statusText = newStatus === 1 ? '启用' : '禁用'
      return ApiResponse.success(res, updatedUser, `用户${statusText}成功`)
    } catch (error) {
      this.logger.error('切换用户状态失败:', error)
      return ApiResponse.serverError(res, '切换用户状态失败', error)
    }
  }
}

module.exports = UserController
