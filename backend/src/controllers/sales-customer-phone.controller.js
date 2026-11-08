'use strict'

const SalesCustomerPhoneService = require('../services/sales-customer-phone.service')
const log = require('../utils/log')

class SalesCustomerPhoneController {
  constructor({ service = new SalesCustomerPhoneService(), logger = log } = {}) {
    if (!service || typeof service.find !== 'function') throw new TypeError('SalesCustomerPhoneController requires a customer phone service')
    this.service = service
    this.logger = logger
  }

  async find(req, res) {
    try {
      const result = await this.service.find(req.params.phone)
      if (!result.valid) {
        return res.json({
          success: false,
          message: '手机号格式不正确',
          data: null
        })
      }

      const customer = result.customer
      if (!customer) {
        return res.json({ success: true, message: '未找到客户', data: null })
      }

      return res.json({
        success: true,
        message: '找到客户',
        data: {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          apple_id: customer.apple_id,
          created_at: customer.created_at
        }
      })
    } catch (error) {
      this.logger.error('❌ 查找客户失败:', error)
      return res.status(500).json({
        success: false,
        message: '查找客户失败',
        error: error.message
      })
    }
  }
}

module.exports = SalesCustomerPhoneController
