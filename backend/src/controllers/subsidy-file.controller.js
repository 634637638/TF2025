'use strict'

const log = require('../utils/log')
const SubsidyFileService = require('../services/subsidy-file.service')

class SubsidyFileController {
  constructor({ service = new SubsidyFileService(), logger = log } = {}) {
    this.service = service
    this.logger = logger
  }

  getFile(req, res) {
    try {
      const requestedPath = typeof req.params[0] === 'string' ? req.params[0] : ''
      const absolutePath = this.service.getFilePath(requestedPath)

      res.setHeader('Cache-Control', 'private, max-age=300, must-revalidate')
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
      return res.sendFile(absolutePath)
    } catch (error) {
      if (error.statusCode === 400 || error.statusCode === 403 || error.statusCode === 404) {
        return res.status(error.statusCode).json({ success: false, message: error.message })
      }

      this.logger.error('读取国补照片失败:', error)
      return res.status(500).json({
        success: false,
        message: error.message || '读取照片失败'
      })
    }
  }
}

module.exports = SubsidyFileController
