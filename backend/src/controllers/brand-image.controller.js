'use strict'

const ApiResponse = require('../utils/response')
const log = require('../utils/log')
const BrandImageService = require('../services/brand-image.service')

class BrandImageController {
  constructor({ service = new BrandImageService(), response = ApiResponse, logger = log } = {}) {
    this.service = service
    this.response = response
    this.logger = logger
  }

  async cleanup(_req, res) {
    try {
      if (!this.service.isConnected()) {
        return this.response.error(res, '数据库未连接', 500)
      }

      const result = await this.service.cleanupUnreferencedFiles()
      return this.response.success(res, result)
    } catch (error) {
      this.logger.error('清理品牌图片失败:', error)
      return this.response.error(res, '清理失败', 500)
    }
  }

  async upload(req, res) {
    if (!req.file) return this.response.error(res, '没有上传文件', 400)

    try {
      const result = await this.service.upload(req.file)
      return this.response.success(res, result, '图片上传成功')
    } catch (error) {
      if (error.statusCode === 400) return this.response.error(res, error.message, 400)
      if (error.message === '数据库未连接') return this.response.error(res, error.message, 500)
      this.logger.error('上传图片失败:', error)
      return this.response.error(res, '图片上传失败', 500)
    }
  }

  async getInfo(_req, res) {
    try {
      if (!this.service.isConnected()) {
        return this.response.error(res, '数据库未连接', 500)
      }

      const result = await this.service.getManagementInfo()
      return this.response.success(res, result)
    } catch (error) {
      this.logger.error('获取品牌图片信息失败:', error)
      return this.response.error(res, '获取信息失败', 500)
    }
  }
}

module.exports = BrandImageController
