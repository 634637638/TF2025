'use strict'

const log = require('../utils/log')
const PermissionRoleManagementService = require('../services/permission-role-management.service')

class PermissionRoleManagementController {
  constructor({ service = new PermissionRoleManagementService(), logger = log } = {}) {
    this.service = service
    this.logger = logger
  }

  async create(req, res) {
    try {
      const role = await this.service.create(req.body, req)
      return res.json({ success: true, message: '角色创建成功', data: role })
    } catch (error) {
      this.logger.error('创建角色失败:', error)
      return res.status(error.statusCode || 500).json({ success: false, message: '创建角色失败: ' + error.message })
    }
  }

  async update(req, res) {
    try {
      const role = await this.service.update(req.params.id, req.body, req)
      return res.json({ success: true, message: '角色更新成功', data: role })
    } catch (error) {
      this.logger.error('更新角色失败:', error)
      return res.status(error.statusCode || 500).json({ success: false, message: '更新角色失败: ' + error.message })
    }
  }

  async remove(req, res) {
    try {
      await this.service.remove(req.params.id, req)
      return res.json({ success: true, message: '角色删除成功' })
    } catch (error) {
      this.logger.error('删除角色失败:', error)
      return res.status(error.statusCode || 500).json({ success: false, message: '删除角色失败: ' + error.message })
    }
  }

  async updateStatus(req, res) {
    try {
      const result = await this.service.updateStatus(req.params.id, req.body, req)
      return res.json({
        success: true,
        message: `角色${result.action}成功`,
        data: { affected_users: result.affected_users }
      })
    } catch (error) {
      this.logger.error('更新角色状态失败:', error)
      return res.status(error.statusCode || 500).json({ success: false, message: '更新角色状态失败: ' + error.message })
    }
  }
}

module.exports = PermissionRoleManagementController
