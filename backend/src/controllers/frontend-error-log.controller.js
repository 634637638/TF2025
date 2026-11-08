'use strict'

const FrontendErrorLogService = require('../services/frontend-error-log.service')
const log = require('../utils/log')

class FrontendErrorLogController {
  constructor({ service = new FrontendErrorLogService() } = {}) {
    this.service = service
  }

  async report(req, res) {
    try {
      const userId = Number(req.user?.id)
      if (!Number.isInteger(userId) || userId <= 0) {
        return res.status(401).json({ success: false, message: '登录状态无效' })
      }

      const report = await this.service.submitReport(req.body, userId)
      if (report.error) {
        return res.status(report.error.status).json({
          success: false,
          message: report.error.message
        })
      }

      return res.json({
        success: true,
        message: '错误日志上报成功',
        data: { accepted: report.accepted }
      })
    } catch (error) {
      log.error('前端错误日志上报失败:', error)
      return res.status(500).json({ success: false, message: '错误日志上报失败' })
    }
  }
}

module.exports = FrontendErrorLogController
