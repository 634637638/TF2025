'use strict'

const UserManagementService = require('../services/user-management.service')
const ApiResponse = require('../utils/response')
const log = require('../utils/log')

class UserController {
  constructor({ service, logger = log, ...options } = {}) {
    this.service = service || new UserManagementService(options)
    this.logger = logger
  }

  async operators(req, res) {
    try {
      const result = await this.service.operators(req.user, req.query)
      return ApiResponse.success(res, result.data, result.message, 200, result.extra)
    } catch (error) {
      if (error.statusCode === 400) return ApiResponse.badRequest(res, error.message)
      if (error.statusCode === 500 && error.message === '数据库未连接') return ApiResponse.error(res, error.message, 500)
      if (error.statusCode === 403) return ApiResponse.error(res, error.message, 403)
      if (error.statusCode === 404) return ApiResponse.notFound(res, error.message)

      this.logger.error('获取操作员列表失败:', error)
      return ApiResponse.error(res, '获取操作员列表失败', 500)
    }
  }

  async employees(req, res) {
    try {
      const result = await this.service.employees(req.user, req.query)
      return ApiResponse.success(res, result.data, result.message, 200, result.extra)
    } catch (error) {
      if (error.statusCode === 400) return ApiResponse.badRequest(res, error.message)
      if (error.statusCode === 500 && error.message === '数据库未连接') return ApiResponse.error(res, error.message, 500)
      if (error.statusCode === 403) return ApiResponse.error(res, error.message, 403)
      if (error.statusCode === 404) return ApiResponse.notFound(res, error.message)

      this.logger.error('获取员工列表失败:', error)
      return ApiResponse.error(res, '获取员工列表失败', 500)
    }
  }

  async getById(req, res) {
    try {
      const result = await this.service.getById(req.params)
      return ApiResponse.success(res, result.data, result.message, 200, result.extra)
    } catch (error) {
      if (error.statusCode === 400) return ApiResponse.badRequest(res, error.message)
      if (error.statusCode === 500 && error.message === '数据库未连接') return ApiResponse.error(res, error.message, 500)
      if (error.statusCode === 403) return ApiResponse.error(res, error.message, 403)
      if (error.statusCode === 404) return ApiResponse.notFound(res, error.message)

      this.logger.error('获取用户详情失败:', error)
      return ApiResponse.error(res, '获取用户详情失败', 500)
    }
  }

  async profile(req, res) {
    try {
      const result = await this.service.profile(req.query)
      return ApiResponse.success(res, result.data, result.message, 200, result.extra)
    } catch (error) {
      if (error.statusCode === 400) return ApiResponse.badRequest(res, error.message)
      if (error.statusCode === 500 && error.message === '数据库未连接') return ApiResponse.error(res, error.message, 500)
      if (error.statusCode === 403) return ApiResponse.error(res, error.message, 403)
      if (error.statusCode === 404) return ApiResponse.notFound(res, error.message)

      this.logger.error('获取用户档案失败:', error)
      return ApiResponse.error(res, '获取用户档案失败', 500)
    }
  }

  async list(req, res) {
    try {
      const result = await this.service.list(req.query)
      return ApiResponse.success(res, result.data, result.message, 200, result.extra)
    } catch (error) {
      if (error.statusCode === 400) return ApiResponse.badRequest(res, error.message)
      if (error.statusCode === 500 && error.message === '数据库未连接') return ApiResponse.error(res, error.message, 500)
      if (error.statusCode === 403) return ApiResponse.error(res, error.message, 403)
      if (error.statusCode === 404) return ApiResponse.notFound(res, error.message)

      this.logger.error('获取用户列表失败:', error)
      return ApiResponse.error(res, '获取用户列表失败', 500)
    }
  }

  async create(req, res) {
    try {
      const result = await this.service.create(req.body)
      return ApiResponse.created(res, result.message, result.data)
    } catch (error) {
      if (error.statusCode === 400) return ApiResponse.badRequest(res, error.message)
      if (error.statusCode === 500 && error.message === '数据库未连接') return ApiResponse.error(res, error.message, 500)
      if (error.statusCode === 403) return ApiResponse.error(res, error.message, 403)
      if (error.statusCode === 404) return ApiResponse.notFound(res, error.message)

      if (error.statusCode === 400) return ApiResponse.badRequest(res, error.message)
      this.logger.error('创建用户失败:', error)
      return ApiResponse.serverError(res, '创建用户失败', error)
    }
  }

  async update(req, res) {
    try {
      const result = await this.service.update(req.params, req.body)
      return ApiResponse.success(res, result.data, result.message, 200, result.extra)
    } catch (error) {
      if (error.statusCode === 400) return ApiResponse.badRequest(res, error.message)
      if (error.statusCode === 500 && error.message === '数据库未连接') return ApiResponse.error(res, error.message, 500)
      if (error.statusCode === 403) return ApiResponse.error(res, error.message, 403)
      if (error.statusCode === 404) return ApiResponse.notFound(res, error.message)

      if (error.statusCode === 400) return ApiResponse.badRequest(res, error.message)
      this.logger.error('更新用户失败:', error)
      return ApiResponse.serverError(res, '更新用户失败', error)
    }
  }

  async remove(req, res) {
    try {
      const result = await this.service.remove(req.params)
      return ApiResponse.success(res, result.data, result.message, 200, result.extra)
    } catch (error) {
      if (error.statusCode === 400) return ApiResponse.badRequest(res, error.message)
      if (error.statusCode === 500 && error.message === '数据库未连接') return ApiResponse.error(res, error.message, 500)
      if (error.statusCode === 403) return ApiResponse.error(res, error.message, 403)
      if (error.statusCode === 404) return ApiResponse.notFound(res, error.message)

      this.logger.error('删除用户失败:', error)
      return ApiResponse.serverError(res, '删除用户失败', error)
    }
  }

  async toggle(req, res) {
    try {
      const result = await this.service.toggle(req.params)
      return ApiResponse.success(res, result.data, result.message, 200, result.extra)
    } catch (error) {
      if (error.statusCode === 400) return ApiResponse.badRequest(res, error.message)
      if (error.statusCode === 500 && error.message === '数据库未连接') return ApiResponse.error(res, error.message, 500)
      if (error.statusCode === 403) return ApiResponse.error(res, error.message, 403)
      if (error.statusCode === 404) return ApiResponse.notFound(res, error.message)

      this.logger.error('切换用户状态失败:', error)
      return ApiResponse.serverError(res, '切换用户状态失败', error)
    }
  }
}

module.exports = UserController
