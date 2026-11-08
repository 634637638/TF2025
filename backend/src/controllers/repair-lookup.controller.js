'use strict'

const ApiResponse = require('../utils/response')
const log = require('../utils/log')

class RepairLookupController {
  constructor({ service, response = ApiResponse, logger = log } = {}) {
    if (!service) throw new TypeError('RepairLookupController requires service')
    this.service = service
    this.response = response
    this.logger = logger
  }

  async options(req, res) {
    try {
      return this.response.success(res, await this.service.getOptions(req), '获取维修选项成功')
    } catch (error) {
      this.logger.error('获取维修选项失败:', error)
      return this.response.serverError(res, '获取维修选项失败', error)
    }
  }

  async searchCustomers(req, res) {
    try {
      const result = await this.service.searchCustomersForRepair(req)
      return this.response.success(res, result.data, result.message)
    } catch (error) {
      if (error.statusCode === 403) {
        return res.status(403).json({ success: false, message: error.message, code: error.code })
      }
      this.logger.error('维修客户检索失败:', error)
      return this.response.serverError(res, '客户检索失败', error)
    }
  }

  async searchDevices(req, res) {
    try {
      const result = await this.service.searchDevicesForRepair(req)
      return this.response.success(res, result.data, result.message)
    } catch (error) {
      this.logger.error('检索维修设备失败:', error)
      return this.response.serverError(res, '检索维修设备失败', error)
    }
  }
}

module.exports = RepairLookupController
