const PhoneOptionService = require('../services/phone-option.service')
const ApiResponse = require('../utils/response')
const log = require('../utils/log')
const { isConnected } = require('../config/database')

class PhoneOptionController {
  constructor({ service = new PhoneOptionService(), checkDatabaseConnection = isConnected } = {}) {
    this.service = service
    this.checkDatabaseConnection = checkDatabaseConnection
  }

  async getPhoneOptions(_req, res) {
    try {
      if (!this.checkDatabaseConnection()) {
        return ApiResponse.error(res, '数据库未连接', 500)
      }

      const options = await this.service.getPhoneOptions()
      return ApiResponse.success(res, options, '获取手机选项成功')
    } catch (error) {
      log.error('获取手机选项失败:', error)
      return ApiResponse.error(res, '获取手机选项失败', 500)
    }
  }
}

module.exports = PhoneOptionController
