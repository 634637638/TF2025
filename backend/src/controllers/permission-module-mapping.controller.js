'use strict'

const log = require('../utils/log')
const PermissionModuleMappingService = require('../services/permission-module-mapping.service')

class PermissionModuleMappingController {
  constructor({ service = new PermissionModuleMappingService(), logger = log } = {}) {
    this.service = service
    this.logger = logger
  }

  async list(_req, res) {
    try {
      const modules = await this.service.list()
      return res.json({ success: true, message: '获取模块映射列表成功', data: modules })
    } catch (error) {
      this.logger.error('获取模块映射列表失败:', error)
      return res.status(500).json({
        success: false,
        message: '获取模块映射列表失败: ' + error.message,
        data: []
      })
    }
  }
}

module.exports = PermissionModuleMappingController
