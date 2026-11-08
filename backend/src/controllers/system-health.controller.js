'use strict'

const ApiResponse = require('../utils/response')
const log = require('../utils/log')
const SystemHealthService = require('../services/system-health.service')

class SystemHealthController {
  constructor({ service = new SystemHealthService() } = {}) {
    this.service = service
  }

  async getStats(_req, res) {
    try {
      const result = await this.service.getStats()
      if (result.unavailable) return ApiResponse.error(res, '数据库未连接', 503)
      return ApiResponse.success(res, result.stats)
    } catch (error) {
      log.error('获取系统统计失败:', error)
      return ApiResponse.error(res, '获取系统统计失败', 500)
    }
  }

  async getStatus(_req, res) {
    try {
      const status = await this.service.getStatus()
      return ApiResponse.success(res, status)
    } catch (error) {
      log.error('获取系统状态失败:', error)
      return ApiResponse.error(res, '获取系统状态失败', 500)
    }
  }
}

module.exports = SystemHealthController
