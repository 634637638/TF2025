'use strict'

const UserStoreService = require('../services/user-store.service')
const ApiResponse = require('../utils/response')
const log = require('../utils/log')

class UserStoreController {
  constructor({ service, logger = log, ...options } = {}) {
    this.service = service || new UserStoreService(options)
    this.logger = logger
  }

  async getUserStores(req, res) {
    try {
      const result = await this.service.getUserStores(req.params)
      return ApiResponse.success(res, result.data, result.message, 200, result.extra)
    } catch (error) {
      if (error.statusCode === 400) return ApiResponse.badRequest(res, error.message)
      if (error.statusCode === 404) return ApiResponse.notFound(res, error.message)

      this.logger.error('获取用户门店列表失败:', error)
      return ApiResponse.error(res, '获取用户门店列表失败', 500)
    }
  }

  async getStoreUsers(req, res) {
    try {
      const result = await this.service.getStoreUsers(req.params)
      return ApiResponse.success(res, result.data, result.message, 200, result.extra)
    } catch (error) {
      if (error.statusCode === 400) return ApiResponse.badRequest(res, error.message)
      if (error.statusCode === 404) return ApiResponse.notFound(res, error.message)

      this.logger.error('获取门店用户列表失败:', error)
      return ApiResponse.error(res, '获取门店用户列表失败', 500)
    }
  }

  async assignStores(req, res) {
    try {
      const result = await this.service.assignStores(req.user, req.body, { user: req.user, ip: req.ip, connection: { remoteAddress: req.connection?.remoteAddress } })
      return ApiResponse.success(res, result.data, result.message, 200, result.extra)
    } catch (error) {
      if (error.statusCode === 400) return ApiResponse.badRequest(res, error.message)
      if (error.statusCode === 404) return ApiResponse.notFound(res, error.message)

      this.logger.error('关联用户门店失败:', error)
      return ApiResponse.error(res, '关联用户门店失败', 500)
    }
  }

  async setPrimaryStore(req, res) {
    try {
      const result = await this.service.setPrimaryStore(req.body, { user: req.user, ip: req.ip, connection: { remoteAddress: req.connection?.remoteAddress } })
      return ApiResponse.success(res, result.data, result.message, 200, result.extra)
    } catch (error) {
      if (error.statusCode === 400) return ApiResponse.badRequest(res, error.message)
      if (error.statusCode === 404) return ApiResponse.notFound(res, error.message)

      this.logger.error('设置用户主门店失败:', error)
      return ApiResponse.error(res, '设置用户主门店失败', 500)
    }
  }

  async removeStore(req, res) {
    try {
      const result = await this.service.removeStore(req.body, { user: req.user, ip: req.ip, connection: { remoteAddress: req.connection?.remoteAddress } })
      return ApiResponse.success(res, result.data, result.message, 200, result.extra)
    } catch (error) {
      if (error.statusCode === 400) return ApiResponse.badRequest(res, error.message)
      if (error.statusCode === 404) return ApiResponse.notFound(res, error.message)

      this.logger.error('移除用户门店关联失败:', error)
      return ApiResponse.error(res, '移除用户门店关联失败', 500)
    }
  }

  async removeAllStores(req, res) {
    try {
      const result = await this.service.removeAllStores(req.params, { user: req.user, ip: req.ip, connection: { remoteAddress: req.connection?.remoteAddress } })
      return ApiResponse.success(res, result.data, result.message, 200, result.extra)
    } catch (error) {
      if (error.statusCode === 400) return ApiResponse.badRequest(res, error.message)
      if (error.statusCode === 404) return ApiResponse.notFound(res, error.message)

      this.logger.error('移除用户所有门店关联失败:', error)
      return ApiResponse.error(res, '移除用户所有门店关联失败', 500)
    }
  }
}

module.exports = UserStoreController
