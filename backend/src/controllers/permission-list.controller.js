'use strict'

const log = require('../utils/log')
const PermissionListService = require('../services/permission-list.service')

class PermissionListController {
  constructor({ service = new PermissionListService(), logger = log } = {}) {
    this.service = service
    this.logger = logger
  }

  async list(_req, res) {
    try {
      const permissions = await this.service.list()
      return res.json({
        success: true,
        message: '获取权限列表成功',
        data: { total: permissions.length, permissions }
      })
    } catch (error) {
      this.logger.error('获取权限列表失败:', error)
      return res.status(500).json({
        success: false,
        message: '获取权限列表失败: ' + error.message,
        data: []
      })
    }
  }
}

module.exports = PermissionListController
