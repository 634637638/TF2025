'use strict'

const { searchCustomers: searchCustomerOptions } = require('../services/customer-search.service')
const log = require('../utils/log')

class SalesCustomerSearchController {
  constructor({ searchCustomers = searchCustomerOptions, logger = log } = {}) {
    if (typeof searchCustomers !== 'function') throw new TypeError('SalesCustomerSearchController requires searchCustomers')
    this.searchCustomers = searchCustomers
    this.logger = logger
  }

  async search(req, res) {
    try {
      const { search } = req.query
      if (!search || search.length < 2) {
        return res.json({
          success: true,
          message: '获取客户列表成功',
          data: []
        })
      }

      const result = await this.searchCustomers({
        keyword: search,
        page: req.query.page,
        page_size: req.query.page_size,
        fields: ['id', 'name', 'phone', 'apple_id', 'member_number', 'vip_level', 'created_at'],
        search_fields: /^\d+$/.test(search) ? ['phone'] : ['name'],
        order_by: 'created_at'
      })

      return res.json({
        success: true,
        message: '搜索客户成功',
        data: result.records,
        pagination: result.pagination
      })
    } catch (error) {
      this.logger.error('❌ 搜索客户失败:', error)
      return res.status(500).json({
        success: false,
        message: '搜索客户失败',
        error: error.message
      })
    }
  }
}

module.exports = SalesCustomerSearchController
