'use strict'

const ApiResponse = require('../utils/response')
const log = require('../utils/log')
const BrandSettingsService = require('../services/brand-settings.service')

class BrandSettingsController {
  constructor({ service = new BrandSettingsService(), response = ApiResponse, logger = log } = {}) {
    this.service = service
    this.response = response
    this.logger = logger
  }

  async getCurrent(_req, res) {
    try {
      if (!this.service.isConnected()) {
        return this.response.error(res, '数据库未连接', 503)
      }

      try {
        const settings = await this.service.getCurrent()
        return settings
          ? this.response.success(res, settings)
          : this.response.notFound(res, '品牌设置尚未配置')
      } catch (error) {
        this.logger.warn('获取品牌设置失败:', error.message)
        return this.response.error(res, '品牌设置读取失败', 500)
      }
    } catch (error) {
      this.logger.error('获取品牌设置失败:', error)
      return this.response.error(res, '获取品牌设置失败', 500)
    }
  }

  async saveCurrent(req, res) {
    try {
      if (!this.service.isConnected()) {
        return this.response.error(res, '数据库未连接', 500)
      }

      const {
        logoUrl,
        systemName,
        systemShortName,
        loginTitle,
        loginSubtitle,
        loginBackgroundUrl,
        primaryColor,
        accentColor
      } = req.body

      await this.service.saveCurrent({
        logoUrl,
        systemName,
        systemShortName,
        loginTitle,
        loginSubtitle,
        loginBackgroundUrl,
        primaryColor,
        accentColor
      })
      return this.response.success(res, null, '品牌设置保存成功')
    } catch (error) {
      this.logger.error('保存品牌设置失败:', error)
      return this.response.error(res, '品牌设置保存失败，请检查数据库结构', 500)
    }
  }
}

module.exports = BrandSettingsController
