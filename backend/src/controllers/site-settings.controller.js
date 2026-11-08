'use strict'

const ApiResponse = require('../utils/response')
const log = require('../utils/log')
const SiteSettingsService = require('../services/site-settings.service')

class SiteSettingsController {
  constructor({ service = new SiteSettingsService(), response = ApiResponse, logger = log } = {}) {
    this.service = service
    this.response = response
    this.logger = logger
  }

  async getPublic(_req, res) {
    try {
      if (!this.service.isConnected()) {
        this.logger.warn('数据库未连接，无法读取站点信息设置')
        return this.response.error(res, '数据库未连接', 503)
      }
      return this.response.success(res, await this.service.getPublicSettings())
    } catch (error) {
      this.logger.warn('获取站点信息设置失败:', error.message)
      return this.response.error(res, '获取站点信息设置失败', 500)
    }
  }

  async getAdmin(_req, res) {
    try {
      if (!this.service.isConnected()) return this.response.error(res, '数据库未连接', 503)
      return this.response.success(res, await this.service.getSettings())
    } catch (error) {
      this.logger.warn('读取完整站点设置失败:', error.message)
      return this.response.error(res, '读取完整站点设置失败', 500)
    }
  }

  async save(req, res) {
    try {
      if (!this.service.isConnected()) return this.response.error(res, '数据库未连接', 500)
      const result = await this.service.saveSettings(req.body)
      const message = result.unsupportedFields.length > 0
        ? `站点信息已保存，但以下字段当前未写入数据库：${result.unsupportedFields.join('、')}`
        : '站点信息设置保存成功'
      return this.response.success(res, result, message)
    } catch (error) {
      if (error.code === 'SITE_SETTINGS_SCHEMA_UNSUPPORTED') {
        return this.response.error(res, error.message, 500)
      }
      this.logger.error('保存站点信息设置到数据库失败:', error)
      return this.response.error(res, `站点信息设置保存失败: ${error.message}`, 500)
    }
  }
}

module.exports = SiteSettingsController
