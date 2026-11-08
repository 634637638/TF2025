'use strict'

const EmployeeRoleService = require('../services/employee-role.service')
const ApiResponse = require('../utils/response')
const log = require('../utils/log')

class EmployeeRoleController {
  constructor({ service, logger = log, ...options } = {}) {
    this.service = service || new EmployeeRoleService(options)
    this.logger = logger
  }

  async systemRoles(req, res) {
    try {
      const result = await this.service.systemRoles()
      return ApiResponse.success(res, result.data, result.message, 200, result.extra)
    } catch (error) {
      if (error.statusCode === 400) return ApiResponse.badRequest(res, error.message)
      if (error.statusCode === 404) return ApiResponse.notFound(res, error.message)

      this.logger.error('获取系统角色列表失败:', error)
      return ApiResponse.serverError(res, '获取系统角色列表失败', error)
    }
  }

  async list(req, res) {
    try {
      const result = await this.service.list()
      return ApiResponse.success(res, result.data, result.message, 200, result.extra)
    } catch (error) {
      if (error.statusCode === 400) return ApiResponse.badRequest(res, error.message)
      if (error.statusCode === 404) return ApiResponse.notFound(res, error.message)

      this.logger.error('获取角色列表失败:', error)
      return ApiResponse.serverError(res, '获取角色列表失败', error)
    }
  }

  async create(req, res) {
    try {
      const result = await this.service.create(req.body)
      return ApiResponse.created(res, result.message, result.data)
    } catch (error) {
      if (error.statusCode === 400) return ApiResponse.badRequest(res, error.message)
      if (error.statusCode === 404) return ApiResponse.notFound(res, error.message)

      this.logger.error('创建角色失败:', error)
      return ApiResponse.serverError(res, '创建角色失败', error)
    }
  }

  async update(req, res) {
    try {
      const result = await this.service.update(req.params, req.body)
      return ApiResponse.success(res, result.data, result.message, 200, result.extra)
    } catch (error) {
      if (error.statusCode === 400) return ApiResponse.badRequest(res, error.message)
      if (error.statusCode === 404) return ApiResponse.notFound(res, error.message)

      this.logger.error('更新角色失败:', error)
      return ApiResponse.serverError(res, '更新角色失败', error)
    }
  }

  async delete(req, res) {
    try {
      const result = await this.service.delete(req.params)
      return ApiResponse.success(res, result.data, result.message, 200, result.extra)
    } catch (error) {
      if (error.statusCode === 400) return ApiResponse.badRequest(res, error.message)
      if (error.statusCode === 404) return ApiResponse.notFound(res, error.message)

      this.logger.error('删除角色失败:', error)
      return ApiResponse.serverError(res, '删除角色失败', error)
    }
  }

  async assign(req, res) {
    try {
      const result = await this.service.assign(req.params, req.body)
      return ApiResponse.success(res, result.data, result.message, 200, result.extra)
    } catch (error) {
      if (error.statusCode === 400) return ApiResponse.badRequest(res, error.message)
      if (error.statusCode === 404) return ApiResponse.notFound(res, error.message)

      this.logger.error('分配角色失败:', error)
      return ApiResponse.serverError(res, '分配角色失败', error)
    }
  }

  async remove(req, res) {
    try {
      const result = await this.service.remove(req.params)
      return ApiResponse.success(res, result.data, result.message, 200, result.extra)
    } catch (error) {
      if (error.statusCode === 400) return ApiResponse.badRequest(res, error.message)
      if (error.statusCode === 404) return ApiResponse.notFound(res, error.message)

      this.logger.error('移除角色失败:', error)
      return ApiResponse.serverError(res, '移除角色失败', error)
    }
  }
}

module.exports = EmployeeRoleController
