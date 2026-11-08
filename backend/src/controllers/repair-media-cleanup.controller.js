'use strict'

const ApiResponse = require('../utils/response')
const log = require('../utils/log')

class RepairMediaCleanupController {
  constructor({ service, response = ApiResponse, logger = log } = {}) {
    if (!service) throw new TypeError('RepairMediaCleanupController requires service')
    this.service = service
    this.response = response
    this.logger = logger
  }

  async cleanup(req, res) {
    try {
      await this.service.cleanup(req.body?.files, req.user.id)
      return this.response.success(res, null, '未保存维修媒体已清理')
    } catch (error) {
      if (error.code === 'REPAIR_MEDIA_OWNER_REQUIRED') {
        return res.status(403).json({ success: false, message: error.message, code: error.code })
      }
      this.logger.error('清理维修临时媒体失败:', error)
      return this.response.serverError(res, '清理维修临时媒体失败', error)
    }
  }
}

module.exports = RepairMediaCleanupController
