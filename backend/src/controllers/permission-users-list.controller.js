'use strict'

const log = require('../utils/log')
const PermissionUsersListService = require('../services/permission-users-list.service')

class PermissionUsersListController {
  constructor({ service = new PermissionUsersListService(), logger = log } = {}) {
    this.service = service
    this.logger = logger
  }

  async list(req, res) {
    try {
      const result = await this.service.list(req.query)
      return res.json({
        success: true,
        message: '获取用户角色列表成功',
        data: result
      })
    } catch (error) {
      this.logger.error('获取用户角色列表失败:', error)
      return res.status(500).json({
        success: false,
        message: '获取用户角色列表失败: ' + error.message,
        data: {
          users: [],
          total: 0,
          page: 1,
          page_size: 10,
          total_pages: 0,
          has_next: false,
          has_prev: false
        }
      })
    }
  }
}

module.exports = PermissionUsersListController
