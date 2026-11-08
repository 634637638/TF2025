'use strict'

const log = require('../utils/log')
const UserRolesService = require('../services/user-roles.service')
const {
  PERMISSION_LIST_DEFAULT_PAGE_SIZE,
  PERMISSION_LIST_MAX_PAGE_SIZE
} = require('../config/permission-list.constants')

class UserRolesController {
  constructor({ service = new UserRolesService(), logger = log } = {}) {
    this.service = service
    this.logger = logger
  }

  async getUserRoles(req, res) {
    try {
      const userRoles = await this.service.getUserRoles(req.params.id)
      if (userRoles === null) {
        return res.status(404).json({ success: false, message: '用户不存在' })
      }
      return res.json({ success: true, message: '获取用户角色成功', data: userRoles })
    } catch (error) {
      this.logger.error('获取用户角色失败:', error)
      return res.status(500).json({
        success: false,
        message: '获取用户角色失败: ' + error.message
      })
    }
  }

  async listRoles(req, res) {
    try {
      const search = String(req.query.search || '').trim().slice(0, 100)
      const normalizedPage = Number.parseInt(req.query.page, 10)
      const normalizedLimit = Number.parseInt(req.query.page_size, 10)
      const page = Number.isInteger(normalizedPage) && normalizedPage > 0 ? normalizedPage : 1
      const pageSize = Number.isInteger(normalizedLimit) && normalizedLimit > 0
        ? Math.min(normalizedLimit, PERMISSION_LIST_MAX_PAGE_SIZE)
        : PERMISSION_LIST_DEFAULT_PAGE_SIZE
      const result = await this.service.listRoles({ search, page, pageSize })

      return res.json({
        success: true,
        message: '获取角色列表成功',
        data: {
          roles: result.roles,
          total: result.total,
          page,
          page_size: pageSize,
          total_pages: Math.ceil(result.total / pageSize),
          has_next: page * pageSize < result.total,
          has_prev: page > 1
        }
      })
    } catch (error) {
      this.logger.error('获取角色列表失败:', error)
      return res.status(500).json({
        success: false,
        message: '获取角色列表失败: ' + error.message,
        data: {
          roles: [],
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

module.exports = UserRolesController
