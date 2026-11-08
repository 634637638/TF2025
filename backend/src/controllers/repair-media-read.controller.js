'use strict'

const ApiResponse = require('../utils/response')
const log = require('../utils/log')

class RepairMediaReadController {
  constructor({ service, response = ApiResponse, logger = log } = {}) {
    if (!service) throw new TypeError('RepairMediaReadController requires service')
    this.service = service
    this.response = response
    this.logger = logger
  }

  async read(req, res) {
    try {
      const absolutePath = this.service.resolve(req.params[0], req.query)
      res.setHeader('Cache-Control', 'private, no-store')
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
      return res.sendFile(absolutePath, { acceptRanges: true })
    } catch (error) {
      if (error.statusCode === 403) return this.response.error(res, error.message, 403)
      if (error.statusCode === 400) return res.status(400).json({ success: false, message: error.message })
      if (error.statusCode === 404) return res.status(404).json({ success: false, message: error.message })
      this.logger.error('读取维修媒体失败:', error)
      return this.response.serverError(res, '读取维修媒体失败', error)
    }
  }
}

module.exports = RepairMediaReadController
