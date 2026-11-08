'use strict'

const SubsidyPhoneSearchService = require('../services/subsidy-phone-search.service')
const log = require('../utils/log')

const createRouteTimer = (req) => {
  const routeStart = process.hrtime.bigint()
  let lastMark = routeStart
  return (label, extra = {}) => {
    const now = process.hrtime.bigint()
    const stepMs = Number(now - lastMark) / 1e6
    const totalMs = Number(now - routeStart) / 1e6
    lastMark = now
    log.info(`⏱️ [GET /subsidy/search-phones/:identifier] ${label}`, {
      stepMs: stepMs.toFixed(2),
      totalMs: totalMs.toFixed(2),
      method: req.method,
      path: req.originalUrl,
      ...extra
    })
  }
}

class SubsidyPhoneSearchController {
  constructor({ service = new SubsidyPhoneSearchService(), logger = log } = {}) {
    this.service = service
    this.logger = logger
  }

  async search(req, res) {
    const mark = createRouteTimer(req)
    try {
      const identifier = req.params.identifier
      if (!identifier || identifier.trim().length === 0) {
        return res.status(400).json({ success: false, message: '请输入IMEI或序列号' })
      }

      mark('search params prepared', { keywordLength: identifier.trim().length })
      const deviceList = await this.service.search(identifier, mark)
      if (deviceList.length === 0) {
        return res.status(404).json({ success: false, message: '未找到匹配的设备' })
      }

      res.json({
        success: true,
        message: `找到 ${deviceList.length} 个匹配设备`,
        data: deviceList
      })
      mark('response sent', { resultCount: deviceList.length })
    } catch (error) {
      mark('request failed', { error: error.message })
      this.logger.error('❌ 搜索设备失败:', error)
      return res.status(500).json({
        success: false,
        message: '搜索失败',
        error: error.message
      })
    }
  }
}

module.exports = SubsidyPhoneSearchController
