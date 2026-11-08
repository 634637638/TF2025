'use strict'

const DevTempService = require('../services/dev-temp.service')
const log = require('../utils/log')

class DevTempController {
  constructor(service = new DevTempService()) {
    this.service = service
  }

  async makeAdmin(req, res) {
    try {
      const { username } = req.body
      if (!username) {
        return res.status(400).json({ success: false, message: '请提供用户名' })
      }

      await this.service.makeAdmin(username)
      return res.json({
        success: true,
        message: `用户 ${username} 已设置为管理员，请重新登录`
      })
    } catch (error) {
      log.error('开发临时接口设置管理员失败:', error)
      return res.status(500).json({ success: false, message: '设置失败' })
    }
  }

  async migrateHomeSections(_req, res) {
    try {
      const sections = await this.service.migrateHomeSections()
      return res.json({
        success: true,
        message: '首页推荐表创建成功',
        data: { sections, count: sections.length }
      })
    } catch (error) {
      log.error('开发临时接口迁移首页推荐失败:', error)
      return res.status(500).json({ success: false, message: '迁移失败' })
    }
  }
}

module.exports = DevTempController
