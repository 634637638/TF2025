'use strict'

const ApiResponse = require('../utils/response')
const log = require('../utils/log')

class RepairMediaUploadController {
  constructor({ service, uploadParser, response = ApiResponse, logger = log } = {}) {
    if (!service) throw new TypeError('RepairMediaUploadController requires service')
    if (typeof uploadParser !== 'function') throw new TypeError('RepairMediaUploadController requires uploadParser')
    this.service = service
    this.uploadParser = uploadParser
    this.response = response
    this.logger = logger
  }

  parseUpload(req, res, next) {
    this.uploadParser(req, res, async error => {
      if (!error) return next()
      try {
        await this.service.removeUploadedFiles(req.files)
      } catch (cleanupError) {
        this.logger.warn('清理维修媒体临时文件失败:', cleanupError)
      }
      return this.response.error(res, error.message || '媒体上传失败', error.status || 400)
    })
  }

  async upload(req, res) {
    try {
      const data = await this.service.upload(req.files, req.user.id)
      return this.response.success(res, data, '媒体上传成功')
    } catch (error) {
      if (error.code === 'BAD_REQUEST') return this.response.badRequest(res, error.message)
      await this.service.removeUploadedFiles(req.files).catch(() => {})
      this.logger.error('上传维修媒体失败:', error)
      return this.response.serverError(res, '媒体上传失败', error)
    }
  }
}

module.exports = RepairMediaUploadController
