'use strict'

const log = require('../utils/log')
const PermissionStatisticsService = require('../services/permission-statistics.service')

class PermissionStatisticsController {
  constructor({ service = new PermissionStatisticsService(), logger = log } = {}) {
    this.service = service
    this.logger = logger
  }

  async getStats(req, res) {
    try {
      const data = await this.service.getStats()
      return res.json({ success: true, message: '获取权限统计成功', data })
    } catch (error) {
      this.logger.error('获取权限统计失败:', error)
      return res.status(500).json({ success: false, message: '获取权限统计失败: ' + error.message })
    }
  }

  async getOverview(req, res) {
    try {
      const data = await this.service.getOverview()
      return res.json({ success: true, message: '获取权限统计成功', data })
    } catch (error) {
      this.logger.error('获取权限统计失败:', error)
      return res.status(500).json({ success: false, message: '获取权限统计失败: ' + error.message })
    }
  }
}

module.exports = PermissionStatisticsController
