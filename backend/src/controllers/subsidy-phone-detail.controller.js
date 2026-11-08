'use strict'

const SubsidyPhoneDetailService = require('../services/subsidy-phone-detail.service')
const log = require('../utils/log')

class SubsidyPhoneDetailController {
  constructor({ service = new SubsidyPhoneDetailService(), logger = log } = {}) {
    this.service = service
    this.logger = logger
  }

  async getByPhoneId(req, res) {
    const { phoneId } = req.params
    if (!phoneId || Number.isNaN(Number(phoneId))) {
      return res.status(400).json({ success: false, message: '设备ID无效' })
    }

    try {
      const detail = await this.service.getByPhoneId(phoneId)
      if (!detail) {
        return res.status(404).json({ success: false, message: '仅已销售设备可申请国补' })
      }
      if (detail.requires_sale) {
        return res.json({ success: true, message: '设备未销售，无法申请国补', data: detail })
      }
      return res.json({ success: true, message: '获取详情成功', data: detail })
    } catch (error) {
      this.logger.error('❌ 获取设备详情失败:', error)
      return res.status(500).json({ success: false, message: '获取详情失败', error: error.message })
    }
  }
}

module.exports = SubsidyPhoneDetailController
